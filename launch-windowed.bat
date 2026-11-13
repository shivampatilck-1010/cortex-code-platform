@echo off
title Codex Browser (Preview Mode)
echo ========================================================
echo   CODEX BROWSER - PREVIEW / WINDOWED MODE
echo ========================================================
echo.
echo Launching Codex Browser in Windowed Mode...
cd /d "%~dp0apps\cortex-lockdown-desktop"
call npm run start:windowed
pause
