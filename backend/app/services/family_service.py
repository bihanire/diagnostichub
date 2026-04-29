from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.models.models import Procedure
from app.schemas.common import ProcedureSummary
from app.schemas.family import (
    RepairFamilyCategoryCard,
    RepairFamilyDetailResponse,
    RepairFamilyFocusCard,
    RepairFamilyProcedureGroup,
    RepairFamilySummary,
)
from app.services.procedure_service import procedure_query_with, to_summary

FAMILY_DEFINITIONS = {
    "display": {
        "title": "Display & Vision",
        "hint": "Start here for cracked screens, black display, lines, blur, tint, or touch problems.",
        "diagnostic_goal": "Separate visible damage, temporary display behaviour, and true internal screen faults before repair booking.",
        "categories": {"Display & Vision"},
        "symptom_prompts": [
            "cracked screen",
            "black screen but phone rings",
            "yellow tint or lines",
            "touch not working",
        ],
        "common_categories": [
            {
                "title": "Cracks and visible panel damage",
                "description": "Use this when the customer or officer can already see impact, broken glass, ink bleed, or pressure marks.",
                "search_examples": [
                    "cracked screen",
                    "screen broken",
                    "glass shattered",
                    "display leaking black ink",
                ],
                "primary_procedure": "Screen Issue",
                "supporting_procedures": ["Liquid or Physical Damage"],
            },
            {
                "title": "Black screen but the phone is still alive",
                "description": "Use this when the phone vibrates, rings, or shows the Samsung logo but the display does not come up properly.",
                "search_examples": [
                    "black screen but vibrating",
                    "phone rings but screen is dark",
                    "Samsung logo then dark",
                    "phone alive no display",
                ],
                "primary_procedure": "Screen Issue",
                "supporting_procedures": ["Phone Not Powering On"],
            },
            {
                "title": "Lines, flicker, tint, or shaky picture",
                "description": "Use this when the picture appears distorted, unstable, yellowed, blurred, or striped.",
                "search_examples": [
                    "lines in screen",
                    "screen flickering",
                    "yellow screen",
                    "shaky display",
                ],
                "primary_procedure": "Screen Issue",
                "supporting_procedures": [],
            },
            {
                "title": "Touch problem without obvious breakage",
                "description": "Use this when the image looks mostly normal but the screen does not respond correctly to touch.",
                "search_examples": [
                    "touch not working",
                    "ghost touch",
                    "screen pressing itself",
                    "touch delay on screen",
                ],
                "primary_procedure": "Screen Issue",
                "supporting_procedures": ["Freezing, Hanging, or App Issue"],
            },
        ],
        "focus_cards": [
            {
                "title": "Visible damage first",
                "description": "Separate cracks, pressure marks, and wet-impact history before anything else.",
            },
            {
                "title": "Alive but dark",
                "description": "Treat vibration, sound, and logo behaviour as clues that the phone may still have power.",
            },
            {
                "title": "Touch versus image",
                "description": "Confirm whether the image is bad, the touch is bad, or both are failing together.",
            },
        ],
        "procedure_groups": [
            {
                "title": "Core display route",
                "description": "Keep the visible screen path primary unless the symptom is actually no-power or obvious physical damage first.",
                "procedures": ["Screen Issue"],
            },
        ],
        "branch_checks": [
            "Confirm whether cracks, pressure marks, or liquid traces are visible with the customer present.",
            "Check whether the phone rings, vibrates, or shows a logo even when the display looks dead.",
            "Rule out brightness, temporary app behaviour, or touch-only complaints before booking repair.",
        ],
        "escalation_signals": [
            "Visible crack, ink bleed, or pressure damage changing the warranty direction.",
            "Display remains dark even though the phone is clearly alive after branch checks.",
            "Touch and image both fail repeatedly after restart and safe branch confirmation.",
        ],
    },
    "power": {
        "title": "Power & Thermal",
        "hint": "Start here for no power, charging trouble, overheating, swelling, or fast battery drain.",
        "diagnostic_goal": "Separate accessory issues, recoverable power states, safety risks, and deeper internal power faults before courier repair.",
        "categories": {"Power & Thermal"},
        "symptom_prompts": [
            "not powering on",
            "not charging",
            "battery drains fast",
            "overheating or swollen battery",
        ],
        "common_categories": [
            {
                "title": "No power or dead phone",
                "description": "Use this when the phone seems completely off, stuck on logo, or only shows brief signs of life.",
                "search_examples": [
                    "not powering on",
                    "dead phone",
                    "phone only vibrates",
                    "stuck on Samsung logo",
                ],
                "primary_procedure": "Phone Not Powering On",
                "supporting_procedures": ["Screen Issue"],
            },
            {
                "title": "Not charging or charging in one position",
                "description": "Use this when the complaint is about the cable, port, moisture warning, or needing to hold the charger at an angle.",
                "search_examples": [
                    "not charging",
                    "charging only in one position",
                    "moisture warning in port",
                    "charger enters but does nothing",
                ],
                "primary_procedure": "Charging Issue",
                "supporting_procedures": ["Phone Not Powering On"],
            },
            {
                "title": "Overheating, swelling, or unsafe battery signs",
                "description": "Use this when the phone gets unusually hot, smells burnt, or the back cover is lifting.",
                "search_examples": [
                    "phone too hot",
                    "swollen battery",
                    "back cover lifting",
                    "burnt smell from phone",
                ],
                "primary_procedure": "Overheating or Swollen Battery",
                "supporting_procedures": ["Charging Issue"],
            },
            {
                "title": "Fast battery drain",
                "description": "Use this when the charge drops too quickly during light use or overnight.",
                "search_examples": [
                    "battery drains fast",
                    "charge drops overnight",
                    "battery goes down quickly",
                    "battery low after little use",
                ],
                "primary_procedure": "Battery Draining Fast",
                "supporting_procedures": ["Overheating or Swollen Battery"],
            },
        ],
        "focus_cards": [
            {
                "title": "Accessory versus device",
                "description": "Keep charger, cable, and port-side causes in play before assuming internal failure.",
            },
            {
                "title": "Safety first",
                "description": "Heat, swelling, and burn smell should immediately change the path from routine to safety-led.",
            },
            {
                "title": "Recoverable states",
                "description": "Deep battery drain, forced restart recovery, and one-position charging can look worse than they are.",
            },
        ],
        "procedure_groups": [
            {
                "title": "Primary power routes",
                "description": "Start with the nearest symptom family and keep everything else as support, not as equal-weight options.",
                "procedures": [
                    "Phone Not Powering On",
                    "Charging Issue",
                    "Overheating or Swollen Battery",
                    "Battery Draining Fast",
                ],
            },
        ],
        "branch_checks": [
            "Test with a known-good charger and cable before classifying the device itself as faulty.",
            "Look for blocked port signs, one-angle charging, or moisture warnings before promising repair.",
            "Use forced restart and safe branch charging checks before escalating a no-power complaint.",
        ],
        "escalation_signals": [
            "Swollen battery, lifting back cover, burn smell, or unsafe heat.",
            "Phone still shows no life after branch-safe charging and restart checks.",
            "Battery drains or overheats again quickly after branch-level causes are ruled out.",
        ],
    },
    "logic": {
        "title": "Logic & Software",
        "hint": "Start here for freezing, hanging, restart loops, safe mode, and app behaviour issues.",
        "diagnostic_goal": "Separate app-specific faults, storage or update pressure, and persistent restart or software instability before escalation.",
        "categories": {"Logic & Software"},
        "symptom_prompts": [
            "freezing and hanging",
            "random restart",
            "safe mode issue",
            "one app crashing",
        ],
        "common_categories": [
            {
                "title": "Slow, frozen, or hanging phone",
                "description": "Use this when the whole phone lags, sticks, or becomes unresponsive without obvious restart loops.",
                "search_examples": [
                    "phone freezing",
                    "phone hanging",
                    "too slow to use",
                    "stuck screen but not cracked",
                ],
                "primary_procedure": "Freezing, Hanging, or App Issue",
                "supporting_procedures": [],
            },
            {
                "title": "One app crashing or acting badly",
                "description": "Use this when one app is the problem instead of the full phone experience.",
                "search_examples": [
                    "one app crashing",
                    "WhatsApp freezing",
                    "camera app hangs",
                    "app opens then closes",
                ],
                "primary_procedure": "Freezing, Hanging, or App Issue",
                "supporting_procedures": [],
            },
            {
                "title": "Random restarts and reboot loops",
                "description": "Use this when the device restarts on its own or cannot stay stable long enough to use normally.",
                "search_examples": [
                    "phone restarts itself",
                    "keeps rebooting",
                    "random restart",
                    "boot loop",
                ],
                "primary_procedure": "Random Restart or Safe Mode Issue",
                "supporting_procedures": ["Phone Not Powering On"],
            },
            {
                "title": "Safe mode or stuck-button behaviour",
                "description": "Use this when the customer reports safe mode, restart behaviour after pressing buttons, or the phone staying in a restricted boot state.",
                "search_examples": [
                    "safe mode issue",
                    "stuck in safe mode",
                    "power button maybe stuck",
                    "phone boots differently",
                ],
                "primary_procedure": "Random Restart or Safe Mode Issue",
                "supporting_procedures": ["Phone Not Powering On"],
            },
        ],
        "focus_cards": [
            {
                "title": "One app or whole phone",
                "description": "A single crashing app is a different path from a phone that freezes everywhere.",
            },
            {
                "title": "Recent change",
                "description": "Updates, low storage, and one new app often explain software complaints better than repair does.",
            },
            {
                "title": "Repeat instability",
                "description": "Only escalate after the branch checks cannot stabilize the software behaviour.",
            },
        ],
        "procedure_groups": [
            {
                "title": "Primary software routes",
                "description": "Keep the logic space tight: one route for lag or app trouble, one route for restart or safe mode.",
                "procedures": [
                    "Freezing, Hanging, or App Issue",
                    "Random Restart or Safe Mode Issue",
                ],
            },
        ],
        "branch_checks": [
            "Confirm whether one app, low storage, or a recent update triggered the problem.",
            "Keep restart loops separate from simple lag or one-app freezing.",
            "Use branch-safe restart and software checks before classifying it as a repair case.",
        ],
        "escalation_signals": [
            "Restart loop continues after branch-safe checks.",
            "Safe mode or software behaviour points back to a stuck button or deeper device fault.",
            "The phone becomes unstable across the whole system, not just one app.",
        ],
    },
    "security": {
        "title": "Security & Access",
        "hint": "Start here for theft, FRP, password, pattern, PIN, or device access complaints.",
        "diagnostic_goal": "Separate ownership and access recovery cases from real hardware faults so the branch does not misroute the device.",
        "categories": {"Security & Access"},
        "symptom_prompts": [
            "stolen phone",
            "forgot pattern",
            "google lock after reset",
            "managed device restriction",
        ],
        "common_categories": [
            {
                "title": "Stolen, snatched, or missing device",
                "description": "Use this when the customer no longer has the phone and needs protection, theft handling, or next-step routing.",
                "search_examples": [
                    "stolen phone",
                    "phone snatched",
                    "lost phone",
                    "device taken",
                ],
                "primary_procedure": "Stolen Phone",
                "supporting_procedures": ["Replacement Request Eligibility"],
            },
            {
                "title": "Forgot pattern, PIN, or password",
                "description": "Use this when the customer still has the device but cannot open it due to forgotten credentials.",
                "search_examples": [
                    "forgot pattern",
                    "forgot password",
                    "forgot phone pin",
                    "locked out of phone",
                ],
                "primary_procedure": "FRP, Password, or Locked Device",
                "supporting_procedures": [],
            },
            {
                "title": "FRP or Google lock after reset",
                "description": "Use this when the device was reset and now asks for the previous Google account.",
                "search_examples": [
                    "google lock after reset",
                    "frp lock",
                    "wants old email after reset",
                    "factory reset now locked",
                ],
                "primary_procedure": "FRP, Password, or Locked Device",
                "supporting_procedures": [],
            },
            {
                "title": "Managed, restricted, or ownership-check case",
                "description": "Use this when the customer is unsure about ownership status, management restrictions, or what process the branch should follow next.",
                "search_examples": [
                    "managed device restriction",
                    "device says managed",
                    "ownership not clear",
                    "phone locked by company rule",
                ],
                "primary_procedure": "FRP, Password, or Locked Device",
                "supporting_procedures": ["Repair Ticket, Dispatch, or Legal Status Handling"],
            },
        ],
        "focus_cards": [
            {
                "title": "Ownership first",
                "description": "Confirm who owns the phone before discussing recovery or next steps.",
            },
            {
                "title": "Access is not hardware",
                "description": "FRP, password loss, and theft are process-led paths, not normal repair diagnosis.",
            },
            {
                "title": "Avoid wrong routing",
                "description": "Do not let a locked or stolen-device case slip into standard warranty repair logic.",
            },
        ],
        "procedure_groups": [
            {
                "title": "Primary security routes",
                "description": "Keep the diagnosis simple: either the phone is missing, or the phone is present but access is blocked.",
                "procedures": [
                    "Stolen Phone",
                    "FRP, Password, or Locked Device",
                ],
            },
        ],
        "branch_checks": [
            "Confirm whether this is ownership loss, theft, FRP, or forgotten credentials before mentioning repair.",
            "Keep process-led security cases out of normal hardware diagnosis and warranty promises.",
            "Use the guided flow to separate access recovery from follow-up routing.",
        ],
        "escalation_signals": [
            "Ownership is unclear or the device may not belong to the customer presenting it.",
            "The customer expects a bypass or technical unlock that the branch must not promise.",
            "The case shifts from access recovery into replacement or legal-status handling.",
        ],
    },
    "connectivity": {
        "title": "Connectivity & I/O",
        "hint": "Start here for SIM, signal, data, speaker, microphone, mouthpiece, or audio path issues.",
        "diagnostic_goal": "Separate network-side, settings-side, and component-side faults before the device is sent away.",
        "categories": {"Connectivity & I/O"},
        "symptom_prompts": [
            "not reading sim",
            "no network",
            "mobile data not working",
            "mouthpiece or speaker issue",
        ],
        "common_categories": [
            {
                "title": "SIM not detected or no service",
                "description": "Use this when the phone fails to read the SIM or cannot register on network reliably.",
                "search_examples": [
                    "not reading sim",
                    "no sim detected",
                    "no service",
                    "sim card not working",
                ],
                "primary_procedure": "SIM or Network Issue",
                "supporting_procedures": ["Liquid or Physical Damage"],
            },
            {
                "title": "Signal, bars, or mobile data issue",
                "description": "Use this when the customer reports unstable network bars, no data, or mobile internet failing.",
                "search_examples": [
                    "no network",
                    "mobile data not working",
                    "network bars disappear",
                    "internet only works on Wi-Fi",
                ],
                "primary_procedure": "SIM or Network Issue",
                "supporting_procedures": [],
            },
            {
                "title": "Mouthpiece, speaker, or microphone problem",
                "description": "Use this when calls, recordings, or media audio cannot be heard clearly or at all.",
                "search_examples": [
                    "mouthpiece not working",
                    "speaker low",
                    "they cannot hear me on calls",
                    "earpiece no sound",
                ],
                "primary_procedure": "Speaker, Microphone, or Audio Issue",
                "supporting_procedures": ["SIM or Network Issue"],
            },
            {
                "title": "Tray, grill, or external path damage",
                "description": "Use this when a network or audio complaint may really be coming from a broken tray, blocked grill, or visible damage.",
                "search_examples": [
                    "broken sim tray",
                    "speaker grill blocked",
                    "tray bent",
                    "network issue after dropping phone",
                ],
                "primary_procedure": "Liquid or Physical Damage",
                "supporting_procedures": ["SIM or Network Issue", "Speaker, Microphone, or Audio Issue"],
            },
        ],
        "focus_cards": [
            {
                "title": "Network versus device",
                "description": "Keep SIM-side, signal-side, and settings-side causes alive before moving to hardware suspicion.",
            },
            {
                "title": "Call path versus signal",
                "description": "Poor hearing or microphone complaints may be audio or signal, not both.",
            },
            {
                "title": "Visible tray or port damage",
                "description": "Broken trays, bent frames, and blocked grills can explain the complaint quickly.",
            },
        ],
        "procedure_groups": [
            {
                "title": "Primary connectivity routes",
                "description": "Keep the main split clean: network/SIM complaints on one side, audio-path complaints on the other.",
                "procedures": [
                    "SIM or Network Issue",
                    "Speaker, Microphone, or Audio Issue",
                ],
            },
        ],
        "branch_checks": [
            "Test whether the complaint is no SIM, no network, no data, or call-audio specific before escalating.",
            "Use another working SIM or simple branch settings checks before assuming board repair.",
            "Inspect trays, grills, and the frame for visible clues that change the path immediately.",
        ],
        "escalation_signals": [
            "Phone still cannot detect SIM or hold network after branch-safe checks.",
            "Audio path fails repeatedly after mute, volume, Bluetooth, and signal causes are ruled out.",
            "Visible tray, grill, or impact damage changes the warranty direction and repair path.",
        ],
    },
    "physical": {
        "title": "Physical & Liquid",
        "hint": "Start here for water exposure, bent frame, broken tray, impact damage, or burnt condition.",
        "diagnostic_goal": "Confirm visible or hidden damage early so the warranty direction and repair path stay accurate.",
        "categories": {"Physical & Liquid"},
        "symptom_prompts": [
            "fell in water",
            "broken frame",
            "bent phone",
            "burnt or corroded",
        ],
        "common_categories": [
            {
                "title": "Water, liquid, or corrosion signs",
                "description": "Use this when the device got wet, shows corrosion, or has a moisture or liquid history that changes the repair path.",
                "search_examples": [
                    "fell in water",
                    "water damage",
                    "liquid entered phone",
                    "corrosion in port",
                ],
                "primary_procedure": "Liquid or Physical Damage",
                "supporting_procedures": ["Charging Issue"],
            },
            {
                "title": "Bent, burnt, or externally damaged body",
                "description": "Use this when the frame, body, or structure is clearly damaged even before you confirm the internal complaint.",
                "search_examples": [
                    "bent phone",
                    "broken frame",
                    "phone burnt",
                    "body damaged after fall",
                ],
                "primary_procedure": "Liquid or Physical Damage",
                "supporting_procedures": ["Screen Issue"],
            },
            {
                "title": "Broken tray, button, or external part",
                "description": "Use this when one physical part looks damaged and may explain the wider complaint.",
                "search_examples": [
                    "sim tray broken",
                    "button damaged",
                    "side key not working after fall",
                    "external part broken",
                ],
                "primary_procedure": "Liquid or Physical Damage",
                "supporting_procedures": ["SIM or Network Issue", "Phone Not Powering On"],
            },
            {
                "title": "Symptom started after impact or wet event",
                "description": "Use this when the visible damage is not the complaint itself, but it clearly started the display, charging, or network problem.",
                "search_examples": [
                    "screen issue after dropping phone",
                    "charging problem after water",
                    "network lost after impact",
                    "phone changed after falling",
                ],
                "primary_procedure": "Liquid or Physical Damage",
                "supporting_procedures": ["Screen Issue", "Charging Issue", "SIM or Network Issue"],
            },
        ],
        "focus_cards": [
            {
                "title": "Visible damage changes everything",
                "description": "Physical and liquid clues should be confirmed early because they shift both warranty direction and routing.",
            },
            {
                "title": "Document what you see",
                "description": "Good damage confirmation prevents the branch from submitting the wrong warranty claim.",
            },
            {
                "title": "Link back to the main symptom",
                "description": "After confirming damage, reopen the symptom-led flow only if it helps explain the impact result better.",
            },
        ],
        "procedure_groups": [
            {
                "title": "Primary damage route",
                "description": "Keep one damage-led route primary, then reopen the symptom path only when it helps explain the effect of that damage.",
                "procedures": ["Liquid or Physical Damage"],
            },
        ],
        "branch_checks": [
            "Confirm visible cracks, bend, corrosion, or liquid signs before choosing a normal repair path.",
            "Capture the main visible clue that explains why the warranty direction has shifted.",
            "Use damage confirmation first, then reopen the symptom-led flow only when it adds clarity.",
        ],
        "escalation_signals": [
            "Clear liquid exposure, corrosion, or burn signs.",
            "Structural damage like bend, shattered screen, or broken tray changing normal use.",
            "The customer is describing a symptom that began immediately after an impact or water event.",
        ],
    },
}


