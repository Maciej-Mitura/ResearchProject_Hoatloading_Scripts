# Trusted execution supervisor — the only service with Docker Engine access.
FROM denoland/deno:2.1.4

USER root

# Docker CLI only (talks to mounted engine socket). Not the daemon.
ARG DOCKER_CLI_VERSION=27.3.1
ARG TARGETARCH
RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends curl ca-certificates; \
  arch="$TARGETARCH"; \
  if [ -z "$arch" ] || [ "$arch" = "amd64" ]; then arch="x86_64"; fi; \
  if [ "$arch" = "arm64" ]; then arch="aarch64"; fi; \
  curl -fsSL "https://download.docker.com/linux/static/stable/${arch}/docker-${DOCKER_CLI_VERSION}.tgz" -o /tmp/docker.tgz; \
  tar -xzf /tmp/docker.tgz -C /tmp; \
  mv /tmp/docker/docker /usr/local/bin/docker; \
  chmod 755 /usr/local/bin/docker; \
  rm -rf /tmp/docker /tmp/docker.tgz /var/lib/apt/lists/*; \
  docker --version

WORKDIR /app
COPY services/runner /app

RUN deno cache src/main.ts || true

ENV RUNNER_PORT=3100
ENV SANDBOX_IMAGE=research-poc-sandbox:local
ENV SANDBOX_DENO_VERSION=2.9.7
EXPOSE 3100

# Needs dockerd socket at runtime (compose mount). No app DB/LLM secrets required.
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-run=docker", "--allow-import", "src/main.ts"]
