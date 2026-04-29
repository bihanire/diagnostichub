import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from functools import lru_cache

from sqlalchemy.orm import Session

from app.models.models import Procedure
from app.schemas.common import ProcedureSummary
from app.schemas.search import SearchResponse, StructuredIntent
from app.services.procedure_service import (
    get_customer_care,
    get_related_procedures,
    procedure_query_with,
    get_sop_layers,
    to_summary,
)

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "after",
    "be",
    "before",
    "but",
    "by",
    "can",
    "customer",
    "does",
    "do",
    "during",
    "even",
    "for",
    "from",
    "gets",
    "getting",
    "got",
    "has",
    "have",
    "help",
    "if",
    "in",
    "insert",
    "inserted",
    "i",
    "is",
    "it",
    "its",
    "just",
    "keep",
    "keeps",
    "me",
    "my",
    "of",
    "off",
    "only",
    "on",
    "or",
    "phone",
    "plug",
    "plugged",
    "please",
    "problem",
    "issue",
    "says",
    "said",
    "samsung",
    "so",
    "still",
    "the",
    "there",
    "this",
    "that",
    "through",
    "when",
    "whenever",
    "while",
    "to",
    "up",
    "using",
    "with",
    "device",
    "galaxy",
}

TERM_GROUPS = {
    "Display & Vision": {
        "display",
        "screen",
        "black",
        "line",
        "flicker",
        "shake",
        "blurry",
        "yellow",
        "tint",
        "touch",
        "ghosttouch",
    },
    "Power & Thermal": {
        "power",
        "dead",
        "battery",
        "charge",
        "charger",
        "vibrate",
        "boot",
        "start",
        "overheat",
        "swollen",
        "drain",
        "hot",
        "devicecare",
        "moisture",
    },
    "Logic & Software": {
        "freeze",
        "hang",
        "lag",
        "slow",
        "app",
        "restart",
        "reboot",
        "safemode",
        "crash",
        "stuck",
        "update",
        "oneui",
        "galaxystore",
    },
    "Security & Access": {
        "stolen",
        "theft",
        "lost",
        "track",
        "account",
        "frp",
        "lock",
        "password",
        "pattern",
        "pin",
        "managed",
        "shell",
        "findmymobile",
    },
    "Connectivity & I/O": {
        "sim",
        "signal",
        "network",
        "service",
        "data",
        "wifi",
        "internet",
        "register",
        "speaker",
        "microphone",
        "mouthpiece",
        "earpiece",
        "audio",
    },
    "Physical & Liquid": {
        "water",
        "liquid",
        "wet",
        "broken",
        "cracked",
        "bent",
        "frame",
        "burnt",
        "damage",
        "simtray",
        "corrosion",
    },
    "Operations & Compliance": {
        "ticket",
        "repair",
        "dispatch",
        "waybill",
        "incoming",
        "outgoing",
        "legal",
        "status",
        "sticker",
        "transtel",
        "aramex",
        "maintenancemode",
    },
    "Replacements & Transfers": {
        "replacement",
        "replace",
        "transfer",
        "ownership",
        "ber",
        "repossessed",
        "transferred",
        "reschedule",
        "loan",
        "nok",
    },
    "Returns & Recovery": {
        "return",
        "refund",
        "recovered",
        "recovery",
        "reward",
        "storage",
        "prepayment",
        "returned",
    },
}

ISSUE_TYPE_PRIORITY = [
    "Replacements & Transfers",
    "Returns & Recovery",
    "Operations & Compliance",
    "Security & Access",
    "Physical & Liquid",
    "Connectivity & I/O",
    "Logic & Software",
    "Power & Thermal",
    "Display & Vision",
]

