from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.db.seed import seed_session
from app.services.procedure_service import procedure_query_with
from app.services.search_service import (
    STOPWORDS,
    build_ngrams,
    build_procedure_search_index,
    infer_issue_type,
    normalize_text,
    score_procedure,
    search_procedures,
    tokenize,
)


class SearchBenchmarkError(ValueError):
    pass


BENCHMARK_COLUMNS = {
    "query",
    "expected_procedure_id",
    "expected_procedure_title",
    "expected_issue_type",
    "minimum_confidence",
    "minimum_margin",
}


@dataclass(frozen=True)
class SearchBenchmarkCase:
    query: str
    expected_procedure_id: int
    expected_procedure_title: str
    expected_issue_type: str
    minimum_confidence: float
    minimum_margin: float


@dataclass(frozen=True)
class SearchBenchmarkResult:
    case: SearchBenchmarkCase
    passed: bool
    matched_procedure_id: int | None
    matched_procedure_title: str | None
    matched_issue_type: str | None
    confidence: float
    alternative_procedure_id: int | None
    alternative_procedure_title: str | None
    margin: float
    reason: str


@dataclass(frozen=True)
class SearchBenchmarkReport:
    total_cases: int
    passed_cases: int
    failed_cases: int
    results: list[SearchBenchmarkResult]


def load_search_benchmark(path: str | Path) -> list[SearchBenchmarkCase]:
    csv_path = Path(path)
    if not csv_path.exists():
        raise SearchBenchmarkError(f"Missing benchmark CSV file: {csv_path}")

    with csv_path.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        fieldnames = set(reader.fieldnames or [])
        missing = BENCHMARK_COLUMNS - fieldnames
        if missing:
            missing_columns = ", ".join(sorted(missing))
            raise SearchBenchmarkError(f"{csv_path.name} is missing column(s): {missing_columns}")

        cases: list[SearchBenchmarkCase] = []
        for row in reader:
            cases.append(
                SearchBenchmarkCase(
                    query=_required_text(row, "query", csv_path),
                    expected_procedure_id=_required_int(row, "expected_procedure_id", csv_path),
                    expected_procedure_title=_required_text(row, "expected_procedure_title", csv_path),
                    expected_issue_type=_required_text(row, "expected_issue_type", csv_path),
                    minimum_confidence=_required_float(row, "minimum_confidence", csv_path),
                    minimum_margin=_required_float(row, "minimum_margin", csv_path),
                )
            )
    return cases


def run_search_benchmark(path: str | Path) -> SearchBenchmarkReport:
    cases = load_search_benchmark(path)
    session_local, engine = _build_temp_session_factory()
    try:
        with session_local() as db:
            seed_session(db)
            db.commit()

            results = [_evaluate_case(db, case) for case in cases]
    finally:
        engine.dispose()

    passed_cases = sum(1 for result in results if result.passed)
    failed_cases = len(results) - passed_cases
    return SearchBenchmarkReport(
        total_cases=len(results),
        passed_cases=passed_cases,
        failed_cases=failed_cases,
        results=results,
    )


def render_markdown_report(report: SearchBenchmarkReport) -> str:
    lines = [
        "# Search Benchmark Report",
        "",
        "## Summary",
        "",
        f"- Total cases: {report.total_cases}",
        f"- Passed: {report.passed_cases}",
        f"- Failed: {report.failed_cases}",
        "",
        "## Results",
        "",
        "| Query | Expected | Matched | Alternative | Issue Type | Confidence | Margin | Status |",
        "| --- | --- | --- | --- | --- | ---: | ---: | --- |",
    ]

    for result in report.results:
        expected = f"{result.case.expected_procedure_id} {result.case.expected_procedure_title}"
        matched_title = result.matched_procedure_title or "No match"
        matched_id = "-" if result.matched_procedure_id is None else str(result.matched_procedure_id)
        matched = f"{matched_id} {matched_title}".strip()
        alternative_title = result.alternative_procedure_title or "-"
        alternative_id = "-" if result.alternative_procedure_id is None else str(result.alternative_procedure_id)
        alternative = f"{alternative_id} {alternative_title}".strip()
        issue_type = result.matched_issue_type or "-"
        status = "Pass" if result.passed else f"Fail: {result.reason}"
        lines.append(
            f"| {result.case.query} | {expected} | {matched} | {alternative} | "
            f"{issue_type} | {result.confidence:.2f} | {result.margin:.2f} | {status} |"
        )

    return "\n".join(lines) + "\n"


