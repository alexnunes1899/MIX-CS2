import { escapeHtml, safeJsonForHtml } from './utils/security.js';

export function renderProfileHtml({ query = {} } = {}) {
  const rawPhone = String(query.phone || '').replace(/\D/g, '').slice(0, 20);
  const rawNick = String(query.nick || '').trim().slice(0, 40);
  const rawRoom = String(query.room || '').trim().slice(0, 32);
  const initialPhone = escapeHtml(rawPhone);
  const initialNick = escapeHtml(rawNick);
  const initialRoom = escapeHtml(rawRoom);

  return `<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>CS2 Mix Hub • Definir Perfil & Nível Gamers Club</title>
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
            csgold: '#f59e0b',
            csdark: '#090d16',
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #090d16; color: #f1f5f9; font-family: 'Inter', sans-serif; }
    .font-heading { font-family: 'Chakra Petch', sans-serif; }
    .lvl-btn {
      transition: all 0.15s ease-out;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .lvl-btn:active {
      transform: scale(0.93);
    }
    .lvl-btn.active {
      transform: scale(1.06);
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.5), inset 0 0 10px rgba(245, 158, 11, 0.3);
      border-color: #f59e0b !important;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
      color: #050811 !important;
      font-weight: 900 !important;
    }
  </style>
</head>
<body class="min-h-screen bg-[#090d16] text-slate-100 flex flex-col antialiased">
  <!-- Top Header -->
  <header class="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
    <a href="/" class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-black flex items-center justify-center shadow-md shadow-amber-500/20">
        CS2
      </div>
      <div>
        <span class="font-heading font-black text-base tracking-wide text-white block leading-none">MIX HUB</span>
        <span class="text-[9px] text-amber-400 font-bold uppercase tracking-wider block mt-0.5">Perfil de Jogador</span>
      </div>
    </a>
    <a href="/" class="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition">
      Abrir Hub Web
    </a>
  </header>

  <!-- Main Card -->
  <main class="flex-1 max-w-lg w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
    <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
      <!-- Glow background -->
      <div class="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Card Title -->
      <div class="text-center mb-5">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold mb-2">
          ⭐ Gamers Club • Perfil Permanente
        </div>
        <h1 class="text-xl sm:text-2xl font-black font-heading text-white">Definir Meu Nível GC</h1>
        <p class="text-slate-400 text-xs mt-1">
          Salve seu nível para sempre! Ele será usado no WhatsApp e no Discord para equilibrar os times no sorteio automático.
        </p>
      </div>

      <!-- Current Selected Badge -->
      <div class="mb-5 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div id="badge-icon-box" class="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-black flex items-center justify-center text-xl shadow-lg">
            <span id="badge-number">16</span>
          </div>
          <div>
            <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Nível Selecionado</div>
            <div id="badge-title" class="font-heading font-black text-white text-base leading-tight">Level 16 • Elite GC</div>
            <div id="badge-desc" class="text-xs text-amber-400 font-medium">Capitão / Tier Avançado</div>
          </div>
        </div>
        <div id="badge-status-pill" class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
          Ativo
        </div>
      </div>

      <!-- Level Buttons Grid (1 to 21) -->
      <div class="mb-5">
        <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
          Selecione seu Nível Gamers Club (Toque para Escolher):
        </label>
        
        <!-- Legend -->
        <div class="flex items-center justify-between text-[10px] text-slate-400 mb-2 px-1">
          <span class="text-slate-400">Bronze (1-5)</span>
          <span class="text-cyan-400">Prata (6-10)</span>
          <span class="text-amber-400">Ouro (11-15)</span>
          <span class="text-purple-400">Black (16-19)</span>
          <span class="text-rose-400">Major (20-21)</span>
        </div>

        <div class="grid grid-cols-7 gap-1.5" id="levels-grid">
          <!-- Populated by JS -->
        </div>
      </div>

      <!-- Inputs Form -->
      <form id="profile-form" class="space-y-3.5">
        <div>
          <label class="block text-xs font-bold text-slate-300 mb-1" for="input-nick">
            Seu Nick no CS2 / Nome:
          </label>
          <input
            id="input-nick"
            type="text"
            required
            placeholder="Ex: FalleN, zex, coldzera..."
            value="${initialNick}"
            class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
          />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-300 mb-1" for="input-phone">
            Seu Número de WhatsApp (com DDD):
          </label>
          <input
            id="input-phone"
            type="tel"
            required
            placeholder="Ex: 5534999998888"
            value="${initialPhone}"
            class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
          />
          <span class="text-[10px] text-slate-500 block mt-1">
            Usado para associar com o bot do WhatsApp e marcar você no mix.
          </span>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-300 mb-1" for="input-steam">
            Link da Steam ou ID (Opcional):
          </label>
          <input
            id="input-steam"
            type="text"
            placeholder="steamcommunity.com/id/... ou 7656119..."
            class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
          />
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          id="btn-submit"
          class="w-full py-3 px-4 rounded-xl font-heading font-black text-sm uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-500 active:scale-[0.98] transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 mt-4 cursor-pointer"
        >
          <span id="btn-text">💾 Salvar Meu Perfil CS2</span>
        </button>
      </form>

      <!-- Feedback Area -->
      <div id="feedback-box" class="hidden mt-4 p-3.5 rounded-xl border text-xs font-semibold"></div>

      <!-- Action Footer Links -->
      <div class="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <span>Mix Ativo: <strong class="text-amber-400" id="mix-active-label">${initialRoom || '5v5 Atual'}</strong></span>
        <button type="button" id="btn-back-zap" class="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition">
          💬 Abrir WhatsApp
        </button>
      </div>
    </div>
  </main>

  <script>
    let selectedLevel = 16;
    const initialPhone = ${safeJsonForHtml(rawPhone)};
    const initialRoom = ${safeJsonForHtml(rawRoom)};

    const tiers = {
      bronze: { label: 'Bronze', color: 'border-slate-700 bg-slate-800 text-slate-300', iconBg: 'from-slate-600 to-slate-500' },
      silver: { label: 'Prata', color: 'border-cyan-800 bg-cyan-950/40 text-cyan-300', iconBg: 'from-cyan-500 to-cyan-400' },
      gold: { label: 'Ouro', color: 'border-amber-700 bg-amber-950/40 text-amber-300', iconBg: 'from-amber-500 to-amber-400' },
      black: { label: 'Black / Elite', color: 'border-purple-800 bg-purple-950/40 text-purple-300', iconBg: 'from-purple-600 to-purple-400' },
      major: { label: 'Major / Pro', color: 'border-rose-800 bg-rose-950/40 text-rose-300', iconBg: 'from-rose-600 to-rose-400' },
    };

    function getTier(lvl) {
      if (lvl <= 5) return tiers.bronze;
      if (lvl <= 10) return tiers.silver;
      if (lvl <= 15) return tiers.gold;
      if (lvl <= 19) return tiers.black;
      return tiers.major;
    }

    function renderGrid() {
      const container = document.getElementById('levels-grid');
      container.innerHTML = '';

      for (let i = 1; i <= 21; i++) {
        const tier = getTier(i);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = \`lvl-btn py-2 px-1 rounded-lg border text-xs font-bold text-center \${tier.color} \${i === selectedLevel ? 'active' : ''}\`;
        btn.textContent = i;
        btn.onclick = () => selectLevel(i);
        container.appendChild(btn);
      }
    }

    function selectLevel(lvl) {
      selectedLevel = lvl;
      renderGrid();

      const tier = getTier(lvl);
      document.getElementById('badge-number').textContent = lvl;
      document.getElementById('badge-title').textContent = \`Level \${lvl} • \${tier.label}\`;
      
      let desc = 'Jogador Regular';
      if (lvl >= 20) desc = '🔥 Nível Pro / Major';
      else if (lvl >= 16) desc = '⭐ Capitão / Elite GC';
      else if (lvl >= 11) desc = '🥇 Intermediário / Ouro';
      else if (lvl >= 6) desc = '🥈 Prata Competitivo';
      else desc = '🥉 Iniciante GC';

      document.getElementById('badge-desc').textContent = desc;

      const iconBox = document.getElementById('badge-icon-box');
      iconBox.className = \`w-12 h-12 rounded-xl bg-gradient-to-tr \${tier.iconBg} text-slate-950 font-black flex items-center justify-center text-xl shadow-lg\`;
    }

    // Auto-fetch profile if phone is known
    async function checkExistingProfile(phone) {
      if (!phone) return;
      try {
        const res = await fetch(\`/api/player/profile?phone=\${encodeURIComponent(phone)}\`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.profile) {
            if (data.profile.level) selectLevel(data.profile.level);
            if (data.profile.username && !document.getElementById('input-nick').value) {
              document.getElementById('input-nick').value = data.profile.username;
            }
            if (data.profile.steamId && !document.getElementById('input-steam').value) {
              document.getElementById('input-steam').value = data.profile.steamId;
            }
          }
        }
      } catch (_) {}
    }

    // Form submit
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nick = document.getElementById('input-nick').value.trim();
      const phone = document.getElementById('input-phone').value.replace(/\\D/g, '');
      const steamId = document.getElementById('input-steam').value.trim();
      const btn = document.getElementById('btn-submit');
      const feedback = document.getElementById('feedback-box');

      if (!nick || !phone) {
        showFeedback('Por favor, preencha seu Nick e WhatsApp.', false);
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="animate-spin">⏳</span> Salvando Perfil...';

      try {
        const res = await fetch('/api/player/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            name: nick,
            username: nick,
            level: selectedLevel,
            steamId,
            room: initialRoom
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showFeedback(\`✅ <strong>Perfil Salvo com Sucesso!</strong><br>Seu Nível <strong>\${selectedLevel} da Gamers Club</strong> está salvo para sempre e já foi sincronizado com o WhatsApp e Discord!\`, true);
          btn.innerHTML = '✅ Salvo com Sucesso!';
          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '💾 Atualizar Perfil';
          }, 3000);
        } else {
          showFeedback(data.error || 'Erro ao salvar perfil.', false);
          btn.disabled = false;
          btn.innerHTML = '💾 Salvar Meu Perfil CS2';
        }
      } catch (err) {
        showFeedback('Erro de conexão ao salvar perfil.', false);
        btn.disabled = false;
        btn.innerHTML = '💾 Salvar Meu Perfil CS2';
      }
    });

    function showFeedback(html, isSuccess) {
      const box = document.getElementById('feedback-box');
      box.className = \`mt-4 p-3.5 rounded-xl border text-xs font-semibold \${
        isSuccess 
          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
          : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
      }\`;
      box.innerHTML = html;
      box.classList.remove('hidden');
    }

    document.getElementById('btn-back-zap').addEventListener('click', () => {
      window.location.href = 'whatsapp://';
    });

    // Init
    selectLevel(16);
    if (initialPhone) {
      checkExistingProfile(initialPhone);
    }
  </script>
</body>
</html>`;
}
