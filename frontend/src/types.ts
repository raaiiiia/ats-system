export type ImportFile = {
  id: string;
  filename: string;
  file_format: string;
  size_bytes: number;
  uploaded_at: string;
  created_at?: string;
  status: string;
  detected_type: string;
  field_mapping: Record<string, string>;
  row_count: number;
  clean_summary: Record<string, number | string[]>;
};

export type UploadedFile = {
  id: string;
  parentId?: string;
  fileName: string;
  path: string;
  processed: boolean;
  createdAt: string;
};

export type CandidateProfile = {
  name?: string;
  role?: string;
  contact?: CandidateContact;
  education?: string[];
  experience?: string[];
  experienceDuration?: string;
  skills?: string[];
  projects?: string[];
  summary?: string;
};

export type Candidate = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  education: string;
  skills: string[];
  experience: string;
  resume: string;
  fit_score: number;
  level: string;
  pipeline_status: string;
  tags: string[];
  parsed_data: Record<string, unknown>;
  profile?: CandidateProfile;
  originalResume?: string;
  history: { stage: string; date: string; result: string }[];
};

export type CandidateContact = {
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  website?: string;
};

export type CandidateParsedData = {
  name?: string;
  role?: string;
  profile?: CandidateProfile;
  originalResume?: string;
  contact?: CandidateContact;
  education?: string | string[];
  experienceYears?: number;
  experience_years?: number;
  experienceDuration?: string;
  skills?: string[];
  summary?: string;
  projects?: string[];
  certificates?: string[];
  notes?: Array<{ date: string; text: string }>;
  score_breakdown?: Record<string, unknown>;
};

export type CandidateDetail = {
  candidate: Candidate;
  resumeFile: string;
  resumeFileUrl: string;
  isPdf: boolean;
  timeline: { stage: string; date: string; result: string }[];
  interviews: Array<{
    id: string;
    title: string;
    scheduled_at: string;
    location: string;
    interviewer: string;
    communication: number | null;
    technical: number | null;
    leadership: number | null;
    problem_solving: number | null;
    culture_fit: number | null;
    average_score: number | null;
    result: string;
    notes: string;
  }>;
};

export type ImportDebugItem = {
  file: ImportFile;
  rawResume: string;
  parsedData: CandidateParsedData & Record<string, unknown>;
};

export type CandidatePage = {
  items: Candidate[];
  total: number;
  page: number;
  page_size: number;
};

export type ResumeScoreWeights = {
  text_match: number;
  skills: number;
  experience: number;
  education: number;
};

export type ResumeScoreConfig = {
  weights: ResumeScoreWeights;
  logic: Array<{ key: keyof ResumeScoreWeights; label: string; weight: number; description: string }>;
  updated?: number;
};

export type PipelineColumn = {
  id: string;
  name: string;
  position: number;
  candidates: Candidate[];
};

export type DashboardStats = {
  candidates: number;
  pendingInterviews: number;
  offers: number;
  upcomingSessions: number;
};

export type Interview = {
  id: string;
  title: string;
  scheduled_at: string;
  location: string;
  interviewer: string;
};
