import unittest
from pathlib import Path
from tempfile import NamedTemporaryFile
import os

from app.db.search_benchmark import (
    load_search_benchmark,
    render_markdown_report,
    run_search_benchmark,
)

BENCHMARK_PATH = Path(__file__).resolve().parents[2] / "docs" / "sop-import-template" / "search-benchmark.csv"


class SearchBenchmarkTests(unittest.TestCase):
    def test_load_search_benchmark_requires_expected_columns(self) -> None:
        with NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8") as temp_file:
            temp_file.write("query,expected_procedure_id\nphone not turning on,1\n")
            temp_path = temp_file.name

        try:
            with self.assertRaisesRegex(Exception, "missing column"):
                load_search_benchmark(temp_path)
        finally:
            os.unlink(temp_path)

    def test_run_search_benchmark_passes_for_canonical_pack(self) -> None:
        report = run_search_benchmark(BENCHMARK_PATH)

        self.assertEqual(report.total_cases, 82)
        self.assertEqual(report.failed_cases, 0)
        self.assertEqual(report.passed_cases, 82)
        self.assertGreater(min(result.margin for result in report.results), 0.04)

    def test_render_markdown_report_includes_case_table(self) -> None:
        report = run_search_benchmark(BENCHMARK_PATH)
        markdown = render_markdown_report(report)

        self.assertIn("# Search Benchmark Report", markdown)
        self.assertIn("| Query | Expected | Matched | Alternative | Issue Type | Confidence | Margin | Status |", markdown)
        self.assertIn("phone not coming on but vibrates", markdown)
