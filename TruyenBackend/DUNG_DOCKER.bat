@echo off
cd /d "%~dp0"
docker compose --env-file .docker.env stop
pause
