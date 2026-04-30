from sqlalchemy.orm import Session

from app.models.models import Procedure
from app.schemas.system import DataIntegrityIssue, DataIntegrityReport
from app.services.procedure_service import procedure_query_with

_REQUIRED_OUTCOME_KEYS = (
    "diagnosis",
    "recommended_action",
    "warranty_status",
    "related_actions",
    "follow_up_message",
)


def _is_blank(value: str | None) -> bool:
    return not value or not value.strip()


def validate_data_integrity(db: Session) -> DataIntegrityReport:
    procedures = db.scalars(
        procedure_query_with(
            include_tags=True,
            include_decision_nodes=True,
            include_links=False,
        ).order_by(Procedure.id)
    ).all()

    issues: list[DataIntegrityIssue] = []
    validated_nodes = 0

    for procedure in procedures:
        if _is_blank(procedure.title):
            issues.append(
                DataIntegrityIssue(
                    severity="error",
                    procedure_id=procedure.id,
                    message="Procedure title is blank.",
                )
            )
        if _is_blank(procedure.category):
            issues.append(
                DataIntegrityIssue(
                    severity="error",
                    procedure_id=procedure.id,
                    message="Procedure category is blank.",
                )
            )
        if _is_blank(procedure.description):
            issues.append(
                DataIntegrityIssue(
                    severity="error",
                    procedure_id=procedure.id,
                    message="Procedure description is blank.",
                )
            )
        if not isinstance(procedure.steps, dict):
            issues.append(
                DataIntegrityIssue(
                    severity="error",
                    procedure_id=procedure.id,
                    message="Procedure steps payload must be a JSON object.",
                )
            )
        elif _is_blank(procedure.steps.get("immediate_action")):
            issues.append(
                DataIntegrityIssue(
                    severity="warning",
                    procedure_id=procedure.id,
                    message="Procedure is missing 'immediate_action' guidance.",
                )
            )

        node_map = {node.id: node for node in procedure.decision_nodes}
        validated_nodes += len(node_map)
        if not node_map:
            issues.append(
                DataIntegrityIssue(
                    severity="error",
                    procedure_id=procedure.id,
                    message="Procedure has no decision nodes.",
                )
            )
            continue

        for node in procedure.decision_nodes:
            if _is_blank(node.question):
                issues.append(
                    DataIntegrityIssue(
                        severity="error",
                        procedure_id=procedure.id,
                        node_id=node.id,
                        message="Decision node question is blank.",
                    )
                )

            if node.yes_next is not None:
                yes_node = node_map.get(node.yes_next)
                if yes_node is None:
                    issues.append(
                        DataIntegrityIssue(
                            severity="error",
                            procedure_id=procedure.id,
                            node_id=node.id,
                            message=f"yes_next points to missing node {node.yes_next}.",
                        )
                    )
                elif yes_node.procedure_id != procedure.id:
                    issues.append(
                        DataIntegrityIssue(
                            severity="error",
                            procedure_id=procedure.id,
                            node_id=node.id,
                            message=f"yes_next points across procedures to node {node.yes_next}.",
                        )
                    )

            if node.no_next is not None:
                no_node = node_map.get(node.no_next)
                if no_node is None:
                    issues.append(
                        DataIntegrityIssue(
                            severity="error",
                            procedure_id=procedure.id,
                            node_id=node.id,
                            message=f"no_next points to missing node {node.no_next}.",
                        )
                    )
                elif no_node.procedure_id != procedure.id:
                    issues.append(
                        DataIntegrityIssue(
                            severity="error",
                            procedure_id=procedure.id,
                            node_id=node.id,
                            message=f"no_next points across procedures to node {node.no_next}.",
                        )
                    )

            if node.final_outcome is None and node.yes_next is None and node.no_next is None:
                issues.append(
                    DataIntegrityIssue(
                        severity="warning",
                        procedure_id=procedure.id,
                        node_id=node.id,
                        message="Question node has no branch and no final outcome.",
                    )
                )
                continue

            if node.final_outcome is not None:
                if not isinstance(node.final_outcome, dict):
                    issues.append(
                        DataIntegrityIssue(
                            severity="error",
                            procedure_id=procedure.id,
                            node_id=node.id,
                            message="final_outcome payload must be a JSON object.",
                        )
                    )
                    continue

                missing_keys = [
                    key
                    for key in _REQUIRED_OUTCOME_KEYS
                    if key not in node.final_outcome
                ]
                if missing_keys:
                    issues.append(
                        DataIntegrityIssue(
                            severity="warning",
                            procedure_id=procedure.id,
                            node_id=node.id,
                            message=(
                                "final_outcome is missing keys: "
                                + ", ".join(sorted(missing_keys))
                            ),
                        )
                    )

                if node.yes_next is not None or node.no_next is not None:
                    issues.append(
                        DataIntegrityIssue(
                            severity="error",
                            procedure_id=procedure.id,
                            node_id=node.id,
                            message="Final outcome node must not branch further.",
                        )
                    )

        if not procedure.tags:
            issues.append(
                DataIntegrityIssue(
                    severity="warning",
                    procedure_id=procedure.id,
                    message="Procedure has no tags, which weakens search precision.",
                )
            )

    error_count = sum(1 for issue in issues if issue.severity == "error")
    warning_count = sum(1 for issue in issues if issue.severity == "warning")
    return DataIntegrityReport(
        validated_procedures=len(procedures),
        validated_nodes=validated_nodes,
        error_count=error_count,
        warning_count=warning_count,
        issues=issues,
    )