PHRASE_REPLACEMENTS = {
    "won't turn on": "no power",
    "wont turn on": "no power",
    "not turning on": "no power",
    "not powering on": "no power",
    "refuses to start": "no power",
    "black screen": "screen black",
    "no display": "screen black",
    "blacked out": "screen black",
    "blacked screen": "screen black",
    "touch not working": "touch unresponsive",
    "lines in screen": "screen lines",
    "shaky screen": "screen shake",
    "yellow light": "yellow display",
    "yellowish": "yellow display",
    "not charging": "charge fail",
    "does not charge": "charge fail",
    "doesnt charge": "charge fail",
    "wont charge": "charge fail",
    "will not charge": "charge fail",
    "slow charging": "charge slow",
    "charges only when cable bent": "one position charge",
    "only when cable bent": "one position charge",
    "cable bent": "one position charge",
    "insert a charger": "charger",
    "insert charger": "charger",
    "plug in charger": "charger",
    "plugged in charger": "charger",
    "while the charger is in": "charge fail",
    "while charger is in": "charge fail",
    "moisture detected": "moisture warning",
    "water in port": "moisture warning",
    "when charging": "charge",
    "drained battery": "battery drain",
    "battery drains fast": "battery drain",
    "draining too fast": "battery drain",
    "draining fast": "battery drain",
    "swollen battery": "battery swollen",
    "back cover lifting": "battery swollen",
    "heating up": "overheat",
    "hot phone": "overheat",
    "restarts itself": "random restart",
    "keeps restarting": "random restart",
    "showing logo": "stuck on logo",
    "samsung logo": "stuck on logo",
    "holding power": "power button",
    "safe mode": "safemode",
    "forgot pattern": "forgot password",
    "forgot pin": "forgot password",
    "not reading sim": "sim not detected",
    "not detecting sim": "sim not detected",
    "no network": "network issue",
    "no service": "network issue",
    "register on network": "network registration",
    "registering on network": "network registration",
    "no signal": "signal issue",
    "mobile data": "data",
    "wi fi": "wifi",
    "mouth piece": "mouthpiece",
    "hear me badly": "microphone issue",
    "cant hear me": "microphone issue",
    "cannot hear me": "microphone issue",
    "cant hear caller": "speaker issue",
    "cannot hear caller": "speaker issue",
    "fell in water": "liquid damage",
    "water damage": "liquid damage",
    "got wet": "liquid damage",
    "frame damaged": "frame bent",
    "smells burnt": "burnt smell",
    "phone is ringing": "ringing",
    "sim tray": "simtray",
    "simty": "simtray",
    "simtry": "simtray",
    "sim tray snapped": "simtray broken",
    "ghost touch": "ghosttouch",
    "touch pressing itself": "ghosttouch",
    "touch moving by itself": "ghosttouch",
    "job card": "repairticket",
    "repair ticket": "repairticket",
    "legal status": "legalstatus",
    "self repairs ls": "selfrepairsls",
    "watu repairs ls": "waturepairsls",
    "remove ls": "removels",
    "replacement device": "replacement",
    "wants a replacement": "replacement request",
    "wants replacement": "replacement request",
    "ownership transfer": "transfer",
    "loan transfer": "transfer",
    "return phone": "refund return",
    "recovered phone": "recovered device",
    "third party recovery": "recovery reward",
    "police abstract": "stolen abstract",
    "after sales": "aftersales",
    "aftersales ticketing": "aftersales ticket",
    "samsung members": "membersdiagnostic",
    "members diagnostics": "membersdiagnostic",
    "phone diagnostics": "membersdiagnostic",
    "battery and device care": "devicecare",
    "device care": "devicecare",
    "maintenance mode": "maintenancemode",
    "find my mobile": "findmymobile",
    "samsung find": "findmymobile",
    "galaxy store": "galaxystore",
    "one ui": "oneui",
    "after update": "software update",
    "old google account": "google lock",
}

TOKEN_NORMALIZATIONS = {
    "charging": "charge",
    "charges": "charge",
    "charged": "charge",
    "draining": "drain",
    "charger": "charger",
    "flickering": "flicker",
    "frozen": "freeze",
    "freezes": "freeze",
    "hanging": "hang",
    "hangs": "hang",
    "lagging": "lag",
    "restarting": "restart",
    "restarts": "restart",
    "rebooting": "reboot",
    "locked": "lock",
    "locking": "lock",
    "speakerphone": "speaker",
    "mic": "microphone",
    "mouthpiece": "microphone",
    "earpiece": "speaker",
    "wifi": "wifi",
    "networking": "network",
    "overheating": "overheat",
    "overheated": "overheat",
    "hot": "overheat",
    "tinted": "tint",
    "swelling": "swollen",
    "cracked": "broken",
    "crack": "broken",
    "burning": "burnt",
    "burned": "burnt",
    "wet": "liquid",
    "water": "liquid",
    "simcard": "sim",
    "simtray": "simtray",
    "registration": "register",
    "ticketing": "ticket",
    "aftersales": "ticket",
    "repairticket": "ticket",
    "legalstatus": "legal",
    "membersdiagnostic": "diagnostic",
    "devicecare": "battery",
    "maintenancemode": "dispatch",
    "findmymobile": "stolen",
    "galaxystore": "app",
    "oneui": "software",
    "update": "update",
    "managed": "shell",
    "frame": "frame",
    "selfrepairsls": "selfrepairsls",
    "waturepairsls": "waturepairsls",
    "removels": "removels",
    "replacement": "replacement",
    "replacements": "replacement",
    "transferring": "transfer",
    "transferred": "transfer",
    "returned": "return",
    "refunds": "refund",
    "recovered": "recovered",
}

