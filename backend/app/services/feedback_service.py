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
            FeedbackEntry.query,
            FeedbackEntry.helpful,
            FeedbackEntry.branch_label,
            FeedbackEntry.created_at,
            Procedure.title,
        )
        .select_from(FeedbackEntry)
        .join(Procedure, Procedure.id == FeedbackEntry.procedure_id, isouter=True)
        .where(where_clause, FeedbackEntry.query.is_not(None))
        .order_by(desc(FeedbackEntry.created_at))
    ).all()

    grouped: dict[str, FeedbackLanguageCandidateItem] = {}

    for query, helpful, branch_label, created_at, procedure_title in rows:
        normalized_query = _normalize_feedback_query(query)
        if not normalized_query:
            continue

        existing = grouped.get(normalized_query)
        if existing is None:
            grouped[normalized_query] = FeedbackLanguageCandidateItem(
                normalized_query=normalized_query,
                sample_query=query.strip(),
                total_mentions=1,
                helpful_count=1 if helpful else 0,
                not_helpful_count=0 if helpful else 1,
                latest_procedure_title=procedure_title,
                latest_branch_label=branch_label,
                latest_created_at=created_at,
            )
            continue

        grouped[normalized_query] = FeedbackLanguageCandidateItem(
            normalized_query=existing.normalized_query,
            sample_query=existing.sample_query,
            total_mentions=existing.total_mentions + 1,
            helpful_count=existing.helpful_count + (1 if helpful else 0),
            not_helpful_count=existing.not_helpful_count + (0 if helpful else 1),
            latest_procedure_title=existing.latest_procedure_title,
            latest_branch_label=existing.latest_branch_label,
            latest_created_at=existing.latest_created_at,
        )

    sorted_items = sorted(
        grouped.values(),
        key=lambda item: (
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
            "latest_procedure_title",
            "latest_branch_label",
            "latest_created_at",
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
                "latest_procedure_title": item.latest_procedure_title or "",
                "latest_branch_label": item.latest_branch_label or "",
                "latest_created_at": item.latest_created_at.isoformat()
                if item.latest_created_at
                else "",
            }
        )

    return buffer.getvalue()


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
