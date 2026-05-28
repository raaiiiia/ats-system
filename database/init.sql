CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS import_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    file_format TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'uploaded',
    detected_type TEXT NOT NULL DEFAULT 'unknown_data',
    field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    row_count INTEGER NOT NULL DEFAULT 0,
    clean_summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_file_id UUID REFERENCES import_files(id) ON DELETE SET NULL,
    name TEXT NOT NULL DEFAULT 'Unknown',
    role TEXT NOT NULL DEFAULT 'Unknown',
    email TEXT NOT NULL DEFAULT 'Unknown',
    phone TEXT NOT NULL DEFAULT 'Unknown',
    education TEXT NOT NULL DEFAULT 'Unknown',
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    experience TEXT NOT NULL DEFAULT 'Unknown',
    resume TEXT NOT NULL DEFAULT '',
    job_description TEXT NOT NULL DEFAULT '',
    fit_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    level TEXT NOT NULL DEFAULT 'Unknown',
    pipeline_status TEXT NOT NULL DEFAULT 'Resume',
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    parsed_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_role ON candidates(role);
CREATE INDEX IF NOT EXISTS idx_candidates_pipeline ON candidates(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_fit ON candidates(fit_score DESC);

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    location TEXT NOT NULL DEFAULT 'TBD',
    interviewer TEXT NOT NULL DEFAULT 'Unassigned',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interview_candidates (
    interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    communication DOUBLE PRECISION,
    technical DOUBLE PRECISION,
    leadership DOUBLE PRECISION,
    problem_solving DOUBLE PRECISION,
    culture_fit DOUBLE PRECISION,
    average_score DOUBLE PRECISION,
    result TEXT NOT NULL DEFAULT 'Hold',
    notes TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (interview_id, candidate_id)
);

INSERT INTO pipeline_stages (name, position)
VALUES ('Resume', 1), ('Interview1', 2), ('Interview2', 3), ('Offer', 4), ('Rejected', 5)
ON CONFLICT (name) DO NOTHING;

