from __future__ import annotations

from app.models.models import Procedure
from app.schemas.common import CustomerCare, FinalOutcomePayload, SopLayers


PROCEDURE_GUIDANCE_OVERRIDES: dict[int, dict[str, list[str] | str]] = {
    1: {
        "expectation": "For Samsung Galaxy phones, start with a Samsung-approved charger and quick Galaxy checks before courier escalation.",
        "related_actions": [
            "If the Galaxy phone can stay on, open Samsung Members and run Phone diagnostics before booking repair.",
            "Use a Samsung-approved charger and cable for the first retry where available.",
        ],
    },
    2: {
        "expectation": "For Samsung Galaxy phones, rule out protectors, cases, and quick Galaxy diagnostics before confirming a display repair path.",
        "related_actions": [
            "If the screen is visible, remove non-Samsung-certified cases or protectors that may be touching the display.",
            "Check for the symptom across simple Samsung screens such as Settings, Camera, and Samsung Members diagnostics.",
        ],
    },
    3: {
        "expectation": "For a stolen Samsung Galaxy phone, secure the account and device first, then move to theft records and replacement checks only when the facts are verified.",
        "related_actions": [
            "If the Samsung account has device finding enabled, guide the customer to Samsung Find or Find My Mobile after SIM blocking.",
        ],
    },
    4: {
        "expectation": "On Samsung Galaxy phones, confirm charging behavior with a Samsung-approved charger before you classify the phone as a repair case.",
        "related_actions": [
            "If the Galaxy phone stays on, check Settings > Battery and device care while testing the charging pattern.",
            "Run Samsung Members Phone diagnostics if the charging symptom remains but the phone is still usable.",
        ],
    },
    5: {
        "expectation": "For Samsung Galaxy phones, treat heat and swelling as a safety-first path and use Battery and device care checks only if the device is safe to keep on.",
        "related_actions": [
            "If the Galaxy phone remains usable and safe, review Battery and device care or Samsung Members battery checks before courier booking.",
            "Charging may be limited on Galaxy phones when the temperature is outside the safe range.",
        ],
    },
    6: {
        "expectation": "On Samsung Galaxy phones, use Battery and device care plus Samsung Members diagnostics before assuming the battery needs courier repair.",
        "related_actions": [
            "Review Battery and device care and battery usage before booking a battery-health inspection.",
            "If the Galaxy phone stays on, use Samsung Members Phone diagnostics to confirm battery condition signals.",
        ],
    },
    7: {
        "expectation": "For Samsung Galaxy phones, app updates, Safe mode, and Samsung Members diagnostics should come before courier escalation when the phone is freezing.",
        "related_actions": [
            "Use Safe mode on the Galaxy phone to check whether a downloaded app is causing the freezing.",
            "Update the affected apps from Galaxy Store and Play Store before booking service.",
        ],
    },
    8: {
        "expectation": "For Samsung Galaxy phones, restart loops and Safe mode problems should first be checked through side-key pressure, recent apps, and Safe mode behavior.",
        "related_actions": [
            "Use Safe mode to check whether a downloaded app is behind the restart pattern.",
            "Check whether a case or side-key pressure is keeping the Galaxy phone in an abnormal boot state.",
        ],
    },
    9: {
        "expectation": "For Samsung Galaxy phones, use quick SIM, mobile data, and Samsung Members checks before routing the device to the service centre.",
        "related_actions": [
            "If the phone is still usable, run Samsung Members diagnostics for SIM, network, and mobile data checks where available.",
        ],
    },
    10: {
        "expectation": "On Samsung Galaxy phones, clear the easy audio-routing causes first, then use Galaxy diagnostics before courier repair.",
        "related_actions": [
            "Run Samsung Members diagnostics for speaker, receiver, or microphone if the Galaxy phone is still usable.",
            "Remove external devices, Bluetooth audio, and third-party accessories that may be redirecting sound.",
        ],
    },
    11: {
        "expectation": "For Samsung Galaxy phones, ownership verification and official account recovery matter more than speed on FRP and lock cases.",
        "related_actions": [
            "Do not promise FRP or lock bypass. Use only legitimate Samsung or Google account recovery steps after ownership is confirmed.",
        ],
    },
    12: {
        "expectation": "If a Samsung Galaxy phone is damaged but still usable, protect the customer's data and route the case correctly before repair handover.",
        "related_actions": [
            "If the Galaxy phone still works and is going for service, help the customer back up data and turn on Maintenance mode before handover.",
        ],
        "outcome_actions": [
            "If the Galaxy phone is still usable and is being handed over for service, back up data and enable Maintenance mode first.",
        ],
    },
    13: {
        "expectation": "For Samsung Galaxy repair intake, classify the case correctly, then preserve privacy and traceability before dispatch.",
        "related_actions": [
            "If a usable Galaxy phone is going out for service, help the customer back up data and enable Maintenance mode before dispatch.",
        ],
        "outcome_actions": [
            "Before dispatching a usable Galaxy phone, help the customer back up data and enable Maintenance mode.",
        ],
    },
}


