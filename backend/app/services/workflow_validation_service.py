from collections import deque

from sqlalchemy.orm import Session

from app.models.models import DecisionNode, Procedure
from app.schemas.system import WorkflowValidationIssue, WorkflowValidationReport
from app.services.procedure_service import procedure_query
from app.services.triage_service import find_root_node

REQUIRED_FINAL_OUTCOME_KEYS = (
    "diagnosis",
    "recommended_action",
    "warranty_status",
    "related_actions",
    "follow_up_message",
)


def _is_blank_text(value: object) -> bool:
    return not isinstance(value, str) or not value.strip()


def _walk_reachable(node_map: dict[int, DecisionNode], root_id: int) -> set[int]:
    visited: set[int] = set()
    queue: deque[int] = deque([root_id])

    while queue:
        current_id = queue.popleft()
        if current_id in visited or current_id not in node_map:
            continue

        visited.add(current_id)
        node = node_map[current_id]
        for next_id in (node.yes_next, node.no_next):
            if next_id is not None:
                queue.append(next_id)

    return visited


def _has_cycle(node_map: dict[int, DecisionNode]) -> bool:
    state: dict[int, int] = {}

    def visit(node_id: int) -> bool:
        current_state = state.get(node_id, 0)
        if current_state == 1:
            return True
        if current_state == 2:
            return False

        state[node_id] = 1
        node = node_map[node_id]
        for next_id in (node.yes_next, node.no_next):
            if next_id is not None and next_id in node_map and visit(next_id):
                return True
        state[node_id] = 2
        return False

    return any(visit(node_id) for node_id in node_map if state.get(node_id, 0) == 0)


def _can_reach_final_outcome(
    node_map: dict[int, DecisionNode],
    node_id: int,
    seen: set[int] | None = None,
) -> bool:
    node = node_map.get(node_id)
    if node is None:
        return False
    if node.final_outcome is not None:
        return True

    seen = seen or set()
    if node_id in seen:
        return False
    seen.add(node_id)

    return any(
        next_id is not None and _can_reach_final_outcome(node_map, next_id, set(seen))
        for next_id in (node.yes_next, node.no_next)
    )


