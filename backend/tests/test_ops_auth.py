import unittest
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.feedback import router as feedback_router
from app.api.routes.ops import router as ops_router
from app.api.routes.ticket_draft import router as ticket_draft_router
from app.core.config import get_settings
from app.core.database import Base, get_db
from app.db.seed import seed_session
from app.services.ops_auth_service import (
    create_ops_session_token,
    read_ops_session_token,
    validate_ops_auth_settings,
)


def _build_ticket_preview_payload(**overrides):
    payload = {
        "id": "case-4-1778666400000",
        "schemaVersion": "diagnostichub.case_packet.v1",
        "source": "diagnostic_hub",
        "eventName": "diagnostic.case.completed",
        "createdAt": "2026-05-13T10:00:00.000Z",
        "idempotencyKey": "diagnostichub:4:1778666400000",
        "privacyClassification": "contains_customer_free_text",
        "query": "moisture warning when charging",
        "family": {
            "id": "power",
            "title": "Power & Thermal",
            "trackTitle": "Charging safety",
        },
        "procedure": {
            "id": 4,
            "title": "Charging Issue",
            "category": "Power & Thermal",
            "description": "Use this for charging issues.",
            "outcome": "Charging path complete.",
            "warranty_status": "Inspection required.",
        },
        "answers": [],
        "diagnosis": "Charging path needs review.",
        "recommendation": "Do not keep charging at the branch.",
        "decisionLabel": "Book repair intake",
        "warrantyDirection": "Needs inspection",
        "evidenceChecklist": ["Record moisture warning."],
        "dispatchGateConfirmed": [],
        "feedbackStatus": "not_saved",
        "ticketReadiness": "ready_for_ticket_draft",
        "evidenceState": "pending",
        "deliveryReadiness": "blocked_missing_evidence",
        "watuDecision": {
            "decisionLabel": "Book repair intake",
            "warrantyDirection": "Needs inspection",
            "ticketReadiness": "ready_for_ticket_draft",
        },
        "knowledgeSourceIds": ["device-moisture-port", "watu-sop-pack"],
    }
    payload.update(overrides)
    return payload


class OpsAuthRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_engine(
            "sqlite://",
            future=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(cls.engine, "connect")
        def set_sqlite_pragma(dbapi_connection, _) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        cls.SessionLocal = sessionmaker(
            bind=cls.engine,
            autoflush=False,
            autocommit=False,
            future=True,
        )
        Base.metadata.create_all(bind=cls.engine)

        with cls.SessionLocal() as db:
            seed_session(db)
            db.commit()

        cls.settings = get_settings()
        cls.original_settings = {
            "ops_auth_enabled": cls.settings.ops_auth_enabled,
            "ops_shared_password": cls.settings.ops_shared_password,
            "ops_session_secret": cls.settings.ops_session_secret,
            "ops_session_ttl_hours": cls.settings.ops_session_ttl_hours,
            "ops_cookie_name": cls.settings.ops_cookie_name,
            "ops_cookie_secure": cls.settings.ops_cookie_secure,
        }
        cls.settings.ops_auth_enabled = True
        cls.settings.ops_shared_password = "ops-password"
        cls.settings.ops_session_secret = "test-session-secret"
        cls.settings.ops_session_ttl_hours = 8
        cls.settings.ops_cookie_name = "rel_ops_session"
        cls.settings.ops_cookie_secure = False

        cls.app = FastAPI()
        cls.app.include_router(ops_router)
        cls.app.include_router(feedback_router)
        cls.app.include_router(ticket_draft_router)

        def override_get_db():
            db = cls.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        cls.app.dependency_overrides[get_db] = override_get_db

    @classmethod
    def tearDownClass(cls) -> None:
        for key, value in cls.original_settings.items():
            setattr(cls.settings, key, value)
        cls.engine.dispose()

    def test_login_success_sets_cookie_and_allows_reporting(self) -> None:
        with TestClient(self.app) as client:
            login_response = client.post("/ops/login", json={"password": "ops-password"})

            self.assertEqual(login_response.status_code, 200)
            self.assertTrue(login_response.json()["authenticated"])
            self.assertIn(self.settings.ops_cookie_name, login_response.headers["set-cookie"])

            summary_response = client.get("/feedback/summary")
            self.assertEqual(summary_response.status_code, 200)
            self.assertIn("total_submissions", summary_response.json())

    def test_wrong_password_is_rejected(self) -> None:
        with TestClient(self.app) as client:
            response = client.post("/ops/login", json={"password": "wrong-password"})

        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.json()["authenticated"])
        self.assertEqual(
            response.json()["message"],
            "The password did not match. Please try again.",
        )

    def test_session_endpoint_reflects_current_auth_state(self) -> None:
        with TestClient(self.app) as client:
            before_login = client.get("/ops/session")
            login_response = client.post("/ops/login", json={"password": "ops-password"})
            after_login = client.get("/ops/session")

        self.assertEqual(before_login.status_code, 200)
        self.assertFalse(before_login.json()["authenticated"])
        self.assertEqual(login_response.status_code, 200)
        self.assertTrue(after_login.json()["authenticated"])
        self.assertIsNotNone(after_login.json()["expires_at"])

    def test_logout_clears_cookie_and_invalidates_reporting_access(self) -> None:
        with TestClient(self.app) as client:
            client.post("/ops/login", json={"password": "ops-password"})
            logout_response = client.post("/ops/logout")
            summary_response = client.get("/feedback/summary")

        self.assertEqual(logout_response.status_code, 200)
        self.assertFalse(logout_response.json()["authenticated"])
        self.assertEqual(summary_response.status_code, 401)

    def test_protected_feedback_routes_require_a_valid_ops_session(self) -> None:
        protected_paths = (
            "/feedback/summary",
            "/feedback/by-procedure",
            "/feedback/by-branch",
            "/feedback/export.csv",
        )

        with TestClient(self.app) as client:
            for path in protected_paths:
                response = client.get(path)
                self.assertEqual(response.status_code, 401, path)

            ticket_response = client.post(
                "/ops/ticket-draft/preview",
                json=_build_ticket_preview_payload(),
            )
            self.assertEqual(ticket_response.status_code, 401)

    def test_ticket_draft_preview_is_dry_run_and_requires_operator_ready_packet(self) -> None:
        with TestClient(self.app) as client:
            client.post("/ops/login", json={"password": "ops-password"})
            blocked_response = client.post(
                "/ops/ticket-draft/preview",
                json=_build_ticket_preview_payload(),
            )
            ready_payload = _build_ticket_preview_payload(
                evidenceState="complete",
                deliveryReadiness="ready_for_operator_review",
                dispatchGateConfirmed=["Record moisture warning."],
            )
            ready_response = client.post("/ops/ticket-draft/preview", json=ready_payload)

        self.assertEqual(blocked_response.status_code, 200)
        blocked_payload = blocked_response.json()
        self.assertTrue(blocked_payload["dry_run"])
        self.assertFalse(blocked_payload["delivery_enabled"])
        self.assertEqual(blocked_payload["draft_status"], "blocked")
        self.assertIsNone(blocked_payload["external_ticket_id"])
        self.assertIn("Evidence checklist is not complete.", blocked_payload["blockers"])

        self.assertEqual(ready_response.status_code, 200)
        ready_preview = ready_response.json()
        self.assertTrue(ready_preview["dry_run"])
        self.assertFalse(ready_preview["delivery_enabled"])
        self.assertEqual(ready_preview["draft_status"], "ready_for_operator_review")
        self.assertEqual(ready_preview["ticket_fields"]["external_reference"], "diagnostichub:4:1778666400000")
        self.assertIsNone(ready_preview["external_ticket_id"])

    def test_feedback_submission_stays_open_without_ops_login(self) -> None:
        with TestClient(self.app) as client:
            response = client.post(
                "/feedback",
                json={
                    "helpful": True,
                    "procedure_id": 1,
                    "branch_label": "Makerere",
                    "comment": "Still open for branch feedback.",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "Thanks. Your feedback has been saved.")

    def test_tampered_cookie_is_rejected(self) -> None:
        with TestClient(self.app) as seeded_client:
            login_response = seeded_client.post("/ops/login", json={"password": "ops-password"})

        valid_cookie_header = login_response.headers["set-cookie"]
        valid_token = valid_cookie_header.split(";", maxsplit=1)[0].split("=", maxsplit=1)[1]
        payload_segment, signature_segment = valid_token.split(".", maxsplit=1)
        tampered_signature = (
            f"a{signature_segment[1:]}" if not signature_segment.startswith("a") else f"b{signature_segment[1:]}"
        )
        tampered_token = f"{payload_segment}.{tampered_signature}"

        with TestClient(self.app) as client:
            response = client.get(
                "/feedback/summary",
                headers={"Cookie": f"{self.settings.ops_cookie_name}={tampered_token}"},
            )

        self.assertEqual(response.status_code, 401)

    def test_expired_cookie_is_rejected(self) -> None:
        expired_token, _ = create_ops_session_token(
            self.settings,
            issued_at=datetime.now(timezone.utc) - timedelta(hours=1),
            ttl_seconds=1,
        )

        self.assertIsNone(
            read_ops_session_token(
                expired_token,
                settings=self.settings,
                now=datetime.now(timezone.utc),
            )
        )

        with TestClient(self.app) as client:
            client.cookies.set(self.settings.ops_cookie_name, expired_token)
            response = client.get("/feedback/summary")

        self.assertEqual(response.status_code, 401)

    def test_enabled_ops_auth_requires_password_and_secret(self) -> None:
        original_password = self.settings.ops_shared_password
        original_secret = self.settings.ops_session_secret
        try:
            self.settings.ops_shared_password = None
            self.settings.ops_session_secret = None
            with self.assertRaises(RuntimeError):
                validate_ops_auth_settings(self.settings)
        finally:
            self.settings.ops_shared_password = original_password
            self.settings.ops_session_secret = original_secret
