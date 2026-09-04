FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /capture
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY capture.py .
COPY tests ./tests
CMD ["python", "capture.py"]
