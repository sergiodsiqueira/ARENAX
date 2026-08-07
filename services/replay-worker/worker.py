"""Development Replay Worker backed by the transactional outbox.

Camera equipment must contain configuration.source_path. For the first vertical
slice that path is a continuously refreshed local media file. A production rolling
segment adapter can replace `generate_replay` without changing the job contract.
"""
import asyncio
import json
import os
from pathlib import Path
from uuid import UUID

import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://arenax:arenax@postgres:5432/arenax")
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", "/media"))
PRE_SECONDS = int(os.getenv("REPLAY_PRE_SECONDS", "30"))
POST_SECONDS = int(os.getenv("REPLAY_POST_SECONDS", "5"))


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


async def process_one(connection) -> bool:
    async with connection.transaction():
        job = await connection.fetchrow("""
            SELECT id, aggregate_id, payload FROM outbox
            WHERE kind = 'ReplayRequested' AND published_at IS NULL
            ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1
        """)
        if not job:
            return False
        payload = job["payload"] if isinstance(job["payload"], dict) else json.loads(job["payload"])
        camera = await connection.fetchrow("""
            SELECT configuration FROM equipments
            WHERE space_id = $1 AND kind = 'camera' ORDER BY id LIMIT 1
        """, UUID(payload["spaceId"]))
        try:
            if not camera:
                raise RuntimeError("No camera configured for Space")
            configuration = camera["configuration"]
            if isinstance(configuration, str):
                configuration = json.loads(configuration)
            source = configuration.get("source_path")
            if not source:
                raise RuntimeError("Camera configuration.source_path is required")
            output = MEDIA_ROOT / "replays" / f"{payload['momentId']}.mp4"
            await connection.execute("UPDATE moments SET status='processing' WHERE id=$1",
                                     UUID(payload["momentId"]))
            await generate_replay(source, output)
            await connection.execute("UPDATE moments SET status='ready', replay_path=$2 WHERE id=$1",
                                     UUID(payload["momentId"]), str(output))
            await connection.execute("""INSERT INTO timeline
                (id, session_id, kind, occurred_at, data)
                VALUES(gen_random_uuid(), $1, 'ReplayGenerated', now(), $2::json)""",
                UUID(payload["sessionId"]), json.dumps({"momentId": payload["momentId"]}))
        except Exception as exc:
            await connection.execute("UPDATE moments SET status='failed' WHERE id=$1",
                                     UUID(payload["momentId"]))
            await connection.execute("""INSERT INTO timeline
                (id, session_id, kind, occurred_at, data)
                VALUES(gen_random_uuid(), $1, 'ReplayGenerationFailed', now(), $2::json)""",
                UUID(payload["sessionId"]), json.dumps({"error": str(exc)}))
        await connection.execute("UPDATE outbox SET published_at=now() WHERE id=$1", job["id"])
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

