# 🎮 CS2 Mix Hub — Sorteador Gamers Club / FACEIT & Pick/Ban em Tempo Real

Aplicação web full-stack para organizar partidas de **Mix de Counter-Strike 2 (CS2)** 5v5 em tempo real via WebSockets (`Socket.IO`), com balanceamento inteligente por **Gamers Club (1–21)** ou **FACEIT (1–10)**, **Pick & Ban Oficial (MD1 / MD3 / MD5)**, **Draft de Capitães**, integração **Steam OpenID**, **CS2 GSI**, **RCON**, **MatchZy** e **Bot / Webhook do Discord**.

---

## ✨ Principais Recursos

1. **Salas Públicas, Privadas e Protegidas por Senha:**
   - Hub ao vivo com listagem em tempo real (`rooms_list`) na Landing Page e no modal de salas.
   - Salas privadas com link de convite por token (`?room=...&key=...`), preservado automaticamente através do login Steam (`cs2_pending_invite`).
   - Proteção opcional por senha com hashing `scrypt` timing-safe no servidor.

2. **Entrada com Steam OpenID, Sessão Assinada e Roles:**
   - Cookie de sessão `HttpOnly` assinado via HMAC-SHA256 (`mixhub_session`), verificado em endpoints HTTP (`/api/auth/me`, `/api/auth/logout`) e handshakes Socket.IO.
   - Sincronização automática de horas no CS2 e nível/ELO da FACEIT.
   - Controles administrativos reais (permissão de criador/admin da sala para Ready Check, timer de turno, RCON, kick, limpeza e configuração de bot Discord).

3. **Balanceamento, Draft & Fluxo Pré-Jogo Cronometrado:**
   - Algoritmo unificado em `shared/balance.js` (exato até 16 jogadores + fallback greedy acima de 16).
   - **Ready Check com Countdown (30s):** confirmação rápida ou expulsão automática/manual de jogadores AFK.
   - **Draft de Capitães 1v1** e **Pick & Ban Oficial (`MD1`, `MD3`, `MD5`)** baseados em `shared/proVeto.js`, com **Timer Automático por Turno** (`Off`, `20s`, `30s`, `45s`).
   - Pool padrão Active Duty (`src/data/maps.js`): **Mirage** (`de_mirage`), **Inferno** (`de_inferno`), **Nuke** (`de_nuke`), **Dust II** (`de_dust2`), **Ancient** (`de_ancient`), **Anubis** (`de_anubis`) e **Cache** (`de_cache`) + sincronização ao vivo em `/api/maps/sync-rotation`.

4. **Pós-Jogo, Reputação e Servidores Dedicados:**
   - **Comendações Persistentes:** elogios pós-jogo (`👍 Parceiro`, `👑 Liderança`, `🎯 Mira`, `🎙️ Comms`) salvos em `commendationsStore.json` e refletidos em tempo real.
   - **GSI Isolado por Sala (`/api/gsi/:roomId` e `/api/gsi`):** telemetria CS2 ao vivo por sala sem vazamento entre partidas simultâneas.
   - **MatchZy & RCON:** geração de config MatchZy, webhook protegido por segredo (`MATCHZY_WEBHOOK_SECRET`) e troca de mapa / comandos RCON autenticados.
   - **Backup & Restore Admin (`/api/admin/backup` e `/api/admin/restore`):** exportação e restauração atômica de todos os arquivos JSON do `DATA_DIR`.

---

## 🔒 Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | Não (`3000`) | Porta HTTP/WebSocket do servidor |
| `DATA_DIR` | Recomendada | Diretório persistente (ex.: `/var/data` no Render Disk) para stores JSON e `.session-secret` |
| `SESSION_SECRET` | Recomendada | Segredo HMAC-SHA256 dos cookies `HttpOnly` (se omitido, gera e persiste em `DATA_DIR/.session-secret`) |
| `ADMIN_API_KEY` | Recomendada | Chave administrativa aceita via header `x-admin-key` ou `Authorization: Bearer` |
| `ADMIN_STEAM_IDS` | Opcional | Lista separada por vírgula de SteamIDs64 autorizados como administradores globais |
| `MATCHZY_WEBHOOK_SECRET` | Recomendada | Segredo exigido no webhook MatchZy (`x-matchzy-secret` / header Bearer / `?secret=`) |
| `ALLOWED_ORIGINS` | Opcional | Origens CORS extras separadas por vírgula além de localhost e `mix-cs2.onrender.com` |
| `STEAM_API_KEY` | Opcional | Chave da Steam Web API para avatar, horas de CS2 e inventário |
| `FACEIT_API_KEY` | Opcional | Chave server-side da FACEIT Data API v4 |
| `DISCORD_TOKEN` / `DISCORD_CLIENT_ID` / `DISCORD_GUILD_ID` / `DISCORD_CHANNEL_ID` | Opcional | Credenciais e canais padrão do Bot Discord |
| `DISCORD_LOBBY_VOICE` / `DISCORD_TEAMA_VOICE` / `DISCORD_TEAMB_VOICE` | Opcional | IDs dos canais de voz para o Voice Mover do Bot Discord |
| `DEFAULT_SERVER_CONNECT` | Opcional | IP:Porta padrão exibido como sugestão nas mensagens do bot Discord |
| `SERVER_PUBLIC_URL` | Opcional | URL pública HTTPS usada em links de retorno Steam, OG tags e scripts GSI |

> **Modo local sem variáveis admin:** quando `ADMIN_API_KEY` e `ADMIN_STEAM_IDS` não estão configurados em ambiente local (`!RENDER && !RAILWAY_ENVIRONMENT`), requisições diretas de loopback (`127.0.0.1` / `::1`) recebem acesso local conveniente.

---

## 🚀 Scripts e Comandos

```bash
# Instalar dependências
npm install

# Desenvolvimento full-stack (Backend Express + Vite HMR)
npm run dev

# Executar suíte automatizada de testes (unit + integração HTTP/Socket)
npm test

# Build de produção do frontend (dist/) com Code-Splitting + React.lazy
npm run build

# Verificação completa (testes + build)
npm run check

# Iniciar servidor em produção (serve dist/ + Socket.IO)
npm start
```
