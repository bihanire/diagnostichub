from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.models import AppUser, Case, ECLocation
from app.schemas.admin import (
    ActivityResponse,
    ActivitySummary,
    AgentActivityItem,
    ECActivityItem,
)

_EC_ROLES = frozenset({"ec_agent", "ec_manager"})


def get_activity(db: Session) -> ActivityResponse:
    now = datetime.now(UTC)
    cutoff = now - timedelta(days=30)

    # ── EC locations ──────────────────────────────────────────────
    ec_rows = db.scalars(select(ECLocation).where(ECLocation.is_active)).all()
    ec_map = {ec.id: ec for ec in ec_rows}

    # ── Agent counts per EC ───────────────────────────────────────
    agent_count_rows = db.execute(
        select(AppUser.ec_location_id, func.count(AppUser.id).label("n"))
        .where(AppUser.approval_status == "approved")
        .where(AppUser.ec_location_id.is_not(None))
        .group_by(AppUser.ec_location_id)
    ).all()
    agent_counts: dict[int, int] = {r.ec_location_id: r.n for r in agent_count_rows}

    # ── Case stats per EC (last 30d) ──────────────────────────────
    case_ec_rows = db.execute(
        select(
            Case.ec_location_id,
            func.count(Case.id).label("n"),
            func.max(Case.created_at).label("last_at"),
        )
        .where(Case.created_at >= cutoff)
        .group_by(Case.ec_location_id)
    ).all()
    case_counts: dict[int, int] = {r.ec_location_id: r.n for r in case_ec_rows}
    case_last: dict[int, datetime] = {r.ec_location_id: r.last_at for r in case_ec_rows}

    # ── Totals ────────────────────────────────────────────────────
    total_cases_30d = db.scalar(
        select(func.count(Case.id)).where(Case.created_at >= cutoff)
    ) or 0
    pending_count = db.scalar(
        select(func.count(AppUser.id)).where(AppUser.approval_status == "pending")
    ) or 0
    total_agents = sum(agent_counts.values())
    active_ec_ids = {eid for eid in ec_map if agent_counts.get(eid, 0) > 0 or case_counts.get(eid, 0) > 0}

    by_ec = sorted(
        [
            ECActivityItem(
                ec_id=ec.id,
                ec_name=ec.name,
                country_code=ec.country_code,
                agent_count=agent_counts.get(ec.id, 0),
                cases_30d=case_counts.get(ec.id, 0),
                last_case_at=case_last.get(ec.id),
            )
            for ec in ec_rows
        ],
        key=lambda x: x.cases_30d,
        reverse=True,
    )

    # ── Top agents ────────────────────────────────────────────────
    agent_rows = db.scalars(
        select(AppUser)
        .where(AppUser.approval_status == "approved")
        .where(AppUser.role.in_(list(_EC_ROLES)))
    ).all()

    agent_ids = [u.id for u in agent_rows]
    agent_case_rows = db.execute(
        select(
            Case.created_by_id,
            func.count(Case.id).label("n"),
            func.max(Case.created_at).label("last_at"),
        )
        .where(Case.created_by_id.in_(agent_ids))
        .where(Case.created_at >= cutoff)
        .group_by(Case.created_by_id)
    ).all()
    agent_case_count: dict[int, int] = {r.created_by_id: r.n for r in agent_case_rows}
    agent_case_last: dict[int, datetime] = {r.created_by_id: r.last_at for r in agent_case_rows}

    top_agents = sorted(
        [
            AgentActivityItem(
                user_id=u.id,
                full_name=u.full_name,
                email=u.email,
                ec_name=ec_map[u.ec_location_id].name if u.ec_location_id and u.ec_location_id in ec_map else None,
                role=u.role,
                cases_30d=agent_case_count.get(u.id, 0),
                last_login_at=u.last_login_at,
                last_case_at=agent_case_last.get(u.id),
            )
            for u in agent_rows
        ],
        key=lambda x: x.cases_30d,
        reverse=True,
    )[:40]

    return ActivityResponse(
        generated_at=now,
        summary=ActivitySummary(
            total_active_agents=total_agents,
            total_cases_30d=total_cases_30d,
            active_ecs=len(active_ec_ids),
            pending_approvals=pending_count,
        ),
        by_ec=by_ec,
        top_agents=top_agents,
    )
