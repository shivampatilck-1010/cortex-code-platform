@echo off
setlocal enabledelayedexpansion
echo ================================================================
echo CORTEX LOCKDOWN PRODUCTION RELEASE - CHECKSUM VERIFIER
echo Target: Windows 10 & 11 (x64) Institutional Baseline
echo Strictly Zero Emojis Enforced. Additional Budget: INR 0.
echo ================================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0VERIFY_CHECKSUMS.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
    echo [OK] All release checksums verified successfully.
) else (
    echo [ERROR] Verification failed. One or more files are corrupted or missing.
)
exit /b %EXIT_CODE%
