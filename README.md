# 🎮 CS2 Mix Hub - Sorteador Gamers Club & Pick/Ban em Tempo Real

Aplicação web completa para organizar partidas de **Mix de Counter-Strike 2 (CS2)** com os amigos, contando com **balanceamento inteligente baseado no nível da Gamers Club (1 a 21)** e **sistema oficial de Pick & Ban (Veto de Mapas)** em tempo real via WebSockets.

---

## ✨ Funcionalidades

1. **Salas Privadas e Compartilháveis:**
   - Criação de salas instantâneas com código (ex: `MIX-PRO`, `MIX-7821`).
   - Link de convite com 1 clique para mandar no Discord/WhatsApp.
   - Sincronização em tempo real (qualquer mudança atualiza instantaneamente para todos na sala sem F5).

2. **Entrada de Jogadores & Nível Gamers Club:**
   - Nickname do jogador e escolha de ícone/avatar.
   - **Nível Gamers Club (1 a 21)** com preview visual das patentes/badges oficiais (Bronze, Prata, Ouro, Platina, Diamante, Desafiante e Pro/Lenda).
   - Preferência de lado: **CT** (Defesa), **TR** (Ataque) ou **Flex / Tanto Faz**.

3. **Sorteio & Balanceamento dos Times:**
   - **Balanceamento Inteligente (Algoritmo de Otimização):** Calcula a partição exata de 5v5 que minimiza a diferença de soma de níveis entre os times (ex: diferença de apenas 1 level = 99% equilibrado), respeitando as preferências de lado sempre que possível.
   - **Sorteio Aleatório:** Opção para embaralhar os times puramente pela sorte.
   - **Métricas:** Mostra média de GC, soma de pontos de cada time e percentual de equilíbrio.
   - **Inverter Lados:** Inverte Time A e Time B com 1 clique.

4. **Pick & Ban (Veto de Mapas) Oficial:**
   - Pool oficial de mapas do CS2 (Active Duty):
     - **Mirage** (`de_mirage`)
     - **Inferno** (`de_inferno`)
     - **Nuke** (`de_nuke`)
     - **Dust II** (`de_dust2`)
     - **Ancient** (`de_ancient`)
     - **Anubis** (`de_anubis`)
     - **Vertigo** (`de_vertigo`)
   - Alternância de turnos: Time A bane ➔ Time B bane ➔ Time A bane ...
   - Carimbo animado de **BANIDO** com efeito sonoro (Web Audio API nativo).
   - **Mapa Decisivo (Decider):** Revelação com chuva de confetes e celebração!
   - **Escolha de Lado Inicial:** O time adversário escolhe se começa de CT ou TR no mapa decisivo.

5. **Exportação & Utilidades:**
   - **Copiar Escalação:** Gera mensagem formatada pronta com emojis para colar no Discord ou WhatsApp.
   - **Comando RCON:** Comando rápido (`changelevel de_mirage; mp_warmup_end 1;`) para colar no console do CS2 ou servidor dedicado.
   - **⚡ Teste com 10 Bots:** Botão no lobby para adicionar 10 jogadores lendários brasileiros (FalleN, coldzera, fer, fnx, TACO, kNg, felps, boltz, yel, bit) e testar todo o fluxo imediatamente sem precisar esperar 10 pessoas entrarem.

---

## 🚀 Como Executar

### 1. Iniciar o Servidor
Abra o terminal na pasta do projeto e execute:

```bash
npm start
```
O servidor iniciará em **`http://localhost:3000`**.

### 2. Modo de Desenvolvimento (Hot Reload)
Se quiser editar o código com recarregamento automático do Vite:

```bash
npm run dev
```

---

## 🌐 Como Jogar com os Amigos na Internet

Para jogar com amigos fora da sua rede local sem precisar pagar hospedagem:

### Opção A: Usando o Ngrok ou Localtunnel (Mais rápido para hoje)
Com o servidor rodando (`npm start`), abra outro terminal e execute:
```bash
npx localtunnel --port 3000
```
Ele vai gerar um link público (ex: `https://cs2-mix-xyz.loca.lt`) que você pode mandar para seus amigos no WhatsApp/Discord.

### Opção B: Deploy Gratuito no Render ou Railway
1. Suba esta pasta para um repositório no seu GitHub.
2. Crie uma conta no [Render.com](https://render.com) ou [Railway.app](https://railway.app).
3. Conecte o repositório e configure:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
4. Pronto! O site ficará online 24/7 com link HTTPS público para todos os amigos.
