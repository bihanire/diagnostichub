from __future__ import annotations

from pathlib import Path

from app.db.sop_csv import SopImportPackage, load_sop_directory

DEFAULT_SOP_PACK_PATH = Path(__file__).resolve().parents[3] / "docs" / "sop-import-template"


def build_steps(
    immediate_action: str,
    explanation: str,
    related_actions: list[str],
    greeting: str,
    listening: str,
    expectation: str,
) -> dict:
    return {
        "immediate_action": immediate_action,
        "explanation": explanation,
        "related_actions": related_actions,
        "customer_care": {
            "greeting": greeting,
            "listening": listening,
            "expectation": expectation,
        },
    }


def build_outcome(
    diagnosis: str,
    recommended_action: str,
    warranty_status: str,
    related_actions: list[str],
    follow_up_message: str,
) -> dict:
    return {
        "diagnosis": diagnosis,
        "recommended_action": recommended_action,
        "warranty_status": warranty_status,
        "related_actions": related_actions,
        "follow_up_message": follow_up_message,
    }


def build_node(
    node_id: int,
    question: str,
    yes_next: int | None,
    no_next: int | None,
    final_outcome: dict | None = None,
) -> dict:
    return {
        "id": node_id,
        "question": question,
        "yes_next": yes_next,
        "no_next": no_next,
        "final_outcome": final_outcome,
    }


def build_procedure(
    procedure_id: int,
    title: str,
    category: str,
    description: str,
    steps: dict,
    outcome: str,
    warranty_status: str,
    tags: list[str],
    nodes: list[dict],
    links: list[int],
) -> dict:
    return {
        "id": procedure_id,
        "title": title,
        "category": category,
        "description": description,
        "steps": steps,
        "outcome": outcome,
        "warranty_status": warranty_status,
        "tags": tags,
        "nodes": nodes,
        "links": links,
    }


def load_sample_procedures(path: str | Path = DEFAULT_SOP_PACK_PATH) -> list[dict]:
    package = load_sop_directory(path)
    return package_to_sample_procedures(package)


def package_to_sample_procedures(package: SopImportPackage) -> list[dict]:
    tags_by_procedure: dict[int, list[str]] = {}
    nodes_by_procedure: dict[int, list[dict]] = {}
    links_by_procedure: dict[int, list[int]] = {}

    for tag in package.tags:
        tags_by_procedure.setdefault(tag.procedure_id, []).append(tag.keyword)

    for node in package.decision_nodes:
        final_outcome = None
        if node.is_final:
            final_outcome = build_outcome(
                node.diagnosis,
                node.recommended_action,
                node.outcome_warranty_status,
                node.related_actions,
                node.follow_up_message,
            )

        nodes_by_procedure.setdefault(node.procedure_id, []).append(
            build_node(
                node.id,
                node.question,
                node.yes_next,
                node.no_next,
                final_outcome,
            )
        )

    for link in package.linked_procedures:
        links_by_procedure.setdefault(link.procedure_id, []).append(link.linked_procedure_id)

    procedures: list[dict] = []
    for procedure in sorted(package.procedures, key=lambda item: item.id):
        procedures.append(
            build_procedure(
                procedure.id,
                procedure.title,
                procedure.category,
                procedure.description,
                build_steps(
                    procedure.immediate_action,
                    procedure.explanation,
                    procedure.related_actions,
                    procedure.customer_greeting,
                    procedure.customer_listening,
                    procedure.customer_expectation,
                ),
                procedure.outcome,
                procedure.warranty_status,
                sorted(tags_by_procedure.get(procedure.id, [])),
                sorted(nodes_by_procedure.get(procedure.id, []), key=lambda item: item["id"]),
                sorted(links_by_procedure.get(procedure.id, [])),
            )
        )

    return procedures


SAMPLE_PROCEDURES = load_sample_procedures()
