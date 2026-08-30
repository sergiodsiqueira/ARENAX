import asyncio
import json
import shutil
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .database import engine

Probe = Callable[[], Awaitable[None]]


def _age_seconds(checked_at: datetime | None, now: datetime) -> float | None:
    if checked_at is None:
        return None
    if checked_at.tzinfo is None:
        checked_at = checked_at.replace(tzinfo=UTC)
    return max(0, (now - checked_at).total_seconds())


def read_heartbeat(path: Path, now: datetime, stale_after_seconds: int) -> dict:
    if not path.is_file():
        return {"status": "unknown", "checked_at": None, "detail": "Aguardando primeiro sinal"}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        checked_at = datetime.fromisoformat(payload["checkedAt"])
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return {"status": "unavailable", "checked_at": None, "detail": "Relatório inválido"}
    age = _age_seconds(checked_at, now)
    if age is not None and age > stale_after_seconds:
        return {
            "status": "unavailable",
            "checked_at": checked_at,
            "detail": f"Sem sinal há {int(age)} segundos",
        }
    raw_status = payload.get("status", "unknown")
    status = "healthy" if raw_status in {"running", "capturing", "idle"} else "unavailable"
    return {
        "status": status,
        "checked_at": checked_at,
        "detail": payload.get("error") or payload.get("detail"),
    }


async def probe_database() -> None:
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


async def probe_http(url: str) -> None:
    def request() -> None:
        with urlopen(url, timeout=2) as response:
            if response.status >= 400:
                raise OSError(f"HTTP {response.status}")

    await asyncio.to_thread(request)


async def service_probe(name: str, label: str, probe: Probe, now: datetime) -> dict:
    started = asyncio.get_running_loop().time()
    try:
        await probe()
        return {
            "name": name,
            "label": label,
            "status": "healthy",
            "checked_at": now,
            "detail": None,
            "response_time_ms": round((asyncio.get_running_loop().time() - started) * 1000),
        }
    except (OSError, TimeoutError, HTTPError, URLError, SQLAlchemyError) as exc:
        return {
            "name": name,
            "label": label,
            "status": "unavailable",
            "checked_at": now,
            "detail": str(exc)[:300] or "Serviço indisponível",
            "response_time_ms": None,
        }


def storage_health(media_root: Path, now: datetime) -> dict:
    try:
        usage = shutil.disk_usage(media_root)
        free_percent = (usage.free / usage.total * 100) if usage.total else 0
        status = "degraded" if free_percent < 10 or usage.free < 1_073_741_824 else "healthy"
        return {
            "name": "storage",
            "label": "Armazenamento",
            "status": status,
            "checked_at": now,
            "detail": None,
            "response_time_ms": None,
            "total_bytes": usage.total,
            "free_bytes": usage.free,
            "used_percent": round((usage.used / usage.total * 100) if usage.total else 100, 1),
        }
    except OSError as exc:
        return {
            "name": "storage",
            "label": "Armazenamento",
            "status": "unavailable",
            "checked_at": now,
            "detail": str(exc)[:300],
            "response_time_ms": None,
            "total_bytes": None,
            "free_bytes": None,
            "used_percent": None,
        }


def overall_status(items: list[dict]) -> str:
    statuses = {item["status"] for item in items}
    if "unavailable" in statuses:
        return "critical"
    if statuses & {"degraded", "unknown"}:
        return "attention"
    return "healthy"
