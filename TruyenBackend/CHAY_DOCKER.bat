@echo off
setlocal
cd /d "%~dp0"
if not exist .docker.env powershell -NoProfile -Command "$b=New-Object byte[] 32; $r=[System.Security.Cryptography.RandomNumberGenerator]::Create(); $r.GetBytes($b); 'POSTGRES_PASSWORD='+([System.BitConverter]::ToString($b).Replace('-','')) | Set-Content -Encoding ASCII .docker.env"
docker info >nul 2>&1
if errorlevel 1 (
 echo Hay mo Docker Desktop va doi Engine san sang roi chay lai.
 pause
 exit /b 1
)
docker compose --env-file .docker.env up -d --build --wait --wait-timeout 180
if errorlevel 1 goto fail
echo Web: http://localhost:5178
echo API: http://localhost:8000/docs
echo Database duoc giu trong Docker volume. Khong dung down -v.
exit /b 0
:fail
echo Khoi dong loi. Xem: docker compose --env-file .docker.env logs --tail 80
pause
exit /b 1
