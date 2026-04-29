from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError

from app.core.database import Base, SessionLocal, engine
from app.db.sample_data import SAMPLE_PROCEDURES
from app.models.models import DecisionNode, LinkedNode, Procedure, Tag


def create_schema() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_feedback_schema()


def ensure_feedback_schema() -> None:
    additions = [
        (
            "feedback_tags",
            "ALTER TABLE feedback_entries ADD COLUMN feedback_tags JSON DEFAULT '[]'",
            "ALTER TABLE feedback_entries ADD COLUMN feedback_tags JSONB NOT NULL DEFAULT '[]'::jsonb",
        ),
        (
            "triage_trace",
            "ALTER TABLE feedback_entries ADD COLUMN triage_trace JSON",
            "ALTER TABLE feedback_entries ADD COLUMN triage_trace JSONB",
        ),
        (
            "final_decision_label",
            "ALTER TABLE feedback_entries ADD COLUMN final_decision_label VARCHAR(120)",
            "ALTER TABLE feedback_entries ADD COLUMN final_decision_label VARCHAR(120)",
        ),
        (
            "search_confidence",
            "ALTER TABLE feedback_entries ADD COLUMN search_confidence FLOAT",
            "ALTER TABLE feedback_entries ADD COLUMN search_confidence DOUBLE PRECISION",
        ),
        (
            "search_confidence_state",
            "ALTER TABLE feedback_entries ADD COLUMN search_confidence_state VARCHAR(40)",
            "ALTER TABLE feedback_entries ADD COLUMN search_confidence_state VARCHAR(40)",
        ),
    ]

    dialect = engine.dialect.name
    with engine.begin() as connection:
        inspector = inspect(connection)
        try:
            existing_columns = {
                column["name"] for column in inspector.get_columns("feedback_entries")
            }
        except Exception:
            existing_columns = set()

        for column_name, sqlite_sql, default_sql in additions:
            if column_name in existing_columns:
                continue
            connection.execute(text(sqlite_sql if dialect == "sqlite" else default_sql))
            existing_columns.add(column_name)


def seed_session(db) -> None:
    existing_procedures = {
        procedure.id: procedure for procedure in db.scalars(select(Procedure)).all()
    }

    for procedure_data in SAMPLE_PROCEDURES:
        procedure = existing_procedures.get(procedure_data["id"])
        if procedure is None:
            procedure = Procedure(id=procedure_data["id"])
            db.add(procedure)
            existing_procedures[procedure.id] = procedure

        procedure.title = procedure_data["title"]
        procedure.category = procedure_data["category"]
        procedure.description = procedure_data["description"]
        procedure.steps = procedure_data["steps"]
        procedure.outcome = procedure_data["outcome"]
        procedure.warranty_status = procedure_data["warranty_status"]

    db.flush()

    existing_tag_pairs = set(db.execute(select(Tag.keyword, Tag.procedure_id)).all())
    existing_nodes = {
        node.id: node for node in db.scalars(select(DecisionNode)).all()
    }
    existing_link_pairs = set(
        db.execute(select(LinkedNode.procedure_id, LinkedNode.linked_procedure_id)).all()
    )
    node_relationships: list[tuple[DecisionNode, int | None, int | None]] = []

    for procedure_data in SAMPLE_PROCEDURES:
        for keyword in procedure_data["tags"]:
            tag_key = (keyword, procedure_data["id"])
            if tag_key in existing_tag_pairs:
                continue

            db.add(Tag(keyword=keyword, procedure_id=procedure_data["id"]))
            existing_tag_pairs.add(tag_key)

        for node_data in procedure_data["nodes"]:
            node = existing_nodes.get(node_data["id"])
            if node is None:
                # Create nodes first with blank relationships so self-referencing
                # decision trees can be inserted safely in PostgreSQL.
                node = DecisionNode(
                    id=node_data["id"],
                    procedure_id=procedure_data["id"],
                    question=node_data["question"],
                    yes_next=None,
                    no_next=None,
                    final_outcome=node_data["final_outcome"],
                )
                db.add(node)
                existing_nodes[node.id] = node
            else:
                node.procedure_id = procedure_data["id"]
                node.question = node_data["question"]
                node.final_outcome = node_data["final_outcome"]

            node_relationships.append(
                (node, node_data["yes_next"], node_data["no_next"])
            )

    db.flush()

    for node, yes_next, no_next in node_relationships:
        node.yes_next = yes_next
        node.no_next = no_next

    for procedure_data in SAMPLE_PROCEDURES:
        for linked_procedure_id in procedure_data["links"]:
            link_key = (procedure_data["id"], linked_procedure_id)
            if link_key in existing_link_pairs:
                continue

            db.add(
                LinkedNode(
                    procedure_id=procedure_data["id"],
                    linked_procedure_id=linked_procedure_id,
                )
            )
            existing_link_pairs.add(link_key)


def seed_data() -> None:
    for attempt in range(2):
        with SessionLocal() as db:
            try:
                seed_session(db)
                db.commit()
                return
            except IntegrityError:
                db.rollback()
                if attempt == 1:
                    raise


if __name__ == "__main__":
    create_schema()
    seed_data()
