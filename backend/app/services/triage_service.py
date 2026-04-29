from collections import deque
from functools import lru_cache

from sqlalchemy.orm import Session

from app.models.models import DecisionNode, Procedure
from app.schemas.common import (
    BranchPlaybookPayload,
    DecisionNodePayload,
    FinalOutcomePayload,
    ProgressPayload,
    WarrantyAssessmentPayload,
)
from app.schemas.triage import TriageNextResponse, TriageStartResponse
from app.services.procedure_service import (
    get_customer_care,
    get_related_procedures,
    get_sop_layers,
    procedure_query_with,
    to_summary,
)
from app.services.samsung_guidance_service import apply_samsung_outcome


def load_procedure(db: Session, procedure_id: int) -> Procedure | None:
    return db.scalar(
        procedure_query_with(
            include_tags=False,
            include_decision_nodes=True,
            include_links=False,
        ).where(Procedure.id == procedure_id)
    )


def build_node_map(procedure: Procedure) -> dict[int, DecisionNode]:
    return {node.id: node for node in procedure.decision_nodes}


def find_root_node(procedure: Procedure) -> DecisionNode | None:
    if not procedure.decision_nodes:
        return None

    referenced: set[int] = set()
    for node in procedure.decision_nodes:
        if node.yes_next:
            referenced.add(node.yes_next)
        if node.no_next:
            referenced.add(node.no_next)

    root_candidates = [
        node for node in procedure.decision_nodes if node.id not in referenced and node.final_outcome is None
    ]
    if root_candidates:
        return sorted(root_candidates, key=lambda item: item.id)[0]
    return sorted(procedure.decision_nodes, key=lambda item: item.id)[0]


def _decision_graph_signature(procedure: Procedure) -> tuple[tuple[int, int | None, int | None, bool], ...]:
    return tuple(
        sorted(
            (
                node.id,
                node.yes_next,
                node.no_next,
                node.final_outcome is not None,
            )
            for node in procedure.decision_nodes
        )
    )


@lru_cache(maxsize=2048)
def _calculate_depths_for_signature(
    signature: tuple[tuple[int, int | None, int | None, bool], ...],
) -> tuple[tuple[tuple[int, int], ...], int]:
    if not signature:
        return tuple(), 1

    node_map = {node_id: (yes_next, no_next, is_final) for node_id, yes_next, no_next, is_final in signature}
    referenced: set[int] = set()
    for _, yes_next, no_next, _ in signature:
        if yes_next is not None:
            referenced.add(yes_next)
        if no_next is not None:
            referenced.add(no_next)

    root_candidates = [
        node_id
        for node_id, _, _, is_final in signature
        if node_id not in referenced and not is_final
    ]
    root_id = min(root_candidates) if root_candidates else min(node_map.keys())

    depths: dict[int, int] = {root_id: 1}
    queue: deque[int] = deque([root_id])
    while queue:
        current_id = queue.popleft()
        current_depth = depths[current_id]
        yes_next, no_next, _ = node_map[current_id]
        for next_id in (yes_next, no_next):
            if next_id is not None and next_id in node_map and next_id not in depths:
                depths[next_id] = current_depth + 1
                queue.append(next_id)

    total_steps = max(depths.values(), default=1)
    return tuple(sorted(depths.items())), total_steps


def calculate_depths(procedure: Procedure) -> tuple[dict[int, int], int]:
    depth_pairs, total_steps = _calculate_depths_for_signature(_decision_graph_signature(procedure))
    return dict(depth_pairs), total_steps


def make_progress(procedure: Procedure, node_id: int | None) -> ProgressPayload:
    depths, total_steps = calculate_depths(procedure)
    if node_id is None:
        return ProgressPayload(step=total_steps, total=total_steps)
    return ProgressPayload(step=depths.get(node_id, 1), total=total_steps)


