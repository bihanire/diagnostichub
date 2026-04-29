from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from app.db.import_sop import SopImportError, SopImportPackage, load_sop_directory, validate_import_package
from app.services.search_service import STOPWORDS, normalize_text, tokenize

MIN_TAGS_PER_PROCEDURE = 8
MIN_FINAL_OUTCOMES_PER_PROCEDURE = 2
BROAD_TAG_STOPWORDS = {
    "issue",
    "problem",
    "device",
    "phone",
    "repair",
    "service",
    "damage",
    "broken",
    "screen",
    "battery",
}
BRANCH_ACTION_HINTS = (
    "check",
    "test",
    "review",
    "document",
    "log",
    "update",
    "clean",
    "monitor",
    "advise",
    "guide",
    "confirm",
    "collect",
    "perform",
    "factory reset",
    "restart",
    "charge",
    "change",
    "verify",
    "block",
    "upload",
)
ACTION_PREFIXES = (
    "Resolve at branch:",
    "Monitor at branch:",
    "Book repair intake:",
    "Send to service centre:",
    "Continue branch processing:",
    "Pause and verify:",
)


@dataclass(frozen=True)
class ProcedureAuditSummary:
    procedure_id: int
    title: str
    tag_count: int
    final_outcome_count: int
    branch_resolution_paths: int


@dataclass(frozen=True)
class SopAuditReport:
    procedure_count: int
    tag_count: int
    decision_node_count: int
    linked_procedure_count: int
    error_count: int
    warning_count: int
    errors: list[str]
    warnings: list[str]
    procedure_summaries: list[ProcedureAuditSummary]


def audit_sop_directory(path: str | Path) -> SopAuditReport:
    package = load_sop_directory(path)
    errors, warnings = audit_import_package(package)
    summaries = _build_procedure_summaries(package)
    return SopAuditReport(
        procedure_count=len(package.procedures),
        tag_count=len(package.tags),
        decision_node_count=len(package.decision_nodes),
        linked_procedure_count=len(package.linked_procedures),
        error_count=len(errors),
        warning_count=len(warnings),
        errors=errors,
        warnings=warnings,
        procedure_summaries=summaries,
    )


def audit_import_package(package: SopImportPackage) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    try:
        validate_import_package(package)
    except SopImportError as exc:
        errors.extend(_extract_validation_errors(str(exc)))

    procedures_by_id = {procedure.id: procedure for procedure in package.procedures}
    tags_by_procedure: dict[int, list[str]] = {procedure_id: [] for procedure_id in procedures_by_id}
    finals_by_procedure: dict[int, list] = {procedure_id: [] for procedure_id in procedures_by_id}
    normalized_tag_index: dict[str, set[int]] = {}

    for tag in package.tags:
        tags_by_procedure.setdefault(tag.procedure_id, []).append(tag.keyword)
        normalized_tag = normalize_text(tag.keyword)
        if normalized_tag:
            normalized_tag_index.setdefault(normalized_tag, set()).add(tag.procedure_id)

    for node in package.decision_nodes:
        if node.is_final:
            finals_by_procedure.setdefault(node.procedure_id, []).append(node)

    for procedure_id, procedure in procedures_by_id.items():
        tag_count = len(tags_by_procedure.get(procedure_id, []))
        final_nodes = finals_by_procedure.get(procedure_id, [])
        branch_resolution_paths = sum(
            1 for node in final_nodes if _looks_branch_resolvable(node.recommended_action)
        )

        if tag_count < MIN_TAGS_PER_PROCEDURE:
            warnings.append(
                f"Procedure {procedure_id} '{procedure.title}' has only {tag_count} tags. "
                f"Target at least {MIN_TAGS_PER_PROCEDURE} for stronger search coverage."
            )

        if len(final_nodes) < MIN_FINAL_OUTCOMES_PER_PROCEDURE:
            warnings.append(
                f"Procedure {procedure_id} '{procedure.title}' has only {len(final_nodes)} final outcomes. "
                "Consider adding more triage resolution branches."
            )

        if branch_resolution_paths == 0:
            warnings.append(
                f"Procedure {procedure_id} '{procedure.title}' has no clearly branch-resolvable outcome. "
                "Review whether the flow is escalating too early."
            )

        for keyword in tags_by_procedure.get(procedure_id, []):
            normalized = normalize_text(keyword)
            if _is_overly_broad_tag(normalized):
                warnings.append(
                    f"Procedure {procedure_id} '{procedure.title}' uses a broad tag '{keyword}'. "
                    "Consider replacing it with a more precise customer phrase."
                )

        for node in final_nodes:
            if not _has_standard_action_prefix(node.recommended_action):
                warnings.append(
                    f"Procedure {procedure_id} '{procedure.title}' node {node.id} uses a non-standard "
                    "recommended_action opening. Start with one of the approved action prefixes."
                )

    for normalized_tag, procedure_ids in sorted(normalized_tag_index.items()):
        if len(procedure_ids) <= 1:
            continue

        procedure_titles = ", ".join(
            procedures_by_id[procedure_id].title for procedure_id in sorted(procedure_ids)
        )
        warnings.append(
            f"Shared normalized tag '{normalized_tag}' appears in multiple procedures: {procedure_titles}. "
            "Confirm this overlap is intentional and not causing search ambiguity."
        )

    return _dedupe(errors), _dedupe(warnings)


