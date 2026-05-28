import json
from typing import Any

import redis

from app.config import settings


class Cache:
    def __init__(self) -> None:
        try:
            self.client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
            self.client.ping()
        except Exception:
            self.client = None
            self.memory: dict[str, str] = {}

    def get_json(self, key: str) -> Any | None:
        raw = self.client.get(key) if self.client else self.memory.get(key)
        return json.loads(raw) if raw else None

    def set_json(self, key: str, value: Any, ttl: int = 3600) -> None:
        payload = json.dumps(value, ensure_ascii=False)
        if self.client:
            self.client.setex(key, ttl, payload)
        else:
            self.memory[key] = payload

    def delete(self, key: str) -> None:
        if self.client:
            self.client.delete(key)
        else:
            self.memory.pop(key, None)


cache = Cache()

