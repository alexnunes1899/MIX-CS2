export function renderWhatsAppAdminHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CS2 Mix Hub • Integração WhatsApp</title>
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            heading: ['Chakra Petch', 'sans-serif'],
          },
          colors: {
            csgreen: '#22c55e',
            csdark: '#090d16',
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #090d16; color: #f1f5f9; font-family: 'Inter', sans-serif; }
    .font-heading { font-family: 'Chakra Petch', sans-serif; }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
  </style>
</head>
<body class="min-h-screen bg-[#090d16] text-slate-100 flex flex-col antialiased">
  <!-- Top Navbar -->
  <header class="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <a href="/" class="flex items-center gap-2.5 group">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-black flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
          CS2
        </div>
        <div>
          <span class="font-heading font-black text-lg tracking-wide text-white block leading-none">MIX HUB</span>
          <span class="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mt-0.5">WhatsApp Integration</span>
        </div>
      </a>
    </div>

    <div class="flex items-center gap-3">
      <span id="nav-badge" class="px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-slate-900 border-slate-700 text-slate-400">
        <span class="w-2 h-2 rounded-full bg-slate-500"></span>
        <span id="nav-badge-text">Carregando...</span>
      </span>
      <a href="/" class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition">
        ← Voltar ao Hub
      </a>
    </div>
  </header>

  <!-- Main Container -->
  <main class="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
    
    <!-- Hero / Title -->
    <div class="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
      <div class="absolute -right-8 -top-8 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-3">
            <svg class="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.97.545 1.777.838 2.795.839 3.18 0 5.767-2.586 5.768-5.766.001-3.18-2.585-5.766-5.767-5.766zm9.969 5.828c0 5.523-4.477 10-10 10-1.748 0-3.385-.45-4.819-1.238l-7.181 1.882 1.916-6.994c-.879-1.487-1.396-3.218-1.396-5.069 0-5.523 4.477-10 10-10s10 4.477 10 10z"/></svg>
            Notificador Automático de Mixes
          </div>
          <h1 class="text-2xl sm:text-3xl font-black font-heading text-white">Bot do WhatsApp para Grupos</h1>
          <p class="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-xl">
            Conecte o bot do CS2 Mix Hub ao WhatsApp para avisar automaticamente no grupo quando um novo mix for aberto, quando faltarem 1 ou 2 vagas, e mandar o placar e MVP das partidas finalizadas!
          </p>
        </div>

        <div id="btn-reconnect-wrap" class="shrink-0 hidden">
          <button onclick="reconnectBot()" class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition flex items-center gap-2">
            <svg class="w-4 h-4 animate-spin-hover" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Reconectar
          </button>
        </div>
      </div>
    </div>

    <!-- Alert Banner (Dynamic) -->
    <div id="alert-box" class="hidden rounded-2xl p-4 text-xs font-semibold border transition-all"></div>

    <!-- SECTION 1: CONNECTION STATE -->
    <div id="card-connection" class="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
      
      <!-- Loading State -->
      <div id="state-loading" class="py-12 text-center space-y-3">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Verificando status do WhatsApp...</p>
      </div>

      <!-- QR Code State -->
      <div id="state-qrcode" class="hidden space-y-6">
        <div class="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              Aguardando Leitura do QR Code
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">Abra seu WhatsApp no celular e escaneie a imagem abaixo para autenticar o bot.</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="switchTab('qr')" id="tab-qr" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              Via QR Code
            </button>
            <button onclick="switchTab('code')" id="tab-code" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:text-white">
              Via Código de Telefone
            </button>
          </div>
        </div>

        <!-- View Tab: QR Code -->
        <div id="view-qr" class="grid sm:grid-cols-2 gap-6 items-center">
          <div class="flex flex-col items-center justify-center p-6 bg-slate-950 border border-slate-800 rounded-2xl relative shadow-inner">
            <div id="qr-container" class="bg-white p-3 rounded-2xl shadow-xl flex items-center justify-center min-w-[220px] min-h-[220px]">
              <img id="qr-image" src="" alt="WhatsApp QR Code" class="w-56 h-56 object-contain rounded-lg" />
            </div>
            <p class="text-[11px] text-slate-400 mt-3 text-center">O código é atualizado automaticamente a cada 20 segundos.</p>
          </div>

          <div class="space-y-4">
            <h3 class="text-sm font-bold text-slate-200">Como conectar no seu celular:</h3>
            <ol class="space-y-3 text-xs text-slate-300">
              <li class="flex items-start gap-2.5">
                <span class="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                <span>Abra o <strong>WhatsApp</strong> no seu smartphone.</span>
              </li>
              <li class="flex items-start gap-2.5">
                <span class="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                <span>Toque em <strong>Mais opções</strong> (três pontos no Android) ou em <strong>Configurações</strong> (no iPhone).</span>
              </li>
              <li class="flex items-start gap-2.5">
                <span class="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                <span>Toque em <strong>Aparelhos conectados</strong> e depois em <strong>Conectar um aparelho</strong>.</span>
              </li>
              <li class="flex items-start gap-2.5">
                <span class="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">4</span>
                <span>Aponte a câmera para o QR Code ao lado. A conexão será feita na hora!</span>
              </li>
            </ol>
            <div class="pt-2">
              <span class="inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                💡 Dica: Você pode usar seu próprio número ou um chip secundário exclusivo para o bot.
              </span>
            </div>
          </div>
        </div>

        <!-- View Tab: Pairing Code by Phone -->
        <div id="view-code" class="hidden space-y-4 max-w-lg mx-auto py-4">
          <div class="text-center space-y-1">
            <h3 class="text-sm font-bold text-slate-100">Conectar via Código de 8 Dígitos</h3>
            <p class="text-xs text-slate-400">Insira seu número com DDD (ex: 5511999998888) para receber o código na notificação do WhatsApp.</p>
          </div>

          <div class="space-y-3">
            <div class="flex gap-2">
              <input id="input-phone" type="tel" placeholder="5511999998888" class="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500" />
              <button onclick="requestPairCode()" id="btn-pair" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white transition shadow-lg shadow-emerald-600/20">
                Gerar Código
              </button>
            </div>
            
            <div id="pair-result" class="hidden p-4 rounded-xl bg-slate-950 border border-emerald-500/30 text-center space-y-2">
              <p class="text-xs text-slate-300">Digite este código de 8 dígitos no seu celular:</p>
              <div id="pair-code-display" class="font-heading font-black text-2xl tracking-widest text-emerald-400 bg-emerald-500/10 py-2 rounded-lg border border-emerald-500/30">
                ----
              </div>
              <p class="text-[11px] text-slate-500">Acesse Aparelhos conectados > Conectar com número de telefone</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Connected State -->
      <div id="state-connected" class="hidden space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xl border border-emerald-500/40 shrink-0">
              ✓
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 id="connected-name" class="font-bold text-base text-white">CS2 Mix Hub Bot</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-slate-950">ONLINE</span>
              </div>
              <p id="connected-phone" class="text-xs text-slate-400 mt-0.5">+55 ...</p>
            </div>
          </div>

          <button onclick="logoutBot()" class="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition">
            Desconectar WhatsApp
          </button>
        </div>

        <!-- Group Selector & Notification Preferences -->
        <div class="space-y-4 pt-2">
          <h3 class="font-bold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span>Configuração do Grupo de Destino</span>
          </h3>

          <div class="space-y-3">
            <label class="block text-xs font-semibold text-slate-300">
              Selecione o Grupo do WhatsApp onde o bot deve postar os avisos:
            </label>
            <div class="flex flex-col sm:flex-row gap-2">
              <select id="group-select" class="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500">
                <option value="">Carregando grupos do WhatsApp...</option>
              </select>
              <button onclick="saveGroupConfig()" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition shrink-0">
                Salvar Grupo
              </button>
            </div>
            <p class="text-[11px] text-slate-400">
              ⚠️ <strong>Importante:</strong> Para o grupo aparecer nesta lista, o número conectado do bot precisa ter sido adicionado no grupo do WhatsApp!
            </p>
          </div>

          <!-- Notification Toggles -->
          <div class="pt-4 border-t border-slate-800 space-y-3">
            <label class="block text-xs font-semibold text-slate-300">Quais notificações enviar no grupo:</label>
            <div class="grid sm:grid-cols-2 gap-3">
              <label class="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input id="chk-create" type="checkbox" checked class="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500" />
                <span class="text-xs text-slate-200">🔥 Novo Mix Aberto (com link)</span>
              </label>

              <label class="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input id="chk-slots" type="checkbox" checked class="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500" />
                <span class="text-xs text-slate-200">🚨 Faltam Vagas (8/10 e 9/10)</span>
              </label>

              <label class="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input id="chk-ready" type="checkbox" checked class="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500" />
                <span class="text-xs text-slate-200">⚔️ Partida Pronta (Times, Mapa e IP)</span>
              </label>

              <label class="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input id="chk-result" type="checkbox" checked class="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500" />
                <span class="text-xs text-slate-200">🏆 Fim de Jogo (Placar Oficial e MVP)</span>
              </label>
            </div>
          </div>

          <!-- Test Message Action -->
          <div class="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
            <span class="text-xs text-slate-400">Quer verificar se o bot está conseguindo postar no grupo?</span>
            <button onclick="sendTestMessage()" id="btn-test" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-2">
              <span>🚀 Enviar Mensagem de Teste no Grupo</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- FAQ / Instructions Box -->
    <div class="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
      <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
        <span>Perguntas Frequentes & Dicas</span>
      </h4>
      <div class="grid sm:grid-cols-2 gap-4 text-xs text-slate-400">
        <div>
          <strong class="text-slate-200 block mb-1">Como coloco o bot no grupo?</strong>
          Basta abrir o grupo de CS2 no WhatsApp, ir em dados do grupo, clicar em "Adicionar participantes" e selecionar o número de telefone que você conectou nesta tela.
        </div>
        <div>
          <strong class="text-slate-200 block mb-1">O bot responde comandos no grupo?</strong>
          Sim! Qualquer jogador no grupo pode digitar <code>!mix</code> ou <code>!mix status</code> para receber o link do lobby e ver o status do sistema.
        </div>
      </div>
    </div>
  </main>

  <script>
    let currentStatus = null;
    let pollInterval = null;

    function showAlert(msg, isSuccess = true) {
      const box = document.getElementById('alert-box');
      box.classList.remove('hidden', 'bg-emerald-500/10', 'border-emerald-500/30', 'text-emerald-300', 'bg-rose-500/10', 'border-rose-500/30', 'text-rose-300');
      if (isSuccess) {
        box.classList.add('bg-emerald-500/10', 'border-emerald-500/30', 'text-emerald-300');
      } else {
        box.classList.add('bg-rose-500/10', 'border-rose-500/30', 'text-rose-300');
      }
      box.innerHTML = msg;
      setTimeout(() => box.classList.add('hidden'), 5000);
    }

    function switchTab(tab) {
      const viewQr = document.getElementById('view-qr');
      const viewCode = document.getElementById('view-code');
      const tabQr = document.getElementById('tab-qr');
      const tabCode = document.getElementById('tab-code');

      if (tab === 'qr') {
        viewQr.classList.remove('hidden');
        viewCode.classList.add('hidden');
        tabQr.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
        tabCode.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:text-white';
      } else {
        viewQr.classList.add('hidden');
        viewCode.classList.remove('hidden');
        tabCode.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
        tabQr.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:text-white';
      }
    }

    async function fetchStatus() {
      try {
        const res = await fetch('/api/whatsapp/status');
        if (!res.ok) return;
        const data = await res.json();
        currentStatus = data;
        renderState(data);
      } catch (e) {
        console.warn('Erro ao consultar status:', e);
      }
    }

    function renderState(data) {
      const navBadge = document.getElementById('nav-badge');
      const navText = document.getElementById('nav-badge-text');
      const stateLoading = document.getElementById('state-loading');
      const stateQr = document.getElementById('state-qrcode');
      const stateConnected = document.getElementById('state-connected');
      const btnReconnectWrap = document.getElementById('btn-reconnect-wrap');

      stateLoading.classList.add('hidden');

      if (data.status === 'connected') {
        navBadge.className = 'px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-emerald-950/60 border-emerald-500/40 text-emerald-400';
        navText.textContent = 'Conectado';
        btnReconnectWrap.classList.add('hidden');

        stateQr.classList.add('hidden');
        stateConnected.classList.remove('hidden');

        document.getElementById('connected-name').textContent = data.user?.name || 'CS2 Mix Hub Bot';
        document.getElementById('connected-phone').textContent = data.user?.phone ? ('+' + data.user.phone) : 'Número Ativo';

        // Set checkbox values from config
        if (data.config) {
          document.getElementById('chk-create').checked = Boolean(data.config.notifyOnCreate);
          document.getElementById('chk-slots').checked = Boolean(data.config.notifyOnMissingSlots);
          document.getElementById('chk-ready').checked = Boolean(data.config.notifyOnReady);
          document.getElementById('chk-result').checked = Boolean(data.config.notifyOnResult);
        }

        // Fetch groups if not populated yet
        fetchGroups(data.config?.targetGroupId);

      } else if (data.status === 'qrcode' || data.status === 'connecting' || data.qrCode) {
        navBadge.className = 'px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-amber-950/60 border-amber-500/40 text-amber-400';
        navText.textContent = 'Aguardando QR Code';
        btnReconnectWrap.classList.add('hidden');

        stateConnected.classList.add('hidden');
        stateQr.classList.remove('hidden');

        if (data.qrCode) {
          document.getElementById('qr-image').src = data.qrCode;
        }
      } else {
        navBadge.className = 'px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-rose-950/60 border-rose-500/40 text-rose-400';
        navText.textContent = 'Desconectado';
        btnReconnectWrap.classList.remove('hidden');

        stateConnected.classList.add('hidden');
        stateQr.classList.remove('hidden');
      }
    }

    async function fetchGroups(selectedId = '') {
      try {
        const res = await fetch('/api/whatsapp/groups');
        if (!res.ok) return;
        const resData = await res.json();
        const groups = Array.isArray(resData) ? resData : (resData?.groups || []);
        const select = document.getElementById('group-select');
        select.innerHTML = '';

        if (!Array.isArray(groups) || groups.length === 0) {
          select.innerHTML = '<option value="">Nenhum grupo encontrado (adicione o bot em um grupo primeiro)</option>';
          return;
        }

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- Selecione o Grupo do Mix CS2 --';
        select.appendChild(placeholder);

        groups.forEach((g) => {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = \`\${g.subject} (\${g.size} membros)\`;
          if (selectedId && (g.id === selectedId || g.id.includes(selectedId))) {
            opt.selected = true;
          }
          select.appendChild(opt);
        });
      } catch (e) {
        console.warn('Erro ao carregar lista de grupos:', e);
      }
    }

    async function requestPairCode() {
      const phoneInput = document.getElementById('input-phone');
      const phone = phoneInput.value.trim();
      if (!phone) {
        showAlert('Digite o número do WhatsApp com DDD.', false);
        return;
      }
      const btn = document.getElementById('btn-pair');
      btn.disabled = true;
      btn.textContent = 'Gerando...';

      try {
        const res = await fetch('/api/whatsapp/pair-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phone }),
        });
        const data = await res.json();
        if (data.success && data.code) {
          document.getElementById('pair-result').classList.remove('hidden');
          document.getElementById('pair-code-display').textContent = data.code;
          showAlert('Código gerado! Digite-o no WhatsApp do seu celular.', true);
        } else {
          showAlert(data.error || 'Falha ao gerar código.', false);
        }
      } catch (e) {
        showAlert('Erro de comunicação com o servidor.', false);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Gerar Código';
      }
    }

    async function saveGroupConfig() {
      const select = document.getElementById('group-select');
      const targetGroupId = select.value;
      const targetGroupName = select.options[select.selectedIndex]?.text || '';

      const notifyOnCreate = document.getElementById('chk-create').checked;
      const notifyOnMissingSlots = document.getElementById('chk-slots').checked;
      const notifyOnReady = document.getElementById('chk-ready').checked;
      const notifyOnResult = document.getElementById('chk-result').checked;

      try {
        const res = await fetch('/api/whatsapp/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetGroupId,
            targetGroupName,
            notifyOnCreate,
            notifyOnMissingSlots,
            notifyOnReady,
            notifyOnResult,
          }),
        });
        if (res.ok) {
          showAlert('✅ Configuração salva com sucesso! O bot notificará este grupo.', true);
        } else {
          showAlert('Erro ao salvar configuração.', false);
        }
      } catch (e) {
        showAlert('Erro ao salvar.', false);
      }
    }

    async function sendTestMessage() {
      const btn = document.getElementById('btn-test');
      btn.disabled = true;
      btn.innerHTML = 'Enviando...';

      try {
        const res = await fetch('/api/whatsapp/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data.success) {
          showAlert('🚀 Mensagem de teste enviada com sucesso no grupo do WhatsApp!', true);
        } else {
          showAlert('⚠️ ' + (data.error || 'Falha ao enviar mensagem de teste.'), false);
        }
      } catch (e) {
        showAlert('Erro ao enviar mensagem de teste.', false);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🚀 Enviar Mensagem de Teste no Grupo</span>';
      }
    }

    async function reconnectBot() {
      try {
        await fetch('/api/whatsapp/connect', { method: 'POST' });
        showAlert('Iniciando reconexão...', true);
        fetchStatus();
      } catch (_) {}
    }

    async function logoutBot() {
      if (!confirm('Deseja realmente desconectar o WhatsApp do bot?')) return;
      try {
        await fetch('/api/whatsapp/logout', { method: 'POST' });
        showAlert('WhatsApp desconectado com sucesso.', true);
        fetchStatus();
      } catch (_) {}
    }

    // Start auto polling
    fetchStatus();
    pollInterval = setInterval(fetchStatus, 3000);
  </script>
</body>
</html>`;
}
