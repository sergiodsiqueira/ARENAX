import importlib.util
from pathlib import Path
import sys
from uuid import uuid4


MODULE_PATH = Path(__file__).parents[1] / "capture.py"
SPEC = importlib.util.spec_from_file_location("capture_service", MODULE_PATH)
capture_service = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = capture_service
SPEC.loader.exec_module(capture_service)


def test_rtsp_camera_uses_tcp_and_segment_output(tmp_path):
    camera = capture_service.Camera(uuid4(), "rtsp://camera/stream")
    command = capture_service.build_ffmpeg_command(camera, tmp_path / "%Y.mp4")
    assert command[:5] == ["ffmpeg", "-hide_banner", "-loglevel", "warning", "-rtsp_transport"]
    assert "segment" in command
    assert camera.capture_url in command


def test_loop_is_enabled_only_when_configured(tmp_path):
    camera = capture_service.Camera(uuid4(), "/media/source.mp4", loop=True)
    command = capture_service.build_ffmpeg_command(camera, tmp_path / "%Y.mp4")
    assert command[4:6] == ["-stream_loop", "-1"]


def test_retention_removes_only_expired_mp4_files(tmp_path, monkeypatch):
    old_segment = tmp_path / "old.mp4"
    current_segment = tmp_path / "current.mp4"
    ignored = tmp_path / "health.json"
    for path in (old_segment, current_segment, ignored):
        path.write_text("test")
    old_segment.touch()
    current_segment.touch()
    monkeypatch.setattr(capture_service, "RETENTION_SECONDS", 10)
    import os
    os.utime(old_segment, (80, 80))
    os.utime(current_segment, (95, 95))

    capture_service.remove_expired_segments(tmp_path, 100)

    assert not old_segment.exists()
    assert current_segment.exists()
    assert ignored.exists()
