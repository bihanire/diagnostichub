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
