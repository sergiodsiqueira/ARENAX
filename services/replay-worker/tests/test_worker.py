import importlib.util
from datetime import datetime, timezone
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "worker.py"
SPEC = importlib.util.spec_from_file_location("replay_worker", MODULE_PATH)
replay_worker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(replay_worker)


def test_selects_only_segments_overlapping_replay_window(tmp_path, monkeypatch):
    monkeypatch.setattr(replay_worker, "PRE_SECONDS", 4)
    monkeypatch.setattr(replay_worker, "POST_SECONDS", 2)
    monkeypatch.setattr(replay_worker, "SEGMENT_SECONDS", 2)
    for name in (
        "20260808T115952Z.mp4",
        "20260808T115956Z.mp4",
        "20260808T115958Z.mp4",
        "20260808T120000Z.mp4",
        "20260808T120002Z.mp4",
        "20260808T120004Z.mp4",
    ):
        (tmp_path / name).touch()

    selected = replay_worker.select_segments(
        tmp_path, datetime(2026, 8, 8, 12, 0, tzinfo=timezone.utc)
    )

    assert [path.name for path in selected] == [
        "20260808T115956Z.mp4",
        "20260808T115958Z.mp4",
        "20260808T120000Z.mp4",
        "20260808T120002Z.mp4",
    ]


def test_ignores_files_without_segment_timestamp(tmp_path):
    (tmp_path / "current.mp4").touch()
    assert replay_worker.select_segments(
        tmp_path, datetime(2026, 8, 8, 12, 0, tzinfo=timezone.utc)
    ) == []


def test_service_health_is_written_atomically(tmp_path, monkeypatch):
    monkeypatch.setattr(replay_worker, "MEDIA_ROOT", tmp_path)
    replay_worker.write_service_health()
    payload = __import__("json").loads(
        (tmp_path / "service-health" / "replay-worker.json").read_text()
    )
    assert payload["status"] == "running"


class RetentionConnection:
    def __init__(self, retention_days, rows=None):
        self.retention_days = retention_days
        self.rows = rows or []
        self.fetch_called = False
        self.executed = []

    async def fetchval(self, *_):
        return self.retention_days

    async def fetch(self, *_):
        self.fetch_called = True
        return self.rows

    async def execute(self, *args):
        self.executed.append(args)

    def transaction(self):
        class Transaction:
            async def __aenter__(self): return self
            async def __aexit__(self, *_): return None
        return Transaction()


def test_replay_retention_is_disabled_by_default():
    import asyncio

    connection = RetentionConnection(None)
    removed = asyncio.run(replay_worker.remove_expired_replays(
        connection, datetime(2026, 8, 30, tzinfo=timezone.utc)
    ))
    assert removed == 0
    assert not connection.fetch_called


def test_expired_replay_file_is_removed_but_history_is_preserved(tmp_path, monkeypatch):
    import asyncio

    moment_id = __import__("uuid").uuid4()
    session_id = __import__("uuid").uuid4()
    replay = tmp_path / "replays" / "moment.mp4"
    replay.parent.mkdir()
    replay.write_bytes(b"video")
    monkeypatch.setattr(replay_worker, "MEDIA_ROOT", tmp_path)
    connection = RetentionConnection(30, [{
        "id": moment_id, "sessao_id": session_id, "caminho_replay": str(replay)
    }])

    removed = asyncio.run(replay_worker.remove_expired_replays(
        connection, datetime(2026, 8, 30, tzinfo=timezone.utc)
    ))

    assert removed == 1
    assert not replay.exists()
    assert "status='expired'" in connection.executed[0][0]
    assert "ReplayExpired" in connection.executed[1][0]
