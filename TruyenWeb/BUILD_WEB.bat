@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
 call npm ci
 if errorlevel 1 goto :error
)
call npm run build
if errorlevel 1 goto :error
echo Da build xong. Ket qua trong thu muc dist.
start "" "%~dp0dist"
pause
exit /b 0
:error
echo Build chua thanh cong. Xem loi phia tren.
pause
exit /b 1
