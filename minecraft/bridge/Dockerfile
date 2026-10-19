# One-shot builder: produces SecureBridge JAR into /out (shared volume)
FROM gradle:8.11.1-jdk21

WORKDIR /workspace
COPY minecraft/bridge /workspace

# Build jar (skip tests in image build for speed; tests run in CI/compose test target)
RUN gradle --no-daemon clean jar -x test

CMD ["sh", "-c", "cp -f build/libs/SecureBridge-*.jar /out/SecureBridge.jar && ls -la /out && echo 'SecureBridge JAR copied to /out/SecureBridge.jar'"]
