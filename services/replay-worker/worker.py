"""Development Replay Worker backed by the transactional outbox.

Camera equipment must contain configuration.source_path. For the first vertical
slice that path is a continuously refreshed local media file. A production rolling
segment adapter can replace `generate_replay` without changing the job contract.
"""
import asyncio
import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://arenax:arenax@postgres:5432/arenax")
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", "/media"))
PRE_SECONDS = int(os.getenv("REPLAY_PRE_SECONDS", "30"))
POST_SECONDS = int(os.getenv("REPLAY_POST_SECONDS", "5"))
SEGMENT_SECONDS = int(os.getenv("CAPTURE_SEGMENT_SECONDS", "2"))


async def generate_replay(source: str, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    process = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-sseof", f"-{PRE_SECONDS + POST_SECONDS}", "-i", source,
        "-t", str(PRE_SECONDS + POST_SECONDS), "-c", "copy", str(output),
        stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE,
    )
    _, error = await process.communicate()
    if process.returncode:
        raise RuntimeError(error.decode(errors="replace")[-1000:])


def segment_timestamp(path: Path) -> datetime:
    return datetime.strptime(path.stem, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)


def select_segments(buffer_dir: Path, occurred_at: datetime) -> list[Path]:
    window_start = occurred_at - timedelta(seconds=PRE_SECONDS)
    window_end = occurred_at + timedelta(seconds=POST_SECONDS)
    selected = []
    for path in sorted(buffer_dir.glob("*.mp4")):
        try:
            started_at = segment_timestamp(path)
        except ValueError:
            continue
        if started_at <= window_end and started_at + timedelta(seconds=SEGMENT_SECONDS) >= window_start:
            selected.append(path)
    return selected


async def generate_buffered_replay(buffer_dir: Path, occurred_at: datetime, output: Path) -> None:
    remaining = (occurred_at.timestamp() + POST_SECONDS) - datetime.now(timezone.utc).timestamp()
    if remaining > 0:
        await asyncio.sleep(remaining)
    segments = select_segments(buffer_dir, occurred_at)
    if not segments:
        raise RuntimeError("No buffered camera segments cover the Moment")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as manifest:
        manifest_path = Path(manifest.name)
        for segment in segments:
            manifest.write(f"file '{segment}'\n")
    try:
        process = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(manifest_path),
            "-c", "copy", str(output), stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, error = await process.communicate()
        if process.returncode:
            raise RuntimeError(error.decode(errors="replace")[-1000:])
    finally:
        manifest_path.unlink(missing_ok=True)


async def process_one(connection) -> bool:
    async with connection.transaction():
        job = await connection.fetchrow("""
            SELECT id, agregado_id, dados FROM caixa_de_saida
            WHERE tipo = 'ReplayRequested' AND publicado_em IS NULL
            ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1
        """)
        if not job:
            return False
        payload = job["dados"] if isinstance(job["dados"], dict) else json.loads(job["dados"])
        camera = await connection.fetchrow("""
            SELECT id, configuracao FROM equipamentos
            WHERE espaco_id = $1 AND tipo = 'camera' ORDER BY id LIMIT 1
        """, UUID(payload["spaceId"]))
        try:
            if not camera:
                raise RuntimeError("No camera configured for Space")
            configuration = camera["configuracao"]
            if isinstance(configuration, str):
                configuration = json.loads(configuration)
            output = MEDIA_ROOT / "replays" / f"{payload['momentId']}.mp4"
            await connection.execute("UPDATE momentos SET status='processing' WHERE id=$1",
                                     UUID(payload["momentId"]))
            moment_at = await connection.fetchval(
                "SELECT ocorrido_em FROM momentos WHERE id=$1", UUID(payload["momentId"])
            )
            if configuration.get("capture_url"):
                await generate_buffered_replay(MEDIA_ROOT / "buffers" / str(camera["id"]), moment_at, output)
            elif configuration.get("source_path"):
                await generate_replay(configuration["source_path"], output)
            else:
                raise RuntimeError("Camera configuration.capture_url is required")
            await connection.execute("UPDATE momentos SET status='ready', caminho_replay=$2 WHERE id=$1",
                                     UUID(payload["momentId"]), str(output))
            await connection.execute("""INSERT INTO linha_do_tempo
                (id, sessao_id, tipo, ocorrido_em, dados)
                VALUES(gen_random_uuid(), $1, 'ReplayGenerated', now(), $2::json)""",
                UUID(payload["sessionId"]), json.dumps({"momentId": payload["momentId"]}))
        except Exception as exc:
            await connection.execute("UPDATE momentos SET status='failed' WHERE id=$1",
                                     UUID(payload["momentId"]))
            await connection.execute("""INSERT INTO linha_do_tempo
                (id, sessao_id, tipo, ocorrido_em, dados)
                VALUES(gen_random_uuid(), $1, 'ReplayGenerationFailed', now(), $2::json)""",
                UUID(payload["sessionId"]), json.dumps({"error": str(exc)}))
        await connection.execute(
            "UPDATE caixa_de_saida SET publicado_em=now() WHERE id=$1", job["id"]
        )
        return True


async def main():
    connection = await asyncpg.connect(DATABASE_URL)
    try:
        while True:
            if not await process_one(connection):
                await asyncio.sleep(1)
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
