FROM denoland/deno:2.2.6

WORKDIR /app
COPY . .

WORKDIR /app/client

EXPOSE 8000

CMD ["deno", "run", "--allow-read", "--allow-net", "--allow-env", "--watch", "server.ts", "8000"]