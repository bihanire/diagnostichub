import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.system import router as system_router
from app.core.config import get_settings
from app.middleware.request_context import RequestContextMiddleware
from app.schemas.system import DataIntegrityReport, WorkflowValidationReport


class ReadyProbeRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = get_settings()
        self.original_settings = {
            "database_url": self.settings.database_url,
            "ops_auth_enabled": self.settings.ops_auth_enabled,
            "ops_shared_password": self.settings.ops_shared_password,
            "ops_session_secret": self.settings.ops_session_secret,
            "readiness_probe_enabled": self.settings.readiness_probe_enabled,
            "readiness_probe_timeout_ms": self.settings.readiness_probe_timeout_ms,
        }
        self.settings.database_url = "sqlite:///./relational_encyclopedia.db"
        self.settings.ops_auth_enabled = False
        self.settings.readiness_probe_enabled = True
        self.settings.readiness_probe_timeout_ms = 450

        self.app = FastAPI()
        self.app.add_middleware(RequestContextMiddleware)
        self.app.include_router(system_router)
        self.app.state.workflow_validation = WorkflowValidationReport(
            validated_procedures=12,
            validated_nodes=44,
            error_count=0,
            warning_count=0,
            issues=[],
        )
        self.app.state.data_integrity = DataIntegrityReport(
            validated_procedures=12,
            validated_nodes=44,
            error_count=0,
            warning_count=0,
            issues=[],
        )

    def tearDown(self) -> None:
        for key, value in self.original_settings.items():
            setattr(self.settings, key, value)

    def test_ready_returns_200_when_all_checks_are_ok(self) -> None:
        with patch("app.api.routes.system.database_is_ready", return_value=True):
            with TestClient(self.app) as client:
                response = client.get("/ready", headers={"X-Request-ID": "req-ready-200"})

        payload = response.json()
        self.assertEqual(response.status_code, 200, payload)
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["checks"]["db"], "ok")
        self.assertEqual(payload["checks"]["required_env"], "ok")
        self.assertEqual(payload["failed"], [])
        self.assertEqual(response.headers.get("x-request-id"), "req-ready-200")

    def test_ready_returns_503_when_db_check_fails(self) -> None:
        with patch("app.api.routes.system.database_is_ready", return_value=False):
            with TestClient(self.app) as client:
                response = client.get("/ready")

        self.assertEqual(response.status_code, 503)
        payload = response.json()
        self.assertEqual(payload["status"], "degraded")
        self.assertIn("db", payload["failed"])
        self.assertEqual(payload["checks"]["db"], "failed")
        self.assertTrue(response.headers.get("x-request-id"))
