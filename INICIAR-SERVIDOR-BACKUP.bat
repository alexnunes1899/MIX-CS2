@echo off
title CS2 Mix Hub - Servidor Local de Backup
color 0b

echo ======================================================================
echo           CS2 MIX HUB - SERVIDOR DE BACKUP NO SEU COMPUTADOR
echo ======================================================================
echo.
echo   Iniciando o servidor local no seu PC...
echo.

set PATH=%PATH%;C:\Program Files\nodejs;C:\Users\alexn\AppData\Local\MinGit\cmd
cd /d "C:\Users\alexn\.gemini\antigravity\scratch\cs2-mix-hub"

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set LOCAL_IP=%%a
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP: =%

echo ======================================================================
echo   [OK] O site de backup esta ativo e pronto para uso!
echo.
echo   -> No seu PC (Navegador):    http://localhost:3000
echo   -> Outros PCs na mesma rede: http://%LOCAL_IP%:3000
echo.
echo   Caso o servidor online da Railway caia, o site ira alternar
echo   automaticamente para ca!
echo ======================================================================
echo.

start "" "http://localhost:3000"

node server/index.js

pause