def render_markdown_report(report: SopAuditReport) -> str:
    lines = [
        "# SOP Quality Report",
        "",
        "## Summary",
        "",
        f"- Procedures: {report.procedure_count}",
        f"- Tags: {report.tag_count}",
        f"- Decision nodes: {report.decision_node_count}",
        f"- Linked procedures: {report.linked_procedure_count}",
        f"- Errors: {report.error_count}",
        f"- Warnings: {report.warning_count}",
        "",
        "## Procedure Coverage",
        "",
        "| ID | Title | Tags | Final Outcomes | Branch-Resolvable Outcomes |",
        "| --- | --- | ---: | ---: | ---: |",
    ]

    for summary in report.procedure_summaries:
        lines.append(
            f"| {summary.procedure_id} | {summary.title} | {summary.tag_count} | "
            f"{summary.final_outcome_count} | {summary.branch_resolution_paths} |"
        )

    lines.extend(["", "## Errors", ""])
    if report.errors:
        lines.extend(f"- {error}" for error in report.errors)
    else:
        lines.append("- None")

    lines.extend(["", "## Warnings", ""])
    if report.warnings:
        lines.extend(f"- {warning}" for warning in report.warnings)
    else:
        lines.append("- None")

    return "\n".join(lines) + "\n"


def _build_procedure_summaries(package: SopImportPackage) -> list[ProcedureAuditSummary]:
    tags_by_procedure: dict[int, int] = {}
    finals_by_procedure: dict[int, int] = {}
    branch_paths_by_procedure: dict[int, int] = {}

    for tag in package.tags:
        tags_by_procedure[tag.procedure_id] = tags_by_procedure.get(tag.procedure_id, 0) + 1

    for node in package.decision_nodes:
        if not node.is_final:
            continue
        finals_by_procedure[node.procedure_id] = finals_by_procedure.get(node.procedure_id, 0) + 1
        if _looks_branch_resolvable(node.recommended_action):
            branch_paths_by_procedure[node.procedure_id] = (
                branch_paths_by_procedure.get(node.procedure_id, 0) + 1
            )

    return [
        ProcedureAuditSummary(
            procedure_id=procedure.id,
            title=procedure.title,
            tag_count=tags_by_procedure.get(procedure.id, 0),
            final_outcome_count=finals_by_procedure.get(procedure.id, 0),
            branch_resolution_paths=branch_paths_by_procedure.get(procedure.id, 0),
        )
        for procedure in sorted(package.procedures, key=lambda item: item.id)
    ]


def _extract_validation_errors(message: str) -> list[str]:
    lines = [line.strip() for line in message.splitlines()]
    extracted = [line[2:] if line.startswith("- ") else line for line in lines]
    return [line for line in extracted if line and line != "SOP import validation failed:"]


def _looks_branch_resolvable(recommended_action: str) -> bool:
    normalized = normalize_text(recommended_action)
    return any(hint in normalized for hint in BRANCH_ACTION_HINTS)


def _has_standard_action_prefix(recommended_action: str) -> bool:
    return any(recommended_action.startswith(prefix) for prefix in ACTION_PREFIXES)


def _is_overly_broad_tag(normalized_keyword: str) -> bool:
    if not normalized_keyword:
        return False
    if normalized_keyword in BROAD_TAG_STOPWORDS:
        return True

    tokens = [token for token in tokenize(normalized_keyword) if token not in STOPWORDS]
    if len(tokens) != 1:
        return False

    token = tokens[0]
    return len(token) <= 2 or token in BROAD_TAG_STOPWORDS


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Audit DiagnosticHub SOP CSV knowledge for precision and routing quality."
    )
    parser.add_argument("--path", required=True, help="Directory containing SOP import CSV files.")
    parser.add_argument(
        "--markdown",
        help="Optional path to write a markdown audit report.",
    )
    parser.add_argument(
        "--fail-on-warnings",
        action="store_true",
        help="Exit with a non-zero code when warnings are present.",
    )
    args = parser.parse_args()

    report = audit_sop_directory(args.path)
    output = render_markdown_report(report)

    if args.markdown:
        markdown_path = Path(args.markdown)
        markdown_path.parent.mkdir(parents=True, exist_ok=True)
        markdown_path.write_text(output, encoding="utf-8")

    print(output)

    exit_code = 0
    if report.error_count > 0:
        exit_code = 1
    elif args.fail_on_warnings and report.warning_count > 0:
        exit_code = 1

    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
