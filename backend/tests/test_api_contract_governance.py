import unittest

from fastapi.routing import APIRoute
from pydantic import BaseModel
from starlette.responses import PlainTextResponse

from app.main import app

# Auth redirect endpoints return HTTP 302; PDF endpoint returns application/pdf — no JSON response_model.
JSON_CONTRACT_EXEMPTIONS: set[str] = {"/auth/google", "/auth/callback", "/cases/{reference}/pdf"}
BODY_OPTIONAL_POSTS = {
    "/ops/logout",
    "/auth/logout",
    "/admin/users/{user_id}/approve",
    "/admin/users/{user_id}/suspend",
}
STABLE_RESPONSE_REFS = {
    ("get", "/health"): "HealthResponse",
    ("get", "/meta"): "ApiMetaResponse",
    ("get", "/ready"): "ReadinessResponse",
    ("post", "/search"): "SearchResponse",
    ("post", "/triage/start"): "TriageStartResponse",
    ("post", "/triage/next"): "TriageNextResponse",
    ("post", "/triage/warranty"): "WarrantyNextResponse",
    ("post", "/triage/dispatch-route"): "DispatchRouteResponse",
    ("get", "/triage/devices"): "DeviceListResponse",
    ("get", "/triage/parts-prediction"): "PartsPredictionResponse",
    ("get", "/auth/me"): "AuthStatusResponse",
    ("post", "/auth/register"): "AuthStatusResponse",
    ("get", "/auth/locations"): "ECLocationListResponse",
    ("post", "/auth/logout"): "LogoutResponse",
    ("get", "/admin/users"): "AdminUserListResponse",
    ("post", "/admin/users/{user_id}/approve"): "AdminActionResponse",
    ("post", "/admin/users/{user_id}/suspend"): "AdminActionResponse",
    ("post", "/cases"): "CaseResponse",
    ("get", "/cases"): "CaseListResponse",
    ("get", "/cases/{reference}"): "CaseResponse",
    ("patch", "/cases/{reference}/status"): "CaseStatusUpdateResponse",
    ("post", "/feedback"): "FeedbackCreateResponse",
    ("post", "/ops/login"): "OpsSessionResponse",
    ("post", "/ops/logout"): "OpsSessionResponse",
    ("get", "/ops/session"): "OpsSessionResponse",
}


def _api_routes() -> list[APIRoute]:
    return [route for route in app.routes if isinstance(route, APIRoute)]


def _is_plain_text_route(route: APIRoute) -> bool:
    return route.response_class is PlainTextResponse


class ApiContractGovernanceTests(unittest.TestCase):
    def test_openapi_metadata_uses_runtime_api_version(self) -> None:
        schema = app.openapi()

        self.assertEqual(schema["info"]["title"], app.title)
        self.assertEqual(schema["info"]["version"], app.version)

    def test_json_routes_declare_explicit_response_models(self) -> None:
        missing_contracts = []

        for route in _api_routes():
            if route.path in JSON_CONTRACT_EXEMPTIONS or _is_plain_text_route(route):
                continue
            if route.response_model is None:
                methods = ",".join(sorted(route.methods or []))
                missing_contracts.append(f"{methods} {route.path}")

        self.assertEqual(missing_contracts, [])

    def test_post_routes_with_bodies_use_pydantic_request_models(self) -> None:
        loose_bodies = []

        for route in _api_routes():
            if "POST" not in route.methods or route.path in BODY_OPTIONAL_POSTS:
                continue

            body_type = getattr(route.body_field, "type_", None) if route.body_field else None
            if not isinstance(body_type, type) or not issubclass(body_type, BaseModel):
                loose_bodies.append(route.path)

        self.assertEqual(loose_bodies, [])

    def test_stable_endpoints_keep_expected_response_schema_refs(self) -> None:
        schema = app.openapi()
        drifted_refs = []

        for (method, path), expected_schema_name in STABLE_RESPONSE_REFS.items():
            operation = schema["paths"][path][method]
            response_schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
            expected_ref = f"#/components/schemas/{expected_schema_name}"
            if response_schema.get("$ref") != expected_ref:
                drifted_refs.append(f"{method.upper()} {path}: {response_schema}")

        self.assertEqual(drifted_refs, [])
