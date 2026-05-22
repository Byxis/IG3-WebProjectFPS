FROM denoland/deno:2.2.6

WORKDIR /app

USER deno

COPY --chown=deno:deno deno.json* deno.lock* ./

COPY --chown=deno:deno server.ts ./
RUN deno cache --allow-import server.ts

COPY --chown=deno:deno . .

EXPOSE 8080
ENV PORT=8080

CMD ["run", "--allow-net", "--allow-read", "--allow-env", "--allow-import", "server.ts"]
