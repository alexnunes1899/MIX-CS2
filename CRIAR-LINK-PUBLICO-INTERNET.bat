@echo off
title CS2 Mix Hub - Gerador de Link Publico (Localtunnel)
color 0b

echo ==============================================================================
echo             CS2 MIX HUB - COMPARTILHAR SITE PELA INTERNET (GRATIS)
echo ==============================================================================
echo.
echo   Este utilitario cria um link de internet HTTPS seguro para que qualquer
echo   amigo possa acessar o seu CS2 Mix Hub pelo celular ou PC de fora da sua casa.
echo.
echo   [!] Certifique-se de que o servidor local ja esta aberto na porta 3000!
echo.
echo ==============================================================================
echo.
echo   Gerando link publico... Aguarde alguns segundos...
echo.

npx localtunnel --port 3000

pause
