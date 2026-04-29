from collections import deque

from sqlalchemy.orm import Session

from app.models.models import DecisionNode, Procedure
from app.schemas.system import WorkflowValidationIssue, WorkflowValidationReport
from app.services.procedure_service import procedure_query
from app.services.triage_service import find_root_node


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

            if node.final_outcome and (node.yes_next is not None or node.no_next is not None):
                issues.append(
                    WorkflowValidationIssue(
                        procedure_id=procedure.id,
                        procedure_title=procedure.title,
                        severity="error",
                        node_id=node.id,
                        message="Final outcome node should not point to another node.",
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
