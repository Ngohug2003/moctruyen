@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Du an nay dung Expo SDK 57.
echo Tren dien thoai, cap nhat Expo Go hoac cai ban SDK 57 tai https://expo.dev/go
if not exist node_modules (
 call npm ci
 if errorlevel 1 goto :error
)
call npm start -- --clear
pause
exit /b
:error
echo Khong cai duoc thu vien. Kiem tra Node.js va Internet.
pause
exit /b 1
