import unittest

from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.db.sample_data import SAMPLE_PROCEDURES
from app.db.seed import seed_session
from app.models.models import DecisionNode, LinkedNode, Procedure, Tag
from app.schemas.feedback import FeedbackCreateRequest
from app.services.feedback_service import (
    create_feedback,
    export_feedback_csv,
    export_feedback_language_candidates_csv,
    get_feedback_by_branch,
    get_feedback_by_procedure,
    get_feedback_by_tag,
    get_feedback_language_candidates,
    get_feedback_summary,
)
from app.services.family_service import get_repair_family_detail, list_repair_families
from app.services.procedure_service import get_related_procedures
from app.services.search_service import search_procedures
from app.services.triage_service import next_triage_step, start_triage
from app.services.workflow_validation_service import validate_procedure_workflows


class SearchAndTriageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_engine(
            "sqlite://",
            future=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(cls.engine, "connect")
        def set_sqlite_pragma(dbapi_connection, _) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        cls.SessionLocal = sessionmaker(
            bind=cls.engine,
            autoflush=False,
            autocommit=False,
            future=True,
        )
        Base.metadata.create_all(bind=cls.engine)

        with cls.SessionLocal() as db:
            seed_session(db)
            db.add(
                Procedure(
                    id=999,
                    title="Broken Flow Procedure",
                    category="Power",
                    description="A deliberately incomplete flow for regression coverage.",
                    steps={
                        "immediate_action": "Ask one quick question, then escalate.",
                        "related_actions": ["Escalate to manual review."],
                        "customer_care": {
                            "greeting": "Start with: 'I'll do a quick check first.'",
                            "listening": "Listen for recent symptoms before escalating.",
                            "expectation": "Set expectation: 'If the flow ends early, I'll move this for manual review.'",
                        },
                    },
                    outcome="Broken flow",
                    warranty_status="Manual review",
                )
            )
            db.flush()
            db.add(
                DecisionNode(
                    id=9901,
                    procedure_id=999,
                    question="Does the flow continue correctly?",
                    yes_next=None,
                    no_next=None,
                    final_outcome=None,
                )
            )
            db.commit()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()

    def test_search_returns_best_power_match_for_vibration_query(self) -> None:
        with self.SessionLocal() as db:
            response = search_procedures(db, "phone not turning on but vibrates")

        self.assertFalse(response.no_match)
        self.assertIsNotNone(response.best_match)
        self.assertEqual(response.best_match.title, "Phone Not Powering On")
        self.assertEqual(response.structured_intent.issue_type, "Power & Thermal")
        self.assertIn("vibrate", response.structured_intent.symptoms)
        self.assertGreaterEqual(response.confidence, 0.5)

    def test_search_matches_audio_issue_from_mouthpiece_keyword(self) -> None:
        with self.SessionLocal() as db:
            response = search_procedures(db, "mouthpiece not working")

        self.assertFalse(response.no_match)
        self.assertIsNotNone(response.best_match)
        self.assertEqual(response.best_match.title, "Speaker, Microphone, or Audio Issue")
        self.assertEqual(response.structured_intent.issue_type, "Connectivity & I/O")

    def test_search_matches_security_issue_from_forgot_pattern(self) -> None:
        with self.SessionLocal() as db:
            response = search_procedures(db, "forgot pattern")

        self.assertFalse(response.no_match)
        self.assertIsNotNone(response.best_match)
        self.assertEqual(response.best_match.title, "FRP, Password, or Locked Device")
        self.assertEqual(response.structured_intent.issue_type, "Security & Access")

    def test_search_matches_repair_ticket_operational_query(self) -> None:
        with self.SessionLocal() as db:
            response = search_procedures(db, "repair ticket and legal status")

        self.assertFalse(response.no_match)
        self.assertIsNotNone(response.best_match)
        self.assertEqual(response.best_match.title, "Repair Ticket, Dispatch, or Legal Status Handling")
        self.assertEqual(response.structured_intent.issue_type, "Operations & Compliance")

    def test_search_matches_replacement_query(self) -> None:
        with self.SessionLocal() as db:
            response = search_procedures(db, "replacement device after theft")

        self.assertFalse(response.no_match)
        self.assertIsNotNone(response.best_match)
        self.assertEqual(response.best_match.title, "Replacement Request Eligibility")
        self.assertEqual(response.structured_intent.issue_type, "Replacements & Transfers")

    def test_search_offers_keyword_match_for_vague_physical_damage_phrase(self) -> None:
        with self.SessionLocal() as db:
            response = search_procedures(db, "simty broken")

        self.assertFalse(response.no_match)
        self.assertIsNotNone(response.best_match)
        self.assertEqual(response.best_match.title, "Liquid or Physical Damage")

    def test_search_matches_samsung_sentence_query(self) -> None:
        with self.SessionLocal() as db:
            response = search_procedures(
                db,
                "my Samsung Galaxy is not charging even with the Samsung charger",
            )

        self.assertFalse(response.no_match)
        self.assertIsNotNone(response.best_match)
        self.assertEqual(response.best_match.title, "Charging Issue")
        self.assertEqual(response.structured_intent.issue_type, "Power & Thermal")

    def test_search_marks_tight_match_for_review(self) -> None:
        with self.SessionLocal() as db:
            response = search_procedures(db, "battery drains fast even when idle")

        self.assertFalse(response.no_match)
        self.assertTrue(response.needs_review)
        self.assertEqual(response.confidence_state, "caution")
        self.assertLess(response.confidence_margin, 0.12)

    def test_search_returns_no_match_for_unrelated_text(self) -> None:
        with self.SessionLocal() as db:
            response = search_procedures(db, "warehouse forklift invoice mismatch")

        self.assertTrue(response.no_match)
        self.assertIsNone(response.best_match)
        self.assertIn("Try a shorter description", response.suggested_next_step)

    def test_related_procedures_return_linked_items(self) -> None:
        with self.SessionLocal() as db:
            related = get_related_procedures(db, 1)

        titles = {item.title for item in related}
        self.assertTrue(
            {"Screen Issue", "Charging Issue", "Overheating or Swollen Battery"}.issubset(titles)
        )

    def test_repair_family_workspace_returns_expected_family_procedures(self) -> None:
        with self.SessionLocal() as db:
            families = list_repair_families(db)
            display_family = get_repair_family_detail(db, "display")

        family_ids = {item.id for item in families}
        self.assertIn("display", family_ids)
        self.assertIn("power", family_ids)
        self.assertIsNotNone(display_family)
        assert display_family is not None
        self.assertEqual(display_family.title, "Display & Vision")
        self.assertIn("cracked screen", display_family.symptom_prompts)
        self.assertGreater(len(display_family.focus_cards), 0)
        self.assertGreater(len(display_family.common_categories), 0)
        self.assertGreater(len(display_family.procedure_groups), 0)
        self.assertGreater(len(display_family.branch_checks), 0)
        self.assertGreater(len(display_family.escalation_signals), 0)
        self.assertEqual(
            {item.title for item in display_family.procedures},
            {"Screen Issue"},
        )
        self.assertIn(
            "Liquid or Physical Damage",
            {
                item.title
                for category in display_family.common_categories
                for item in category.supporting_procedures
            },
        )

    def test_start_triage_returns_first_question_and_progress(self) -> None:
        with self.SessionLocal() as db:
            response = start_triage(db, 1)

        self.assertIsNotNone(response)
        assert response is not None
        self.assertEqual(response.status, "question")
        self.assertEqual(response.current_node.id, 101)
        self.assertEqual(response.progress.step, 1)
        self.assertEqual(response.progress.total, 5)
        self.assertIn("Samsung Galaxy", response.customer_care.expectation)

    def test_triage_layers_include_samsung_branch_guidance(self) -> None:
        with self.SessionLocal() as db:
            response = start_triage(db, 13)

        self.assertIsNotNone(response)
        assert response is not None
        self.assertTrue(
            any("Maintenance mode" in action for action in response.sop.related_actions)
        )

    def test_triage_yes_branch_reaches_expected_final_outcome(self) -> None:
        with self.SessionLocal() as db:
            first_step = next_triage_step(db, 101, "yes")
            second_step = next_triage_step(db, 102, "yes")
            final_step = next_triage_step(db, 110, "yes")

        self.assertIsNotNone(first_step)
        self.assertEqual(first_step.status, "question")
        self.assertEqual(first_step.next_node.id, 102)

        self.assertIsNotNone(second_step)
        self.assertEqual(second_step.status, "question")
        self.assertEqual(second_step.next_node.id, 110)

        self.assertIsNotNone(final_step)
        self.assertEqual(final_step.status, "complete")
        self.assertIn("Visible display damage", final_step.outcome.diagnosis)
        self.assertEqual(final_step.progress.step, 4)
        self.assertEqual(final_step.outcome.decision_type, "repair_intake")
        self.assertEqual(final_step.outcome.decision_label, "Book repair intake")
        self.assertEqual(final_step.outcome.warranty_assessment.direction, "likely_out_of_warranty")
        self.assertGreater(len(final_step.outcome.branch_playbook.steps), 0)
        self.assertGreater(len(final_step.outcome.evidence_checklist), 0)
        self.assertTrue(any("photos" in item.lower() for item in final_step.outcome.evidence_checklist))

    def test_operational_outcomes_include_samsung_handover_guidance(self) -> None:
        with self.SessionLocal() as db:
            final_step = next_triage_step(db, 1303, "yes")

        self.assertIsNotNone(final_step)
        assert final_step is not None
        self.assertEqual(final_step.status, "complete")
        self.assertTrue(
            any("Maintenance mode" in action for action in final_step.outcome.related_actions)
        )
        self.assertIn("Galaxy-specific", final_step.outcome.follow_up_message)
        self.assertEqual(final_step.outcome.decision_type, "service_centre")
        self.assertEqual(final_step.outcome.decision_label, "Send to service centre")
        self.assertGreater(len(final_step.outcome.evidence_checklist), 0)

    def test_policy_pause_outcomes_use_verify_requirements_label(self) -> None:
        with self.SessionLocal() as db:
            final_step = next_triage_step(db, 1402, "no")

        self.assertIsNotNone(final_step)
        assert final_step is not None
        self.assertEqual(final_step.status, "complete")
        self.assertEqual(final_step.outcome.decision_type, "verify_requirements")
        self.assertEqual(final_step.outcome.decision_label, "Pause and verify requirements")
        self.assertEqual(final_step.outcome.evidence_checklist, [])

    def test_incomplete_flow_returns_manual_review_outcome(self) -> None:
        with self.SessionLocal() as db:
            start_response = start_triage(db, 999)
            next_response = next_triage_step(db, 9901, "yes")

        self.assertIsNotNone(start_response)
        assert start_response is not None
        self.assertEqual(start_response.status, "question")
        self.assertEqual(start_response.current_node.id, 9901)

        self.assertIsNotNone(next_response)
        self.assertEqual(next_response.status, "complete")
        self.assertEqual(next_response.outcome.diagnosis, "This flow is incomplete")
        self.assertIn("manual review", next_response.outcome.recommended_action.lower())
        self.assertEqual(next_response.outcome.decision_type, "service_centre")
        self.assertEqual(next_response.outcome.decision_label, "Send to service centre")
        self.assertGreater(len(next_response.outcome.evidence_checklist), 0)

    def test_missing_node_returns_none(self) -> None:
        with self.SessionLocal() as db:
            response = next_triage_step(db, 123456, "yes")

        self.assertIsNone(response)

    def test_seed_session_is_idempotent(self) -> None:
        with self.SessionLocal() as db:
            before_counts = {
                "procedures": db.scalar(select(func.count(Procedure.id))),
                "tags": db.scalar(select(func.count(Tag.id))),
                "decision_nodes": db.scalar(select(func.count(DecisionNode.id))),
                "linked_nodes": db.scalar(select(func.count(LinkedNode.id))),
            }

            seed_session(db)
            db.commit()

            after_counts = {
                "procedures": db.scalar(select(func.count(Procedure.id))),
                "tags": db.scalar(select(func.count(Tag.id))),
                "decision_nodes": db.scalar(select(func.count(DecisionNode.id))),
                "linked_nodes": db.scalar(select(func.count(LinkedNode.id))),
            }

        self.assertEqual(before_counts, after_counts)

    def test_seed_session_refreshes_existing_procedure_metadata(self) -> None:
        with self.SessionLocal() as db:
            procedure = db.get(Procedure, 1)
            assert procedure is not None
            procedure.category = "Legacy Category"
            procedure.description = "Old description"
            db.commit()

            seed_session(db)
            db.commit()

            refreshed = db.get(Procedure, 1)

        self.assertIsNotNone(refreshed)
        assert refreshed is not None
        self.assertEqual(refreshed.category, "Power & Thermal")
        self.assertIn("stays black after the power key", refreshed.description)

    def test_sample_knowledge_base_has_complete_triage_paths(self) -> None:
        for procedure in SAMPLE_PROCEDURES:
            self.assertGreater(
                len(procedure["tags"]),
                0,
                f"{procedure['title']} must include search tags",
            )
            self.assertLessEqual(
                len(procedure["warranty_status"]),
                120,
                f"{procedure['title']} warranty_status must fit the procedure schema",
            )

            node_ids = {node["id"] for node in procedure["nodes"]}
            self.assertGreater(
                len(node_ids),
                0,
                f"{procedure['title']} must include at least one decision node",
            )

            for node in procedure["nodes"]:
                final_outcome = node["final_outcome"]
                yes_next = node["yes_next"]
                no_next = node["no_next"]

                if yes_next is not None:
                    self.assertIn(
                        yes_next,
                        node_ids,
                        f"{procedure['title']} node {node['id']} has a broken yes_next link",
                    )
                if no_next is not None:
                    self.assertIn(
                        no_next,
                        node_ids,
                        f"{procedure['title']} node {node['id']} has a broken no_next link",
                    )

                if final_outcome is None:
                    self.assertTrue(
                        yes_next is not None or no_next is not None,
                        f"{procedure['title']} node {node['id']} needs a next node or final outcome",
                    )
                    continue

                for key in (
                    "diagnosis",
                    "recommended_action",
                    "warranty_status",
                    "related_actions",
                    "follow_up_message",
                ):
                    self.assertIn(
                        key,
                        final_outcome,
                        f"{procedure['title']} node {node['id']} final outcome is missing {key}",
                    )

    def test_feedback_entry_is_saved_and_counted(self) -> None:
        with self.SessionLocal() as db:
            before_summary = get_feedback_summary(db)
            response = create_feedback(
                db,
                FeedbackCreateRequest(
                    helpful=True,
                    procedure_id=1,
                    query="phone not turning on but vibrates",
                    branch_label="Kampala Central",
                    comment="This was clear and quick to use.",
                    outcome_diagnosis="The phone is receiving power but the display path may be damaged.",
                    feedback_tags=["should_have_solved_at_branch"],
                    triage_trace=[{"node_id": 101, "question": "Does the phone show any sign of life?", "answer": "yes"}],
                    final_decision_label="Book repair intake",
                    search_confidence=0.89,
                    search_confidence_state="strong",
                ),
            )
            summary = get_feedback_summary(db)

        self.assertGreater(response.id, 0)
        self.assertEqual(summary.total_submissions, before_summary.total_submissions + 1)
        self.assertEqual(summary.helpful_count, before_summary.helpful_count + 1)
        self.assertEqual(summary.not_helpful_count, before_summary.not_helpful_count)
        self.assertEqual(summary.latest_submissions[0].branch_label, "Kampala Central")
        self.assertEqual(summary.latest_submissions[0].feedback_tags, ["should_have_solved_at_branch"])
        self.assertEqual(summary.latest_submissions[0].final_decision_label, "Book repair intake")
        self.assertEqual(summary.latest_submissions[0].triage_trace[0]["node_id"], 101)

    def test_feedback_rejects_unknown_procedure(self) -> None:
        with self.SessionLocal() as db:
            with self.assertRaises(ValueError):
                create_feedback(
                    db,
                    FeedbackCreateRequest(
                        helpful=False,
                        procedure_id=123456,
                        comment="The flow did not fit the case.",
                    ),
                )

    def test_workflow_validation_passes_seeded_sample_data(self) -> None:
        temp_engine = create_engine(
            "sqlite://",
            future=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(temp_engine, "connect")
        def set_temp_sqlite_pragma(dbapi_connection, _) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        temp_session_local = sessionmaker(
            bind=temp_engine,
            autoflush=False,
            autocommit=False,
            future=True,
        )
        Base.metadata.create_all(bind=temp_engine)

        try:
            with temp_session_local() as db:
                seed_session(db)
                db.commit()
                report = validate_procedure_workflows(db)
        finally:
            temp_engine.dispose()

        self.assertEqual(report.error_count, 0)
        self.assertEqual(report.warning_count, 0)
        self.assertEqual(report.validated_procedures, 16)

    def test_feedback_reporting_breakdowns_and_export(self) -> None:
        with self.SessionLocal() as db:
            create_feedback(
                db,
                FeedbackCreateRequest(
                    helpful=True,
                    procedure_id=1,
                    query="phone not charging when i insert a charger",
                    branch_label="Kampala Central",
                    comment="Helpful power guidance.",
                    feedback_tags=["wrong_match"],
                ),
            )
            create_feedback(
                db,
                FeedbackCreateRequest(
                    helpful=False,
                    procedure_id=2,
                    query="lines in screen and touch not working",
                    branch_label="Jinja",
                    comment="Screen path needs a clearer branch.",
                    feedback_tags=["confusing_question", "should_have_solved_at_branch"],
                ),
            )

            by_procedure = get_feedback_by_procedure(db, days=30)
            by_branch = get_feedback_by_branch(db, days=30)
            by_tag = get_feedback_by_tag(db, days=30)
            language_candidates = get_feedback_language_candidates(db, days=30, limit=10)
            exported_csv = export_feedback_csv(db, days=30)
            language_csv = export_feedback_language_candidates_csv(db, days=30, limit=10)

        procedure_titles = {item.procedure_title for item in by_procedure.items}
        branch_labels = {item.branch_label for item in by_branch.items}

        self.assertIn("Phone Not Powering On", procedure_titles)
        self.assertIn("Screen Issue", procedure_titles)
        self.assertIn("Kampala Central", branch_labels)
        self.assertIn("Jinja", branch_labels)
        self.assertIn("confusing_question", {item.tag for item in by_tag.items})
        self.assertGreaterEqual(len(language_candidates.items), 2)
        self.assertEqual(
            language_candidates.items[0].sample_query,
            "lines in screen and touch not working",
        )
        self.assertIn("procedure_title", exported_csv)
        self.assertIn("Helpful power guidance.", exported_csv)
        self.assertIn("Screen path needs a clearer branch.", exported_csv)
        self.assertIn("feedback_tags", exported_csv)
        self.assertIn("sample_query", language_csv)
        self.assertIn("lines in screen and touch not working", language_csv)