_NON_ALNUM_PATTERN = re.compile(r"[^a-z0-9\s]")
_MULTI_SPACE_PATTERN = re.compile(r"\s+")


@dataclass(frozen=True)
class ProcedureSearchIndex:
    procedure: Procedure
    searchable_tokens: frozenset[str]
    searchable_token_values: tuple[str, ...]
    searchable_ngrams: frozenset[str]
    normalized_title: str
    normalized_description: str
    normalized_tags: tuple[str, ...]


@lru_cache(maxsize=8192)
def _normalize_text_cached(text: str) -> str:
    normalized = text.lower().strip()
    for source, replacement in PHRASE_REPLACEMENTS.items():
        normalized = normalized.replace(source, replacement)
    normalized = normalized.replace("doesn't", "doesnt").replace("can't", "cant")
    normalized = _NON_ALNUM_PATTERN.sub(" ", normalized)
    normalized = _MULTI_SPACE_PATTERN.sub(" ", normalized)
    return normalized.strip()


def normalize_text(text: str) -> str:
    return _normalize_text_cached(text or "")


@lru_cache(maxsize=16384)
def _tokenize_cached(text: str) -> tuple[str, ...]:
    tokens: list[str] = []
    for token in normalize_text(text).split():
        if token.endswith("s") and len(token) > 4:
            token = token[:-1]
        token = TOKEN_NORMALIZATIONS.get(token, token)
        tokens.append(token)
    return tuple(tokens)


def tokenize(text: str) -> list[str]:
    return list(_tokenize_cached(text or ""))


def extract_symptoms(tokens: list[str], procedure: Procedure | None = None) -> list[str]:
    meaningful = [token for token in tokens if token not in STOPWORDS]
    if procedure is None:
        return meaningful[:6]

    procedure_tags: set[str] = set()
    for tag in procedure.tags:
        procedure_tags.update(tokenize(tag.keyword))
    matched = [token for token in meaningful if token in procedure_tags]
    if matched:
        return matched[:6]
    return meaningful[:6]


def infer_issue_type(tokens: list[str]) -> str | None:
    token_set = set(tokens)
    scores: dict[str, int] = {}
    for issue_type, keywords in TERM_GROUPS.items():
        scores[issue_type] = len(token_set.intersection(keywords))

    highest_score = max(scores.values())
    if highest_score <= 0:
        return None

    tied_issue_types = [issue_type for issue_type, score in scores.items() if score == highest_score]
    for issue_type in ISSUE_TYPE_PRIORITY:
        if issue_type in tied_issue_types:
            return issue_type

    return tied_issue_types[0]


def normalized_similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, left, right).ratio()


def similarity(left: str, right: str) -> float:
    return normalized_similarity(normalize_text(left), normalize_text(right))


def token_similarity(
    query_tokens: list[str],
    candidate_tokens: set[str] | frozenset[str],
    candidate_values: tuple[str, ...] | None = None,
) -> float:
    if not query_tokens or not candidate_tokens:
        return 0.0

    candidates = candidate_values or tuple(candidate_tokens)
    total = 0.0
    for token in query_tokens:
        if token in candidate_tokens:
            total += 1.0
            continue
        total += max(SequenceMatcher(None, token, candidate).ratio() for candidate in candidates)
    return total / len(query_tokens)


def build_ngrams(tokens: list[str], sizes: tuple[int, ...] = (2, 3)) -> set[str]:
    meaningful_tokens = [token for token in tokens if token not in STOPWORDS]
    ngrams: set[str] = set()

    for size in sizes:
        if len(meaningful_tokens) < size:
            continue
        for index in range(len(meaningful_tokens) - size + 1):
            ngrams.add(" ".join(meaningful_tokens[index : index + size]))
    return ngrams


def ngram_similarity(
    query_tokens: list[str],
    candidate_ngrams: set[str] | frozenset[str],
    query_ngrams: set[str] | None = None,
) -> float:
    query_ngrams = query_ngrams or build_ngrams(query_tokens)
    if not query_ngrams or not candidate_ngrams:
        return 0.0
    return len(query_ngrams.intersection(candidate_ngrams)) / len(query_ngrams)


