import re

from app.cache import cache
from app.services.text import clean_text, extract_contacts, text_hash

SKILL_ALIASES = [
    "python", "sql", "excel", "tableau", "machine learning", "react", "marketing",
    "seo", "leadership", "data analysis", "java", "javascript", "typescript", "vue",
    "angular", "node", "fastapi", "django", "flask", "postgresql", "mysql", "redis",
    "aws", "docker", "kubernetes", "power bi", "nlp", "tensorflow", "pytorch",
    "scikit-learn", "spark", "hadoop", "communication", "crm", "e-commerce",
    "salesforce", "figma", "linux", "go", "golang", "rust", "c++", "c#", "oracle",
    "mongodb", "git",
]

NAME_PATTERNS = [
    re.compile(r"(?:\*\*)?\s*(?:Candidate Name|Candidate|Name)\s*(?:\*\*)?\s*[:：]\s*([^\n\r,;|]{2,80})", re.I),
    re.compile(r"(?:姓名|候选人|应聘者)\s*[:：]\s*([^\n\r,;|]{2,40})", re.I),
]
ROLE_MARKERS = r"申请岗位|应聘岗位|目标岗位|岗位|职位|Applied Role|Role|Position|Job Title"
ROLE_PATTERNS = [
    re.compile(rf"(?:{ROLE_MARKERS})\s*[:：]\s*([^\n\r,;|]{{1,80}})", re.I),
    re.compile(r"(?:applying for|application for)\s+([^\n\r,;|]{1,80})", re.I),
]
INLINE_ROLE_RE = re.compile(rf"\s*(?:{ROLE_MARKERS})\s*[:：].*$", re.I)
SCHOOL_RE = re.compile(r"([\u4e00-\u9fffA-Za-z .&-]{2,80}(?:大学|学院|University|College|Institute|School))", re.I)
DEGREE_RE = re.compile(r"(博士|硕士|本科|学士|大专|College|MBA|PhD|Master|Bachelor|BS|BA|MS|Degree)", re.I)
WORD_NUMBERS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}
MAX_EXPERIENCE_YEARS = 50
MAX_EXPERIENCE_MONTHS = MAX_EXPERIENCE_YEARS * 12
WORK_PREFIX = (
    r"(?:\u5df2\u5de5\u4f5c|\u5de5\u4f5c\u7ecf\u9a8c|\u5de5\u4f5c\u7ecf\u5386|"
    r"\u4ece\u4e1a\u7ecf\u9a8c|\u4ece\u4e1a\u7ecf\u5386|\u76f8\u5173\u5de5\u4f5c\u7ecf\u9a8c|"
    r"worked\s+for|work\s+experience|professional\s+experience)"
)
WORK_SUFFIX = (
    r"(?:\u5de5\u4f5c\u7ecf\u9a8c|\u5de5\u4f5c\u7ecf\u5386|\u4ece\u4e1a\u7ecf\u9a8c|"
    r"\u4ece\u4e1a\u7ecf\u5386|work\s+experience|professional\s+experience)"
)
YEAR_UNIT = r"(?:\u5e74|years?|yrs?)"
MONTH_UNIT = r"(?:\u4e2a\u6708|\u6708|months?|mos?)"
EXPERIENCE_YEAR_PATTERNS = [
    re.compile(rf"{WORK_PREFIX}[^\n\r]{{0,16}}?(?P<value>\d{{1,2}})\+?\s*(?P<unit>{YEAR_UNIT})", re.I),
    re.compile(rf"(?P<value>\d{{1,2}})\+?\s*(?P<unit>{YEAR_UNIT})\s*{WORK_SUFFIX}", re.I),
]
EXPERIENCE_MONTH_PATTERNS = [
    re.compile(rf"{WORK_PREFIX}[^\n\r]{{0,16}}?(?P<value>\d{{1,3}})\+?\s*(?P<unit>{MONTH_UNIT})", re.I),
    re.compile(rf"(?P<value>\d{{1,3}})\+?\s*(?P<unit>{MONTH_UNIT})\s*{WORK_SUFFIX}", re.I),
]
EXPERIENCE_WORD_YEAR_PATTERNS = [
    re.compile(rf"{WORK_PREFIX}[^\n\r]{{0,16}}?\b(?P<word>{'|'.join(WORD_NUMBERS)})\s+years?\b", re.I),
    re.compile(rf"\b(?P<word>{'|'.join(WORD_NUMBERS)})\s+years?\s*{WORK_SUFFIX}", re.I),
]
EXPERIENCE_TIME_MARK_RE = re.compile(
    rf"(\d{{4}}[./-]\d{{1,2}}|\d{{4}}\s*(?:-|to|至|到)\s*(?:\d{{4}}|present|now|至今)|"
    rf"\d{{1,2}}\+?\s*{YEAR_UNIT}|\d{{1,3}}\+?\s*{MONTH_UNIT})",
    re.I,
)


