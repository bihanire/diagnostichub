import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.ops import router as ops_router
from app.api.routes.search import router as search_router
from app.api.routes.system import router as system_router
from app.api.routes.telemetry import router as telemetry_router
from app.core.config import get_settings
from app.core.database import Base, get_db
from app.db.seed import seed_session
from app.middleware.request_context import RequestContextMiddleware
from app.services.data_integrity_service import validate_data_integrity
from app.services.telemetry_service import get_telemetry_collector


class TelemetryAndIntegrityTests(unittest.TestCase):
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

    @classmethod
    def tearDownClass(cls) -> None:
        for key, value in cls.original_settings.items():
            setattr(cls.settings, key, value)
        cls.engine.dispose()

    def setUp(self) -> None:
        get_telemetry_collector.cache_clear()

        self.app = FastAPI()
        self.app.add_middleware(RequestContextMiddleware)
        self.app.include_router(ops_router)
        self.app.include_router(search_router)
        self.app.include_router(system_router)
        self.app.include_router(telemetry_router)

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        self.app.dependency_overrides[get_db] = override_get_db

    def test_data_integrity_report_has_no_errors_for_seed_pack(self) -> None:
        with self.SessionLocal() as db:
            report = validate_data_integrity(db)

        self.assertEqual(report.error_count, 0)
        self.assertGreaterEqual(report.validated_procedures, 16)
        self.assertGreater(report.validated_nodes, 0)

    def test_telemetry_summary_requires_ops_session(self) -> None:
        with TestClient(self.app) as client:
            response = client.get("/ops/telemetry/summary")

        self.assertEqual(response.status_code, 401)

    def test_telemetry_tracks_http_and_semantic_search_signals(self) -> None:
        with TestClient(self.app) as client:
            login_response = client.post("/ops/login", json={"password": "ops-password"})
            self.assertEqual(login_response.status_code, 200)

            search_response = client.post(
                "/search",
                json={"query": "phone not charging when i insert a charger"},
            )
            self.assertEqual(search_response.status_code, 200)
            payload = search_response.json()
            self.assertIn("semantic_insight", payload)
            self.assertIn("ambiguity_risk", payload["semantic_insight"])

            telemetry_response = client.get("/ops/telemetry/summary")
            self.assertEqual(telemetry_response.status_code, 200)
            telemetry_payload = telemetry_response.json()

        self.assertGreaterEqual(telemetry_payload["total_http_requests"], 2)
        self.assertGreaterEqual(telemetry_payload["search"]["total_searches"], 1)
        self.assertGreaterEqual(telemetry_payload["interaction"]["total_events"], 0)
        self.assertIn(
            payload["structured_intent"]["issue_type"],
            telemetry_payload["search"]["top_issue_types"],
        )
        self.assertIn(payload["confidence_state"], telemetry_payload["search"]["confidence_states"])
        self.assertTrue(
            any(
                endpoint["path"] == "/search" and endpoint["method"] == "POST"
                for endpoint in telemetry_payload["endpoints"]
            )
        )
        search_endpoint = next(
            endpoint
            for endpoint in telemetry_payload["endpoints"]
            if endpoint["path"] == "/search" and endpoint["method"] == "POST"
        )
        self.assertIn("error_rate", search_endpoint)
        self.assertIn("failure_categories", search_endpoint)
        self.assertGreaterEqual(telemetry_payload["search"]["diagnostic_success_count"], 0)
        self.assertIn("no_match_rate", telemetry_payload["search"])
        self.assertTrue(
            any(slo["name"] == "search_response" for slo in telemetry_payload["slos"])
        )

    def test_telemetry_tracks_failure_categories_and_probe_events(self) -> None:
        with TestClient(self.app) as client:
            missing_response = client.get("/missing-route")
            self.assertEqual(missing_response.status_code, 404)

            with patch("app.api.routes.system.database_is_ready", return_value=True):
                health_response = client.get("/health")
            self.assertEqual(health_response.status_code, 200)

            login_response = client.post("/ops/login", json={"password": "ops-password"})
            self.assertEqual(login_response.status_code, 200)

            telemetry_response = client.get("/ops/telemetry/summary")
            self.assertEqual(telemetry_response.status_code, 200)
            telemetry_payload = telemetry_response.json()

        not_found_endpoint = next(
            endpoint for endpoint in telemetry_payload["endpoints"] if endpoint["path"] == "/missing-route"
        )
        self.assertEqual(not_found_endpoint["failure_categories"].get("not_found"), 1)
        self.assertTrue(
            any(event["event"] == "health_probe" for event in telemetry_payload["recent_events"])
        )
        health_slo = next(slo for slo in telemetry_payload["slos"] if slo["name"] == "health_liveness")
        self.assertGreaterEqual(health_slo["total_requests"], 1)

    def test_public_interaction_telemetry_records_events_for_ops_review(self) -> None:
        with TestClient(self.app) as client:
            interaction_response = client.post(
                "/telemetry/interaction",
                json={
                    "event": "confidence_gate_shown",
                    "status": "info",
                    "metadata": {"issue_type": "Power & Thermal"},
                },
            )
            self.assertEqual(interaction_response.status_code, 200)
            self.assertEqual(interaction_response.json()["accepted"], True)

            login_response = client.post("/ops/login", json={"password": "ops-password"})
            self.assertEqual(login_response.status_code, 200)

            telemetry_response = client.get("/ops/telemetry/summary")
            self.assertEqual(telemetry_response.status_code, 200)
            telemetry_payload = telemetry_response.json()

        self.assertGreaterEqual(telemetry_payload["interaction"]["total_events"], 1)
        self.assertEqual(
            telemetry_payload["interaction"]["event_counts"].get("confidence_gate_shown"),
            1,
        )

    def test_search_accepts_output_mode_hint_without_breaking_response_contract(self) -> None:
        with TestClient(self.app) as client:
            response = client.post(
                "/search",
                json={
                    "query": "phone not charging when i insert a charger",
                    "output_mode": "sop_action",
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("best_match", payload)
        self.assertIn("confidence_state", payload)
