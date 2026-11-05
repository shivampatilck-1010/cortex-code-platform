@echo off
setlocal
echo ================================================================
echo CORTEX LOCKDOWN - WINDOWS CLIENT UNINSTALLER
echo Target: Windows 10/11 x64 Institutional Baseline
echo Strictly Zero Emojis Enforced. Additional Budget: INR 0.
echo ================================================================

set "TARGET_DIR=%LOCALAPPDATA%\CortexLockdown"
set "START_MENU_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Cortex Lockdown.lnk"
set "DESKTOP_LNK=%USERPROFILE%\Desktop\Cortex Lockdown.lnk"

echo [INFO] Unregistering custom protocol: cortex-lockdown://
reg delete "HKCU\Software\Classes\cortex-lockdown" /f >nul 2>&1

if exist "%START_MENU_LNK%" (
    echo [INFO] Removing Start Menu shortcut...
    del /F /Q "%START_MENU_LNK%" >nul 2>&1
)

if exist "%DESKTOP_LNK%" (
    echo [INFO] Removing Desktop shortcut...
    del /F /Q "%DESKTOP_LNK%" >nul 2>&1
)

if exist "%TARGET_DIR%\CortexLockdown.exe" (
    echo [INFO] Removing executable: %TARGET_DIR%\CortexLockdown.exe
    del /F /Q "%TARGET_DIR%\CortexLockdown.exe" >nul 2>&1
)

if exist "%TARGET_DIR%\sha256.txt" (
    del /F /Q "%TARGET_DIR%\sha256.txt" >nul 2>&1
)

:: Preserve offline student examination data if present
if exist "%TARGET_DIR%\SecureStorage" (
    echo [INFO] Preserving student offline examination data: %TARGET_DIR%\SecureStorage
    echo [INFO] Examination data must be manually sanitized following academic integrity appeal windows.
) else (
    if exist "%TARGET_DIR%\install.log" del /F /Q "%TARGET_DIR%\install.log" >nul 2>&1
    if exist "%TARGET_DIR%" (
        rmdir /Q "%TARGET_DIR%" >nul 2>&1
    )
)

echo ================================================================
echo [OK] Uninstallation complete.
echo Protocol registration, shortcuts, and application binaries removed.
echo ================================================================
exit /b 0
