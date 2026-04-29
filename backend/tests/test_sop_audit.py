import unittest
from tempfile import TemporaryDirectory

from app.db.audit_sop import audit_import_package, audit_sop_directory, render_markdown_report
from app.db.export_sop import export_sample_sop_directory
from app.db.import_sop import (
    DecisionNodeRow,
    LinkedProcedureRow,
    ProcedureRow,
    SopImportPackage,
    TagRow,
)


def build_audit_package() -> SopImportPackage:
    return SopImportPackage(
        procedures=[
            ProcedureRow(
                id=1,
                title="Replacement Flow",
                category="Operations",
                description="Use when a customer asks for a replacement device.",
                immediate_action="Check replacement conditions before dispatch.",
                explanation="This flow keeps replacement handling precise.",
                warranty_status="Policy-based handling.",
                outcome="Replacement guidance complete.",
                customer_greeting="Start with: 'I'll check eligibility first.'",
                customer_listening="Ask what happened to the original device.",
                customer_expectation="Set expectation: 'I'll confirm if this qualifies before I promise a replacement.'",
                related_actions=["Check LS", "Check weekly payments"],
            ),
            ProcedureRow(
                id=2,
                title="Theft Flow",
                category="Security",
                description="Use when the device was stolen.",
                immediate_action="Confirm theft details before guiding the customer.",
                explanation="This flow keeps theft handling safe.",
                warranty_status="Theft is not covered under warranty.",
                outcome="Theft guidance complete.",
                customer_greeting="Start with: 'I'm sorry this happened.'",
                customer_listening="Ask when the device was taken.",
                customer_expectation="Set expectation: 'We'll secure the case first.'",
                related_actions=["Block SIM", "Check abstract"],
            ),
        ],
        tags=[
            TagRow(procedure_id=1, keyword="replacement"),
            TagRow(procedure_id=1, keyword="new phone after theft"),
            TagRow(procedure_id=1, keyword="replacement device"),
            TagRow(procedure_id=1, keyword="stolen ls"),
            TagRow(procedure_id=1, keyword="10 weekly payments"),
            TagRow(procedure_id=1, keyword="ber replacement"),
            TagRow(procedure_id=1, keyword="obs repossessed"),
            TagRow(procedure_id=1, keyword="replace stolen phone"),
            TagRow(procedure_id=2, keyword="stolen phone"),
            TagRow(procedure_id=2, keyword="replacement"),
            TagRow(procedure_id=2, keyword="snatched phone"),
            TagRow(procedure_id=2, keyword="lost phone"),
            TagRow(procedure_id=2, keyword="device stolen"),
            TagRow(procedure_id=2, keyword="track phone"),
            TagRow(procedure_id=2, keyword="block sim"),
            TagRow(procedure_id=2, keyword="police abstract"),
            TagRow(procedure_id=2, keyword="report theft"),
        ],
        decision_nodes=[
            DecisionNodeRow(
                id=101,
                procedure_id=1,
                question="Has the customer completed 10 weekly payments?",
                yes_next=102,
                no_next=103,
                diagnosis="",
                recommended_action="",
                outcome_warranty_status="",
                related_actions=[],
                follow_up_message="",
            ),
            DecisionNodeRow(
                id=102,
                procedure_id=1,
                question="Outcome",
                yes_next=None,
                no_next=None,
                diagnosis="The replacement request appears eligible.",
                recommended_action="Check legal status and complete OBS replacement steps.",
                outcome_warranty_status="Policy-based handling.",
                related_actions=["Check LS", "Complete KYC"],
                follow_up_message="Explain that the branch is moving to the replacement processing steps.",
            ),
            DecisionNodeRow(
                id=103,
                procedure_id=1,
                question="Outcome",
                yes_next=None,
                no_next=None,
                diagnosis="The replacement request is not yet eligible.",
                recommended_action="Advise the customer that the payment condition has not been met.",
                outcome_warranty_status="No replacement approval yet.",
                related_actions=["Review repair path"],
                follow_up_message="Explain that the replacement condition is still incomplete.",
            ),
            DecisionNodeRow(
                id=201,
                procedure_id=2,
                question="Can ownership be verified?",
                yes_next=202,
                no_next=203,
                diagnosis="",
                recommended_action="",
                outcome_warranty_status="",
                related_actions=[],
                follow_up_message="",
            ),
            DecisionNodeRow(
                id=202,
                procedure_id=2,
                question="Outcome",
                yes_next=None,
                no_next=None,
                diagnosis="Ownership can be verified.",
                recommended_action="Guide the customer to upload the police abstract and request the correct legal status.",
                outcome_warranty_status="Theft is not covered under warranty.",
                related_actions=["Check abstract", "Request Stolen LS"],
                follow_up_message="Explain that the branch can continue with theft handling once the ownership and theft records are complete.",
            ),
            DecisionNodeRow(
                id=203,
                procedure_id=2,
                question="Outcome",
                yes_next=None,
                no_next=None,
                diagnosis="Ownership cannot yet be verified.",
                recommended_action="Advise the customer to gather proof of ownership before detailed recovery support.",
                outcome_warranty_status="Theft is not covered under warranty.",
                related_actions=["Advise police reporting"],
                follow_up_message="Explain that the branch needs ownership proof first.",
            ),
        ],
        linked_procedures=[LinkedProcedureRow(procedure_id=1, linked_procedure_id=2)],
    )


class SopAuditTests(unittest.TestCase):
    def test_audit_import_package_flags_shared_ambiguous_tag(self) -> None:
        errors, warnings = audit_import_package(build_audit_package())

        self.assertEqual(errors, [])
        self.assertTrue(
            any("Shared normalized tag 'replacement'" in warning for warning in warnings)
        )

    def test_audit_exported_sample_pack_has_no_errors(self) -> None:
        with TemporaryDirectory() as temp_dir:
            export_sample_sop_directory(temp_dir)
            report = audit_sop_directory(temp_dir)

        self.assertEqual(report.error_count, 0)
        self.assertEqual(report.procedure_count, 16)
        self.assertGreater(report.tag_count, 200)
        self.assertGreater(report.decision_node_count, 100)

    def test_render_markdown_report_includes_summary_table(self) -> None:
        with TemporaryDirectory() as temp_dir:
            export_sample_sop_directory(temp_dir)
            report = audit_sop_directory(temp_dir)
            markdown = render_markdown_report(report)

        self.assertIn("# SOP Quality Report", markdown)
        self.assertIn("| ID | Title | Tags | Final Outcomes | Branch-Resolvable Outcomes |", markdown)
        self.assertIn("## Warnings", markdown)
