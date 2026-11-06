@echo off
title CS2 Mix Hub - Criador de Copia de Backup
color 0a

echo ======================================================================
echo           CS2 MIX HUB - CRIANDO COPIA DE BACKUP NO COMPUTADOR
echo ======================================================================
echo.

set ORIGEM=C:\Users\alexn\.gemini\antigravity\scratch\cs2-mix-hub
set DESTINO=C:\Users\alexn\Desktop\CS2-MIX-HUB-BACKUP

echo   Origem:  %ORIGEM%
echo   Destino: %DESTINO%
echo.
echo   Copiando arquivos essenciais (codigo fonte, servidor, configuracoes)...
echo.

if not exist "%DESTINO%" mkdir "%DESTINO%"

xcopy "%ORIGEM%\src" "%DESTINO%\src" /E /I /Y /Q >nul
xcopy "%ORIGEM%\server" "%DESTINO%\server" /E /I /Y /Q >nul
xcopy "%ORIGEM%\public" "%DESTINO%\public" /E /I /Y /Q >nul
xcopy "%ORIGEM%\dist" "%DESTINO%\dist" /E /I /Y /Q >nul
copy /Y "%ORIGEM%\package.json" "%DESTINO%\" >nul
copy /Y "%ORIGEM%\vite.config.js" "%DESTINO%\" >nul
copy /Y "%ORIGEM%\index.html" "%DESTINO%\" >nul
copy /Y "%ORIGEM%\railway.json" "%DESTINO%\" >nul
copy /Y "%ORIGEM%\nixpacks.toml" "%DESTINO%\" >nul
copy /Y "%ORIGEM%\INICIAR-SERVIDOR-BACKUP.bat" "%DESTINO%\" >nul
copy /Y "%ORIGEM%\push-to-github.bat" "%DESTINO%\" >nul

echo ======================================================================
echo   [SUCESSO] Backup completo criado na sua Area de Trabalho!
echo   Pasta: C:\Users\alexn\Desktop\CS2-MIX-HUB-BACKUP
echo ======================================================================
echo.
pause
