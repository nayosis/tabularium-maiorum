# Tabularium : serveur Bun + interface compilée, données dans le volume /data.

# --- Construction de l'interface
FROM oven/bun:1.3 AS construction
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# --- Image finale
FROM oven/bun:1.3-slim
ARG VERSION=dev
LABEL org.opencontainers.image.title="Tabularium Maiorum" \
      org.opencontainers.image.description="Les archives des ancêtres : recherche généalogique, seul ou en famille" \
      org.opencontainers.image.source="https://github.com/nayosis/tabularium-maiorum" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.version=$VERSION
WORKDIR /app
ENV NODE_ENV=production \
    DOSSIER_DONNEES=/data \
    PORT=3000
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY serveur ./serveur
# Code partagé exécuté par le serveur (fonctions de src/data/, schéma, outils purs)
COPY src ./src
COPY drizzle ./drizzle
COPY --from=construction /app/dist ./dist
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD bun -e "fetch('http://localhost:3000/api/sante').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "serveur/index.ts"]
