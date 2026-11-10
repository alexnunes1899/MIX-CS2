@echo off
title CS2 Mix Hub - Host no seu Computador (100%% Gratuito)
color 0a

echo ==============================================================================
echo              CS2 MIX HUB - INICIANDO HOST NO SEU COMPUTADOR
echo ==============================================================================
echo.
echo   [+] Discord Bot, WhatsApp Bot, GSI Valve e Sistema de Mixes
echo   [+] 100%% Gratuito, sem pagar mensalidades de nuvem
echo   [+] 0ms de latencia para o host e conexao ultra-rapida
echo.

set PATH=%PATH%;C:\Program Files\nodejs;C:\Users\alexn\AppData\Local\MinGit\cmd
cd /d "C:\Users\alexn\.gemini\antigravity\scratch\cs2-mix-hub"

echo ------------------------------------------------------------------------------
echo   ENDERECOS PARA ACESSO:
echo.
echo   [1] No seu proprio computador (Host):
echo       http://localhost:3000
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set LOCAL_IP=%%a
    goto :show_local_ip
)
:show_local_ip
set LOCAL_IP=%LOCAL_IP: =%
echo   [2] Para computadores e celulares no mesmo Wi-Fi/Cabo:
echo       http://%LOCAL_IP%:3000
echo.

for /f "tokens=2 delims=:" %%b in ('ipconfig ^| findstr /i "26."') do (
    set RADMIN_IP=%%b
    goto :show_radmin
)
goto :skip_radmin

:show_radmin
set RADMIN_IP=%RADMIN_IP: =%
echo   [3] Para amigos conectados pelo Radmin VPN:
echo       http://%RADMIN_IP%:3000
echo.

:skip_radmin
echo ------------------------------------------------------------------------------
echo   Abrindo o painel no seu navegador...
echo.

start "" "http://localhost:3000"

node server/index.js

pause