def build_searchable_tokens(procedure: Procedure) -> set[str]:
    searchable_fields = [procedure.title, procedure.category, procedure.description]
    searchable_fields.extend(tag.keyword for tag in procedure.tags)

    joined_tokens: set[str] = set()
    for field in searchable_fields:
        joined_tokens.update(tokenize(field))
    return joined_tokens


def build_searchable_ngrams(procedure: Procedure) -> set[str]:
    searchable_fields = [procedure.title, procedure.category, procedure.description]
    searchable_fields.extend(tag.keyword for tag in procedure.tags)

    ngrams: set[str] = set()
    for field in searchable_fields:
        ngrams.update(build_ngrams(tokenize(field)))
    return ngrams


def build_procedure_search_index(procedure: Procedure) -> ProcedureSearchIndex:
    searchable_tokens = frozenset(build_searchable_tokens(procedure))
    return ProcedureSearchIndex(
        procedure=procedure,
        searchable_tokens=searchable_tokens,
        searchable_token_values=tuple(searchable_tokens),
        searchable_ngrams=frozenset(build_searchable_ngrams(procedure)),
        normalized_title=normalize_text(procedure.title),
        normalized_description=normalize_text(procedure.description),
        normalized_tags=tuple(normalize_text(tag.keyword) for tag in procedure.tags),
    )


def count_exact_hits(query_tokens: list[str], candidate_tokens: set[str] | frozenset[str]) -> int:
    meaningful_tokens = [token for token in query_tokens if token not in STOPWORDS]
    return len(set(meaningful_tokens).intersection(candidate_tokens))


def score_procedure(
    query: str,
    query_tokens: list[str],
    procedure: Procedure,
    *,
    issue_type: str | None = None,
    query_ngrams: set[str] | None = None,
    normalized_query: str | None = None,
    meaningful_tokens: list[str] | None = None,
    meaningful_token_set: set[str] | None = None,
    precomputed: ProcedureSearchIndex | None = None,
) -> float:
    index = precomputed or build_procedure_search_index(procedure)
    joined_tokens = index.searchable_tokens
    joined_ngrams = index.searchable_ngrams
    effective_meaningful_tokens = (
        meaningful_tokens
        if meaningful_tokens is not None
        else [token for token in query_tokens if token not in STOPWORDS]
    )
    effective_meaningful_token_set = (
        meaningful_token_set if meaningful_token_set is not None else set(effective_meaningful_tokens)
    )

    overlap = 0.0
    if effective_meaningful_token_set:
        overlap = len(effective_meaningful_token_set.intersection(joined_tokens)) / len(
            effective_meaningful_token_set
        )

    fuzzy = token_similarity(
        effective_meaningful_tokens or query_tokens,
        joined_tokens,
        candidate_values=index.searchable_token_values,
    )
    phrase_score = ngram_similarity(query_tokens, joined_ngrams, query_ngrams=query_ngrams)

    normalized_query_text = (
        normalized_query if normalized_query is not None else normalize_text(query)
    )
    title_score = normalized_similarity(normalized_query_text, index.normalized_title)
    description_score = normalized_similarity(normalized_query_text, index.normalized_description)

    tag_score = 0.0
    if index.normalized_tags:
        tag_score = max(
            normalized_similarity(normalized_query_text, keyword) for keyword in index.normalized_tags
        )
    exact_hits = (
        len(effective_meaningful_token_set.intersection(joined_tokens))
        if effective_meaningful_token_set
        else count_exact_hits(query_tokens, joined_tokens)
    )
    exact_hit_bonus = min(exact_hits, 3) * 0.05

    inferred_issue_type = issue_type if issue_type is not None else infer_issue_type(query_tokens)
    issue_bonus = (
        0.12 if inferred_issue_type and inferred_issue_type.lower() in procedure.category.lower() else 0.0
    )

    raw_score = (
        (title_score * 0.22)
        + (description_score * 0.12)
        + (overlap * 0.27)
        + (fuzzy * 0.18)
        + (phrase_score * 0.11)
        + (tag_score * 0.10)
        + issue_bonus
        + exact_hit_bonus
    )
    return min(round(raw_score, 4), 0.99)


def classify_confidence(best_score: float, margin: float) -> tuple[str, bool, str | None]:
    if best_score < 0.34:
        return "low", True, "No strong match yet. Try another description or compare the closest flows carefully."
    if best_score < 0.58 or margin < 0.12:
        return "caution", True, "This is the closest flow, but the match is still close. Confirm the symptom carefully before continuing."
    return "strong", False, None


