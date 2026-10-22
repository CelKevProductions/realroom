FROM node:24.14.0-bookworm-slim AS node
FROM vllm/vllm-openai:v0.18.1
USER root
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 1000 realroom
WORKDIR /app
COPY --chown=1000:1000 . /app
ENV HF_HOME=/home/realroom/.cache/huggingface \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    REALROOM_JOBS_DIR=/home/realroom/jobs \
    VLLM_NO_USAGE_STATS=1 \
    DO_NOT_TRACK=1
USER 1000
EXPOSE 7860
ENTRYPOINT ["python3", "/app/services/furnishing/start.py"]
