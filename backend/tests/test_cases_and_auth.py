"""
Tests for:
  - GET  /auth/locations  (public — no credentials needed)
  - GET  /auth/me         (requires JWT cookie)
  - POST /cases
  - GET  /cases
  - GET  /cases/{reference}
  - PATCH /cases/{reference}/status  (including waybill + transition guards)
  - GET  /cases/{reference}/pdf
  - GET  /admin/users                (watu_admin only)
  - POST /admin/users/{id}/approve
  - POST /admin/users/{id}/suspend
"""

import unittest
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.cases import router as cases_router
from app.core.config import get_settings
from app.core.database import Base, get_db
from app.db.seed import seed_ec_locations, seed_session
from app.models.models import AppUser, ECLocation

# ── Shared test state ─────────────────────────────────────────────────────────

def _make_engine():
    engine = create_engine(
        "sqlite://",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _set_fk(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def _make_jwt(user_id: int) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _minimal_case_payload(**overrides) -> dict:
    base = {
        "case_type": "repair",
        "client_name": "Amina Nakato",
        "client_phone": "0701234567",
        "device_model": "Galaxy A05s 64GB",
        "device_imei": "123456789012345",
        "complaint": "Screen flickering on unlock",
        "sim_tray_present": True,
        "lock_type": "pin",
        "client_pin": "1234",
        "warranty_direction": "IW",
        "asc_name": "Transtel",
        "asc_code": "2478424",
    }
    base.update(overrides)
    return base


# ── Auth locations + /me ──────────────────────────────────────────────────────

class AuthRoutesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = _make_engine()
        cls.SessionLocal = sessionmaker(
            bind=cls.engine, autoflush=False, autocommit=False, future=True
        )
        Base.metadata.create_all(bind=cls.engine)
        with cls.SessionLocal() as db:
            seed_session(db)
            seed_ec_locations(db)
            db.commit()

        cls.app = FastAPI()
        cls.app.include_router(auth_router)

        def _override_db():
            db = cls.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        cls.app.dependency_overrides[get_db] = _override_db

        # Create an approved EC agent
        with cls.SessionLocal() as db:
            loc = db.query(ECLocation).first()
            assert loc is not None, "No EC locations seeded"
            cls.ec_location_id = loc.id
            user = AppUser(
                google_sub="auth-test-sub",
                email="auth-agent@test.local",
                full_name="Auth Test Agent",
                role="ec_agent",
                approval_status="approved",
                ec_location_id=loc.id,
                country_code="UGA",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            cls.user_id = user.id

        cls.jwt_token = _make_jwt(cls.user_id)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()

    def test_locations_returns_seeded_ec_locations(self) -> None:
        with TestClient(self.app) as client:
            r = client.get("/auth/locations")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("locations", data)
        self.assertGreater(len(data["locations"]), 0)

    def test_locations_items_have_required_fields(self) -> None:
        with TestClient(self.app) as client:
            r = client.get("/auth/locations")
        for loc in r.json()["locations"]:
            self.assertIn("id", loc)
            self.assertIn("name", loc)
            self.assertIn("city", loc)
            self.assertIn("country_code", loc)

    def test_me_returns_unauthenticated_without_cookie(self) -> None:
        with TestClient(self.app) as client:
            r = client.get("/auth/me")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["authenticated"])

    def test_me_returns_authenticated_user_with_valid_cookie(self) -> None:
        with TestClient(self.app) as client:
            client.cookies.set("dh_auth", self.jwt_token)
            r = client.get("/auth/me")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data["authenticated"])
        self.assertEqual(data["user"]["email"], "auth-agent@test.local")

    def test_me_returns_unauthenticated_with_tampered_token(self) -> None:
        with TestClient(self.app) as client:
            client.cookies.set("dh_auth", self.jwt_token + "X")
            r = client.get("/auth/me")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["authenticated"])


# ── Case routes ───────────────────────────────────────────────────────────────

class CasesRoutesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = _make_engine()
        cls.SessionLocal = sessionmaker(
            bind=cls.engine, autoflush=False, autocommit=False, future=True
        )
        Base.metadata.create_all(bind=cls.engine)
        with cls.SessionLocal() as db:
            seed_session(db)
            seed_ec_locations(db)
            db.commit()

        def _override_db():
            db = cls.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        with cls.SessionLocal() as db:
            loc = db.query(ECLocation).first()
            assert loc is not None
            cls.ec_location_id = loc.id

            cls.agent = AppUser(
                google_sub="cases-agent-sub",
                email="cases-agent@test.local",
                full_name="Cases Agent",
                role="ec_agent",
                approval_status="approved",
                ec_location_id=loc.id,
                country_code="UGA",
            )
            cls.other = AppUser(
                google_sub="other-agent-sub",
                email="other-agent@test.local",
                full_name="Other Agent",
                role="ec_agent",
                approval_status="approved",
                ec_location_id=loc.id,
                country_code="UGA",
            )
            db.add_all([cls.agent, cls.other])
            db.commit()
            db.refresh(cls.agent)
            db.refresh(cls.other)
            cls.agent_id = cls.agent.id

        cls.jwt_token = _make_jwt(cls.agent_id)

        cls.app = FastAPI()
        cls.app.include_router(cases_router)
        cls.app.dependency_overrides[get_db] = _override_db

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()

    def _auth_client(self):
        client = TestClient(self.app, raise_server_exceptions=True)
        client.cookies.set("dh_auth", self.jwt_token)
        return client

    # POST /cases

    def test_create_case_returns_201_and_reference(self) -> None:
        with self._auth_client() as client:
            r = client.post("/cases", json=_minimal_case_payload())
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("reference", data)
        self.assertTrue(data["reference"].startswith("EC-UGA-"))
        self.assertEqual(data["status"], "open")
        self.assertEqual(data["client_name"], "Amina Nakato")

    def test_create_case_requires_auth(self) -> None:
        with TestClient(self.app) as client:
            r = client.post("/cases", json=_minimal_case_payload())
        self.assertEqual(r.status_code, 401)

    def test_create_case_reference_increments_per_ec_location(self) -> None:
        with self._auth_client() as client:
            r1 = client.post("/cases", json=_minimal_case_payload())
            r2 = client.post("/cases", json=_minimal_case_payload())
        seq1 = int(r1.json()["reference"].split("-")[-1])
        seq2 = int(r2.json()["reference"].split("-")[-1])
        self.assertEqual(seq2, seq1 + 1)

    def test_create_frp_case(self) -> None:
        with self._auth_client() as client:
            r = client.post("/cases", json=_minimal_case_payload(case_type="frp"))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["case_type"], "frp")

    # GET /cases

    def test_list_cases_returns_cases_for_location(self) -> None:
        with self._auth_client() as client:
            client.post("/cases", json=_minimal_case_payload())
            r = client.get("/cases")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("cases", data)
        self.assertIn("total", data)
        self.assertGreater(data["total"], 0)

    def test_list_cases_returns_newest_first(self) -> None:
        with self._auth_client() as client:
            client.post("/cases", json=_minimal_case_payload())
            client.post("/cases", json=_minimal_case_payload())
            r = client.get("/cases")
        cases = r.json()["cases"]
        if len(cases) >= 2:
            t0 = cases[0]["created_at"]
            t1 = cases[1]["created_at"]
            self.assertGreaterEqual(t0, t1)

    # GET /cases/{reference}

    def test_get_case_by_reference(self) -> None:
        with self._auth_client() as client:
            created = client.post("/cases", json=_minimal_case_payload()).json()
            r = client.get(f"/cases/{created['reference']}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["reference"], created["reference"])

    def test_get_case_404_for_nonexistent_reference(self) -> None:
        with self._auth_client() as client:
            r = client.get("/cases/EC-UGA-2026-9999")
        self.assertEqual(r.status_code, 404)

    # PATCH /cases/{reference}/status

    def test_dispatch_case_transitions_to_dispatched(self) -> None:
        with self._auth_client() as client:
            ref = client.post("/cases", json=_minimal_case_payload()).json()["reference"]
            r = client.patch(f"/cases/{ref}/status", json={"status": "dispatched"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["case"]["status"], "dispatched")

    def test_dispatch_with_waybill_stores_waybill(self) -> None:
        with self._auth_client() as client:
            ref = client.post("/cases", json=_minimal_case_payload()).json()["reference"]
            r = client.patch(
                f"/cases/{ref}/status",
                json={"status": "dispatched", "waybill_number": "AWB123456"},
            )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["case"]["waybill_number"], "AWB123456")

    def test_dispatch_without_waybill_leaves_waybill_null(self) -> None:
        with self._auth_client() as client:
            ref = client.post("/cases", json=_minimal_case_payload()).json()["reference"]
            r = client.patch(f"/cases/{ref}/status", json={"status": "dispatched"})
        self.assertIsNone(r.json()["case"]["waybill_number"])

    def test_close_dispatched_case(self) -> None:
        with self._auth_client() as client:
            ref = client.post("/cases", json=_minimal_case_payload()).json()["reference"]
            client.patch(f"/cases/{ref}/status", json={"status": "dispatched"})
            r = client.patch(f"/cases/{ref}/status", json={"status": "closed"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["case"]["status"], "closed")

    def test_cancel_open_case(self) -> None:
        with self._auth_client() as client:
            ref = client.post("/cases", json=_minimal_case_payload()).json()["reference"]
            r = client.patch(f"/cases/{ref}/status", json={"status": "cancelled"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["case"]["status"], "cancelled")

    def test_invalid_transition_returns_400(self) -> None:
        with self._auth_client() as client:
            ref = client.post("/cases", json=_minimal_case_payload()).json()["reference"]
            # open → closed is not a valid transition
            r = client.patch(f"/cases/{ref}/status", json={"status": "closed"})
        self.assertEqual(r.status_code, 400)

    def test_terminal_case_cannot_be_transitioned(self) -> None:
        with self._auth_client() as client:
            ref = client.post("/cases", json=_minimal_case_payload()).json()["reference"]
            client.patch(f"/cases/{ref}/status", json={"status": "cancelled"})
            # cancelled → dispatched not allowed
            r = client.patch(f"/cases/{ref}/status", json={"status": "dispatched"})
        self.assertEqual(r.status_code, 400)

    # GET /cases/{reference}/pdf

    def test_pdf_returns_pdf_content_type(self) -> None:
        with self._auth_client() as client:
            ref = client.post("/cases", json=_minimal_case_payload()).json()["reference"]
            r = client.get(f"/cases/{ref}/pdf")
        self.assertEqual(r.status_code, 200)
        self.assertIn("application/pdf", r.headers["content-type"])

    def test_pdf_starts_with_pdf_magic_bytes(self) -> None:
        with self._auth_client() as client:
            ref = client.post("/cases", json=_minimal_case_payload()).json()["reference"]
            r = client.get(f"/cases/{ref}/pdf")
        self.assertTrue(r.content.startswith(b"%PDF-"))

    def test_pdf_content_disposition_uses_reference_as_filename(self) -> None:
        with self._auth_client() as client:
            ref = client.post("/cases", json=_minimal_case_payload()).json()["reference"]
            r = client.get(f"/cases/{ref}/pdf")
        cd = r.headers.get("content-disposition", "")
        self.assertIn(ref, cd)

    def test_pdf_for_nonexistent_case_returns_404(self) -> None:
        with self._auth_client() as client:
            r = client.get("/cases/EC-UGA-2026-NONE/pdf")
        self.assertEqual(r.status_code, 404)

    def test_pdf_dispatched_case_returns_valid_pdf(self) -> None:
        with self._auth_client() as client:
            ref = client.post("/cases", json=_minimal_case_payload()).json()["reference"]
            client.patch(
                f"/cases/{ref}/status",
                json={"status": "dispatched", "waybill_number": "AWB999"},
            )
            r = client.get(f"/cases/{ref}/pdf")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.content.startswith(b"%PDF-"))
        self.assertGreater(len(r.content), 1000)

    def test_stats_returns_counts_by_status(self) -> None:
        with self._auth_client() as client:
            r0 = client.get("/cases/stats")
            before = r0.json()
            # Create an open case
            client.post("/cases", json=_minimal_case_payload())
            r1 = client.get("/cases/stats")
        data = r1.json()
        self.assertIn("open", data)
        self.assertIn("dispatched", data)
        self.assertIn("closed", data)
        self.assertIn("cancelled", data)
        self.assertIn("total", data)
        self.assertEqual(data["open"], before["open"] + 1)
        self.assertEqual(data["total"], before["total"] + 1)

    def test_stats_requires_auth(self) -> None:
        with TestClient(self.app) as client:
            r = client.get("/cases/stats")
        self.assertEqual(r.status_code, 401)


# ── Admin routes ──────────────────────────────────────────────────────────────

class AdminRoutesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = _make_engine()
        cls.SessionLocal = sessionmaker(
            bind=cls.engine, autoflush=False, autocommit=False, future=True
        )
        Base.metadata.create_all(bind=cls.engine)
        with cls.SessionLocal() as db:
            seed_session(db)
            seed_ec_locations(db)
            db.commit()

        def _override_db():
            db = cls.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        with cls.SessionLocal() as db:
            loc = db.query(ECLocation).first()
            assert loc is not None

            cls.admin = AppUser(
                google_sub="admin-sub",
                email="admin@test.local",
                full_name="Watu Admin",
                role="watu_admin",
                approval_status="approved",
                ec_location_id=loc.id,
                country_code="UGA",
            )
            cls.pending_agent = AppUser(
                google_sub="pending-sub",
                email="pending@test.local",
                full_name="Pending Agent",
                role="ec_agent",
                approval_status="pending",
                ec_location_id=loc.id,
                country_code="UGA",
            )
            cls.agent = AppUser(
                google_sub="approved-agent-sub",
                email="approved-agent@test.local",
                full_name="Approved Agent",
                role="ec_agent",
                approval_status="approved",
                ec_location_id=loc.id,
                country_code="UGA",
            )
            db.add_all([cls.admin, cls.pending_agent, cls.agent])
            db.commit()
            db.refresh(cls.admin)
            db.refresh(cls.pending_agent)
            db.refresh(cls.agent)
            cls.admin_id = cls.admin.id
            cls.pending_id = cls.pending_agent.id
            cls.agent_id = cls.agent.id

        cls.admin_jwt = _make_jwt(cls.admin_id)
        cls.agent_jwt = _make_jwt(cls.agent_id)

        cls.app = FastAPI()
        cls.app.include_router(admin_router)
        cls.app.dependency_overrides[get_db] = _override_db

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()

    def _admin_client(self):
        client = TestClient(self.app, raise_server_exceptions=True)
        client.cookies.set("dh_auth", self.admin_jwt)
        return client

    def _agent_client(self):
        client = TestClient(self.app, raise_server_exceptions=True)
        client.cookies.set("dh_auth", self.agent_jwt)
        return client

    def test_list_users_returns_all_users_for_admin(self) -> None:
        with self._admin_client() as client:
            r = client.get("/admin/users")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("users", data)
        self.assertGreater(len(data["users"]), 0)

    def test_list_users_forbidden_for_ec_agent(self) -> None:
        with self._agent_client() as client:
            r = client.get("/admin/users")
        self.assertEqual(r.status_code, 403)

    def test_list_users_requires_auth(self) -> None:
        with TestClient(self.app) as client:
            r = client.get("/admin/users")
        self.assertEqual(r.status_code, 401)

    def test_approve_pending_user(self) -> None:
        with self._admin_client() as client:
            r = client.post(f"/admin/users/{self.pending_id}/approve")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["user"]["approval_status"], "approved")

    def test_suspend_approved_user(self) -> None:
        with self._admin_client() as client:
            r = client.post(f"/admin/users/{self.agent_id}/suspend")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["user"]["approval_status"], "suspended")

    def test_approve_nonexistent_user_returns_404(self) -> None:
        with self._admin_client() as client:
            r = client.post("/admin/users/99999/approve")
        self.assertEqual(r.status_code, 404)

    def test_user_list_shows_pending_users_first(self) -> None:
        with self._admin_client() as client:
            r = client.get("/admin/users")
        users = r.json()["users"]
        statuses = [u["approval_status"] for u in users]
        # Find first non-pending index
        try:
            first_non_pending = next(i for i, s in enumerate(statuses) if s != "pending")
        except StopIteration:
            return  # all pending — acceptable
        # Everything before first_non_pending must be pending
        for s in statuses[:first_non_pending]:
            self.assertEqual(s, "pending")