def build_outcome(procedure: Procedure, outcome_data: dict | None) -> FinalOutcomePayload:
    data = outcome_data or {}
    customer_care = get_customer_care(procedure)
    diagnosis = data.get("diagnosis", procedure.outcome or "Review needed")
    recommended_action = data.get(
        "recommended_action",
        "Escalate to the next support level for manual review.",
    )
    warranty_status = data.get("warranty_status", procedure.warranty_status)
    related_actions = data.get("related_actions", get_sop_layers(procedure).related_actions)
    follow_up_message = data.get(
        "follow_up_message",
        "Tell the customer what you will do next and when they should expect an update.",
    )
    decision_type = data.get("decision_type") or classify_decision_type(
        procedure,
        diagnosis=diagnosis,
        recommended_action=recommended_action,
    )
    decision_label = data.get("decision_label") or decision_label_for_type(decision_type)
    warranty_assessment = build_warranty_assessment(
        procedure,
        diagnosis=diagnosis,
        recommended_action=recommended_action,
        warranty_status=warranty_status,
        decision_type=decision_type,
    )
    branch_playbook = build_branch_playbook(
        procedure,
        decision_type=decision_type,
        recommended_action=recommended_action,
    )
    evidence_checklist = data.get("evidence_checklist") or build_evidence_checklist(
        procedure,
        decision_type=decision_type,
    )
    outcome = FinalOutcomePayload(
        diagnosis=diagnosis,
        recommended_action=recommended_action,
        decision_type=decision_type,
        decision_label=decision_label,
        warranty_status=warranty_status,
        warranty_assessment=warranty_assessment,
        branch_playbook=branch_playbook,
        related_actions=related_actions,
        evidence_checklist=evidence_checklist,
        customer_care=customer_care,
        follow_up_message=follow_up_message,
    )
    return apply_samsung_outcome(procedure, outcome)


def classify_decision_type(
    procedure: Procedure,
    *,
    diagnosis: str,
    recommended_action: str,
) -> str:
    action_text = recommended_action.lower().strip()
    text = f"{procedure.title} {procedure.category} {diagnosis} {recommended_action}".lower()

    if action_text.startswith("resolve at branch:"):
        return "branch_resolve"
    if action_text.startswith("monitor at branch:"):
        return "monitor_return"
    if action_text.startswith("book repair intake:"):
        return "repair_intake"
    if action_text.startswith("send to service centre:"):
        return "service_centre"
    if action_text.startswith("continue branch processing:"):
        return "branch_process"
    if action_text.startswith("pause and verify:"):
        return "verify_requirements"

    if any(
        phrase in text
        for phrase in (
            "monitor",
            "return the phone to normal use",
            "return only if",
            "few charge cycles",
            "short observation period",
        )
    ):
        return "monitor_return"

    if any(
        phrase in text
        for phrase in (
            "avoid courier repair",
            "before repair intake",
            "before booking repair",
            "before sending the phone away",
            "guide the customer through the legitimate account-recovery path",
            "replace the charger or cable",
            "check the customer's sim status",
            "return the phone after correcting",
        )
    ):
        return "branch_resolve"

    if any(
        phrase in text
        for phrase in (
            "request self repairs ls",
            "request watu repairs ls",
            "create the replacement loan",
            "create the transfer",
            "collect the password",
            "hand the case to the refund process",
            "guide the customer to secure the device remotely",
            "help the customer lock accounts",
            "verify ownership",
        )
    ):
        return "branch_process"

    if any(
        phrase in text
        for phrase in (
            "pause dispatch",
            "do not promise",
            "gather proof of ownership",
            "hold the transfer",
            "missing conditions",
            "only one replacement",
            "not been met",
            "proof of ownership before",
        )
    ):
        return "verify_requirements"

    if any(
        phrase in text
        for phrase in (
            "book screen",
            "book hardware repair",
            "book urgent battery inspection",
            "book the specific repair path",
            "book display inspection",
            "book screen replacement",
            "repair intake",
            "password-processing charge",
            "request self repairs ls",
        )
    ):
        return "repair_intake"

    if any(
        phrase in text
        for phrase in (
            "escalate",
            "dispatch to transtel",
            "route the device to watu simu hq",
            "route the case",
            "courier repair",
            "service centre",
            "service center",
            "watu repairs ls",
            "manual review",
            "broken workflow",
        )
    ):
        return "service_centre"

    if procedure.category in {"Operations & Compliance", "Replacements & Transfers"}:
        return "repair_intake"

    return "branch_resolve"


def decision_label_for_type(decision_type: str) -> str:
    labels = {
        "branch_resolve": "Solve at branch now",
        "monitor_return": "Monitor and return if repeated",
        "repair_intake": "Book repair intake",
        "service_centre": "Send to service centre",
        "branch_process": "Continue branch processing",
        "verify_requirements": "Pause and verify requirements",
    }
    return labels.get(decision_type, "Review and decide next step")


