import unittest
from uuid import UUID

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.middleware.request_context import RequestContextMiddleware


class RequestCorrelationMiddlewareTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = get_settings()
        self.original_request_correlation_enabled = self.settings.request_correlation_enabled

        self.app = FastAPI()
        self.app.add_middleware(RequestContextMiddleware)

        @self.app.get("/ping")
        def ping():
            return JSONResponse({"status": "ok"})

    def tearDown(self) -> None:
        self.settings.request_correlation_enabled = self.original_request_correlation_enabled

    def test_echoes_client_request_id_as_request_id_when_enabled(self) -> None:
        self.settings.request_correlation_enabled = True
        with TestClient(self.app) as client:
            response = client.get("/ping", headers={"X-Client-Request-ID": "client-id-123"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("x-request-id"), "client-id-123")

    def test_generates_request_id_when_client_request_id_is_missing(self) -> None:
        self.settings.request_correlation_enabled = True
        with TestClient(self.app) as client:
            response = client.get("/ping")

        self.assertEqual(response.status_code, 200)
        request_id = response.headers.get("x-request-id")
        self.assertIsNotNone(request_id)
        self.assertNotEqual(request_id, "-")
        UUID(str(request_id))

    def test_uses_legacy_request_id_when_correlation_is_disabled(self) -> None:
        self.settings.request_correlation_enabled = False
        with TestClient(self.app) as client:
            response = client.get(
                "/ping",
                headers={
                    "X-Client-Request-ID": "ignored-client-id",
                    "X-Request-ID": "legacy-request-id-007",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("x-request-id"), "legacy-request-id-007")
