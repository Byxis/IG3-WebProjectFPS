FROM denoland/deno:1.40.2

WORKDIR /app
COPY . .

RUN cd client && deno cache server.ts

ENV PORT=8080

CMD cd client && deno run --allow-read --allow-net server.ts ${PORT}