def _evaluate_case(db, case: SearchBenchmarkCase) -> SearchBenchmarkResult:
    response = search_procedures(db, case.query)
    ranked = _rank_procedures(db, case.query)
    alternative = ranked[1] if len(ranked) > 1 else None
    margin = 0.0
    if ranked and alternative is not None:
        margin = round(ranked[0][0] - alternative[0], 4)

    if response.best_match is None:
        return SearchBenchmarkResult(
            case=case,
            passed=False,
            matched_procedure_id=None,
            matched_procedure_title=None,
            matched_issue_type=response.structured_intent.issue_type,
            confidence=response.confidence,
            alternative_procedure_id=alternative[1] if alternative else None,
            alternative_procedure_title=alternative[2] if alternative else None,
            margin=margin,
            reason="no best match returned",
        )

    if response.best_match.id != case.expected_procedure_id:
        return SearchBenchmarkResult(
            case=case,
            passed=False,
            matched_procedure_id=response.best_match.id,
            matched_procedure_title=response.best_match.title,
            matched_issue_type=response.structured_intent.issue_type,
            confidence=response.confidence,
            alternative_procedure_id=alternative[1] if alternative else None,
            alternative_procedure_title=alternative[2] if alternative else None,
            margin=margin,
            reason="matched the wrong procedure",
        )

    if response.best_match.title != case.expected_procedure_title:
        return SearchBenchmarkResult(
            case=case,
            passed=False,
            matched_procedure_id=response.best_match.id,
            matched_procedure_title=response.best_match.title,
            matched_issue_type=response.structured_intent.issue_type,
            confidence=response.confidence,
            alternative_procedure_id=alternative[1] if alternative else None,
            alternative_procedure_title=alternative[2] if alternative else None,
            margin=margin,
            reason="matched title differs from expectation",
        )

    if response.structured_intent.issue_type != case.expected_issue_type:
        return SearchBenchmarkResult(
            case=case,
            passed=False,
            matched_procedure_id=response.best_match.id,
            matched_procedure_title=response.best_match.title,
            matched_issue_type=response.structured_intent.issue_type,
            confidence=response.confidence,
            alternative_procedure_id=alternative[1] if alternative else None,
            alternative_procedure_title=alternative[2] if alternative else None,
            margin=margin,
            reason="issue type differs from expectation",
        )

    if response.confidence < case.minimum_confidence:
        return SearchBenchmarkResult(
            case=case,
            passed=False,
            matched_procedure_id=response.best_match.id,
            matched_procedure_title=response.best_match.title,
            matched_issue_type=response.structured_intent.issue_type,
            confidence=response.confidence,
            alternative_procedure_id=alternative[1] if alternative else None,
            alternative_procedure_title=alternative[2] if alternative else None,
            margin=margin,
            reason="confidence fell below the minimum threshold",
        )

    if margin < case.minimum_margin:
        return SearchBenchmarkResult(
            case=case,
            passed=False,
            matched_procedure_id=response.best_match.id,
            matched_procedure_title=response.best_match.title,
            matched_issue_type=response.structured_intent.issue_type,
            confidence=response.confidence,
            alternative_procedure_id=alternative[1] if alternative else None,
            alternative_procedure_title=alternative[2] if alternative else None,
            margin=margin,
            reason="match margin fell below the minimum threshold",
        )

    return SearchBenchmarkResult(
        case=case,
        passed=True,
        matched_procedure_id=response.best_match.id,
        matched_procedure_title=response.best_match.title,
        matched_issue_type=response.structured_intent.issue_type,
        confidence=response.confidence,
        alternative_procedure_id=alternative[1] if alternative else None,
        alternative_procedure_title=alternative[2] if alternative else None,
        margin=margin,
        reason="ok",
    )


def _rank_procedures(db, query: str) -> list[tuple[float, int, str]]:
    query_tokens = tokenize(query)
    meaningful_tokens = [token for token in query_tokens if token not in STOPWORDS]
    meaningful_token_set = set(meaningful_tokens)
    query_ngrams = build_ngrams(query_tokens)
    issue_type = infer_issue_type(query_tokens)
    normalized_query = normalize_text(query)
    procedures = db.scalars(
        procedure_query_with(
            include_tags=True,
            include_decision_nodes=False,
            include_links=False,
        )
    ).all()
    indexes = [build_procedure_search_index(procedure) for procedure in procedures]
    return sorted(
        (
            (
                score_procedure(
                    query,
                    query_tokens,
                    item.procedure,
                    issue_type=issue_type,
                    query_ngrams=query_ngrams,
                    normalized_query=normalized_query,
                    meaningful_tokens=meaningful_tokens,
                    meaningful_token_set=meaningful_token_set,
                    precomputed=item,
                ),
                item.procedure.id,
                item.procedure.title,
            )
            for item in indexes
        ),
        key=lambda item: item[0],
        reverse=True,
    )


def _build_temp_session_factory():
    engine = create_engine(
        "sqlite://",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, _) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    session_local = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    return session_local, engine


def _required_text(row: dict[str, str], column: str, path: Path) -> str:
    value = (row.get(column) or "").strip()
    if not value:
        raise SearchBenchmarkError(f"{path.name} has a blank required text column: {column}")
    return value


def _required_int(row: dict[str, str], column: str, path: Path) -> int:
    value = _required_text(row, column, path)
    try:
        return int(value)
    except ValueError as exc:
        raise SearchBenchmarkError(f"{path.name} has an invalid integer in {column}: {value}") from exc


def _required_float(row: dict[str, str], column: str, path: Path) -> float:
    value = _required_text(row, column, path)
    try:
        return float(value)
    except ValueError as exc:
        raise SearchBenchmarkError(f"{path.name} has an invalid number in {column}: {value}") from exc


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run a messy-query search benchmark against the canonical DiagnosticHub knowledge pack."
    )
    parser.add_argument("--path", required=True, help="CSV file containing search benchmark cases.")
    parser.add_argument("--markdown", help="Optional path to write a markdown report.")
    parser.add_argument(
        "--fail-on-mismatch",
        action="store_true",
        help="Exit with a non-zero code when any benchmark case fails.",
    )
    args = parser.parse_args()

    report = run_search_benchmark(args.path)
    markdown = render_markdown_report(report)

    if args.markdown:
        markdown_path = Path(args.markdown)
        markdown_path.parent.mkdir(parents=True, exist_ok=True)
        markdown_path.write_text(markdown, encoding="utf-8")

    print(markdown)

    if args.fail_on_mismatch and report.failed_cases > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
