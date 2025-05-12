web: cd client/ && deno run --allow-read --allow-net server.ts $PORT cert.pem key.pem
worker: deno run --allow-net --allow-read --allow-import --allow-write server/back_server.ts 3000 cert.pem key.pem