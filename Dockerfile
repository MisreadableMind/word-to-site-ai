# Stage 1 — build the TanStack Start app (Vite 8 + Nitro node-server)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts ./
COPY app/ ./app/
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

# Stage 2 — runtime: one process — the Nitro server with the Express backend mounted in-process
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY public/ ./public/
COPY certs/ ./certs/
COPY --from=build /app/.output ./.output

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/app/certs/letsencrypt-gen-y.pem

CMD ["npm", "start"]
