import unittest

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestPartsPredictionEndpoint(unittest.TestCase):
    def test_returns_200_for_known_code(self) -> None:
        response = client.get("/triage/parts-prediction?t_code=T21")
        self.assertEqual(response.status_code, 200)

    def test_response_shape(self) -> None:
        response = client.get("/triage/parts-prediction?t_code=T21&warranty_direction=OW")
        data = response.json()
        self.assertIn("t_code", data)
        self.assertIn("parts", data)
        self.assertIn("directional_note", data)
        self.assertIsInstance(data["parts"], list)

    def test_t_code_normalised_uppercase(self) -> None:
        response = client.get("/triage/parts-prediction?t_code=t21")
        data = response.json()
        self.assertEqual(data["t_code"], "T21")

    def test_unknown_t_code_returns_empty_parts(self) -> None:
        response = client.get("/triage/parts-prediction?t_code=T99")
        data = response.json()
        self.assertEqual(data["parts"], [])

    def test_missing_t_code_returns_empty_parts(self) -> None:
        response = client.get("/triage/parts-prediction")
        data = response.json()
        self.assertEqual(data["parts"], [])

    def test_directional_note_is_non_empty_string(self) -> None:
        response = client.get("/triage/parts-prediction?t_code=T12")
        data = response.json()
        self.assertIsInstance(data["directional_note"], str)
        self.assertGreater(len(data["directional_note"]), 0)

    def test_warranty_direction_filter_applies(self) -> None:
        # T01 is OW-only (service fee). Should return empty when filtered for IW.
        iw_resp = client.get("/triage/parts-prediction?t_code=T01&warranty_direction=IW")
        ow_resp = client.get("/triage/parts-prediction?t_code=T01&warranty_direction=OW")
        iw_data = iw_resp.json()
        ow_data = ow_resp.json()
        # OW should have parts if seeded; IW should have none for T01
        if ow_data["parts"]:
            self.assertEqual(iw_data["parts"], [])
