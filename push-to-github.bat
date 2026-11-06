@echo off
chcp 65001 >nul
echo ========================================================
echo   Compilando e Enviando CS2 Mix Hub para o GitHub...
echo ========================================================
echo.

set PATH=%PATH%;C:\Users\alexn\AppData\Local\MinGit\cmd;C:\Program Files\nodejs
cd /d "C:\Users\alexn\.gemini\antigravity\scratch\cs2-mix-hub"

echo [1/3] Compilando frontend (npm run build)...
call npm run build

if %ERRORLEVEL% neq 0 (
    echo [AVISO] Build falhou ou usou versoes pre-compiladas em dist. Continuando...
)

echo [2/3] Adicionando arquivos modificados...
git add -A

echo [3/3] Criando commit e enviando para o GitHub (main)...
git commit -m "update: sincronizar alteracoes com GitHub" 2>nul
git push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo ========================================================
    echo   [SUCESSO] Todos os arquivos foram enviados para o GitHub!
    echo   Acesse railway.app para acompanhar o deploy.
    echo ========================================================
) else (
    echo [ERRO] Ocorreu uma falha ao enviar. Verifique sua conexao ou login.
)
pause
