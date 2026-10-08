@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js LTS from https://nodejs.org/ then run this file again.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:8772 after the server starts.
node server.mjs
pause
