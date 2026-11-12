# ==============================================================================
# NEXTPLAY STREAMING - DOCKERFILE UNIFICADO DE PRODUÇÃO (WEB + ADMIN + ENGINE)
# Stage 1: Build do Frontend (Vite + Painel Admin + APK)
# Stage 2: Nginx Alpine (:80) + Motor Express IPTV (127.0.0.1:4150) no mesmo container
# ==============================================================================

# ------------------------------------------------------------------------------
# STAGE 1: Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=""
ARG VITE_APP_NAME="NextPlay"

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

# 1. Instala dependências e compila o Frontend (Vite)
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# 2. Prepara diretório isolado do backend com apenas dependências de produção
RUN mkdir -p /app/server-prod && \
    cp -r /app/server/* /app/server-prod/ && \
    printf '{\n  "name": "nextplay-server",\n  "type": "module",\n  "dependencies": {\n    "cors": "^2.8.5",\n    "express": "^4.21.1"\n  }\n}\n' > /app/server-prod/package.json && \
    cd /app/server-prod && npm install --omit=dev --no-audit --no-fund

# ------------------------------------------------------------------------------
# STAGE 2: Runner (Nginx :80 + NextPlay Express Engine em 127.0.0.1:4150)
# ------------------------------------------------------------------------------
FROM nginx:stable-alpine AS runner

RUN apk add --no-cache nodejs wget

# Remove configuração padrão do Nginx e aplica a do NextPlay
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos estáticos compilados pelo Vite (incluindo /download/nextplay.apk)
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia o servidor Express já com node_modules instalado
COPY --from=builder /app/server-prod /usr/src/nextplay-server
RUN mkdir -p /usr/src/nextplay-server/data

# Script de inicialização que sobe o motor Express (porta 4150) e o Nginx (porta 80)
RUN printf '#!/bin/sh\ncd /usr/src/nextplay-server && NODE_ENV=production PORT=4150 node index.js &\nexec nginx -g "daemon off;"\n' > /start.sh && chmod +x /start.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/healthz || exit 1

CMD ["/start.sh"]

