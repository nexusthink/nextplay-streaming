#!/usr/bin/env bash
# ==============================================================================
# NEXTPLAY STREAMING - SCRIPT AUTOMATIZADO DE DEPLOY EM VPS (UBUNTU / DEBIAN)
# Container Isolado: nextplay-web (Porta padrão 8090 — não interfere no GoRango)
# Uso na VPS: chmod +x deploy/setup-vps.sh deploy/update-vps.sh && ./deploy/setup-vps.sh
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}   🎬 NEXTPLAY STREAMING - CONFIGURAÇÃO E DEPLOY EM CONTAINER ISOLADO ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# 1. Verifica se o Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}[1/4] Docker não encontrado. Instalando Docker Engine oficial...${NC}"
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER" || true
    echo -e "${GREEN}✓ Docker instalado com sucesso!${NC}"
else
    echo -e "${GREEN}[1/4] ✓ Docker já está instalado ($(docker --version))${NC}"
fi

# 2. Verifica arquivo .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}[2/4] Arquivo .env não encontrado. Criando a partir de .env.example...${NC}"
    cp .env.example .env
else
    echo -e "${GREEN}[2/4] ✓ Arquivo .env localizado.${NC}"
fi

# 3. Build e Inicialização do Container Isolado NextPlay via Docker Compose
echo -e "${CYAN}[3/4] Compilando imagem de produção e subindo container isolado nextplay-web...${NC}"
docker compose -p nextplay --env-file .env up -d --build

# 4. Verificação de Saúde (Healthcheck)
echo -e "${CYAN}[4/4] Aguardando inicialização do servidor NextPlay...${NC}"
sleep 3

PORT=$(grep -E '^APP_PORT=' .env | cut -d '=' -f2 || echo "8090")
PORT=${PORT:-8090}

# Libera a porta no UFW ou Firewalld/Iptables caso o firewall da VPS esteja ativo
if command -v ufw &> /dev/null; then
    sudo ufw allow "${PORT}/tcp" >/dev/null 2>&1 || true
fi
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port="${PORT}/tcp" >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
fi
iptables -I INPUT -p tcp --dport "${PORT}" -j ACCEPT >/dev/null 2>&1 || true

if curl -fsS "http://127.0.0.1:${PORT}/healthz" > /dev/null 2>&1; then
    echo -e "${GREEN}======================================================================${NC}"
    echo -e "${GREEN}🚀 DEPLOY DO NEXTPLAY CONCLUÍDO COM SUCESSO!${NC}"
    echo -e "${GREEN}• Container:      nextplay-web (isolado dos demais containers)${NC}"
    echo -e "${GREEN}• Player Web:     http://SEU_IP_DA_VPS:${PORT}/${NC}"
    echo -e "${GREEN}• Painel Admin:   http://SEU_IP_DA_VPS:${PORT}/admin${NC}"
    echo -e "${GREEN}• Download APK:   http://SEU_IP_DA_VPS:${PORT}/apk${NC}"
    echo -e "${GREEN}======================================================================${NC}"
else
    echo -e "${YELLOW}⚠️ Container iniciado. Verifique os logs com: docker compose -p nextplay logs -f${NC}"
fi

