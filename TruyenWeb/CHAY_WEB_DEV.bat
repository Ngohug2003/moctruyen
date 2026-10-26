@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto :node_error
if not exist node_modules (
 call npm ci
 if errorlevel 1 goto :error
)
call npm run dev -- --open
if errorlevel 1 goto :error
exit /b 0
:node_error
echo Can cai Node.js 24 tro len. Mo lai file nay sau khi cai.
pause
exit /b 1
:error
echo Chua mo duoc web. Xem thong bao phia tren.
pause
exit /b 1
