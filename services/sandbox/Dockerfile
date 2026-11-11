# Minimal sandbox image for one-shot untrusted script execution.
# Contains Deno + trusted entrypoint + tiny host SDK. No app secrets, no Docker socket.
#
# Pin an explicit Deno version for reproducible permission-baseline experiments.
FROM denoland/deno:2.9.7

USER root
COPY packages/contracts/src/script-project.ts /trusted/script-project.ts
COPY services/sandbox/materialize.ts /trusted/materialize.ts
COPY services/sandbox/entrypoint.sh /trusted/entrypoint.sh
COPY services/sandbox/import_map.json /trusted/import_map.json
COPY services/sandbox/host /trusted/host
COPY services/sandbox/fixtures/allowed.txt /fixtures/allowed.txt
RUN sed -i 's/\r$//' /trusted/entrypoint.sh \
  && chmod 755 /trusted/entrypoint.sh \
  && mkdir -p /workspace \
  && chmod 755 /fixtures \
  && chmod 644 /fixtures/allowed.txt \
  && chmod -R a+rX /trusted \
  && chown deno:deno /workspace

USER deno
WORKDIR /workspace

ENV SANDBOX_DENO_VERSION=2.9.7
ENV DENO_DIR=/workspace/.deno
ENTRYPOINT ["/trusted/entrypoint.sh"]
