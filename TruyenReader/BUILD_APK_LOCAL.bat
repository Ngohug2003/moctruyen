@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules call npm ci
call npm run build:local
pause
