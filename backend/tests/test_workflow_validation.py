import unittest

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.db.seed import seed_session
from app.models.models import DecisionNode, Procedure
from app.services.workflow_validation_service import validate_procedure_workflows


def _valid_outcome(**overrides):
    outcome = {
        "diagnosis": "The guided path reached a complete outcome.",
        "recommended_action": "Resolve at branch: explain the completed branch check.",
        "warranty_status": "No repair decision needed.",
        "related_actions": ["Record the branch finding."],
        "follow_up_message": "Tell the customer what was confirmed.",
    }
    outcome.update(overrides)
    return outcome


class WorkflowValidationStageFourTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            future=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def set_sqlite_pragma(dbapi_connection, _) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        self.SessionLocal = sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
            future=True,
        )
        Base.metadata.create_all(bind=self.engine)

    def tearDown(self) -> None:
        self.engine.dispose()

    def _add_procedure(self, db, *nodes: DecisionNode) -> None:
        procedure = Procedure(
            id=7000,
            title="Stage Four Validation Fixture",
            category="Power & Thermal",
            description="Synthetic procedure used only for workflow integrity tests.",
            steps={
                "immediate_action": "Ask the guided question.",
                "customer_care": {
                    "greeting": "Start with a calm branch check.",
                    "listening": "Listen for the customer's exact symptom.",
                    "expectation": "Set expectation before continuing.",
                },
            },
            outcome="Workflow validation fixture.",
            warranty_status="Depends on final diagnosis.",
        )
        db.add(procedure)
        db.flush()
        branch_links: list[tuple[DecisionNode, int | None, int | None]] = []
        for node in nodes:
            branch_links.append((node, node.yes_next, node.no_next))
            node.procedure_id = procedure.id
            node.yes_next = None
            node.no_next = None
            db.add(node)
        db.flush()
        for node, yes_next, no_next in branch_links:
            node.yes_next = yes_next
            node.no_next = no_next
        db.commit()

    def test_seeded_workflows_have_complete_terminal_paths(self) -> None:
        with self.SessionLocal() as db:
            seed_session(db)
            db.commit()
            report = validate_procedure_workflows(db)

        self.assertEqual(report.error_count, 0)
        self.assertEqual(report.warning_count, 0)
        self.assertEqual(report.validated_procedures, 17)

    def test_validator_rejects_missing_final_outcome_keys(self) -> None:
        with self.SessionLocal() as db:
            self._add_procedure(
                db,
                DecisionNode(id=7001, question="Does it continue?", yes_next=7002, no_next=7003),
                DecisionNode(
                    id=7002,
                    question="Outcome",
                    final_outcome=_valid_outcome(follow_up_message=""),
                ),
                DecisionNode(
                    id=7003,
                    question="Outcome",
                    final_outcome={"diagnosis": "Too thin"},
                ),
            )
            report = validate_procedure_workflows(db)

        messages = {issue.message for issue in report.issues}
        self.assertGreaterEqual(report.error_count, 2)
        self.assertIn("Final outcome has blank required text: follow_up_message", messages)
        self.assertTrue(
            any(
                message.startswith("Final outcome is missing required keys:")
                for message in messages
            )
        )

    def test_validator_rejects_one_sided_question_branches(self) -> None:
        with self.SessionLocal() as db:
            self._add_procedure(
                db,
                DecisionNode(id=7001, question="Does it continue?", yes_next=7002, no_next=None),
                DecisionNode(id=7002, question="Outcome", final_outcome=_valid_outcome()),
            )
            report = validate_procedure_workflows(db)

        self.assertTrue(
            any(
                issue.severity == "error"
                and issue.node_id == 7001
                and issue.message
                == "Question node must define both yes and no branches or a final outcome."
                for issue in report.issues
            )
        )

    def test_validator_rejects_reachable_questions_without_terminal_outcome(self) -> None:
        with self.SessionLocal() as db:
            self._add_procedure(
                db,
                DecisionNode(id=7001, question="Start?", yes_next=7002, no_next=7003),
                DecisionNode(id=7002, question="Loop A?", yes_next=7003, no_next=7003),
                DecisionNode(id=7003, question="Loop B?", yes_next=7002, no_next=7002),
            )
            report = validate_procedure_workflows(db)

        messages = [issue.message for issue in report.issues]
        self.assertIn("Procedure has no final outcome nodes.", messages)
        self.assertIn("Cycle detected in decision tree.", messages)
        self.assertTrue(
            any(
                message == "Reachable question cannot reach a final outcome."
                for message in messages
            )
        )

    def test_validator_warns_when_yes_and_no_immediately_converge(self) -> None:
        with self.SessionLocal() as db:
            self._add_procedure(
                db,
                DecisionNode(
                    id=7001, question="Does either answer converge?", yes_next=7002, no_next=7002
                ),
                DecisionNode(id=7002, question="Outcome", final_outcome=_valid_outcome()),
            )
            report = validate_procedure_workflows(db)

        self.assertEqual(report.error_count, 0)
        self.assertTrue(
            any(
                issue.severity == "warning"
                and issue.node_id == 7001
                and issue.message
                == "Yes and no answers converge immediately to the same next node."
                for issue in report.issues
            )
        )
