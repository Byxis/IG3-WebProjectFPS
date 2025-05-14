FROM denoland/deno:2.2.6

WORKDIR /app
COPY . .

RUN cd client && deno cache server.ts

ENV PORT=8000
EXPOSE PORT
CMD ["ls", "-la"]
CMD ["pwd"]
CMD ["cd", "client", "&&", "deno", "run", "--allow-read", "--allow-net", "server.ts", "${PORT}"]