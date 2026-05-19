from collections import Counter
from csv import DictWriter
from datetime import datetime, timedelta, timezone
from io import StringIO
import re

from sqlalchemy import case, desc, func, select
from sqlalchemy.orm import Session

from app.models.models import FeedbackEntry, Procedure
from app.schemas.feedback import (
    BranchFeedbackBreakdownItem,
    BranchFeedbackBreakdownResponse,
    FeedbackCreateRequest,
    FeedbackCreateResponse,
    FeedbackEntryPayload,
    FeedbackLanguageCandidateItem,
    FeedbackLanguageCandidateResponse,
    FeedbackSummaryResponse,
    FEEDBACK_TAG_OPTIONS,
    FeedbackTagBreakdownItem,
    FeedbackTagBreakdownResponse,
    ProcedureFeedbackBreakdownItem,
    ProcedureFeedbackBreakdownResponse,
)

_SPACE_PATTERN = re.compile(r"\s+")
_NON_SIGNAL_PATTERN = re.compile(r"[^a-z0-9+ ]+")
_REVIEW_SIGNAL_TAGS = {
    "wrong_match",
    "confusing_question",
    "should_have_solved_at_branch",
    "should_have_escalated_sooner",
}
_LOW_CONFIDENCE_STATES = {"low", "caution"}
_PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}