def search_procedures(db: Session, query: str) -> SearchResponse:
    clean_query = query.strip()
    query_tokens = tokenize(clean_query)
    meaningful_tokens = [token for token in query_tokens if token not in STOPWORDS]
    meaningful_token_set = set(meaningful_tokens)
    normalized_query = normalize_text(clean_query)
    query_ngrams = build_ngrams(query_tokens)
    issue_type = infer_issue_type(query_tokens)
    procedures = db.scalars(
        procedure_query_with(
            include_tags=True,
            include_decision_nodes=False,
            include_links=False,
        )
    ).all()

    if not procedures:
        return SearchResponse(
            query=clean_query,
            structured_intent=StructuredIntent(issue_type=None, symptoms=[]),
            confidence=0.0,
            confidence_state="low",
            confidence_margin=0.0,
            needs_review=True,
            review_message="No procedures are available yet.",
            suggested_next_step="Load procedures first, then try again.",
            no_match=True,
            message="No procedures are available yet.",
        )

    indexed_procedures = [build_procedure_search_index(procedure) for procedure in procedures]
    ranked = sorted(
        (
            (
                score_procedure(
                    clean_query,
                    query_tokens,
                    item.procedure,
                    issue_type=issue_type,
                    query_ngrams=query_ngrams,
                    normalized_query=normalized_query,
                    meaningful_tokens=meaningful_tokens,
                    meaningful_token_set=meaningful_token_set,
                    precomputed=item,
                ),
                item.procedure,
                item,
            )
            for item in indexed_procedures
        ),
        key=lambda item: item[0],
        reverse=True,
    )

    best_score, best_match, best_match_index = ranked[0]
    second_score = ranked[1][0] if len(ranked) > 1 else 0.0
    margin = max(round(best_score - second_score, 2), 0.0)
    confidence_state, needs_review, review_message = classify_confidence(best_score, margin)
    exact_hits = count_exact_hits(query_tokens, best_match_index.searchable_tokens)
    structured_intent_issue_type = (
        issue_type
        if issue_type and issue_type.lower() in best_match.category.lower()
        else best_match.category
    )
    structured_intent = StructuredIntent(
        issue_type=structured_intent_issue_type,
        symptoms=extract_symptoms(query_tokens, best_match),
    )

    alternatives: list[ProcedureSummary] = [
        to_summary(procedure)
        for score, procedure, _ in ranked[1:4]
        if score >= max(best_score - 0.12, 0.28)
    ]

    if best_score < 0.34:
        if exact_hits > 0 or issue_type:
            broad_alternatives: list[ProcedureSummary] = [
                to_summary(procedure)
                for score, procedure, _ in ranked[1:5]
                if score >= max(best_score - 0.18, 0.18)
            ]
            related = get_related_procedures(db, best_match.id)
            return SearchResponse(
                query=clean_query,
                structured_intent=structured_intent,
                confidence=round(best_score, 2),
                confidence_state=confidence_state,
                confidence_margin=margin,
                needs_review=needs_review,
                review_message=review_message,
                suggested_next_step=f"Start with {best_match.title}. This is a broad match based on one or two key words.",
                best_match=to_summary(best_match),
                alternatives=broad_alternatives,
                related=related,
                customer_care=get_customer_care(best_match),
                sop_preview=get_sop_layers(best_match),
                no_match=False,
                message="A broad keyword match was found. Confirm the symptom carefully during triage.",
            )
        return SearchResponse(
            query=clean_query,
            structured_intent=structured_intent,
            confidence=round(best_score, 2),
            confidence_state=confidence_state,
            confidence_margin=margin,
            needs_review=True,
            review_message=review_message,
            suggested_next_step="Try a shorter description or tap one of the quick issue buttons.",
            alternatives=alternatives,
            no_match=True,
            message="I could not find a confident match yet.",
        )

    related = get_related_procedures(db, best_match.id)
    next_step = f"Open guided triage for {best_match.title}."
    if alternatives:
        next_step = f"Start with {best_match.title}, but keep the alternate matches in mind."

    return SearchResponse(
        query=clean_query,
        structured_intent=structured_intent,
        confidence=round(best_score, 2),
        confidence_state=confidence_state,
        confidence_margin=margin,
        needs_review=needs_review,
        review_message=review_message,
        suggested_next_step=next_step,
        best_match=to_summary(best_match),
        alternatives=alternatives,
        related=related,
        customer_care=get_customer_care(best_match),
        sop_preview=get_sop_layers(best_match),
        no_match=False,
        message="Best match ready for guided triage.",
    )
