FROM denoland/deno:2.2.6

WORKDIR /app

RUN mkdir -p /app/server/database && chown -R deno:deno /app

USER deno

COPY --chown=deno:deno deno.json* deno.lock* ./

COPY --chown=deno:deno shared/ ./shared/

COPY --chown=deno:deno server/ ./server/

RUN deno cache --allow-import server/back_server.ts

EXPOSE 3020
ENV PORT=3020

VOLUME ["/app/server/database"]

CMD ["run", "--allow-net", "--allow-read", "--allow-env", "--allow-import", "--allow-write", "server/back_server.ts"]
