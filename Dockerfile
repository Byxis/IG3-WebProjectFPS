FROM denoland/deno:1.38.3

WORKDIR /app

# Copier tous les fichiers du projet
COPY . .

# Mettre en cache les dépendances
RUN if [ -f deps.ts ]; then deno cache deps.ts; fi
RUN if [ -f client/deps.ts ]; then deno cache client/deps.ts; fi
RUN if [ -f server/deps.ts ]; then deno cache server/deps.ts; fi

# Exposer les ports nécessaires (bonne pratique, même si Dokku gère le mapping)
EXPOSE 8080
EXPOSE 3000