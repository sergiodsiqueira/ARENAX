import json
from datetime import UTC, datetime, timedelta

from arenax.infrastructure.health_center import overall_status, read_heartbeat

NOW = datetime(2026, 8, 30, 15, tzinfo=UTC)


def write_report(path, checked_at, status="running"):
    path.write_text(json.dumps({
        "status": status,
        "checkedAt": checked_at.isoformat(),
        "error": None,
    }), encoding="utf-8")


def test_recent_heartbeat_is_healthy(tmp_path):
    report = tmp_path / "service.json"
    write_report(report, NOW - timedelta(seconds=5))
    result = read_heartbeat(report, NOW, 30)
    assert result["status"] == "healthy"
    assert result["checked_at"] == NOW - timedelta(seconds=5)


def test_stale_heartbeat_is_unavailable(tmp_path):
    report = tmp_path / "service.json"
    write_report(report, NOW - timedelta(seconds=31))
    result = read_heartbeat(report, NOW, 30)
    assert result["status"] == "unavailable"
    assert "31 segundos" in result["detail"]


def test_missing_heartbeat_is_unknown(tmp_path):
    result = read_heartbeat(tmp_path / "missing.json", NOW, 30)
    assert result["status"] == "unknown"


def test_overall_status_prioritizes_unavailable_then_attention():
    assert overall_status([{"status": "healthy"}]) == "healthy"
    assert overall_status([{"status": "healthy"}, {"status": "unknown"}]) == "attention"
    assert overall_status([{"status": "degraded"}]) == "attention"
    assert overall_status([{"status": "unknown"}, {"status": "unavailable"}]) == "critical"
