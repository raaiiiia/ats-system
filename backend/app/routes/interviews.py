from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Candidate, Interview, InterviewCandidate
from app.schemas import InterviewCreate, InterviewScore

router = APIRouter(prefix="/interviews", tags=["interviews"])


def _score_payload(row: InterviewCandidate) -> dict:
    return {
        "communication": row.communication or 0,
        "technical": row.technical or 0,
        "leadership": row.leadership or 0,
        "problem_solving": row.problem_solving or 0,
        "culture_fit": row.culture_fit or 0,
        "average_score": row.average_score or 0,
        "result": row.result or "Hold",
        "notes": row.notes or "",
    }


@router.get("")
def list_interviews(db: Session = Depends(get_db)):
    return db.query(Interview).order_by(Interview.scheduled_at).all()


@router.post("")
def create_interview(payload: InterviewCreate, db: Session = Depends(get_db)):
    interview = Interview(**payload.model_dump())
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return interview


@router.get("/{interview_id}")
def detail(interview_id: UUID, db: Session = Depends(get_db)):
    interview = db.get(Interview, interview_id)
    if not interview:
        raise HTTPException(404, "Interview not found")
    rows = db.query(InterviewCandidate, Candidate).join(Candidate, Candidate.id == InterviewCandidate.candidate_id).filter(InterviewCandidate.interview_id == interview.id).all()
    return {
        "interview": interview,
        "candidates": [{"score": _score_payload(score), "candidate": candidate} for score, candidate in rows],
    }


@router.post("/{interview_id}/candidates/{candidate_id}")
def add_candidate(interview_id: UUID, candidate_id: UUID, db: Session = Depends(get_db)):
    if not db.get(Interview, interview_id) or not db.get(Candidate, candidate_id):
        raise HTTPException(404, "Interview or candidate not found")
    row = InterviewCandidate(interview_id=interview_id, candidate_id=candidate_id)
    db.merge(row)
    db.commit()
    return {"ok": True}


@router.delete("/{interview_id}/candidates/{candidate_id}")
def remove_candidate(interview_id: UUID, candidate_id: UUID, db: Session = Depends(get_db)):
    db.query(InterviewCandidate).filter_by(interview_id=interview_id, candidate_id=candidate_id).delete()
    db.commit()
    return {"ok": True}


@router.put("/{interview_id}/candidates/{candidate_id}/score")
def score_candidate(interview_id: UUID, candidate_id: UUID, payload: InterviewScore, db: Session = Depends(get_db)):
    row = db.get(InterviewCandidate, {"interview_id": interview_id, "candidate_id": candidate_id})
    if not row:
        raise HTTPException(404, "Candidate is not in this interview")
    values = payload.model_dump()
    scores = [values[k] for k in ["communication", "technical", "leadership", "problem_solving", "culture_fit"]]
    for key, value in values.items():
        setattr(row, key, value)
    row.average_score = round(sum(scores) / len(scores), 2)
    db.commit()
    db.refresh(row)
    return _score_payload(row)