def build_warranty_assessment(
    procedure: Procedure,
    *,
    diagnosis: str,
    recommended_action: str,
    warranty_status: str | None,
    decision_type: str,
) -> WarrantyAssessmentPayload:
    text = " ".join(
        filter(
            None,
            [
                procedure.title,
                procedure.category,
                diagnosis,
                recommended_action,
                warranty_status or "",
            ],
        )
    ).lower()

    out_of_warranty_markers = (
        "crack",
        "impact",
        "physical damage",
        "liquid",
        "water",
        "bent",
        "burnt",
        "swollen",
        "tamper",
        "forgotten password",
        "password-reset",
        "frp",
        "theft",
        "stolen",
        "replacement",
        "refund",
        "transfer",
        "out-warranty",
    )
    in_warranty_markers = (
        "manufacturer-originating",
        "no impact",
        "no obvious external damage",
        "internal display",
        "internal power",
        "battery-health",
        "device-side audio",
        "device-side network",
        "may be covered",
        "free to the customer",
        "without obvious external damage",
    )

    if any(marker in text for marker in out_of_warranty_markers):
        reasons = []
        if any(marker in text for marker in ("crack", "impact", "physical damage", "bent", "burnt")):
            reasons.append("Visible or reported external damage changes the case away from normal manufacturer cover.")
        if any(marker in text for marker in ("liquid", "water", "swollen")):
            reasons.append("Liquid or unsafe battery conditions usually need out-of-warranty handling or inspection.")
        if any(marker in text for marker in ("password-reset", "forgotten password", "frp")):
            reasons.append("Access-recovery cases are not standard hardware warranty faults.")
        if any(marker in text for marker in ("theft", "stolen", "replacement", "refund", "transfer")):
            reasons.append("This path is operational rather than a standard manufacturer repair claim.")
        if not reasons:
            reasons.append("The current diagnosis points away from a standard in-warranty repair path.")
        return WarrantyAssessmentPayload(
            direction="likely_out_of_warranty",
            label="Likely out of warranty",
            confidence="high",
            reasons=reasons,
        )

    if any(marker in text for marker in in_warranty_markers):
        reasons = [
            "The symptom path points to an internal device fault rather than a customer-induced damage event.",
            "No strong external-damage signal is guiding the current repair route.",
        ]
        if decision_type in {"repair_intake", "service_centre"}:
            reasons.append("Final confirmation still depends on repair inspection before the branch promises cover.")
            confidence = "medium"
        else:
            confidence = "high"
        return WarrantyAssessmentPayload(
            direction="likely_in_warranty",
            label="Likely in warranty",
            confidence=confidence,
            reasons=reasons,
        )

    reasons = [
        "The branch has a direction, but the final warranty position still depends on inspection or missing proof.",
    ]
    if decision_type in {"branch_resolve", "monitor_return"}:
        reasons.append("The case should stay in branch handling until the symptom repeats more clearly.")
    else:
        reasons.append("Do not overpromise warranty before the next team confirms the fault and physical condition.")
    return WarrantyAssessmentPayload(
        direction="needs_inspection",
        label="Needs inspection",
        confidence="medium",
        reasons=reasons,
    )


def build_branch_playbook(
    procedure: Procedure,
    *,
    decision_type: str,
    recommended_action: str,
) -> BranchPlaybookPayload:
    playbooks: dict[str, tuple[str, list[str]]] = {
        "branch_resolve": (
            "Close the case at branch level",
            [
                "Complete the branch-side fix while the customer is still present.",
                "Show the customer what changed so they understand why repair intake is not needed.",
                "Advise the customer to return only if the same symptom repeats under the same conditions.",
            ],
        ),
        "monitor_return": (
            "Keep the case at branch with observation",
            [
                "Explain what the branch confirmed and why the phone is not being sent away yet.",
                "Tell the customer exactly what repeat sign should trigger a return to branch.",
                "Escalate only if the same symptom repeats after normal use or charging conditions.",
            ],
        ),
        "repair_intake": (
            "Prepare a clean repair-intake handover",
            [
                "Finish the evidence checklist before the phone leaves the desk.",
                "Explain the likely repair path without promising final warranty approval too early.",
                "Hand over the device with clear notes, photos, and the repeat symptom captured.",
            ],
        ),
        "service_centre": (
            "Escalate only with a complete branch case",
            [
                "Confirm the branch checks are complete and clearly recorded.",
                "Set customer expectation carefully and avoid overpromising on cover or turnaround.",
                "Send the case forward with photos, repeat pattern, and customer history attached.",
            ],
        ),
        "branch_process": (
            "Continue the branch-led operational path",
            [
                "Keep the operational workflow moving without changing the diagnostic conclusion.",
                "Use the diagnosis outcome to choose the right internal process or system step next.",
                "Tell the customer what approval, tracking, or branch follow-up happens after this stage.",
            ],
        ),
        "verify_requirements": (
            "Pause the case until requirements are complete",
            [
                "Stop the handover before dispatch, approval, or promise-making.",
                "Collect the missing proof, branch checks, or ownership details first.",
                "Resume only when the missing condition is clearly satisfied and recorded.",
            ],
        ),
    }
    title, steps = playbooks.get(
        decision_type,
        (
            "Use the next branch step carefully",
            [
                "Keep the diagnostic result visible while you complete the next branch action.",
                "Avoid handover until the branch notes and customer explanation are clear.",
            ],
        ),
    )
    if decision_type == "branch_process" and "replacement" in recommended_action.lower():
        steps = [
            "Keep the replacement or approval conditions visible while you process the case.",
            "Do not promise handover until the required status and payment checks are complete.",
            "Explain the next internal branch step before ending the interaction.",
        ]
    return BranchPlaybookPayload(title=title, steps=steps)


