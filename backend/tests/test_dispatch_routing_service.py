import unittest

from app.services.dispatch_routing_service import get_dispatch_route


class TestDispatchRoutingIwHardware(unittest.TestCase):
    def test_iw_hardware_returns_self_repairs_and_transtel(self) -> None:
        result = get_dispatch_route("SRC012", "T12", "IW")
        self.assertEqual(result["ls_code"], "Self Repairs")
        self.assertEqual(result["service_center"], "Transtel")
        self.assertEqual(result["dispatch_class"], "iw_hardware")
        self.assertFalse(result["escalate"])

    def test_iw_display_fault_routes_correctly(self) -> None:
        result = get_dispatch_route("SRC014", "T21", "IW")
        self.assertEqual(result["ls_code"], "Self Repairs")
        self.assertEqual(result["service_center"], "Transtel")
        self.assertEqual(result["dispatch_class"], "iw_hardware")

    def test_iw_charging_fault_routes_correctly(self) -> None:
        result = get_dispatch_route("SRC016", "T31", "IW")
        self.assertEqual(result["ls_code"], "Self Repairs")
        self.assertEqual(result["dispatch_class"], "iw_hardware")

    def test_iw_route_note_mentions_aramex_and_mifos(self) -> None:
        result = get_dispatch_route("SRC018", "T61", "IW")
        self.assertIn("Self Repairs", result["route_note"])
        self.assertIn("MIFOS", result["route_note"])
        self.assertIn("Aramex", result["route_note"])


class TestDispatchRoutingOwHardware(unittest.TestCase):
    def test_ow_hardware_returns_watu_repairs_and_simu_hq(self) -> None:
        result = get_dispatch_route("SRC012", "T12", "OW")
        self.assertEqual(result["ls_code"], "Watu Repairs")
        self.assertEqual(result["service_center"], "Watu SIMU HQ")
        self.assertEqual(result["dispatch_class"], "ow_hardware")
        self.assertFalse(result["escalate"])

    def test_ow_route_note_mentions_supervisor_and_30_70(self) -> None:
        result = get_dispatch_route("SRC014", "T21", "OW")
        self.assertIn("Watu Repairs", result["route_note"])
        self.assertIn("supervisor", result["route_note"])
        self.assertIn("30/70", result["route_note"])

    def test_ow_service_center_is_watu_simu_hq(self) -> None:
        result = get_dispatch_route("SRC016", "T35", "OW")
        self.assertEqual(result["service_center"], "Watu SIMU HQ")
        self.assertIn("SIMU HQ", result["route_note"])


class TestDispatchRoutingCustomerRequest(unittest.TestCase):
    def test_t01_routes_to_banana_asc(self) -> None:
        result = get_dispatch_route("CUSTOMER_REQUEST", "T01", "IW")
        self.assertEqual(result["ls_code"], "Watu Repairs")
        self.assertEqual(result["service_center"], "Banana ASC")
        self.assertEqual(result["dispatch_class"], "customer_request")
        self.assertFalse(result["escalate"])

    def test_t02_routes_to_banana_asc(self) -> None:
        result = get_dispatch_route(None, "T02", "IW")
        self.assertEqual(result["service_center"], "Banana ASC")
        self.assertEqual(result["dispatch_class"], "customer_request")

    def test_t03_routes_to_banana_asc(self) -> None:
        result = get_dispatch_route(None, "T03", "IW")
        self.assertEqual(result["service_center"], "Banana ASC")
        self.assertEqual(result["dispatch_class"], "customer_request")

    def test_customer_request_src_group_routes_to_banana(self) -> None:
        result = get_dispatch_route("CUSTOMER_REQUEST", None, None)
        self.assertEqual(result["service_center"], "Banana ASC")
        self.assertEqual(result["dispatch_class"], "customer_request")

    def test_t_code_is_case_insensitive(self) -> None:
        result = get_dispatch_route(None, "t01", "IW")
        self.assertEqual(result["service_center"], "Banana ASC")
        self.assertEqual(result["dispatch_class"], "customer_request")

    def test_customer_request_note_mentions_banana_asc(self) -> None:
        result = get_dispatch_route(None, "T01", None)
        self.assertIn("Banana ASC", result["route_note"])
        self.assertIn("Watu Repairs", result["route_note"])


class TestDispatchRoutingNeedsReview(unittest.TestCase):
    def test_needs_review_flag_escalates(self) -> None:
        result = get_dispatch_route("SRC012", "T12", None, warranty_needs_review=True)
        self.assertIsNone(result["ls_code"])
        self.assertIsNone(result["service_center"])
        self.assertTrue(result["escalate"])
        self.assertEqual(result["dispatch_class"], "needs_review")

    def test_no_warranty_direction_and_no_flag_escalates(self) -> None:
        result = get_dispatch_route("SRC014", "T21", None)
        self.assertEqual(result["dispatch_class"], "needs_review")
        self.assertTrue(result["escalate"])

    def test_needs_review_takes_priority_over_ow(self) -> None:
        result = get_dispatch_route("SRC016", "T31", "OW", warranty_needs_review=True)
        self.assertEqual(result["dispatch_class"], "needs_review")
        self.assertIsNone(result["ls_code"])

    def test_null_inputs_escalate(self) -> None:
        result = get_dispatch_route(None, None, None)
        self.assertEqual(result["dispatch_class"], "needs_review")
        self.assertTrue(result["escalate"])

    def test_needs_review_takes_priority_over_iw(self) -> None:
        result = get_dispatch_route("SRC012", "T12", "IW", warranty_needs_review=True)
        self.assertEqual(result["dispatch_class"], "needs_review")
        self.assertIsNone(result["ls_code"])
