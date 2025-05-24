FROM denoland/deno:latest
WORKDIR /app

COPY --from=builder /app .

CMD ["deno", "run", "--allow-read", "--allow-net", "--allow-env", "--allow-import", "--allow-write", "server/back_server.ts"]
