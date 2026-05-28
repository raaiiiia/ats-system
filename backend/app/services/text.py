import hashlib
import re
from html import unescape

from bs4 import BeautifulSoup

EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
PHONE_RE = re.compile(r"(?:\+?\d[\s().-]?){7,18}")
URL_RE = re.compile(r"https?://\S+|www\.\S+", re.I)
LINKEDIN_RE = re.compile(r"(?:https?://)?(?:www\.)?linkedin\.com/\S+", re.I)
GITHUB_RE = re.compile(r"(?:https?://)?(?:www\.)?github\.com/\S+", re.I)


def text_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()


def clean_text(value: str, remove_contacts: bool = True) -> str:
    text = unescape(value or "")
    text = BeautifulSoup(text, "html.parser").get_text(" ")
    text = URL_RE.sub(" ", text)
    if remove_contacts:
        text = EMAIL_RE.sub(" ", text)
        text = PHONE_RE.sub(" ", text)
    text = text.lower()
    text = re.sub(r"[^a-z0-9+#.\s-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _contact_text(text: str) -> str:
    normalized = text or ""
    normalized = normalized.replace("＠", "@").replace("。", ".").replace("．", ".")
    normalized = re.sub(r"\s*@\s*", "@", normalized)
    normalized = re.sub(r"\s*\.\s*", ".", normalized)
    normalized = re.sub(r"(?i)\s+at\s+", "@", normalized)
    normalized = re.sub(r"(?i)\s+dot\s+", ".", normalized)
    return normalized


def _phone_value(text: str) -> str:
    for match in PHONE_RE.findall(text or ""):
        compact = re.sub(r"\D", "", match)
        if 7 <= len(compact) <= 15:
            return match.strip()
    return "N/A"


def extract_contacts(text: str) -> dict:
    contact_text = _contact_text(text)
    email = next(iter(EMAIL_RE.findall(contact_text)), "N/A")
    phone = _phone_value(contact_text)
    linkedin = next(iter(LINKEDIN_RE.findall(contact_text)), "N/A")
    github = next(iter(GITHUB_RE.findall(contact_text)), "N/A")
    website = next(iter(URL_RE.findall(contact_text)), "N/A")
    return {"email": email, "phone": phone, "linkedin": linkedin, "github": github, "website": website}
