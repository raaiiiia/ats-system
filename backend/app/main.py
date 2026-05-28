from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import Base, engine
from app.models import PipelineStage
from app.routes import candidates, dashboard, imports, interviews, pipeline

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(imports.router, prefix="/api")
app.include_router(imports.files_router, prefix="/api")
app.include_router(candidates.router, prefix="/api")
app.include_router(pipeline.router, prefix="/api")
app.include_router(interviews.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    from app.db import SessionLocal

    with SessionLocal() as db:
        if db.query(PipelineStage).count() == 0:
            for position, name in enumerate(["Resume", "Interview1", "Interview2", "Offer", "Rejected"], start=1):
                db.add(PipelineStage(name=name, position=position))
            db.commit()


@app.get("/api/health")
def health():
    return {"ok": True, "name": settings.app_name}
