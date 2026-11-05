@echo off
title Finovo Portal Launcher
echo ====================================================
echo         STARTING FINOVO ENTERPRISE PORTAL
echo ====================================================

echo [1/3] Launching Laravel Backend (http://127.0.0.1:8000)...
start "Finovo Backend (Laravel)" cmd /k "cd /d "%~dp0Backend" && php artisan serve"

echo [2/3] Launching Socket Server (Port 3001)...
start "Finovo Socket Server" cmd /k "cd /d "%~dp0" && node socket-server.cjs"

echo [3/3] Launching React Vite Frontend (http://localhost:5173)...
start "Finovo Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo All Finovo services are booting up!
echo Opening browser in 3 seconds...
timeout /t 3 >nul
start http://localhost:5173
