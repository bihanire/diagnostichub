import unittest
from tempfile import TemporaryDirectory

from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.db.export_sop import export_sample_sop_directory
from app.db.import_sop import (
    DecisionNodeRow,
    ProcedureRow,
    SopImportError,
    SopImportPackage,
    TagRow,
    import_sop_session,
    load_sop_directory,
    validate_import_package,
)
from app.db.sample_data import DEFAULT_SOP_PACK_PATH, SAMPLE_PROCEDURES
from app.models.models import DecisionNode, FeedbackEntry, Procedure, Tag


def build_package(*, broken_next_id: int | None = None) -> SopImportPackage:
    next_id = broken_next_id if broken_next_id is not None else 5002
    return SopImportPackage(
        procedures=[
            ProcedureRow(
                id=50,
                title="Accessory Test",
                category="Charging",
                description="Use when the customer may have an accessory-related complaint.",
                immediate_action="Check the accessory before booking device repair.",
                explanation="This flow separates accessory faults from device faults.",
                warranty_status="Depends on accessory condition and inspection.",
                outcome="Accessory test complete.",
                customer_greeting="Start with: 'I will check the accessory first.'",
                customer_listening="Listen for when the accessory stopped working.",
                customer_expectation="Set expectation: 'This quick check tells us the next step.'",
                related_actions=["Check cable", "Check charger"],
            )
        ],
        tags=[TagRow(procedure_id=50, keyword="charger issue")],
        decision_nodes=[
            DecisionNodeRow(
                id=5001,
                procedure_id=50,
                question="Does the issue happen with a known-good charger?",
                yes_next=next_id,
                no_next=5003,
                diagnosis="",
                recommended_action="",
                outcome_warranty_status="",
                related_actions=[],
                follow_up_message="",
            ),
            DecisionNodeRow(
                id=5002,
                procedure_id=50,
                question="Outcome",
                yes_next=None,
                no_next=None,
                diagnosis="The device may need inspection.",
                recommended_action="Book inspection after confirming accessory condition.",
                outcome_warranty_status="Depends on inspection.",
                related_actions=["Record charger used"],
                follow_up_message="Explain that the known-good charger did not resolve the issue.",
            ),
            DecisionNodeRow(
                id=5003,
                procedure_id=50,
                question="Outcome",
                yes_next=None,
                no_next=None,
                diagnosis="The accessory may be faulty.",
                recommended_action="Replace or inspect the accessory before device repair.",
                outcome_warranty_status="Accessory warranty depends on condition.",
                related_actions=["Test another cable"],
                follow_up_message="Explain that the phone responded with a known-good accessory.",
            ),
        ],
        linked_procedures=[],
    )


