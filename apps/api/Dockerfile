FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
COPY tests ./tests
COPY alembic.ini ./
COPY migrations ./migrations
RUN pip install --no-cache-dir ".[dev]"
CMD ["uvicorn", "arenax.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