def validate_procedure_workflows(db: Session) -> WorkflowValidationReport:
    procedures = db.scalars(procedure_query().order_by(Procedure.id)).all()
    issues: list[WorkflowValidationIssue] = []
    validated_nodes = 0

    for procedure in procedures:
        nodes = list(procedure.decision_nodes)
        validated_nodes += len(nodes)

        if not nodes:
            issues.append(
                WorkflowValidationIssue(
                    procedure_id=procedure.id,
                    procedure_title=procedure.title,
                    severity="error",
                    message="Procedure has no decision nodes.",
                )
            )
            continue

        node_map = {node.id: node for node in nodes}
        referenced_ids: set[int] = set()
        final_outcome_count = 0

        for node in nodes:
            for branch_name, next_id in (("yes", node.yes_next), ("no", node.no_next)):
                if next_id is None:
                    continue

                referenced_ids.add(next_id)
                if next_id not in node_map:
                    issues.append(
                        WorkflowValidationIssue(
                            procedure_id=procedure.id,
                            procedure_title=procedure.title,
                            severity="error",
                            node_id=node.id,
                            message=f"{branch_name.title()} branch points to missing node {next_id}.",
                        )
                    )

            if node.final_outcome is not None:
                final_outcome_count += 1
                if not isinstance(node.final_outcome, dict):
                    issues.append(
                        WorkflowValidationIssue(
                            procedure_id=procedure.id,
                            procedure_title=procedure.title,
                            severity="error",
                            node_id=node.id,
                            message="Final outcome payload must be a JSON object.",
                        )
                    )
                else:
                    missing_keys = [
                        key for key in REQUIRED_FINAL_OUTCOME_KEYS if key not in node.final_outcome
                    ]
                    if missing_keys:
                        issues.append(
                            WorkflowValidationIssue(
                                procedure_id=procedure.id,
                                procedure_title=procedure.title,
                                severity="error",
                                node_id=node.id,
                                message=(
                                    "Final outcome is missing required keys: "
                                    + ", ".join(sorted(missing_keys))
                                ),
                            )
                        )

                    blank_keys = [
                        key
                        for key in (
                            "diagnosis",
                            "recommended_action",
                            "warranty_status",
                            "follow_up_message",
                        )
                        if key in node.final_outcome and _is_blank_text(node.final_outcome.get(key))
                    ]
                    if blank_keys:
                        issues.append(
                            WorkflowValidationIssue(
                                procedure_id=procedure.id,
                                procedure_title=procedure.title,
                                severity="error",
                                node_id=node.id,
                                message=(
                                    "Final outcome has blank required text: "
                                    + ", ".join(sorted(blank_keys))
                                ),
                            )
                        )

                    related_actions = node.final_outcome.get("related_actions")
                    if related_actions is not None and not isinstance(related_actions, list):
                        issues.append(
                            WorkflowValidationIssue(
                                procedure_id=procedure.id,
                                procedure_title=procedure.title,
                                severity="error",
                                node_id=node.id,
                                message="Final outcome related_actions must be a list.",
                            )
                        )

            if node.final_outcome is not None and (node.yes_next is not None or node.no_next is not None):
                issues.append(
                    WorkflowValidationIssue(
                        procedure_id=procedure.id,
                        procedure_title=procedure.title,
                        severity="error",
                        node_id=node.id,
                        message="Final outcome node should not point to another node.",
                    )
                )

            if node.final_outcome is None and (node.yes_next is None) != (node.no_next is None):
                issues.append(
                    WorkflowValidationIssue(
                        procedure_id=procedure.id,
                        procedure_title=procedure.title,
                        severity="error",
                        node_id=node.id,
                        message="Question node must define both yes and no branches or a final outcome.",
                    )
                )

            if node.final_outcome is None and node.yes_next is None and node.no_next is None:
                issues.append(
                    WorkflowValidationIssue(
                        procedure_id=procedure.id,
                        procedure_title=procedure.title,
                        severity="warning",
                        node_id=node.id,
                        message="Question node ends early and will fall back to manual review.",
                    )
                )

            if (
                node.final_outcome is None
                and node.yes_next is not None
                and node.no_next is not None
                and node.yes_next == node.no_next
            ):
                issues.append(
                    WorkflowValidationIssue(
                        procedure_id=procedure.id,
                        procedure_title=procedure.title,
                        severity="warning",
                        node_id=node.id,
                        message="Yes and no answers converge immediately to the same next node.",
                    )
                )

        if final_outcome_count == 0:
            issues.append(
                WorkflowValidationIssue(
                    procedure_id=procedure.id,
                    procedure_title=procedure.title,
                    severity="error",
                    message="Procedure has no final outcome nodes.",
                )
            )

        root_candidates = [
            node for node in nodes if node.id not in referenced_ids and node.final_outcome is None
        ]
        if not root_candidates:
            issues.append(
                WorkflowValidationIssue(
                    procedure_id=procedure.id,
                    procedure_title=procedure.title,
                    severity="error",
                    message="No non-final root question could be identified.",
                )
            )
            continue

        if len(root_candidates) > 1:
            issues.append(
                WorkflowValidationIssue(
                    procedure_id=procedure.id,
                    procedure_title=procedure.title,
                    severity="warning",
                    message="More than one possible root question was found.",
                )
            )

        root = find_root_node(procedure)
        if root is None:
            issues.append(
                WorkflowValidationIssue(
                    procedure_id=procedure.id,
                    procedure_title=procedure.title,
                    severity="error",
                    message="The root question could not be resolved.",
                )
            )
            continue

        reachable = _walk_reachable(node_map, root.id)
        for node in nodes:
            if node.id not in reachable:
                issues.append(
                    WorkflowValidationIssue(
                        procedure_id=procedure.id,
                        procedure_title=procedure.title,
                        severity="warning",
                        node_id=node.id,
                        message="Node is not reachable from the root question.",
                    )
                )

        for node_id in reachable:
            node = node_map[node_id]
            if node.final_outcome is None and not _can_reach_final_outcome(node_map, node_id):
                issues.append(
                    WorkflowValidationIssue(
                        procedure_id=procedure.id,
                        procedure_title=procedure.title,
                        severity="error",
                        node_id=node.id,
                        message="Reachable question cannot reach a final outcome.",
                    )
                )

        if _has_cycle(node_map):
            issues.append(
                WorkflowValidationIssue(
                    procedure_id=procedure.id,
                    procedure_title=procedure.title,
                    severity="error",
                    message="Cycle detected in decision tree.",
                )
            )

    error_count = sum(1 for issue in issues if issue.severity == "error")
    warning_count = sum(1 for issue in issues if issue.severity == "warning")

    return WorkflowValidationReport(
        validated_procedures=len(procedures),
        validated_nodes=validated_nodes,
        error_count=error_count,
        warning_count=warning_count,
        issues=issues,
    )
