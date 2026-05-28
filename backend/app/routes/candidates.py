import csv
import io
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.encoders import jsonable_encoder
from openpyxl import Workbook
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.cache import cache
from app.db import get_db
from app.models import AppSetting, Candidate, ImportFile, Interview, InterviewCandidate
from app.schemas import (
    CandidateNoteUpdate,
    CandidateOut,
    CandidateStatusUpdate,
    CandidateTagsUpdate,
    PageOut,
    ResumeScoreConfigUpdate,
)
from app.services.scoring import DEFAULT_SCORE_WEIGHTS, WEIGHT_LABELS, level_from_score, normalize_weights, score_resume

router = APIRouter(prefix="/candidates", tags=["candidates"])


SCORE_LOGIC = {
    "text_match": "使用岗位描述与简历正文的 TF-IDF 关键词相似度评估岗位贴合度。高分代表简历中的职责、行业词和成果表达与岗位要求一致；低分代表简历文本与岗位描述缺少共同专业信号。岗位描述为空时该项不加分。",
    "skills": "先用标准技能词典识别简历技能，再优先计算岗位要求技能的命中率。80分及以上为高匹配，50-79分为中匹配，低于50分为低匹配。没有岗位技能要求时按识别出的技能覆盖度给保守分，并在明细中标注为兜底逻辑。",
    "experience": "从简历中解析 5 years、3+ years、worked for two years、中文年限等表达，按 8 年封顶线性计分。高分代表年限足以支撑岗位熟练度，低分代表年限证据不足或未解析到有效经验。",
    "education": "按学历层级给分：博士、硕士、本科、大专/College、其他教育经历。该项只衡量教育背景，不替代技能和经历判断。",
}


def _current_score_weights(db: Session) -> dict[str, float]:
    setting = db.get(AppSetting, "resume_score_weights")
    value = setting.value if setting else {}
    return normalize_weights(value.get("weights", DEFAULT_SCORE_WEIGHTS))


def _score_config_response(weights: dict[str, float], updated: int | None = None) -> dict:
    response = {
        "weights": weights,
        "logic": [
            {"key": key, "label": WEIGHT_LABELS[key], "weight": weights[key], "description": SCORE_LOGIC[key]}
            for key in DEFAULT_SCORE_WEIGHTS
        ],
    }
    if updated is not None:
        response["updated"] = updated
    return response


def _candidate_payload(candidate: Candidate) -> dict:
    if hasattr(CandidateOut, "model_validate"):
        payload = jsonable_encoder(CandidateOut.model_validate(candidate))
    else:
        payload = jsonable_encoder(CandidateOut.from_orm(candidate))
    parsed = candidate.parsed_data or {}
    contact = parsed.get("contact") or {}
    profile = parsed.get("profile") or {
        "name": parsed.get("name") or candidate.name,
        "role": parsed.get("role") or candidate.role,
        "contact": {
            "email": contact.get("email") or candidate.email,
            "phone": contact.get("phone") or candidate.phone,
            "linkedin": contact.get("linkedin") or "",
            "github": contact.get("github") or "",
            "website": contact.get("website") or "",
        },
        "education": parsed.get("education") if isinstance(parsed.get("education"), list) else [candidate.education],
        "experience": parsed.get("experience") if isinstance(parsed.get("experience"), list) else [candidate.experience],
        "skills": parsed.get("skills") or candidate.skills,
        "projects": parsed.get("projects") or [],
        "summary": parsed.get("summary") or "",
    }
    if not profile.get("role"):
        profile = {**profile, "role": parsed.get("role") or candidate.role}
    payload["profile"] = profile
    payload["originalResume"] = parsed.get("originalResume") or candidate.resume or ""
    return payload


def _rescore_candidates(db: Session, weights: dict[str, float]) -> int:
    updated = 0
    for candidate in db.query(Candidate).all():
        parsed = candidate.parsed_data or {}
        years = int(parsed.get("experienceYears") or parsed.get("experience_years") or 0)
        score, breakdown = score_resume(candidate.resume, candidate.job_description, candidate.skills, candidate.education, years, weights)
        candidate.fit_score = score
        candidate.level = level_from_score(score, years)
        candidate.parsed_data = {**parsed, "score_breakdown": breakdown}
        updated += 1
    return updated


