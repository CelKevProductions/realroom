FROM node:24.14.0-bookworm-slim AS node
FROM vllm/vllm-openai:v0.18.1
USER root
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core python3-venv tini && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 1000 realroom
WORKDIR /app
COPY --chown=1000:1000 . /app
# The 2024 spatial checkpoint has its own pinned PyTorch environment. Mixing it
# with vLLM's torch/torchvision versions would change the official runtime.
RUN python3 -m venv /opt/semlayoutdiff && \
    /opt/semlayoutdiff/bin/pip install --no-cache-dir -r services/furnishing/semlayout/requirements.txt
# Downloads public checkpoint files on the build CPU; performs no inference.
# Both files are pinned to one resolved Hub revision and checked against LFS hashes.
ARG SEMLAYOUT_HUB_REVISION=main
RUN /opt/semlayoutdiff/bin/python services/furnishing/semlayout/assets.py \
    --output /opt/realroom-weights --revision "$SEMLAYOUT_HUB_REVISION" && \
    chmod -R a+rX /opt/realroom-weights
ENV HF_HOME=/home/realroom/.cache/huggingface \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    REALROOM_JOBS_DIR=/home/realroom/jobs \
    VLLM_NO_USAGE_STATS=1 \
    DO_NOT_TRACK=1
USER 1000
EXPOSE 7860
ENTRYPOINT ["tini", "-s", "--", "python3", "/app/services/furnishing/start.py"]
