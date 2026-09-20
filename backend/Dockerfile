# Build multi-stage MedAssur (backend NestJS + frontend Vite), voir plan
# de migration vers Coolify — remplace le déploiement manuel scp/systemctl.
# Contexte de build = RACINE du dépôt (pas backend/), pour que le stage
# frontend voie src/ à la racine. node:22-bookworm partout (jamais Alpine)
# : sharp et canvas (via chartjs-node-canvas) ciblent des binaires glibc,
# le VPS de prod tourne sous Ubuntu 24.04 (glibc).

# ---------- Frontend (Vite) ----------
FROM node:22-bookworm AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json postcss.config.mjs ./
COPY public ./public
COPY src ./src
COPY .env.production ./.env.production
RUN npm run build

# ---------- Backend (NestJS) ----------
FROM node:22-bookworm AS backend
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json ./
COPY backend/prisma ./prisma
COPY backend/src ./src
COPY backend/assets ./assets
RUN npx prisma generate
RUN npm run build

# ---------- Runtime ----------
FROM node:22-bookworm AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend /app/node_modules ./node_modules
COPY --from=backend /app/dist ./dist
COPY --from=backend /app/prisma ./prisma
COPY --from=backend /app/assets ./assets
COPY --from=frontend /app/dist ./frontend-dist
EXPOSE 3002
CMD ["node", "dist/src/main.js"]
