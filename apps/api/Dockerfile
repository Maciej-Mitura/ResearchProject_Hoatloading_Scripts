FROM denoland/deno:2.1.4

WORKDIR /workspace

COPY packages/contracts /workspace/packages/contracts
COPY apps/api /workspace/apps/api
COPY config /workspace/config

WORKDIR /workspace/apps/api

# Cache remote deps including optional OpenAI SDK (Gemini uses fetch only)
RUN deno cache src/main.ts src/providers/openai.ts src/providers/gemini.ts || true

ENV API_PORT=3000
ENV PROJECT_CONFIG_DIR=/workspace/config
EXPOSE 3000

# Limited Deno permissions — RESEARCH TODO: further tighten for research runs
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "--allow-sys", "--allow-import", "src/main.ts"]
