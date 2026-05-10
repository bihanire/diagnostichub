import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.error_handling import register_error_handlers
from app.middleware.request_context import RequestContextMiddleware


class ErrorStandardizationTests(unittest.TestCase):
    def _build_app(self, *, standardized: bool, debug: bool = False) -> FastAPI:
        app = FastAPI(debug=debug)
        app.add_middleware(RequestContextMiddleware)
        if standardized:
            register_error_handlers(app)

        @app.get("/explode")
        def explode() -> dict[str, str]:
            raise RuntimeError("forced explosion")

        return app

    def test_404_returns_standardized_envelope_with_correlation_id(self) -> None:
        app = self._build_app(standardized=True)
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get(
                "/missing-route",
                headers={
                    "X-Client-Request-ID": "client-404-id",
                    "X-Request-ID": "legacy-404-id",
                },
            )

        self.assertEqual(response.status_code, 404)
        payload = response.json()
        self.assertEqual(payload["code"], "NOT_FOUND")
        self.assertEqual(payload["request_id"], "client-404-id")
        self.assertEqual(response.headers.get("x-request-id"), "client-404-id")

    def test_500_returns_standardized_envelope(self) -> None:
        app = self._build_app(standardized=True)
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get("/explode", headers={"X-Client-Request-ID": "client-500-id"})

        self.assertEqual(response.status_code, 500)
        payload = response.json()
        self.assertEqual(payload["code"], "INTERNAL_ERROR")
        self.assertEqual(payload["request_id"], "client-500-id")
        self.assertEqual(response.headers.get("x-request-id"), "client-500-id")

    def test_handlers_are_registered_for_http_validation_and_runtime(self) -> None:
        app = self._build_app(standardized=True)
        handler_names = {exc_type.__name__ for exc_type in app.exception_handlers.keys()}
        self.assertIn("HTTPException", handler_names)
        self.assertIn("RequestValidationError", handler_names)
        self.assertIn("Exception", handler_names)

    def test_debug_traceback_remains_when_standardization_disabled(self) -> None:
        app = self._build_app(standardized=False, debug=True)
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get("/explode", headers={"X-Client-Request-ID": "client-debug-id"})

        self.assertEqual(response.status_code, 500)
        body = response.text
        self.assertIn("RuntimeError", body)
        self.assertIn("forced explosion", body)
