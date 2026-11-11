# Trusted Host Gateway — no Docker socket, no BRIDGE_TOKEN in sandboxes.
FROM denoland/deno:2.1.4

COPY packages/contracts /workspace/packages/contracts
COPY services/host-gateway /workspace/services/host-gateway
WORKDIR /workspace/services/host-gateway

RUN deno cache src/main.ts || true

ENV HOST_GATEWAY_PORT=3200
EXPOSE 3200

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-import", "src/main.ts"]
