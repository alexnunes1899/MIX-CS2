@echo off
set PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files\Git\cmd;C:\Users\alexn\AppData\Local\Programs\Git\cmd
cd /d "%~dp0"
node server/runner.js
