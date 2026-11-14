@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Git\cmd;%LOCALAPPDATA%\MinGit\cmd;C:\Program Files\Git\cmd;C:\Program Files\nodejs;%APPDATA%\npm"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado no computador.
    echo Instale o Node.js LTS em: https://nodejs.org/
    pause
    exit /b 1
)

(
    node "%~dp0scripts\sync-github.mjs" %*
    if errorlevel 1 (
        echo.
        echo ========================================================
        echo   [FALHA] A sincronizacao foi interrompida.
        echo ========================================================
        pause
        exit /b 1
    )
    echo.
    echo ========================================================
    echo   [OK] Sincronizacao finalizada!
    echo ========================================================
    pause
    exit /b 0
)
