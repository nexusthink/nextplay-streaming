#!/usr/bin/env bash
# ==============================================================================
# NEXTPLAY STREAMING - ATUALIZAÇÃO RÁPIDA NA VPS (GIT PULL + DOCKER REBUILD)
# Uso na VPS sempre que der git push: ./deploy/update-vps.sh
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🔄 Baixando última versão do repositório Git...${NC}"
git fetch origin main
git reset --hard origin/main

echo -e "${CYAN}🏗️ Recompilando e atualizando apenas o container isolado nextplay-web...${NC}"
docker compose -p nextplay --env-file .env up -d --build

echo -e "${CYAN}🧹 Limpando imagens antigas do Docker...${NC}"
docker image prune -f

echo -e "${GREEN}✅ NextPlay atualizado na VPS com sucesso!${NC}"