def build_evidence_checklist(procedure: Procedure, *, decision_type: str) -> list[str]:
    if decision_type not in {"repair_intake", "service_centre"}:
        return []

    checklist_map: dict[int, list[str]] = {
        1: [
            "Confirm a known-good charger and cable were tested.",
            "Record whether a forced restart was attempted and what happened.",
            "Note any heat, liquid, swelling, or sudden shutdown history.",
            "Capture the exact startup sign: no life, vibration only, logo loop, or charging symbol.",
            "Take photos of the screen and frame condition before handover, especially if display damage is suspected.",
        ],
        2: [
            "Capture clear photos of the display and any visible impact points.",
            "Confirm whether the symptom is seen outside one app after a restart.",
            "Record touch response, flicker, lines, black screen, or color tint separately.",
            "Note any drop, pressure, or liquid history before dispatch.",
        ],
        3: [
            "Record the IMEI, loan number, and proof of ownership before escalation.",
            "Confirm whether the SIM is blocked and remote account protection steps were explained.",
            "Note whether a police abstract exists and which legal status request is needed.",
            "Upload or attach all theft-supporting documents before moving the case.",
        ],
        4: [
            "Confirm a known-good charger and cable were tested on the device.",
            "Record whether the charging port is loose, dirty, wet, or physically damaged.",
            "Note whether the battery still falls while the phone is connected to power.",
            "Capture any moisture warning, overheating, or power-drop behavior seen at branch.",
        ],
        5: [
            "Record whether the phone is swollen, too hot to handle, or unsafe to keep charging.",
            "Note the charger used, charging environment, and when the heat starts.",
            "Capture any battery smell, lifting back cover, or rapid shutdown behavior.",
            "Stop unsafe handling and log the exact safety risk before dispatch.",
        ],
        6: [
            "Record the battery drain pattern, screen-on use, and standby behavior.",
            "Confirm whether Battery and device care or battery usage was checked.",
            "Note any suspect app, recent update, or heat pattern linked to the drain.",
            "Confirm the issue repeated after branch guidance rather than on one short test only.",
        ],
        7: [
            "Record whether the issue happens in one app or across several apps.",
            "Confirm restart, cache clear, update, and storage checks were completed.",
            "Note whether Safe mode or a clean app test changed the behavior.",
            "Capture the exact freeze pattern before repair intake or escalation.",
        ],
        8: [
            "Record the restart pattern, frequency, and whether the phone enters Safe mode by itself.",
            "Confirm case removal, side-key checks, and recent app or update review were done.",
            "Note whether the restart continues after branch-level software checks.",
            "Capture any heat, liquid, impact, or boot-loop signs before dispatch.",
        ],
        9: [
            "Confirm another known-good active SIM was tested in the same location.",
            "Record whether the issue affects calls, SMS, mobile data, or full network registration.",
            "Note the outcome of network reset or manual network search if attempted.",
            "Capture tray damage, frame damage, or liquid history before sending the device out.",
        ],
        10: [
            "Confirm the issue was tested with speaker, earpiece, microphone, call, and recording paths as relevant.",
            "Record whether Bluetooth, earphones, mute state, or app-specific audio routing was cleared.",
            "Note whether the failure stays after trying another app or call path.",
            "Capture any liquid, impact, or mesh blockage signs before escalation.",
        ],
        11: [
            "Record proof-of-ownership status before any password or FRP escalation.",
            "Note whether the case is forgotten password, FRP after reset, or a managed-device lock.",
            "Confirm the customer understands the out-warranty password-processing charge where applicable.",
            "Request and record the correct legal status before dispatching the case.",
        ],
        12: [
            "Capture photos of all visible damage and affected sides of the device.",
            "Record whether the issue followed impact, water, heat, or unauthorized repair handling.",
            "Separate visible external damage from hidden symptom complaints in the notes.",
            "Confirm the out-warranty routing path before dispatching the device.",
        ],
        13: [
            "Confirm the ticket path, legal status request, and receiver destination match the case type.",
            "Upload scanned copies of all co-signed documents before dispatch.",
            "Record incoming and outgoing movement in the branch tracking sheet.",
            "Attach stickers, waybill details, and IMEI records before handover.",
        ],
        14: [
            "Confirm minimum 10 weekly payments and the correct stolen or BER status before proceeding.",
            "Record theft-proof or BER return evidence in the case notes.",
            "Check whether the customer already received one replacement before approval.",
            "Prepare the OBS and handover requirements before moving the replacement request.",
        ],
        15: [
            "Confirm arrears status, IDs, and signed-transfer requirements before escalation.",
            "Record whether the case is a transfer, death case, or loan reschedule.",
            "Attach repair-centre proof and the status timeline for reschedule requests.",
            "Keep missing conditions visible in the notes before handing off the case.",
        ],
        16: [
            "Record IMEI, loan account, return condition, and refund-eligibility checks before handover.",
            "Confirm the password and factory reset requirement was handled where policy allows.",
            "Attach third-party recovery details or ownership verification evidence when relevant.",
            "Note every deduction or non-refundable condition clearly before escalation.",
        ],
    }
    return checklist_map.get(
        procedure.id,
        [
            "Confirm the branch checks in this flow were completed and recorded.",
            "Capture the exact symptom, repeat pattern, and any visible damage before handover.",
            "Attach the right documents, photos, and identifiers before moving the device.",
        ],
    )