def create_feedback(db: Session, payload: FeedbackCreateRequest) -> FeedbackCreateResponse:
    if payload.procedure_id is not None and db.get(Procedure, payload.procedure_id) is None:
        raise ValueError("Procedure not found for feedback.")
    normalized_tags = _normalize_feedback_tags(payload.feedback_tags)
    invalid_tags = sorted(set(normalized_tags).difference(FEEDBACK_TAG_OPTIONS))
    if invalid_tags:
        raise ValueError("Feedback tags contain unsupported values.")

    feedback = FeedbackEntry(
        helpful=payload.helpful,
        procedure_id=payload.procedure_id,
        query=(payload.query or "").strip() or None,
        branch_label=(payload.branch_label or "").strip() or None,
        comment=(payload.comment or "").strip() or None,
        outcome_diagnosis=(payload.outcome_diagnosis or "").strip() or None,
        feedback_tags=normalized_tags,
        triage_trace=payload.triage_trace or [],
        final_decision_label=(payload.final_decision_label or "").strip() or None,
        search_confidence=payload.search_confidence,
        search_confidence_state=(payload.search_confidence_state or "").strip() or None,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return FeedbackCreateResponse(
        id=feedback.id,
        created_at=feedback.created_at,
        message="Thanks. Your feedback has been saved.",
    )


def _cutoff_for_days(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _feedback_where_clause(days: int):
    return FeedbackEntry.created_at >= _cutoff_for_days(days)


def get_feedback_summary(db: Session, days: int = 30) -> FeedbackSummaryResponse:
    where_clause = _feedback_where_clause(days)
    summary_row = db.execute(
        select(
            func.count(FeedbackEntry.id),
            func.sum(case((FeedbackEntry.helpful.is_(True), 1), else_=0)),
            func.sum(case((FeedbackEntry.helpful.is_(False), 1), else_=0)),
        ).where(where_clause)
    ).one()
    total_submissions, helpful_count, not_helpful_count = summary_row

    latest_rows = db.scalars(
        select(FeedbackEntry)
        .where(where_clause)
        .order_by(desc(FeedbackEntry.created_at))
        .limit(10)
    ).all()

    return FeedbackSummaryResponse(
        total_submissions=total_submissions or 0,
        helpful_count=helpful_count or 0,
        not_helpful_count=not_helpful_count or 0,
        latest_submissions=[
            FeedbackEntryPayload(
                id=item.id,
                helpful=item.helpful,
                procedure_id=item.procedure_id,
                branch_label=item.branch_label,
                comment=item.comment,
                outcome_diagnosis=item.outcome_diagnosis,
                feedback_tags=item.feedback_tags or [],
                final_decision_label=item.final_decision_label,
                triage_trace=item.triage_trace or [],
                created_at=item.created_at,
            )
            for item in latest_rows
        ],
    )


def get_feedback_by_procedure(db: Session, days: int = 30) -> ProcedureFeedbackBreakdownResponse:
    where_clause = _feedback_where_clause(days)
    rows = db.execute(
        select(
            FeedbackEntry.procedure_id,
            func.coalesce(Procedure.title, "Unknown or deleted procedure"),
            func.count(FeedbackEntry.id),
            func.sum(case((FeedbackEntry.helpful.is_(True), 1), else_=0)),
            func.sum(case((FeedbackEntry.helpful.is_(False), 1), else_=0)),
        )
        .select_from(FeedbackEntry)
        .join(Procedure, Procedure.id == FeedbackEntry.procedure_id, isouter=True)
        .where(where_clause)
        .group_by(FeedbackEntry.procedure_id, Procedure.title)
        .order_by(func.count(FeedbackEntry.id).desc(), func.coalesce(Procedure.title, "Unknown or deleted procedure"))
    ).all()

    return ProcedureFeedbackBreakdownResponse(
        days=days,
        items=[
            ProcedureFeedbackBreakdownItem(
                procedure_id=procedure_id,
                procedure_title=procedure_title,
                total_submissions=total_submissions,
                helpful_count=helpful_count or 0,
                not_helpful_count=not_helpful_count or 0,
            )
            for procedure_id, procedure_title, total_submissions, helpful_count, not_helpful_count in rows
        ],
    )


def get_feedback_by_branch(db: Session, days: int = 30) -> BranchFeedbackBreakdownResponse:
    where_clause = _feedback_where_clause(days)
    normalized_branch = func.coalesce(
        func.nullif(FeedbackEntry.branch_label, ""),
        "Unspecified branch",
    )
    rows = db.execute(
        select(
            normalized_branch,
            func.count(FeedbackEntry.id),
            func.sum(case((FeedbackEntry.helpful.is_(True), 1), else_=0)),
            func.sum(case((FeedbackEntry.helpful.is_(False), 1), else_=0)),
        )
        .where(where_clause)
        .group_by(normalized_branch)
        .order_by(func.count(FeedbackEntry.id).desc(), normalized_branch)
    ).all()

    return BranchFeedbackBreakdownResponse(
        days=days,
        items=[
            BranchFeedbackBreakdownItem(
                branch_label=branch_label,
                total_submissions=total_submissions,
                helpful_count=helpful_count or 0,
                not_helpful_count=not_helpful_count or 0,
            )
            for branch_label, total_submissions, helpful_count, not_helpful_count in rows
        ],
    )


def get_feedback_by_tag(db: Session, days: int = 30) -> FeedbackTagBreakdownResponse:
    where_clause = _feedback_where_clause(days)
    rows = db.execute(
        select(FeedbackEntry.feedback_tags, FeedbackEntry.helpful).where(where_clause)
    ).all()

    grouped: dict[str, FeedbackTagBreakdownItem] = {}
    for tags, helpful in rows:
        for tag in tags or []:
            existing = grouped.get(tag)
            if existing is None:
                grouped[tag] = FeedbackTagBreakdownItem(
                    tag=tag,
                    total_submissions=1,
                    helpful_count=1 if helpful else 0,
                    not_helpful_count=0 if helpful else 1,
                )
                continue
            grouped[tag] = FeedbackTagBreakdownItem(
                tag=tag,
                total_submissions=existing.total_submissions + 1,
                helpful_count=existing.helpful_count + (1 if helpful else 0),
                not_helpful_count=existing.not_helpful_count + (0 if helpful else 1),
            )

    sorted_items = sorted(
        grouped.values(),
        key=lambda item: (-item.total_submissions, -item.not_helpful_count, item.tag),
    )
    return FeedbackTagBreakdownResponse(days=days, items=sorted_items)


def get_feedback_language_candidates(
    db: Session,
    days: int = 30,
    limit: int = 20,
) -> FeedbackLanguageCandidateResponse:
    where_clause = _feedback_where_clause(days)
    rows = db.execute(
        select(
            FeedbackEntry.id,
            FeedbackEntry.query,
            FeedbackEntry.helpful,
            FeedbackEntry.branch_label,
            FeedbackEntry.created_at,
            FeedbackEntry.procedure_id,
            Procedure.title,
            FeedbackEntry.feedback_tags,
            FeedbackEntry.search_confidence,
            FeedbackEntry.search_confidence_state,
        )
        .select_from(FeedbackEntry)
        .join(Procedure, Procedure.id == FeedbackEntry.procedure_id, isouter=True)
        .where(where_clause, FeedbackEntry.query.is_not(None))
        .order_by(desc(FeedbackEntry.created_at), desc(FeedbackEntry.id))
    ).all()

    grouped: dict[str, dict] = {}

    for (
        _entry_id,
        query,
        helpful,
        branch_label,
        created_at,
        procedure_id,
        procedure_title,
        feedback_tags,
        search_confidence,
        search_confidence_state,
    ) in rows:
        normalized_query = _normalize_feedback_query(query)
        if not normalized_query:
            continue

        existing = grouped.get(normalized_query)
        if existing is None:
            existing = {
                "normalized_query": normalized_query,
                "sample_query": query.strip(),
                "total_mentions": 0,
                "helpful_count": 0,
                "not_helpful_count": 0,
                "latest_procedure_id": procedure_id,
                "latest_procedure_title": procedure_title,
                "latest_branch_label": branch_label,
                "latest_created_at": created_at,
                "feedback_tags": Counter(),
                "confidence_states": Counter(),
                "search_confidences": [],
            }
            grouped[normalized_query] = existing

        existing["total_mentions"] += 1
        existing["helpful_count"] += 1 if helpful else 0
        existing["not_helpful_count"] += 0 if helpful else 1
        existing["feedback_tags"].update(feedback_tags or [])
        if search_confidence is not None:
            existing["search_confidences"].append(search_confidence)
        normalized_state = (search_confidence_state or "").strip().lower()
        if normalized_state:
            existing["confidence_states"].update([normalized_state])

    items = [_build_language_candidate_item(candidate) for candidate in grouped.values()]

    sorted_items = sorted(
        items,
        key=lambda item: (
            _PRIORITY_RANK.get(item.review_priority, 3),
            -item.total_mentions,
            -item.not_helpful_count,
            item.normalized_query,
        ),
    )

    return FeedbackLanguageCandidateResponse(days=days, items=sorted_items[:limit])


def export_feedback_csv(db: Session, days: int = 30) -> str:
    where_clause = _feedback_where_clause(days)
    rows = db.execute(
        select(
            FeedbackEntry.id,
            FeedbackEntry.created_at,
            FeedbackEntry.helpful,
            FeedbackEntry.query,
            FeedbackEntry.branch_label,
            FeedbackEntry.comment,
            FeedbackEntry.outcome_diagnosis,
            FeedbackEntry.feedback_tags,
            FeedbackEntry.final_decision_label,
            FeedbackEntry.search_confidence,
            FeedbackEntry.search_confidence_state,
            FeedbackEntry.triage_trace,
            FeedbackEntry.procedure_id,
            Procedure.title,
        )
        .select_from(FeedbackEntry)
        .join(Procedure, Procedure.id == FeedbackEntry.procedure_id, isouter=True)
        .where(where_clause)
        .order_by(desc(FeedbackEntry.created_at))
    ).all()

    buffer = StringIO()
    writer = DictWriter(
        buffer,
        fieldnames=[
            "id",
            "created_at",
            "helpful",
            "procedure_id",
            "procedure_title",
            "query",
            "branch_label",
            "comment",
            "outcome_diagnosis",
            "feedback_tags",
            "final_decision_label",
            "search_confidence",
            "search_confidence_state",
            "triage_trace",
        ],
    )
    writer.writeheader()

    for row in rows:
        (
            entry_id,
            created_at,
            helpful,
            query,
            branch_label,
            comment,
            outcome_diagnosis,
            feedback_tags,
            final_decision_label,
            search_confidence,
            search_confidence_state,
            triage_trace,
            procedure_id,
            procedure_title,
        ) = row
        writer.writerow(
            {
                "id": entry_id,
                "created_at": created_at.isoformat() if created_at else "",
                "helpful": helpful,
                "procedure_id": procedure_id or "",
                "procedure_title": procedure_title or "",
                "query": query or "",
                "branch_label": branch_label or "",
                "comment": comment or "",
                "outcome_diagnosis": outcome_diagnosis or "",
                "feedback_tags": "|".join(feedback_tags or []),
                "final_decision_label": final_decision_label or "",
                "search_confidence": search_confidence if search_confidence is not None else "",
                "search_confidence_state": search_confidence_state or "",
                "triage_trace": str(triage_trace or ""),
            }
        )

    return buffer.getvalue()


def export_feedback_language_candidates_csv(
    db: Session,
    days: int = 30,
    limit: int = 50,
) -> str:
    response = get_feedback_language_candidates(db, days=days, limit=limit)

    buffer = StringIO()
    writer = DictWriter(
        buffer,
        fieldnames=[
            "normalized_query",
            "sample_query",
            "total_mentions",
            "helpful_count",
            "not_helpful_count",
            "latest_procedure_id",
            "latest_procedure_title",
            "latest_branch_label",
            "latest_created_at",
            "review_priority",
            "suggested_action",
            "promotion_reason",
            "benchmark_draft_query",
            "feedback_tags",
            "confidence_states",
            "average_search_confidence",
        ],
    )
    writer.writeheader()

    for item in response.items:
        writer.writerow(
            {
                "normalized_query": item.normalized_query,
                "sample_query": item.sample_query,
                "total_mentions": item.total_mentions,
                "helpful_count": item.helpful_count,
                "not_helpful_count": item.not_helpful_count,
                "latest_procedure_id": item.latest_procedure_id or "",
                "latest_procedure_title": item.latest_procedure_title or "",
                "latest_branch_label": item.latest_branch_label or "",
                "latest_created_at": item.latest_created_at.isoformat()
                if item.latest_created_at
                else "",
                "review_priority": item.review_priority,
                "suggested_action": item.suggested_action,
                "promotion_reason": item.promotion_reason,
                "benchmark_draft_query": item.benchmark_draft_query,
                "feedback_tags": "|".join(item.feedback_tags),
                "confidence_states": "|".join(
                    f"{state}:{count}" for state, count in sorted(item.confidence_states.items())
                ),
                "average_search_confidence": (
                    round(item.average_search_confidence, 4)
                    if item.average_search_confidence is not None
                    else ""
                ),
            }
        )

    return buffer.getvalue()


def _build_language_candidate_item(candidate: dict) -> FeedbackLanguageCandidateItem:
    feedback_tags = sorted(candidate["feedback_tags"].keys())
    confidence_states = dict(sorted(candidate["confidence_states"].items()))
    search_confidences = candidate["search_confidences"]
    average_search_confidence = (
        sum(search_confidences) / len(search_confidences) if search_confidences else None
    )
    review_priority, suggested_action, promotion_reason = _score_language_candidate(
        total_mentions=candidate["total_mentions"],
        not_helpful_count=candidate["not_helpful_count"],
        feedback_tags=feedback_tags,
        confidence_states=confidence_states,
    )

    return FeedbackLanguageCandidateItem(
        normalized_query=candidate["normalized_query"],
        sample_query=candidate["sample_query"],
        total_mentions=candidate["total_mentions"],
        helpful_count=candidate["helpful_count"],
        not_helpful_count=candidate["not_helpful_count"],
        latest_procedure_id=candidate["latest_procedure_id"],
        latest_procedure_title=candidate["latest_procedure_title"],
        latest_branch_label=candidate["latest_branch_label"],
        latest_created_at=candidate["latest_created_at"],
        review_priority=review_priority,
        suggested_action=suggested_action,
        promotion_reason=promotion_reason,
        benchmark_draft_query=candidate["normalized_query"],
        feedback_tags=feedback_tags,
        confidence_states=confidence_states,
        average_search_confidence=average_search_confidence,
    )


def _score_language_candidate(
    *,
    total_mentions: int,
    not_helpful_count: int,
    feedback_tags: list[str],
    confidence_states: dict[str, int],
) -> tuple[str, str, str]:
    review_tag_count = sum(1 for tag in feedback_tags if tag in _REVIEW_SIGNAL_TAGS)
    low_confidence_count = sum(
        count for state, count in confidence_states.items() if state in _LOW_CONFIDENCE_STATES
    )

    if not_helpful_count >= 2 or review_tag_count >= 2:
        return (
            "high",
            "content_review",
            "Repeated negative feedback or review tags indicate a possible guidance gap.",
        )
    if not_helpful_count >= 1 or review_tag_count >= 1:
        return (
            "medium",
            "content_review",
            "At least one operator marked this wording as unresolved or confusing.",
        )
    if total_mentions >= 2 or low_confidence_count >= 1:
        return (
            "medium",
            "benchmark_candidate",
            "Repeated or low-confidence wording may improve benchmark coverage after review.",
        )
    return ("low", "monitor", "Monitor for repeated branch wording.")


def _normalize_feedback_query(query: str | None) -> str:
    if not query:
        return ""

    normalized = _NON_SIGNAL_PATTERN.sub(" ", query.lower())
    normalized = _SPACE_PATTERN.sub(" ", normalized).strip()
    if len(normalized) < 4:
        return ""
    return normalized


def _normalize_feedback_tags(tags: list[str]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        normalized = tag.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    return ordered
