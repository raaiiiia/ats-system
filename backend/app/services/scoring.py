from __future__ import annotations

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.services.parser import SKILL_ALIASES
from app.services.text import clean_text

DEFAULT_SCORE_WEIGHTS = {
    "text_match": 45,
    "skills": 25,
    "experience": 20,
    "education": 10,
}

WEIGHT_LABELS = {
    "text_match": "岗位文本匹配",
    "skills": "技能匹配",
    "experience": "经验年限",
    "education": "学历背景",
}


def normalize_weights(weights: dict | None) -> dict[str, float]:
    source = {**DEFAULT_SCORE_WEIGHTS, **(weights or {})}
    normalized = {}
    for key in DEFAULT_SCORE_WEIGHTS:
        try:
            normalized[key] = max(0.0, float(source.get(key, 0)))
        except (TypeError, ValueError):
            normalized[key] = float(DEFAULT_SCORE_WEIGHTS[key])
    total = sum(normalized.values())
    if total <= 0:
        return {key: float(value) for key, value in DEFAULT_SCORE_WEIGHTS.items()}
    return {key: round(value * 100 / total, 2) for key, value in normalized.items()}


def _text_match_score(resume: str, job_description: str) -> float:
    if not resume or not job_description:
        return 0.0
    matrix = TfidfVectorizer(max_features=4000, stop_words="english").fit_transform([resume, job_description])
    return round(float(cosine_similarity(matrix[0], matrix[1])[0][0]) * 100, 2)


def _skill_score(skills: list[str], job_description: str) -> tuple[float, dict]:
    candidate_skills = {skill.lower() for skill in skills if skill}
    jd_text = clean_text(job_description or "", remove_contacts=False)
    required_skills = {skill for skill in SKILL_ALIASES if skill in jd_text}
    matched = sorted(candidate_skills & required_skills)
    missing = sorted(required_skills - candidate_skills)

    if required_skills:
        score = round(len(matched) / len(required_skills) * 100, 2)
        basis = "JD required skill hit rate"
    else:
        score = round(min(len(candidate_skills) * 12.5, 100), 2)
        basis = "Dictionary coverage fallback"

    if score >= 80:
        level = "High"
    elif score >= 50:
        level = "Medium"
    else:
        level = "Low"

    detail = {
        "basis": basis,
        "level": level,
        "candidateSkills": sorted(candidate_skills),
        "requiredSkills": sorted(required_skills),
        "matchedSkills": matched,
        "missingSkills": missing,
        "rationale": (
            "技能分优先使用岗位描述中的技能词作为评价基准，计算候选人技能命中率；"
            "80分及以上视为高匹配，50-79分为中匹配，低于50分为低匹配。"
            "若岗位描述没有可识别技能，则使用标准技能词典覆盖度作为保守兜底，避免把整段简历当作技能。"
        ),
    }
    return score, detail


def _experience_score(years: int | float | None) -> float:
    try:
        value = max(0.0, float(years or 0))
    except (TypeError, ValueError):
        value = 0.0
    return round(min(value / 8 * 100, 100), 2)


def _education_score(education: str) -> float:
    text = (education or "").lower()
    if any(token in text for token in ["博士", "phd", "doctor"]):
        return 100.0
    if any(token in text for token in ["硕士", "master", "mba", "ms"]):
        return 85.0
    if any(token in text for token in ["本科", "学士", "bachelor", "bs", "ba"]):
        return 70.0
    if education and education != "Unknown":
        return 40.0
    return 0.0


def score_resume(
    resume: str,
    job_description: str,
    skills: list[str],
    education: str,
    years: int | float | None,
    weights: dict | None,
) -> tuple[float, dict]:
    clean_resume = clean_text(resume or "", remove_contacts=False)
    clean_job = clean_text(job_description or "", remove_contacts=False)
    normalized_weights = normalize_weights(weights)
    skill_score, skill_detail = _skill_score(skills, job_description)
    components = {
        "text_match": _text_match_score(clean_resume, clean_job),
        "skills": skill_score,
        "experience": _experience_score(years),
        "education": _education_score(education),
    }
    score = sum(components[key] * normalized_weights[key] / 100 for key in normalized_weights)
    breakdown = {
        "weights": normalized_weights,
        "components": components,
        "skillEvaluation": skill_detail,
        "professionalLogic": [
            "岗位文本匹配使用 TF-IDF 与余弦相似度，衡量简历内容和岗位描述的整体语义/关键词重合度。",
            "技能匹配基于标准技能词典和岗位描述中的必需技能，按命中率判断高、中、低匹配，避免人工主观判断。",
            "经验年限采用 8 年封顶的线性得分，兼顾成长型候选人和资深候选人。",
            "学历背景按博士、硕士、本科、其他教育经历分层赋值，仅作为辅助项，权重可在候选人库右上角调整。",
        ],
        "logic": [
            {"key": key, "label": WEIGHT_LABELS[key], "weight": normalized_weights[key], "score": components[key]}
            for key in normalized_weights
        ],
    }
    return round(score, 2), breakdown


def level_from_score(score: float, years: int | float | None) -> str:
    try:
        year_value = float(years or 0)
    except (TypeError, ValueError):
        year_value = 0.0
    if score >= 80 or year_value >= 8:
        return "Senior"
    if score >= 55 or year_value >= 4:
        return "Mid"
    if score >= 30 or year_value >= 1:
        return "Junior"
    return "Entry"
