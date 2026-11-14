# CS2 Mix Hub — Instruções do Repositório

## Verificação e Build
- Sempre execute `npm run check` (`node --check server/index.js && npm test`) após alterar código do servidor ou utilitários.
- Se modificar arquivos de frontend (`src/`, `index.html`, `vite.config.js`), execute também `npm run build` (`vite build`).
- Testes devem usar um `DATA_DIR` temporário (via `os.tmpdir()`) para não poluir `server/data/`.

## Fluxo Padrão de Git (Preferência do Dono do Projeto)
- **Por padrão, ao concluir uma tarefa com código verificado e aprovado nos testes, faça o commit das alterações e envie para o GitHub (`git push origin main`)** — a menos que o usuário peça explicitamente para não subir ou manter apenas local.
- Nunca altere `git config user.name` ou `git config user.email`.
- Nunca faça commit de segredos ou snapshots locais de runtime em `server/data/` (como `.env`, `leaderboard.json`, `discordBotConfig.json`, `activeMixStore.json` modificado por testes locais, ou arquivos `.db`).
