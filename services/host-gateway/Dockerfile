# Trusted Host Gateway — no Docker socket, no BRIDGE_TOKEN in sandboxes.
FROM denoland/deno:2.1.4

WORKDIR /app
COPY services/host-gateway /app

RUN deno cache src/main.ts || true

ENV HOST_GATEWAY_PORT=3200
EXPOSE 3200

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-import", "src/main.ts"]