def is_resume_document(text: str) -> bool:
    if len(text or "") <= 200:
        return False
    markers = ["email:", "phone:", "summary:", "experience:", "education:", "skills:"]
    lower = (text or "").lower()
    return sum(marker in lower for marker in markers) >= 3


def _clean_candidate_name(value: str) -> str:
    cleaned = re.sub(r"(?i)^here'?s\s+(?:a\s+)?(?:professional\s+)?resume\s+for\s+", "", value or "")
    cleaned = INLINE_ROLE_RE.sub("", cleaned)
    cleaned = cleaned.strip(" *:-：\t")
    return cleaned or "Unknown"


def _extract_name(raw: str) -> str:
    for pattern in NAME_PATTERNS:
        match = pattern.search(raw or "")
        if match:
            return _clean_candidate_name(match.group(1))
    for line in (raw or "").splitlines():
        line = line.strip(" *:-：\t")
        if not line:
            continue
        lowered = line.lower()
        if any(token in lowered for token in ["resume", "email", "phone", "mobile", "tel", "education", "experience", "contact"]) and "resume for" not in lowered:
            continue
        if "@" in line or any(char.isdigit() for char in line):
            continue
        if re.fullmatch(r"[\u4e00-\u9fff]{2,4}", line) or len(line.split()) <= 4:
            return _clean_candidate_name(line)
    return "Unknown"


def _extract_role(raw: str) -> str:
    for pattern in ROLE_PATTERNS:
        match = pattern.search(raw or "")
        if match:
            role = match.group(1).strip(" *:-：\t")
            if role and role.lower() not in {"unknown", "nan", "none", "null"}:
                return role
    return "Unknown"


def _extract_education(raw: str) -> list[str]:
    schools = [match.group(1).strip() for match in SCHOOL_RE.finditer(raw or "")]
    degrees = [match.group(1).strip() for match in DEGREE_RE.finditer(raw or "")]
    items: list[str] = []
    for degree in degrees[:3]:
        value = degree.title() if degree.isascii() else degree
        if value and value not in items:
            items.append(value)
    for school in schools[:3]:
        if school and school not in items:
            items.append(school)
    return items


def _extract_experience_years(raw: str, normalized: str) -> int:
    year_text = f"{raw}\n{normalized}"
    years = [int(x) for x in re.findall(r"(\d+)\+?\s*(?:years?|年)", year_text, re.I)]
    years.extend(
        WORD_NUMBERS[word.lower()]
        for word in re.findall(r"\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\b", year_text, re.I)
    )
    return max(years) if years else 0


def _format_duration(value: int, unit: str) -> str:
    unit_lower = (unit or "").lower()
    if "\u6708" in unit or unit_lower.startswith(("month", "mo")):
        return f"{value}\u4e2a\u6708" if "\u6708" in unit else f"{value} months"
    return f"{value}\u5e74" if "\u5e74" in unit else f"{value} years"


