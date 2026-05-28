from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from app.models import AppSetting, Candidate, ImportFile
from app.services.importer import read_tabular
from app.services.parser import is_resume_document, parse_resume_once
from app.services.scoring import DEFAULT_SCORE_WEIGHTS, level_from_score, normalize_weights, score_resume


PROFILE_FIELDS = {"name", "email", "phone", "skills", "education", "experience"}


def _value(row: pd.Series, mapping: dict, key: str, default: str = "Unknown") -> str:
    column = mapping.get(key)
    if not column or column not in row or pd.isna(row[column]):
        return default
    value = str(row[column]).strip()
    return value if value and value.lower() not in {"unknown", "nan", "none", "null"} else default


def _direct_value(row: pd.Series, *names: str, default: str = "") -> str:
    lookup = {str(column).strip().lower(): column for column in row.index}
    for name in names:
        column = lookup.get(name.lower())
        if column is not None and not pd.isna(row[column]):
            value = str(row[column]).strip()
            if value and value.lower() not in {"unknown", "nan", "none", "null"}:
                return value
    return default


def _mapped_value(row: pd.Series, mapping: dict, key: str, default: str = "Unknown", resume_column: str | None = None) -> str:
    column = mapping.get(key)
    if not column or column not in row or pd.isna(row[column]):
        return default
    value = str(row[column]).strip()
    if not value or value.lower() in {"unknown", "nan", "none", "null"}:
        return default
    if key in PROFILE_FIELDS and (column == resume_column or is_resume_document(value)):
        return default
    return value


def _resume_source(row: pd.Series, mapping: dict) -> tuple[str, str | None]:
    lookup = {str(column).strip().lower(): column for column in row.index}
    for name in ("resume", "cv", "profile", "bio"):
        column = lookup.get(name)
        if column is not None and not pd.isna(row[column]):
            value = str(row[column]).strip()
            if value:
                return value, column
    mapped = mapping.get("resume")
    if mapped and mapped in row and not pd.isna(row[mapped]):
        value = str(row[mapped]).strip()
        if value:
            return value, mapped
    for column in row.index:
        value = "" if pd.isna(row[column]) else str(row[column]).strip()
        if is_resume_document(value):
            return value, column
    return _row_text(row), None


def _row_text(row: pd.Series) -> str:
    values = []
    for value in row.values:
        text = str(value).strip()
        if text and text.lower() not in {"unknown", "nan", "none", "null"}:
            values.append(text)
    return "\n".join(values)


def _score_weights(db: Session | None) -> dict[str, float]:
    if not db:
        return DEFAULT_SCORE_WEIGHTS
    setting = db.get(AppSetting, "resume_score_weights")
    value = setting.value if setting else {}
    return normalize_weights(value.get("weights", DEFAULT_SCORE_WEIGHTS))


def clean_and_create_candidates(import_file: ImportFile, db: Session | None = None) -> tuple[list[Candidate], dict]:
    path = Path(import_file.stored_path)
    df = read_tabular(path, import_file.file_format)
    original = len(df)
    df = df.fillna("Unknown")
    df = df.drop_duplicates()
    duplicate_removed = original - len(df)
    df = df[~df.apply(lambda row: all(str(v).strip() in {"", "Unknown", "nan"} for v in row), axis=1)]
    empty_removed = original - duplicate_removed - len(df)

    candidates: list[Candidate] = []
    mapping = import_file.field_mapping or {}
    now = datetime.now(timezone.utc).isoformat()
    weights = _score_weights(db)

    for _, row in df.iterrows():
        resume_source, resume_column = _resume_source(row, mapping)
        job_description = _mapped_value(row, mapping, "job_description", _direct_value(row, "Job_Description", "job_description"))
        parsed = parse_resume_once(resume_source)
        profile = parsed.get("profile", {})
        contact = profile.get("contact", {})
        parsed_role = profile.get("role") or parsed.get("role") or "Unknown"
        resume_document = parsed.get("fieldType") == "resume_document" or is_resume_document(resume_source)
        if resume_document:
            name = profile.get("name") or "Unknown"
            email = contact.get("email") or "N/A"
            phone = contact.get("phone") or "N/A"
            skills = list(profile.get("skills") or [])
            education_items = list(profile.get("education") or [])
            education = " / ".join(education_items) if education_items else "Unknown"
            experience_items = [
                item for item in list(profile.get("experience") or [])
                if str(item).strip() and str(item).strip().lower() not in {"unknown", "n/a", "nan", "none", "null", "0 years"}
            ]
            experience_duration = profile.get("experienceDuration") or parsed.get("experienceDuration") or ""
            experience = ", ".join(experience_items) if experience_items else (experience_duration if experience_duration and experience_duration != "无" else "无")
        else:
            name = _mapped_value(row, mapping, "name", parsed["name"], resume_column)
            email = _mapped_value(row, mapping, "email", parsed["email"], resume_column)
            phone = _mapped_value(row, mapping, "phone", parsed["phone"], resume_column)
            skills_value = _mapped_value(row, mapping, "skills", "", resume_column)
            skills = [s.strip() for s in skills_value.replace(";", ",").split(",") if s.strip()] or parsed["skills"]
            education = _mapped_value(row, mapping, "education", parsed["education"], resume_column)
            fallback_experience = parsed.get("experienceDuration") or "无"
            experience = _mapped_value(row, mapping, "experience", fallback_experience, resume_column)
        years = parsed.get("experienceYears", 0)
        score, breakdown = score_resume(resume_source, job_description, skills, education, years, weights)
        candidate = Candidate(
            import_file_id=import_file.id,
            name=name if name != "Unknown" else parsed["name"],
            role=_value(row, mapping, "role", parsed_role),
            email=email,
            phone=phone,
            education=education,
            skills=skills,
            experience=experience,
            resume=resume_source,
            job_description=job_description,
            fit_score=score,
            level=level_from_score(score, years),
            pipeline_status="Resume",
            parsed_data={**parsed, "profile": profile, "originalResume": resume_source, "score_breakdown": breakdown},
            history=[{"stage": "Resume", "date": now, "result": "Imported"}],
        )
        candidates.append(candidate)

    summary = {
        "originalRows": original,
        "duplicateRemoved": duplicate_removed,
        "emptyRemoved": max(empty_removed, 0),
        "finalRows": len(candidates),
        "textStandardization": ["lowercase", "strip_html", "strip_url", "strip_special_chars", "collapse_spaces"],
    }
    return candidates, summary