def _load_procedures(db: Session) -> list[Procedure]:
    return db.scalars(
        procedure_query_with(
            include_tags=False,
            include_decision_nodes=False,
            include_links=False,
        )
    ).all()


def _group_procedures_by_category(
    procedures: Sequence[Procedure],
) -> dict[str, list[Procedure]]:
    grouped: dict[str, list[Procedure]] = {}
    for procedure in procedures:
        grouped.setdefault(procedure.category, []).append(procedure)
    return grouped


def _procedures_for_family(
    family_id: str,
    procedures_by_category: dict[str, list[Procedure]],
) -> Sequence[Procedure]:
    family = FAMILY_DEFINITIONS.get(family_id)
    if family is None:
        return []

    family_procedures: list[Procedure] = []
    for category in family["categories"]:
        family_procedures.extend(procedures_by_category.get(category, []))
    return family_procedures


def list_repair_families(db: Session) -> list[RepairFamilySummary]:
    procedures = _load_procedures(db)
    procedures_by_category = _group_procedures_by_category(procedures)
    summaries: list[RepairFamilySummary] = []
    for family_id, family in FAMILY_DEFINITIONS.items():
        family_procedures = _procedures_for_family(family_id, procedures_by_category)
        summaries.append(
            RepairFamilySummary(
                id=family_id,
                title=family["title"],
                hint=family["hint"],
                symptom_prompts=family["symptom_prompts"],
                procedure_count=len(family_procedures),
            )
        )
    return summaries


