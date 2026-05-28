import json
import zipfile
from pathlib import Path
from uuid import uuid4

import pandas as pd
from docx import Document
from PyPDF2 import PdfReader
from fastapi import UploadFile

from app.config import settings

CANONICAL_FIELDS = {
    "role": ["role", "position", "job", "job_title", "title"],
    "resume": ["resume", "cv", "profile", "bio", "text"],
    "job_description": ["job_description", "job description", "jd", "description"],
    "decision": ["decision", "status", "outcome"],
    "reason": ["reason", "reason_for_decision", "decision_reason", "notes"],
    "name": ["name", "full_name", "candidate", "candidate_name"],
    "email": ["email", "mail", "emailaddress", "e-mail", "email_address"],
    "phone": ["phone", "mobile", "phone_number", "telephone"],
    "skills": ["skills", "skill", "tech_stack"],
    "education": ["education", "degree", "school"],
    "experience": ["experience", "work_experience", "years_experience"],
}


def _normalize_field(name: str) -> str:
    return "".join(ch.lower() for ch in name.strip() if ch.isalnum() or ch in {"_", " "}).replace(" ", "_")


def infer_mapping(columns: list[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    normalized = {_normalize_field(column): column for column in columns}
    for target, aliases in CANONICAL_FIELDS.items():
        for alias in aliases:
            key = _normalize_field(alias)
            if key in normalized:
                mapping[target] = normalized[key]
                break
    return mapping


def detect_type(columns: list[str], mapping: dict[str, str]) -> str:
    keys = set(mapping)
    if {"resume", "job_description"} & keys and "role" in keys:
        return "resume_data"
    if {"name", "email", "skills"} & keys:
        return "candidate_data"
    if {"role", "job_description"} <= keys:
        return "job_data"
    if {"decision", "reason"} & keys:
        return "recruitment_data"
    return "unknown_data"


async def store_upload(file: UploadFile) -> tuple[Path, int, str]:
    suffix = Path(file.filename or "upload").suffix.lower().lstrip(".")
    filename = f"{uuid4()}_{Path(file.filename or 'upload').name}"
    destination = settings.storage_path / filename
    size = 0
    with destination.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            out.write(chunk)
    return destination, size, suffix


def read_tabular(path: Path, file_format: str) -> pd.DataFrame:
    if file_format == "csv":
        return pd.read_csv(path)
    if file_format in {"xlsx", "xls"}:
        return pd.read_excel(path)
    if file_format == "json":
        return pd.read_json(path)
    if file_format == "txt":
        return pd.DataFrame([{"Resume": path.read_text(encoding="utf-8", errors="ignore")}])
    if file_format == "docx":
        doc = Document(path)
        text = "\n".join(p.text for p in doc.paragraphs)
        return pd.DataFrame([{"Resume": text}])
    if file_format == "pdf":
        reader = PdfReader(str(path))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return pd.DataFrame([{"Resume": text}])
    if file_format == "zip":
        rows = []
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                if name.endswith("/"):
                    continue
                suffix = Path(name).suffix.lower().lstrip(".")
                if suffix in {"txt", "csv", "json"}:
                    rows.append({"Name": Path(name).stem, "Resume": archive.read(name).decode("utf-8", errors="ignore")})
        return pd.DataFrame(rows)
    raise ValueError(f"Unsupported file format: {file_format}")


def records_preview(path: Path, file_format: str, limit: int = 20) -> tuple[list[dict], list[str]]:
    df = read_tabular(path, file_format)
    df = df.head(limit).fillna("Unknown")
    records = json.loads(df.to_json(orient="records", force_ascii=False))
    return records, list(df.columns)

