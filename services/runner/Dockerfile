FROM denoland/deno:2.1.4

WORKDIR /app
COPY services/runner /app

RUN deno cache src/main.ts || true

ENV RUNNER_PORT=3100
EXPOSE 3100

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-import", "src/main.ts"]
