"""Continuous camera capture into per-camera rolling segment buffers."""

import asyncio
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://arenax:arenax@postgres:5432/arenax")
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", "/media"))
SEGMENT_SECONDS = int(os.getenv("CAPTURE_SEGMENT_SECONDS", "2"))
RETENTION_SECONDS = int(os.getenv("CAPTURE_RETENTION_SECONDS", "120"))
POLL_SECONDS = int(os.getenv("CAPTURE_POLL_SECONDS", "5"))


@dataclass(frozen=True)
class Camera:
    id: UUID
    capture_url: str
    loop: bool = False


def camera_from_row(row) -> Camera | None:
    configuration = row["configuration"]
    if isinstance(configuration, str):
        configuration = json.loads(configuration)
    capture_url = configuration.get("capture_url")
    if not capture_url:
        return None
    return Camera(row["id"], capture_url, bool(configuration.get("loop", False)))


def build_ffmpeg_command(camera: Camera, output_pattern: Path) -> list[str]:
    command = ["ffmpeg", "-hide_banner", "-loglevel", "warning"]
    if camera.capture_url.lower().startswith("rtsp://"):
        command.extend(["-rtsp_transport", "tcp"])
    if camera.loop:
        command.extend(["-stream_loop", "-1"])
    command.extend([
        "-i", camera.capture_url,
        "-map", "0:v:0", "-an", "-c:v", "copy",
        "-f", "segment", "-segment_time", str(SEGMENT_SECONDS),
        "-reset_timestamps", "1", "-strftime", "1", str(output_pattern),
    ])
    return command


def remove_expired_segments(buffer_dir: Path, now: float) -> None:
    cutoff = now - RETENTION_SECONDS
    for segment in buffer_dir.glob("*.mp4"):
        if segment.stat().st_mtime < cutoff:
            segment.unlink(missing_ok=True)


def write_health(camera_id: UUID, status: str, error: str | None = None) -> None:
    health_dir = MEDIA_ROOT / "capture-health"
    health_dir.mkdir(parents=True, exist_ok=True)
    target = health_dir / f"{camera_id}.json"
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps({
        "cameraId": str(camera_id),
        "status": status,
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "error": error,
    }), encoding="utf-8")
    temporary.replace(target)


async def capture(camera: Camera) -> None:
    buffer_dir = MEDIA_ROOT / "buffers" / str(camera.id)
    buffer_dir.mkdir(parents=True, exist_ok=True)
    output_pattern = buffer_dir / "%Y%m%dT%H%M%SZ.mp4"
    while True:
        write_health(camera.id, "starting")
        process = await asyncio.create_subprocess_exec(
            *build_ffmpeg_command(camera, output_pattern),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        write_health(camera.id, "capturing")
        try:
            _, stderr = await process.communicate()
        except asyncio.CancelledError:
            process.terminate()
            await process.wait()
            write_health(camera.id, "stopped")
            raise
        message = stderr.decode(errors="replace")[-1000:] or f"ffmpeg exited {process.returncode}"
        write_health(camera.id, "failed", message)
        await asyncio.sleep(POLL_SECONDS)


async def load_cameras(connection) -> dict[UUID, Camera]:
    rows = await connection.fetch(
        "SELECT id, configuration FROM equipments WHERE kind = 'camera' ORDER BY id"
    )
    cameras = (camera_from_row(row) for row in rows)
    return {camera.id: camera for camera in cameras if camera is not None}


async def main() -> None:
    connection = await asyncpg.connect(DATABASE_URL)
    tasks: dict[UUID, tuple[Camera, asyncio.Task]] = {}
    try:
        while True:
            cameras = await load_cameras(connection)
            for camera_id, (camera, task) in list(tasks.items()):
                if camera_id not in cameras or cameras[camera_id] != camera:
                    task.cancel()
                    tasks.pop(camera_id)
            for camera_id, camera in cameras.items():
                if camera_id not in tasks:
                    tasks[camera_id] = (camera, asyncio.create_task(capture(camera)))
            for camera_id in cameras:
                remove_expired_segments(MEDIA_ROOT / "buffers" / str(camera_id), datetime.now().timestamp())
            await asyncio.sleep(POLL_SECONDS)
    finally:
        for _, task in tasks.values():
            task.cancel()
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