def apply_samsung_customer_care(procedure: Procedure, care: CustomerCare) -> CustomerCare:
    override = PROCEDURE_GUIDANCE_OVERRIDES.get(procedure.id, {})
    expectation_hint = _text_value(override.get("expectation"))

    return CustomerCare(
        greeting=_ensure_brand_context(care.greeting),
        listening=care.listening,
        expectation=_append_sentence(care.expectation, expectation_hint),
    )


def apply_samsung_sop_layers(procedure: Procedure, sop: SopLayers) -> SopLayers:
    override = PROCEDURE_GUIDANCE_OVERRIDES.get(procedure.id, {})
    return SopLayers(
        immediate_action=_ensure_brand_context(sop.immediate_action),
        explanation=_append_sentence(
            sop.explanation,
            "Use the quickest Samsung Galaxy checks that can be completed safely at branch level before courier escalation."
            if procedure.id in PROCEDURE_GUIDANCE_OVERRIDES
            else None,
        ),
        related_actions=_merge_actions(
            _list_value(override.get("related_actions")),
            sop.related_actions,
        ),
    )


def apply_samsung_outcome(procedure: Procedure, outcome: FinalOutcomePayload) -> FinalOutcomePayload:
    override = PROCEDURE_GUIDANCE_OVERRIDES.get(procedure.id, {})
    outcome_actions = _list_value(override.get("outcome_actions")) or _list_value(
        override.get("related_actions")
    )

    return FinalOutcomePayload(
        diagnosis=outcome.diagnosis,
        recommended_action=outcome.recommended_action,
        decision_type=outcome.decision_type,
        decision_label=outcome.decision_label,
        warranty_status=outcome.warranty_status,
        warranty_assessment=outcome.warranty_assessment,
        branch_playbook=outcome.branch_playbook,
        related_actions=_merge_actions(outcome_actions, outcome.related_actions),
        evidence_checklist=outcome.evidence_checklist,
        customer_care=apply_samsung_customer_care(procedure, outcome.customer_care),
        follow_up_message=_append_sentence(
            outcome.follow_up_message,
            "Keep the explanation simple and Galaxy-specific so the customer understands why the branch is or is not sending the phone for service.",
        ),
    )


def _ensure_brand_context(text: str) -> str:
    if "Samsung" in text or "Galaxy" in text:
        return text
    return _append_sentence(text, "This branch flow is designed for Samsung Galaxy phones.")


def _append_sentence(base: str | None, addition: str | None) -> str:
    clean_base = (base or "").strip()
    clean_addition = (addition or "").strip()
    if not clean_addition:
        return clean_base
    if not clean_base:
        return clean_addition
    if clean_addition in clean_base:
        return clean_base
    return f"{clean_base} {clean_addition}"


def _merge_actions(base_actions: list[str], extra_actions: list[str]) -> list[str]:
    seen: set[str] = set()
    merged: list[str] = []
    for action in [*base_actions, *extra_actions]:
        normalized = action.strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        merged.append(normalized)
    return merged


def _text_value(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _list_value(value: object) -> list[str]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    return []
