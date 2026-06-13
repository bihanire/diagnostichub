import unittest

from app.services.warranty_service import WARRANTY_QUESTIONS, evaluate_warranty


class TestWarrantyServiceAutoSkip(unittest.TestCase):
    def test_t01_auto_iw(self):
        result = evaluate_warranty("T01", [])
        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["warranty_direction"], "IW")
        self.assertTrue(result["auto_skipped"])
        self.assertIsNone(result["wty_exception"])

    def test_t02_auto_iw(self):
        result = evaluate_warranty("T02", [])
        self.assertEqual(result["warranty_direction"], "IW")
        self.assertTrue(result["auto_skipped"])

    def test_t03_auto_iw(self):
        result = evaluate_warranty("T03", [])
        self.assertEqual(result["warranty_direction"], "IW")
        self.assertTrue(result["auto_skipped"])

    def test_t01_uppercase_insensitive(self):
        result = evaluate_warranty("t01", [])
        self.assertTrue(result["auto_skipped"])


class TestWarrantyServiceQuestionProgression(unittest.TestCase):
    def test_empty_answers_returns_q0(self):
        result = evaluate_warranty("T10", [])
        self.assertEqual(result["status"], "question")
        self.assertEqual(result["question_index"], 0)
        self.assertEqual(result["question"], WARRANTY_QUESTIONS[0])
        self.assertFalse(result["auto_skipped"])

    def test_q0_no_returns_q1(self):
        result = evaluate_warranty("T10", ["no"])
        self.assertEqual(result["status"], "question")
        self.assertEqual(result["question_index"], 1)

    def test_q1_no_returns_q2(self):
        result = evaluate_warranty("T10", ["no", "no"])
        self.assertEqual(result["status"], "question")
        self.assertEqual(result["question_index"], 2)

    def test_q2_no_returns_q3(self):
        result = evaluate_warranty("T10", ["no", "no", "no"])
        self.assertEqual(result["status"], "question")
        self.assertEqual(result["question_index"], 3)


class TestWarrantyServiceVerdicts(unittest.TestCase):
    def test_liquid_yes_gives_ow_void4(self):
        result = evaluate_warranty("T10", ["yes"])
        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["warranty_direction"], "OW")
        self.assertEqual(result["wty_exception"], "VOID4")
        self.assertFalse(result["needs_review"])

    def test_dropped_yes_gives_ow_void4(self):
        result = evaluate_warranty("T10", ["no", "yes"])
        self.assertEqual(result["warranty_direction"], "OW")
        self.assertEqual(result["wty_exception"], "VOID4")

    def test_software_update_yes_gives_iw(self):
        result = evaluate_warranty("T10", ["no", "no", "yes"])
        self.assertEqual(result["warranty_direction"], "IW")
        self.assertIsNone(result["wty_exception"])
        self.assertFalse(result["needs_review"])

    def test_normal_use_yes_gives_iw(self):
        result = evaluate_warranty("T10", ["no", "no", "no", "yes"])
        self.assertEqual(result["warranty_direction"], "IW")
        self.assertIsNone(result["wty_exception"])
        self.assertFalse(result["needs_review"])

    def test_normal_use_no_gives_needs_review(self):
        result = evaluate_warranty("T10", ["no", "no", "no", "no"])
        self.assertEqual(result["status"], "complete")
        self.assertIsNone(result["warranty_direction"])
        self.assertTrue(result["needs_review"])

    def test_non_customer_request_tcode_uses_questions(self):
        # T41 (camera) should go through questions, not auto-skip
        result = evaluate_warranty("T41", [])
        self.assertEqual(result["status"], "question")
        self.assertFalse(result["auto_skipped"])

    def test_early_stop_liquid_skips_remaining_questions(self):
        # Liquid damage stops immediately — subsequent answers don't matter
        result = evaluate_warranty("T10", ["yes"])
        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["warranty_direction"], "OW")


if __name__ == "__main__":
    unittest.main()