class SopImportTests(unittest.TestCase):
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

    def test_import_sop_session_loads_valid_package(self) -> None:
        package = build_package()

        with self.SessionLocal() as db:
            import_sop_session(db, package)
            db.commit()

            procedure = db.get(Procedure, 50)
            tags = db.scalars(select(Tag).where(Tag.procedure_id == 50)).all()
            first_node = db.get(DecisionNode, 5001)

        self.assertIsNotNone(procedure)
        assert procedure is not None
        self.assertEqual(procedure.title, "Accessory Test")
        self.assertEqual(procedure.steps["customer_care"]["greeting"], "Start with: 'I will check the accessory first.'")
        self.assertEqual([tag.keyword for tag in tags], ["charger issue"])
        self.assertIsNotNone(first_node)
        assert first_node is not None
        self.assertEqual(first_node.yes_next, 5002)
        self.assertEqual(first_node.no_next, 5003)

    def test_validate_import_package_rejects_broken_node_link(self) -> None:
        package = build_package(broken_next_id=5999)

        with self.assertRaisesRegex(SopImportError, "broken yes_next link"):
            validate_import_package(package)

    def test_import_sop_session_requires_replace_for_existing_procedure(self) -> None:
        package = build_package()

        with self.SessionLocal() as db:
            import_sop_session(db, package)
            db.commit()

        with self.SessionLocal() as db:
            with self.assertRaisesRegex(SopImportError, "--replace"):
                import_sop_session(db, package)

    def test_import_sop_session_can_replace_existing_procedure(self) -> None:
        package = build_package()

        with self.SessionLocal() as db:
            import_sop_session(db, package)
            db.commit()

        updated_package = build_package()
        updated_procedure = ProcedureRow(
            **{
                **updated_package.procedures[0].__dict__,
                "title": "Updated Accessory Test",
            }
        )
        updated_package = SopImportPackage(
            procedures=[updated_procedure],
            tags=updated_package.tags,
            decision_nodes=updated_package.decision_nodes,
            linked_procedures=updated_package.linked_procedures,
        )

        with self.SessionLocal() as db:
            import_sop_session(db, updated_package, replace=True)
            db.commit()
            procedure = db.get(Procedure, 50)

        self.assertIsNotNone(procedure)
        assert procedure is not None
        self.assertEqual(procedure.title, "Updated Accessory Test")

    def test_import_replace_preserves_feedback_references(self) -> None:
        package = build_package()

        with self.SessionLocal() as db:
            import_sop_session(db, package)
            db.add(
                FeedbackEntry(
                    helpful=True,
                    procedure_id=50,
                    query="charger issue",
                    comment="Resolved at branch.",
                )
            )
            db.commit()

        updated_package = build_package()
        updated_procedure = ProcedureRow(
            **{
                **updated_package.procedures[0].__dict__,
                "title": "Accessory Test Refined",
            }
        )
        updated_package = SopImportPackage(
            procedures=[updated_procedure],
            tags=updated_package.tags,
            decision_nodes=updated_package.decision_nodes,
            linked_procedures=updated_package.linked_procedures,
        )

        with self.SessionLocal() as db:
            import_sop_session(db, updated_package, replace=True)
            db.commit()
            feedback = db.scalar(select(FeedbackEntry))
            procedure = db.get(Procedure, 50)

        self.assertIsNotNone(feedback)
        assert feedback is not None
        self.assertEqual(feedback.procedure_id, 50)
        self.assertIsNotNone(procedure)
        assert procedure is not None
        self.assertEqual(procedure.title, "Accessory Test Refined")

    def test_exported_sample_pack_round_trips_through_import_pipeline(self) -> None:
        with TemporaryDirectory() as temp_dir:
            export_sample_sop_directory(temp_dir)
            package = load_sop_directory(temp_dir)
            validate_import_package(package)

        with self.SessionLocal() as db:
            import_sop_session(db, package)
            db.commit()

            procedure_count = db.scalar(select(func.count(Procedure.id)))
            tag_count = db.scalar(select(func.count(Tag.id)))
            first_node = db.get(DecisionNode, 101)

        self.assertEqual(len(package.procedures), 16)
        self.assertGreater(len(package.tags), 100)
        self.assertGreater(len(package.decision_nodes), 50)
        self.assertIsNotNone(first_node)
        assert first_node is not None
        self.assertEqual(first_node.yes_next, 102)
        self.assertEqual(first_node.no_next, 104)
        self.assertEqual(procedure_count, 16)
        self.assertEqual(tag_count, len(package.tags))

    def test_sample_procedures_are_loaded_from_the_canonical_sop_pack(self) -> None:
        package = load_sop_directory(DEFAULT_SOP_PACK_PATH)

        self.assertEqual(len(SAMPLE_PROCEDURES), len(package.procedures))
        self.assertEqual(
            [procedure["title"] for procedure in SAMPLE_PROCEDURES],
            [procedure.title for procedure in sorted(package.procedures, key=lambda item: item.id)],
        )
        self.assertEqual(
            sum(len(procedure["tags"]) for procedure in SAMPLE_PROCEDURES),
            len(package.tags),
        )