def _extract_experience_duration(raw: str, normalized: str) -> tuple[int, str]:
    text = f"{raw}\n{normalized}"
    candidates: list[tuple[int, int, str]] = []
    for pattern in EXPERIENCE_YEAR_PATTERNS:
        for match in pattern.finditer(text):
            years = int(match.group("value"))
            if 0 < years <= MAX_EXPERIENCE_YEARS:
                candidates.append((years * 12, years, _format_duration(years, match.group("unit"))))
    for pattern in EXPERIENCE_MONTH_PATTERNS:
        for match in pattern.finditer(text):
            months = int(match.group("value"))
            if 0 < months <= MAX_EXPERIENCE_MONTHS:
                candidates.append((months, months // 12, _format_duration(months, match.group("unit"))))
    for pattern in EXPERIENCE_WORD_YEAR_PATTERNS:
        for match in pattern.finditer(text):
            years = WORD_NUMBERS[match.group("word").lower()]
            candidates.append((years * 12, years, f"{years} years"))
    if not candidates:
        return 0, "\u65e0"
    _, years, label = max(candidates, key=lambda item: item[0])
    return years, label


def _extract_section(raw: str, headings: list[str], stop_headings: list[str] | None = None) -> str:
    text = raw or ""
    stops = stop_headings or [
        "Contact", "Summary", "Profile", "Experience", "Work Experience", "Education",
        "Skills", "Projects", "Project Experience", "Certificates",
    ]
    heading_pattern = "|".join(re.escape(item) for item in headings)
    stop_pattern = "|".join(re.escape(item) for item in stops if item not in headings)
    pattern = re.compile(
        rf"(?:^|\n)\s*(?:{heading_pattern})\s*[:：]?\s*(.*?)(?=\n\s*(?:{stop_pattern})\s*[:：]|\Z)",
        re.I | re.S,
    )
    match = pattern.search(text)
    return match.group(1).strip() if match else ""


def _extract_experience(raw: str, years: int) -> list[str]:
    section = _extract_section(raw, ["Experience", "Work Experience", "工作经历", "工作经验"])
    lines = [line.strip(" -•*\t") for line in section.splitlines() if line.strip(" -•*\t")]
    items = lines[:6]
    if years and not any("year" in item.lower() or "年" in item for item in items):
        items.insert(0, f"{years} years")
    return items


def _extract_work_experience(raw: str, duration_label: str) -> list[str]:
    section = _extract_section(raw, ["Experience", "Work Experience", "宸ヤ綔缁忓巻", "宸ヤ綔缁忛獙"])
    lines = [line.strip(" -鈥?\t") for line in section.splitlines() if line.strip(" -鈥?\t")]
    items = [line for line in lines if EXPERIENCE_TIME_MARK_RE.search(line)][:6]
    if duration_label and duration_label != "\u65e0" and not any(duration_label in item for item in items):
        items.insert(0, duration_label)
    return items


def _extract_projects(raw: str) -> list[str]:
    section = _extract_section(raw, ["Projects", "Project Experience", "项目经历", "项目经验"])
    source = section or raw or ""
    items: list[str] = []
    for line in source.splitlines():
        value = line.strip(" -•*\t")
        if not value:
            continue
        if re.search(r"(?i)\b(project|built|launched|developed)\b", value) or "项目" in value:
            items.append(value[:160])
        if len(items) >= 6:
            break
    return items


def parse_resume_once(resume: str) -> dict:
    digest = text_hash(resume or "")
    key = f"resume:parsed:v8:{digest}"
    cached = cache.get_json(key)
    if cached:
        return cached

    raw = resume or ""
    contacts = extract_contacts(raw)
    normalized = clean_text(raw, remove_contacts=False)
    skills = sorted({skill for skill in SKILL_ALIASES if skill in normalized})
    certificates = re.findall(r"\b(?:certified|certificate|certification)\s+([a-z0-9 +#.-]{2,50})", normalized)[:8]
    education = _extract_education(raw)
    experience_years, experience_duration = _extract_experience_duration(raw, normalized)
    experience = _extract_work_experience(raw, experience_duration)
    projects = _extract_projects(raw)
    summary = _extract_section(raw, ["Summary", "Profile", "个人简介", "简介"]) or " ".join(raw.split())[:320]
    profile = {
        "name": _extract_name(raw),
        "role": _extract_role(raw),
        "contact": {
            "email": contacts["email"],
            "phone": contacts["phone"],
            "linkedin": contacts["linkedin"],
            "github": contacts["github"],
            "website": contacts["website"],
        },
        "education": education,
        "experience": experience,
        "experienceDuration": experience_duration,
        "skills": skills,
        "projects": projects,
        "summary": summary[:600],
    }
    parsed = {
        "fieldType": "resume_document" if is_resume_document(raw) else "resume_text",
        "profile": profile,
        "originalResume": raw,
        "name": profile["name"],
        "role": profile["role"],
        "contact": profile["contact"],
        "email": contacts["email"],
        "phone": contacts["phone"],
        "linkedin": contacts["linkedin"],
        "github": contacts["github"],
        "website": contacts["website"],
        "skills": skills,
        "education": " / ".join(education) if education else "Unknown",
        "experienceYears": experience_years,
        "experienceDuration": experience_duration,
        "experience": experience,
        "summary": summary[:600],
        "projects": projects,
        "certificates": certificates,
        "languages": [],
    }
    cache.set_json(key, parsed, ttl=60 * 60 * 24 * 30)
    return parsed
