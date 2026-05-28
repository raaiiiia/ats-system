from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.cache import cache
from app.db import get_db
from app.models import Candidate, PipelineStage
from app.schemas import MoveCandidate, PipelineStageCreate

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


@router.get("")
def get_pipeline(db: Session = Depends(get_db)):
    stages = db.query(PipelineStage).order_by(PipelineStage.position).all()
    data = []
    for stage in stages:
        candidates = db.query(Candidate).filter(Candidate.pipeline_status == stage.name).order_by(Candidate.fit_score.desc()).limit(100).all()
        data.append({"id": str(stage.id), "name": stage.name, "position": stage.position, "candidates": candidates})
    return data


@router.post("/stages")
def add_stage(payload: PipelineStageCreate, db: Session = Depends(get_db)):
    position = (db.query(PipelineStage).count() or 0) + 1
    stage = PipelineStage(name=payload.name, position=position)
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.post("/move")
def move_candidate(payload: MoveCandidate, db: Session = Depends(get_db)):
    candidate = db.get(Candidate, payload.candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    candidate.pipeline_status = payload.stage
    history = candidate.history or []
    history.append({"stage": payload.stage, "date": datetime.now(timezone.utc).isoformat(), "result": payload.result})
    candidate.history = history
    cache.delete("dashboard:charts")
    db.commit()
    return {"ok": True}
