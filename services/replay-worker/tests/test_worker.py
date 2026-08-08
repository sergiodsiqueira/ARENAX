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
