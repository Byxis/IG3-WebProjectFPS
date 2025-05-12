FROM denoland/deno:1.38.3

WORKDIR /app

# Copier tous les fichiers du projet
COPY . .

# Mettre en cache les dépendances
RUN if [ -f deps.ts ]; then deno cache deps.ts; fi
RUN if [ -f client/deps.ts ]; then deno cache client/deps.ts; fi
RUN if [ -f server/deps.ts ]; then deno cache server/deps.ts; fi

# Exposer les ports nécessaires
EXPOSE 8080
EXPOSE 3000

# Créer un script de démarrage pour exécuter les deux services
RUN echo '#!/bin/sh\n\
deno run --allow-read --allow-net client/server.ts 8080 cert.pem key.pem & \n\
deno run --allow-net --allow-read --allow-import --allow-write server/back_server.ts 3000 cert.pem key.pem & \n\
wait\n' > /app/start.sh && chmod +x /app/start.sh

# Point d'entrée pour démarrer les deux services
CMD ["/app/start.sh"]