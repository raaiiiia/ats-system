from collections import Counter, defaultdict
from itertools import combinations
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.cache import cache
from app.db import get_db
from app.models import Candidate, Interview

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    return {
        "candidates": db.query(Candidate).count(),
        "pendingInterviews": db.query(Candidate).filter(Candidate.pipeline_status.ilike("Interview%")).count(),
        "offers": db.query(Candidate).filter(Candidate.pipeline_status == "Offer").count(),
        "upcomingSessions": db.query(Interview).filter(Interview.scheduled_at >= now).count(),
    }


@router.get("/charts")
def charts():
    return cache.get_json("dashboard:charts") or {"generated": False}


@router.post("/generate")
def generate(db: Session = Depends(get_db)):
    candidates = db.query(Candidate).all()
    stage_order = ["Resume", "Interview1", "Interview2", "Offer", "Rejected"]
    funnel_counts = Counter(c.pipeline_status for c in candidates)
    levels = Counter(c.level for c in candidates)
    skills = Counter(skill for c in candidates for skill in (c.skills or []))
    level_skill: dict[str, Counter] = defaultdict(Counter)
    skill_pairs: Counter[tuple[str, str]] = Counter()
    for c in candidates:
        candidate_skills = sorted({skill for skill in (c.skills or []) if skill})
        for skill in candidate_skills:
            level_skill[c.level][skill] += 1
        for left, right in combinations(candidate_skills[:12], 2):
            skill_pairs[(left, right)] += 1
    heatmap = []
    heat_levels = [level for level in ["Entry", "Junior", "Mid", "Senior", "Unknown"] if level in level_skill]
    top_skills = [skill for skill, _ in skills.most_common(12)]
    max_heat = 0
    for level_index, level in enumerate(heat_levels):
        for skill_index, skill in enumerate(top_skills):
            count = level_skill[level][skill]
            max_heat = max(max_heat, count)
            heatmap.append([skill_index, level_index, count])
    graph_nodes = [
        {"name": name, "value": value, "symbolSize": max(18, min(56, 18 + value * 4))}
        for name, value in skills.most_common(20)
    ]
    graph_names = {node["name"] for node in graph_nodes}
    graph_links = [
        {"source": left, "target": right, "value": value}
        for (left, right), value in skill_pairs.most_common(40)
        if left in graph_names and right in graph_names
    ]
    data = {
        "generated": True,
        "funnel": [{"name": stage, "value": funnel_counts.get(stage, 0)} for stage in stage_order],
        "levels": [{"name": k, "value": v} for k, v in levels.items()],
        "topSkills": skills.most_common(30),
        "heatmap": {"levels": heat_levels, "skills": top_skills, "data": heatmap, "max": max(max_heat, 1)},
        "skillNetwork": {"nodes": graph_nodes, "links": graph_links},
    }
    cache.set_json("dashboard:charts", data, ttl=60 * 60 * 24)
    return data
