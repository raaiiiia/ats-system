from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.cache import cache
from app.db import get_db
from app.models import Candidate, ImportFile, InterviewCandidate
from app.schemas import ImportFileOut, MappingUpdate
from app.services.etl import clean_and_create_candidates
from app.services.importer import detect_type, infer_mapping, records_preview, store_upload

router = APIRouter(prefix="/imports", tags=["imports"])
files_router = APIRouter(prefix="/files", tags=["files"])


def _delete_import_file_record(file_id: UUID, db: Session) -> dict:
    item = db.get(ImportFile, file_id)
    if not item:
        raise HTTPException(404, "File not found")

    related_items = [item]
    related_item_ids = {item.id}

    def add_related(candidate_item: ImportFile) -> None:
        if candidate_item.id not in related_item_ids:
            related_items.append(candidate_item)
            related_item_ids.add(candidate_item.id)

    def is_same_logical_upload(candidate_item: ImportFile) -> bool:
        if candidate_item.id == item.id:
            return False
        if candidate_item.filename != item.filename:
            return False
        if candidate_item.file_format != item.file_format:
            return False
        if candidate_item.size_bytes != item.size_bytes:
            return False
        if {candidate_item.status, item.status} != {"uploaded", "processed"}:
            return False
        if not candidate_item.uploaded_at or not item.uploaded_at:
            return False
        return abs((candidate_item.uploaded_at - item.uploaded_at).total_seconds()) <= 300

    for candidate_item in db.query(ImportFile).all():
        if candidate_item.id == item.id:
            continue
        clean_summary = candidate_item.clean_summary or {}
        field_mapping = candidate_item.field_mapping or {}
        parent_id = clean_summary.get("parentId") or field_mapping.get("parentId") or clean_summary.get("parent_id")
        if parent_id and str(parent_id) == str(item.id):
            add_related(candidate_item)
            continue
        if is_same_logical_upload(candidate_item):
            add_related(candidate_item)

    related_ids = [related.id for related in related_items]
    stored_paths = [Path(related.stored_path) for related in related_items if related.stored_path]
    candidate_ids = [
        candidate_id
        for (candidate_id,) in db.query(Candidate.id).filter(Candidate.import_file_id.in_(related_ids)).all()
    ]
    deleted_interview_links = 0
    deleted_candidates = 0
    if candidate_ids:
        deleted_interview_links = (
            db.query(InterviewCandidate)
            .filter(InterviewCandidate.candidate_id.in_(candidate_ids))
            .delete(synchronize_session=False)
        )
        deleted_candidates = (
            db.query(Candidate)
            .filter(Candidate.id.in_(candidate_ids))
            .delete(synchronize_session=False)
        )

    for related in related_items:
        db.delete(related)
    cache.delete("dashboard:charts")
    db.commit()

    deleted_disk_files = 0
    for stored_path in stored_paths:
        try:
            if stored_path.exists():
                stored_path.unlink()
                deleted_disk_files += 1
        except OSError:
            pass

    return {
        "ok": True,
        "deletedFile": True,
        "deletedFiles": len(related_items),
        "deletedCandidates": deleted_candidates,
        "deletedInterviewLinks": deleted_interview_links,
        "deletedDiskFiles": deleted_disk_files,
        "cacheCleared": True,
    }


@router.post("/upload", response_model=list[ImportFileOut])
async def upload_files(files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    created: list[ImportFile] = []
    for file in files:
        path, size, file_format = await store_upload(file)
        if file_format not in {"csv", "xlsx", "xls", "json", "txt", "docx", "pdf", "zip"}:
            raise HTTPException(400, f"Unsupported format: {file_format}")
        try:
            _, columns = records_preview(path, file_format, limit=5)
        except Exception as exc:
            raise HTTPException(400, f"Failed to read {file.filename}: {exc}") from exc
        mapping = infer_mapping(columns)
        item = ImportFile(
            filename=file.filename or path.name,
            stored_path=str(path),
            file_format=file_format,
            size_bytes=size,
            status="uploaded",
            detected_type=detect_type(columns, mapping),
            field_mapping=mapping,
            row_count=0,
        )
        db.add(item)
        created.append(item)
    db.commit()
    for item in created:
        db.refresh(item)
    return created


@router.get("/files", response_model=list[ImportFileOut])
def files(db: Session = Depends(get_db)):
    return db.query(ImportFile).order_by(ImportFile.uploaded_at.desc()).all()


@router.get("/debug")
def import_debug(db: Session = Depends(get_db)):
    rows = []
    files = db.query(ImportFile).order_by(ImportFile.uploaded_at.desc()).limit(20).all()
    for item in files:
        candidate = (
            db.query(Candidate)
            .filter(Candidate.import_file_id == item.id)
            .order_by(Candidate.created_at.desc())
            .first()
        )
        rows.append(
            {
                "file": item,
                "rawResume": candidate.resume if candidate else "",
                "parsedData": candidate.parsed_data if candidate else {},
            }
        )
    return rows


@router.get("/{file_id}/content")
def file_content(file_id: UUID, db: Session = Depends(get_db)):
    item = db.get(ImportFile, file_id)
    if not item:
        raise HTTPException(404, "File not found")
    path = Path(item.stored_path)
    if not path.exists():
        raise HTTPException(404, "Stored file not found")
    return FileResponse(path, filename=item.filename)


@router.get("/{file_id}/preview")
def preview(file_id: UUID, db: Session = Depends(get_db)):
    item = db.get(ImportFile, file_id)
    if not item:
        raise HTTPException(404, "File not found")
    rows, columns = records_preview(Path(item.stored_path), item.file_format)
    return {"columns": columns, "rows": rows, "mapping": item.field_mapping, "detectedType": item.detected_type}


@router.put("/{file_id}/mapping", response_model=ImportFileOut)
def update_mapping(file_id: UUID, payload: MappingUpdate, db: Session = Depends(get_db)):
    item = db.get(ImportFile, file_id)
    if not item:
        raise HTTPException(404, "File not found")
    item.field_mapping = payload.field_mapping
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{file_id}")
def delete_file(file_id: UUID, db: Session = Depends(get_db)):
    return _delete_import_file_record(file_id, db)


@files_router.delete("/{file_id}")
def delete_file_api(file_id: UUID, db: Session = Depends(get_db)):
    return _delete_import_file_record(file_id, db)


@router.post("/{file_id}/clean", response_model=ImportFileOut)
def clean(file_id: UUID, db: Session = Depends(get_db)):
    item = db.get(ImportFile, file_id)
    if not item:
        raise HTTPException(404, "File not found")
    candidate_ids = [
        candidate_id
        for (candidate_id,) in db.query(Candidate.id).filter(Candidate.import_file_id == item.id).all()
    ]
    if candidate_ids:
        db.query(InterviewCandidate).filter(InterviewCandidate.candidate_id.in_(candidate_ids)).delete(synchronize_session=False)
        db.query(Candidate).filter(Candidate.id.in_(candidate_ids)).delete(synchronize_session=False)
    candidates, summary = clean_and_create_candidates(item, db)
    db.add_all(candidates)
    item.clean_summary = summary
    item.row_count = summary["finalRows"]
    item.status = "processed"
    cache.delete("dashboard:charts")
    db.commit()
    db.refresh(item)
    return item