def start_triage(db: Session, procedure_id: int) -> TriageStartResponse | None:
    procedure = load_procedure(db, procedure_id)
    if procedure is None:
        return None

    root = find_root_node(procedure)
    progress = make_progress(procedure, root.id if root else None)
    outcome = build_outcome(procedure, root.final_outcome) if root and root.final_outcome else None
    status = "complete" if outcome else "question"

    return TriageStartResponse(
        status=status,
        procedure=to_summary(procedure),
        current_node=DecisionNodePayload(id=root.id, question=root.question) if root and not outcome else None,
        progress=progress,
        customer_care=get_customer_care(procedure),
        sop=get_sop_layers(procedure),
        outcome=outcome,
    )


def next_triage_step(db: Session, node_id: int, answer: str) -> TriageNextResponse | None:
    node = db.get(DecisionNode, node_id)
    if node is None:
        return None

    procedure = load_procedure(db, node.procedure_id)
    if procedure is None:
        return None

    next_id = node.yes_next if answer == "yes" else node.no_next
    if next_id is None:
        fallback = build_outcome(
            procedure,
            {
                "diagnosis": "This flow is incomplete",
                "recommended_action": "Stop the guided questions and escalate this case for manual review.",
                "follow_up_message": "Let the customer know you are escalating because the quick branch flow ended early.",
                "related_actions": get_sop_layers(procedure).related_actions,
            },
        )
        return TriageNextResponse(
            status="complete",
            progress=make_progress(procedure, None),
            outcome=fallback,
            related=get_related_procedures(db, procedure.id),
            message="The decision tree ended early, so the case has been marked for manual review.",
        )

    next_node = db.get(DecisionNode, next_id)
    if next_node is None:
        missing_node_outcome = build_outcome(
            procedure,
            {
                "diagnosis": "A linked step is missing",
                "recommended_action": "Escalate this case and report the broken workflow link.",
                "follow_up_message": "Tell the customer you are moving the case forward because the guided checklist is incomplete.",
            },
        )
        return TriageNextResponse(
            status="complete",
            progress=make_progress(procedure, None),
            outcome=missing_node_outcome,
            related=get_related_procedures(db, procedure.id),
            message="A linked node could not be found.",
        )

    if next_node.final_outcome:
        return TriageNextResponse(
            status="complete",
            progress=make_progress(procedure, next_node.id),
            outcome=build_outcome(procedure, next_node.final_outcome),
            related=get_related_procedures(db, procedure.id),
            message="Final recommendation ready.",
        )

    return TriageNextResponse(
        status="question",
        progress=make_progress(procedure, next_node.id),
        next_node=DecisionNodePayload(id=next_node.id, question=next_node.question),
        message="Next question ready.",
    )
