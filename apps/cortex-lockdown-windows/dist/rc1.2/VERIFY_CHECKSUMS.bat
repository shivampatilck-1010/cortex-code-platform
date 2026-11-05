@echo off
REM ============================================================================
REM CORTEX LOCKDOWN RC1.2 - AUTHORITATIVE ARTIFACT CHECKSUM VERIFICATION
REM Platform: Microsoft Windows (PowerShell Utility)
REM Strictly Zero Emojis Enforced. Additional Budget: INR 0.
REM ============================================================================

echo ============================================================================
echo CORTEX LOCKDOWN RC1.2 - CRYPTOGRAPHIC CHECKSUM VERIFICATION
echo ============================================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0VERIFY_CHECKSUMS.ps1"

pause
