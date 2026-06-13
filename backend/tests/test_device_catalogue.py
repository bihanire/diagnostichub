import unittest

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestDeviceListEndpoint(unittest.TestCase):
    def test_returns_200(self) -> None:
        response = client.get("/triage/devices")
        self.assertEqual(response.status_code, 200)

    def test_response_has_devices_key(self) -> None:
        response = client.get("/triage/devices")
        data = response.json()
        self.assertIn("devices", data)
        self.assertIsInstance(data["devices"], list)

    def test_devices_have_required_fields(self) -> None:
        response = client.get("/triage/devices")
        devices = response.json()["devices"]
        if not devices:
            self.skipTest("No devices seeded in test DB — run seed_data() first.")
        for device in devices:
            self.assertIn("id", device)
            self.assertIn("model_name", device)
            self.assertIn("samsung_code", device)
            self.assertIn("display_label", device)
            self.assertIn("auto_blocker_required", device)

    def test_auto_blocker_required_is_boolean(self) -> None:
        response = client.get("/triage/devices")
        devices = response.json()["devices"]
        for device in devices:
            self.assertIsInstance(device["auto_blocker_required"], bool)

    def test_a15_a16_a17_require_auto_blocker(self) -> None:
        response = client.get("/triage/devices")
        devices = response.json()["devices"]
        high_models = {d["model_name"] for d in devices if d["auto_blocker_required"]}
        # If seeded, these three models must be in the auto-blocker set
        if high_models:
            for model in ("A15", "A16", "A17"):
                if any(d["model_name"] == model for d in devices):
                    self.assertIn(model, high_models)

    def test_device_ids_are_unique(self) -> None:
        response = client.get("/triage/devices")
        devices = response.json()["devices"]
        self.assertEqual(len(devices), len(set(d["id"] for d in devices)))
