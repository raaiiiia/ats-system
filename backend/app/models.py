import uuid
from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)


class ImportFile(Base):
    __tablename__ = "import_files"

    id: Mapped[uuid.UUID] = uuid_pk()
    filename: Mapped[str] = mapped_column(Text)
    stored_path: Mapped[str] = mapped_column(Text)
    file_format: Mapped[str] = mapped_column(String(20))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(40), default="uploaded")
    detected_type: Mapped[str] = mapped_column(String(80), default="unknown_data")
    field_mapping: Mapped[dict] = mapped_column(JSON, default=dict)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    clean_summary: Mapped[dict] = mapped_column(JSON, default=dict)


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = uuid_pk()
    import_file_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), ForeignKey("import_files.id"))
    name: Mapped[str] = mapped_column(Text, default="Unknown")
    role: Mapped[str] = mapped_column(Text, default="Unknown")
    email: Mapped[str] = mapped_column(Text, default="Unknown")
    phone: Mapped[str] = mapped_column(Text, default="Unknown")
    education: Mapped[str] = mapped_column(Text, default="Unknown")
    skills: Mapped[list] = mapped_column(JSON, default=list)
    experience: Mapped[str] = mapped_column(Text, default="Unknown")
    resume: Mapped[str] = mapped_column(Text, default="")
    job_description: Mapped[str] = mapped_column(Text, default="")
    fit_score: Mapped[float] = mapped_column(Float, default=0)
    level: Mapped[str] = mapped_column(String(40), default="Unknown")
    pipeline_status: Mapped[str] = mapped_column(String(80), default="Resume")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    parsed_data: Mapped[dict] = mapped_column(JSON, default=dict)
    history: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PipelineStage(Base):
    __tablename__ = "pipeline_stages"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(80), unique=True)
    position: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[uuid.UUID] = uuid_pk()
    title: Mapped[str] = mapped_column(Text)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    location: Mapped[str] = mapped_column(Text, default="TBD")
    interviewer: Mapped[str] = mapped_column(Text, default="Unassigned")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    candidates: Mapped[list["InterviewCandidate"]] = relationship(back_populates="interview", cascade="all, delete-orphan")


class InterviewCandidate(Base):
    __tablename__ = "interview_candidates"
    __table_args__ = (UniqueConstraint("interview_id", "candidate_id"),)

    interview_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("interviews.id"), primary_key=True)
    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("candidates.id"), primary_key=True)
    communication: Mapped[float | None] = mapped_column(Float)
    technical: Mapped[float | None] = mapped_column(Float)
    leadership: Mapped[float | None] = mapped_column(Float)
    problem_solving: Mapped[float | None] = mapped_column(Float)
    culture_fit: Mapped[float | None] = mapped_column(Float)
    average_score: Mapped[float | None] = mapped_column(Float)
    result: Mapped[str] = mapped_column(String(20), default="Hold")
    notes: Mapped[str] = mapped_column(Text, default="")
    interview: Mapped[Interview] = relationship(back_populates="candidates")
