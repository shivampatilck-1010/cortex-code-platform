@echo off
title Codex Browser Launcher
echo ========================================================
echo   CODEX BROWSER - SECURE EXAM ENVIRONMENT
echo ========================================================
echo.
echo Launching Codex Browser...
cd /d "%~dp0apps\cortex-lockdown-desktop"
call npm start -- %*
pause
