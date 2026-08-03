FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3.11 python3.11-venv python3-pip \
    ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source SEBELUM install — pip install . butuh package dir
COPY pyproject.toml ./
COPY app/ ./app/

RUN pip install --no-cache-dir .

RUN mkdir -p /data/models
ENV MUALIM_CACHE_DIR=/data/models

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
