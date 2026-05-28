from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ImportFileOut(BaseModel):
    id: UUID
    filename: str
    file_format: str
    size_bytes: int
    uploaded_at: datetime
    status: str
    detected_type: str
    field_mapping: dict
    row_count: int
    clean_summary: dict

    class Config:
        from_attributes = True


class CandidateOut(BaseModel):
    id: UUID
    name: str
    role: str
    email: str
    phone: str
    education: str
    skills: list
    experience: str
    resume: str
    fit_score: float
    level: str
    pipeline_status: str
    tags: list
    parsed_data: dict
    profile: dict = Field(default_factory=dict)
    originalResume: str = ""
    history: list

    class Config:
        from_attributes = True


class PageOut(BaseModel):
    items: list[CandidateOut]
    total: int
    page: int
    page_size: int


class CandidateTagsUpdate(BaseModel):
    tags: list[str]


class CandidateStatusUpdate(BaseModel):
    pipeline_status: str = Field(min_length=1, max_length=80)


class CandidateNoteUpdate(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


class ResumeScoreConfigUpdate(BaseModel):
    weights: dict[str, float]


class MappingUpdate(BaseModel):
    field_mapping: dict[str, str]


class MoveCandidate(BaseModel):
    candidate_id: UUID
    stage: str
    result: str = "Moved"


class PipelineStageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class InterviewCreate(BaseModel):
    title: str
    scheduled_at: datetime
    location: str
    interviewer: str


class InterviewScore(BaseModel):
    communication: float = 0
    technical: float = 0
    leadership: float = 0
    problem_solving: float = 0
    culture_fit: float = 0
    result: str = "Hold"
    notes: str = ""