def get_repair_family_detail(db: Session, family_id: str) -> RepairFamilyDetailResponse | None:
    family = FAMILY_DEFINITIONS.get(family_id)
    if family is None:
        return None

    procedures = _load_procedures(db)
    procedures_by_category = _group_procedures_by_category(procedures)
    procedures_by_title = {procedure.title: procedure for procedure in procedures}
    summary_by_id: dict[int, ProcedureSummary] = {}

    def summary_for(procedure: Procedure) -> ProcedureSummary:
        cached = summary_by_id.get(procedure.id)
        if cached is not None:
            return cached
        summary = to_summary(procedure)
        summary_by_id[procedure.id] = summary
        return summary

    family_procedures = _procedures_for_family(family_id, procedures_by_category)
    ordered_procedures = sorted(family_procedures, key=lambda item: item.title)

    common_categories: list[RepairFamilyCategoryCard] = []
    for category in family.get("common_categories", []):
        primary_title = category["primary_procedure"]
        primary_procedure = procedures_by_title.get(primary_title)
        if primary_procedure is None:
            continue

        supporting_procedures = [
            summary_for(procedure)
            for title in category.get("supporting_procedures", [])
            if (procedure := procedures_by_title.get(title)) is not None
        ]

        common_categories.append(
            RepairFamilyCategoryCard(
                title=category["title"],
                description=category["description"],
                search_examples=category.get("search_examples", []),
                primary_procedure=summary_for(primary_procedure),
                supporting_procedures=supporting_procedures,
            )
        )

    procedure_groups: list[RepairFamilyProcedureGroup] = []
    for group in family.get("procedure_groups", []):
        group_procedures = [
            summary_for(procedure)
            for title in group["procedures"]
            if (procedure := procedures_by_title.get(title)) is not None
        ]
        if group_procedures:
            procedure_groups.append(
                RepairFamilyProcedureGroup(
                    title=group["title"],
                    description=group["description"],
                    procedures=group_procedures,
                )
            )

    return RepairFamilyDetailResponse(
        id=family_id,
        title=family["title"],
        hint=family["hint"],
        diagnostic_goal=family["diagnostic_goal"],
        symptom_prompts=family["symptom_prompts"],
        focus_cards=[
            RepairFamilyFocusCard(title=item["title"], description=item["description"])
            for item in family.get("focus_cards", [])
        ],
        common_categories=common_categories,
        procedure_groups=procedure_groups,
        branch_checks=family.get("branch_checks", []),
        escalation_signals=family.get("escalation_signals", []),
        procedures=[summary_for(procedure) for procedure in ordered_procedures],
    )
