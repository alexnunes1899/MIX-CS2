@echo off
echo ========================================================
echo   Enviando arquivos e pastas (src, server) para o GitHub...
echo ========================================================
echo.

set PATH=%PATH%;C:\Users\alexn\AppData\Local\MinGit\cmd
cd /d "C:\Users\alexn\.gemini\antigravity\scratch\cs2-mix-hub"

git push -u origin main --force

echo.
if %ERRORLEVEL% equ 0 (
    echo ========================================================
    echo   [SUCESSO] Todos os arquivos foram enviados para o GitHub!
    echo   O Render vai atualizar e compilar o site sozinho agora.
    echo ========================================================
) else (
    echo [ERRO] Ocorreu uma falha ao enviar. Verifique o login acima.
)
pause
