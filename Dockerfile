FROM denoland/deno:latest
WORKDIR /app

COPY --from=builder /app .

WORKDIR /app/client

CMD ["deno", "run", "--allow-read", "--allow-net", "--allow-env", "server.ts"]