def _candidate_detail(candidate: Candidate, db: Session) -> dict:
    import_file = db.get(ImportFile, candidate.import_file_id) if candidate.import_file_id else None
    interview_rows = (
        db.query(InterviewCandidate, Interview)
        .join(Interview, Interview.id == InterviewCandidate.interview_id)
        .filter(InterviewCandidate.candidate_id == candidate.id)
        .order_by(Interview.scheduled_at.desc())
        .all()
    )
    interviews = []
    for score, interview in interview_rows:
        interviews.append(
            {
                "id": str(interview.id),
                "title": interview.title,
                "scheduled_at": interview.scheduled_at.isoformat() if interview.scheduled_at else "",
                "location": interview.location,
                "interviewer": interview.interviewer,
                "communication": score.communication,
                "technical": score.technical,
                "leadership": score.leadership,
                "problem_solving": score.problem_solving,
                "culture_fit": score.culture_fit,
                "average_score": score.average_score,
                "result": score.result,
                "notes": score.notes,
            }
        )
    return {
        "candidate": _candidate_payload(candidate),
        "resumeFile": import_file.filename if import_file else "",
        "resumeFileUrl": f"/api/imports/{import_file.id}/content" if import_file else "",
        "isPdf": bool(import_file and import_file.file_format == "pdf"),
        "timeline": candidate.history or [],
        "interviews": interviews,
    }


@router.get("", response_model=PageOut)
def list_candidates(
    q: str = "",
    search: str = "",
    role: str = "",
    level: str = "",
    stage: str = "",
    pipeline_status: str = Query(default=""),
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(Candidate)
    term = q or search
    current_stage = stage or pipeline_status
    if term:
        like = f"%{term}%"
        query = query.filter(or_(Candidate.name.ilike(like), Candidate.email.ilike(like), Candidate.role.ilike(like), Candidate.resume.ilike(like)))
    if role:
        query = query.filter(Candidate.role == role)
    if level:
        query = query.filter(Candidate.level == level)
    if current_stage:
        query = query.filter(Candidate.pipeline_status == current_stage)
    total = query.count()
    items = query.order_by(Candidate.fit_score.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_candidate_payload(candidate) for candidate in items], "total": total, "page": page, "page_size": page_size}


@router.get("/export.csv")
def export_csv(db: Session = Depends(get_db)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "Role", "Email", "Phone", "Education", "Skills", "ResumeScore", "Tags", "Status"])
    for c in db.query(Candidate).order_by(Candidate.fit_score.desc()).all():
        writer.writerow([c.name, c.role, c.email, c.phone, c.education, ", ".join(c.skills), c.fit_score, ", ".join(c.tags), c.pipeline_status])
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=candidates.csv"})


@router.get("/export.xlsx")
def export_xlsx(db: Session = Depends(get_db)):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Candidates"
    sheet.append(["Name", "Role", "Email", "Phone", "Education", "Skills", "ResumeScore", "Tags", "Status"])
    for c in db.query(Candidate).order_by(Candidate.fit_score.desc()).all():
        sheet.append([c.name, c.role, c.email, c.phone, c.education, ", ".join(c.skills), c.fit_score, ", ".join(c.tags), c.pipeline_status])
    output = io.BytesIO()
    workbook.save(output)
    output.seek(0)
    return Response(
        output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=candidates.xlsx"},
    )


@router.get("/score-config")
def get_score_config(db: Session = Depends(get_db)):
    return _score_config_response(_current_score_weights(db))


@router.put("/score-config")
def update_score_config(payload: ResumeScoreConfigUpdate, db: Session = Depends(get_db)):
    weights = normalize_weights(payload.weights)
    setting = db.get(AppSetting, "resume_score_weights")
    if setting:
        setting.value = {"weights": weights}
    else:
        db.add(AppSetting(key="resume_score_weights", value={"weights": weights}))
    updated = _rescore_candidates(db, weights)
    cache.delete("dashboard:charts")
    db.commit()
    return _score_config_response(weights, updated)


@router.get("/{candidate_id}/detail")
def candidate_detail(candidate_id: UUID, db: Session = Depends(get_db)):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    return _candidate_detail(candidate, db)


@router.put("/{candidate_id}/note")
def add_candidate_note(candidate_id: UUID, payload: CandidateNoteUpdate, db: Session = Depends(get_db)):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    parsed = candidate.parsed_data or {}
    notes = list(parsed.get("notes") or [])
    notes.append({"date": datetime.now(timezone.utc).isoformat(), "text": payload.note.strip()})
    candidate.parsed_data = {**parsed, "notes": notes}
    db.commit()
    db.refresh(candidate)
    return _candidate_detail(candidate, db)


@router.put("/{candidate_id}/tags", response_model=CandidateOut)
def update_tags(candidate_id: UUID, payload: CandidateTagsUpdate, db: Session = Depends(get_db)):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    candidate.tags = [tag.strip() for tag in payload.tags if tag.strip()]
    db.commit()
    db.refresh(candidate)
    return candidate


@router.put("/{candidate_id}/status", response_model=CandidateOut)
def update_status(candidate_id: UUID, payload: CandidateStatusUpdate, db: Session = Depends(get_db)):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    candidate.pipeline_status = payload.pipeline_status
    history = candidate.history or []
    history.append({"stage": payload.pipeline_status, "date": datetime.now(timezone.utc).isoformat(), "result": "Manual update"})
    candidate.history = history
    cache.delete("dashboard:charts")
    db.commit()
    db.refresh(candidate)
    return candidate
