@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist input\truyen.json (
 echo Chua co C:\Truyen\TruyenReader\input\truyen.json
 echo Cho tool tai xong, chep truyen.json vao input roi chay lai file nay.
 pause
 exit /b 1
)
if not exist node_modules\eas-cli\bin\run (
 call npm ci
 if errorlevel 1 goto :error
)
echo Project Expo: viethung111003s-team/moctruyen
echo APK se duoc tai ve C:\Truyen\TruyenReader\build\MocReader.apk
call npm run build:apk
if errorlevel 1 goto :error
echo.
echo DA XONG. Mo thu muc build de lay MocReader.apk.
start "" "%~dp0build"
pause
exit /b 0
:error
echo.
echo Chua hoan tat. Xem thong bao loi phia tren.
echo Neu build tren Expo da xong nhung tai file bi gian doan, chay TAI_LAI_APK.bat.
pause
exit /b 1
