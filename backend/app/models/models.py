from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.core.database import Base

JSON_VARIANT = JSON().with_variant(JSONB, "postgresql")


class Procedure(Base):
    __tablename__ = "procedures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    steps: Mapped[dict] = mapped_column(JSON_VARIANT, nullable=False, default=dict)
    outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    warranty_status: Mapped[str | None] = mapped_column(String(120), nullable=True)
    src_group: Mapped[str | None] = mapped_column(String(30), nullable=True)
    primary_t_code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    tags: Mapped[list["Tag"]] = relationship(
        back_populates="procedure",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    decision_nodes: Mapped[list["DecisionNode"]] = relationship(
        back_populates="procedure",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    links: Mapped[list["LinkedNode"]] = relationship(
        back_populates="procedure",
        cascade="all, delete-orphan",
        foreign_keys="LinkedNode.procedure_id",
        lazy="selectin",
    )


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("keyword", "procedure_id", name="uq_tags_keyword_proc"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    keyword: Mapped[str] = mapped_column(String(120), nullable=False)
    procedure_id: Mapped[int] = mapped_column(ForeignKey("procedures.id"), nullable=False)

    procedure: Mapped["Procedure"] = relationship(back_populates="tags")


class DecisionNode(Base):
    __tablename__ = "decision_nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    procedure_id: Mapped[int] = mapped_column(ForeignKey("procedures.id"), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    yes_next: Mapped[int | None] = mapped_column(
        ForeignKey("decision_nodes.id"),
        nullable=True,
    )
    no_next: Mapped[int | None] = mapped_column(
        ForeignKey("decision_nodes.id"),
        nullable=True,
    )
    final_outcome: Mapped[dict | None] = mapped_column(JSON_VARIANT, nullable=True)

    procedure: Mapped["Procedure"] = relationship(back_populates="decision_nodes")


class LinkedNode(Base):
    __tablename__ = "linked_nodes"
    __table_args__ = (
        UniqueConstraint(
            "procedure_id",
            "linked_procedure_id",
            name="uq_linked_nodes_pair",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    procedure_id: Mapped[int] = mapped_column(ForeignKey("procedures.id"), nullable=False)
    linked_procedure_id: Mapped[int] = mapped_column(
        ForeignKey("procedures.id"),
        nullable=False,
    )

    procedure: Mapped["Procedure"] = relationship(
        back_populates="links",
        foreign_keys=[procedure_id],
    )
    linked_procedure: Mapped["Procedure"] = relationship(foreign_keys=[linked_procedure_id])


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_name: Mapped[str] = mapped_column(String(20), nullable=False)
    samsung_code: Mapped[str] = mapped_column(String(20), nullable=False)
    storage_gb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ram_gb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bom_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    auto_blocker_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    display_label: Mapped[str] = mapped_column(String(80), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    procedure_id: Mapped[int | None] = mapped_column(ForeignKey("procedures.id"), nullable=True)
    item_text: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    applicable_warranty_direction: Mapped[str | None] = mapped_column(String(5), nullable=True)
    checklist_phase: Mapped[str] = mapped_column(String(30), default="evidence", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class RepairPart(Base):
    __tablename__ = "repair_parts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    t_code: Mapped[str] = mapped_column(String(10), nullable=False)
    part_name: Mapped[str] = mapped_column(String(100), nullable=False)
    part_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    applies_to_warranty: Mapped[str | None] = mapped_column(String(5), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ECLocation(Base):
    __tablename__ = "ec_locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    country_code: Mapped[str] = mapped_column(String(3), nullable=False)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    job_card_sequence: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class AppUser(Base):
    __tablename__ = "app_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    google_sub: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    # Roles: ec_agent | ec_manager | watu_ops | watu_admin
    role: Mapped[str] = mapped_column(String(30), default="ec_agent", nullable=False)
    country_code: Mapped[str | None] = mapped_column(String(3), nullable=True)
    ec_location_id: Mapped[int | None] = mapped_column(ForeignKey("ec_locations.id"), nullable=True)
    # Statuses: pending | approved | suspended
    approval_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("app_users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    ec_location: Mapped["ECLocation | None"] = relationship(
        "ECLocation", foreign_keys=[ec_location_id], lazy="selectin"
    )


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    # Types: repair | frp | return | theft
    case_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # Statuses: open | dispatched | closed | cancelled
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False)

    ec_location_id: Mapped[int] = mapped_column(ForeignKey("ec_locations.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False)

    # Client
    client_name: Mapped[str] = mapped_column(String(200), nullable=False)
    client_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    client_alt_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    client_id_number: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Device
    device_model: Mapped[str] = mapped_column(String(100), nullable=False)
    device_imei: Mapped[str] = mapped_column(String(20), nullable=False)
    complaint: Mapped[str] = mapped_column(Text, nullable=False)

    # Diagnostic output (from triage session)
    sym_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    src_group: Mapped[str | None] = mapped_column(String(10), nullable=True)
    defect_description: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Warranty
    warranty_direction: Mapped[str | None] = mapped_column(String(5), nullable=True)
    wty_exception: Mapped[str | None] = mapped_column(String(10), nullable=True)
    liquid_exposure: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    drop_or_repair: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    sw_update: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    normal_use: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Dispatch
    asc_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    asc_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    ls_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    waybill_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Device security
    sim_tray_present: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    lock_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    client_pin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    pattern_sequence: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Photos — Drive links added later (Phase 4)
    photo_front: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_back: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_client_holding: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_pattern: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    ec_location: Mapped["ECLocation"] = relationship("ECLocation", foreign_keys=[ec_location_id], lazy="selectin")
    created_by: Mapped["AppUser"] = relationship("AppUser", foreign_keys=[created_by_id], lazy="selectin")
    case_notes: Mapped[list["CaseNote"]] = relationship(
        "CaseNote", back_populates="case", cascade="all, delete-orphan", lazy="selectin",
        order_by="CaseNote.created_at.asc()",
    )


class CaseNote(Base):
    __tablename__ = "case_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    case: Mapped["Case"] = relationship("Case", back_populates="case_notes")
    user: Mapped["AppUser"] = relationship("AppUser", foreign_keys=[user_id], lazy="selectin")


class InviteToken(Base):
    __tablename__ = "invite_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    ec_location_id: Mapped[int] = mapped_column(ForeignKey("ec_locations.id"), nullable=False)
    country_code: Mapped[str] = mapped_column(String(3), nullable=False)
    role: Mapped[str] = mapped_column(String(30), default="ec_agent", nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    use_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    auto_approve: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    ec_location: Mapped["ECLocation"] = relationship("ECLocation", foreign_keys=[ec_location_id], lazy="selectin")


class OTPRequest(Base):
    __tablename__ = "otp_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 hex of the 6-digit code
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class FeedbackEntry(Base):
    __tablename__ = "feedback_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    helpful: Mapped[bool] = mapped_column(Boolean, nullable=False)
    procedure_id: Mapped[int | None] = mapped_column(ForeignKey("procedures.id"), nullable=True)
    query: Mapped[str | None] = mapped_column(Text, nullable=True)
    branch_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    outcome_diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    feedback_tags: Mapped[list[str]] = mapped_column(JSON_VARIANT, nullable=False, default=list)
    triage_trace: Mapped[list[dict] | None] = mapped_column(JSON_VARIANT, nullable=True)
    final_decision_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    search_confidence: Mapped[float | None] = mapped_column(nullable=True)
    search_confidence_state: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
