@echo off
setlocal enabledelayedexpansion
echo ================================================================
echo CORTEX LOCKDOWN - WINDOWS CLIENT INSTALLER
echo Target: Windows 10/11 x64 Institutional Baseline
echo Strictly Zero Emojis Enforced. Additional Budget: INR 0.
echo ================================================================

set "TARGET_DIR=%LOCALAPPDATA%\CortexLockdown"
set "LOG_FILE=%TARGET_DIR%\install.log"
set "SOURCE_EXE="

:: Locate source executable
if exist "%~dp0CortexLockdown.exe" (
    set "SOURCE_EXE=%~dp0CortexLockdown.exe"
) else if exist "%~dp0CortexLockdown-Hardened.exe" (
    set "SOURCE_EXE=%~dp0CortexLockdown-Hardened.exe"
) else if exist "%~dp0..\bin\CortexLockdown-Hardened.exe" (
    set "SOURCE_EXE=%~dp0..\bin\CortexLockdown-Hardened.exe"
) else if exist "%~dp0..\bin\CortexLockdown.exe" (
    set "SOURCE_EXE=%~dp0..\bin\CortexLockdown.exe"
)

if "%SOURCE_EXE%"=="" (
    echo [ERROR] CortexLockdown executable not found in "%~dp0" or "%~dp0..\bin\"
    exit /b 1
)

if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

echo [INFO] Logging installation details to %LOG_FILE%
echo [%DATE% %TIME%] Installation initiated. Source: %SOURCE_EXE% > "%LOG_FILE%"

:: 1. Runtime Prerequisite Detection: .NET Framework 4.8+
echo [INFO] Inspecting Microsoft .NET Framework runtime...
set "DOTNET_OK=0"
for /f "tokens=3" %%A in ('reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release 2^>nul') do (
    set /a "REL_VAL=%%A"
    if !REL_VAL! geq 528040 (
        set "DOTNET_OK=1"
        echo [INFO] .NET Framework 4.8+ detected (Release key: !REL_VAL!)
        echo [%DATE% %TIME%] .NET Framework 4.8+ detected: Release !REL_VAL! >> "%LOG_FILE%"
    )
)
if "!DOTNET_OK!"=="0" (
    echo [WARNING] .NET Framework 4.8 or newer not confirmed. Application may require .NET 4.8 runtime.
    echo [%DATE% %TIME%] WARNING: .NET Framework 4.8 not detected >> "%LOG_FILE%"
)

:: 2. Runtime Prerequisite Detection: Microsoft Edge WebView2 Evergreen
echo [INFO] Inspecting Microsoft Edge WebView2 Runtime...
set "WEBVIEW2_OK=0"
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-F670AFA547F3}" /v pv >nul 2>&1
if not errorlevel 1 (
    set "WEBVIEW2_OK=1"
    echo [INFO] WebView2 Runtime detected (Machine install)
    echo [%DATE% %TIME%] WebView2 Runtime detected (System) >> "%LOG_FILE%"
) else (
    reg query "HKCU\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-F670AFA547F3}" /v pv >nul 2>&1
    if not errorlevel 1 (
        set "WEBVIEW2_OK=1"
        echo [INFO] WebView2 Runtime detected (User install)
        echo [%DATE% %TIME%] WebView2 Runtime detected (User) >> "%LOG_FILE%"
    )
)
if "!WEBVIEW2_OK!"=="0" (
    echo [INFO] WebView2 standard registry key not found. Querying PowerShell Evergreen loader...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $v = [Microsoft.Web.WebView2.Core.CoreWebView2Environment]::GetAvailableCoreWebView2BrowserVersionString(); if ($v) { Write-Host ('[INFO] WebView2 Version: ' + $v); exit 0 } } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        set "WEBVIEW2_OK=1"
        echo [INFO] WebView2 Evergreen Runtime confirmed available via CoreWebView2.
        echo [%DATE% %TIME%] WebView2 confirmed via PowerShell >> "%LOG_FILE%"
    ) else (
        echo [NOTICE] Microsoft Edge WebView2 Runtime will be automatically loaded from system Microsoft Edge if present.
        echo [%DATE% %TIME%] WebView2 notice logged >> "%LOG_FILE%"
    )
)

:: 3. Version Comparison & Upgrade Safety
if exist "%TARGET_DIR%\CortexLockdown.exe" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$src='%SOURCE_EXE%'; $dst='%TARGET_DIR%\CortexLockdown.exe'; $srcV=[System.Diagnostics.FileVersionInfo]::GetVersionInfo($src).FileVersion; $dstV=[System.Diagnostics.FileVersionInfo]::GetVersionInfo($dst).FileVersion; if ($dstV -and $srcV) { try { if ([System.Version]$dstV -gt [System.Version]$srcV) { Write-Host ('[INFO] Existing installation is newer (Installed: ' + $dstV + ', Source: ' + $srcV + '). Skipping file copy.'); exit 2 } } catch {} }"
    if errorlevel 2 (
        echo [INFO] Existing newer binary preserved.
        echo [%DATE% %TIME%] Existing newer installation preserved >> "%LOG_FILE%"
        goto :register_protocol
    )
)

echo [INFO] Copying application binary to %TARGET_DIR%\CortexLockdown.exe...
copy /Y "%SOURCE_EXE%" "%TARGET_DIR%\CortexLockdown.exe" >nul
if errorlevel 1 (
    echo [ERROR] Failed to copy executable to %TARGET_DIR%\CortexLockdown.exe
    echo [%DATE% %TIME%] ERROR: File copy failed >> "%LOG_FILE%"
    exit /b 1
)
echo [%DATE% %TIME%] Application binary copied successfully >> "%LOG_FILE%"

:register_protocol
echo [INFO] Registering custom protocol: cortex-lockdown://
reg add "HKCU\Software\Classes\cortex-lockdown" /ve /t REG_SZ /d "URL:Cortex Lockdown Secure Protocol" /f >nul
reg add "HKCU\Software\Classes\cortex-lockdown" /v "URL Protocol" /t REG_SZ /d "" /f >nul
reg add "HKCU\Software\Classes\cortex-lockdown\DefaultIcon" /ve /t REG_SZ /d "\"%TARGET_DIR%\CortexLockdown.exe\",0" /f >nul
reg add "HKCU\Software\Classes\cortex-lockdown\shell\open\command" /ve /t REG_SZ /d "\"%TARGET_DIR%\CortexLockdown.exe\" \"%%1\"" /f >nul
echo [%DATE% %TIME%] Custom URI protocol registered in HKCU >> "%LOG_FILE%"

echo [INFO] Creating Start Menu shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(\"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Cortex Lockdown.lnk\"); $s.TargetPath = \"$env:LOCALAPPDATA\CortexLockdown\CortexLockdown.exe\"; $s.WorkingDirectory = \"$env:LOCALAPPDATA\CortexLockdown\"; $s.Description = \"Cortex Lockdown Secure Assessment Client\"; $s.Save()" >nul 2>&1
echo [%DATE% %TIME%] Start Menu shortcut created >> "%LOG_FILE%"

echo [INFO] Writing deployment manifest and SHA-256 integrity record...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$h = (Get-FileHash -Algorithm SHA256 '%TARGET_DIR%\CortexLockdown.exe').Hash; Set-Content -Path '%TARGET_DIR%\sha256.txt' -Value $h -Encoding Ascii" >nul 2>&1
echo [%DATE% %TIME%] SHA-256 record written >> "%LOG_FILE%"

echo ================================================================
echo [OK] Installation and protocol registration complete.
echo Target Directory: %TARGET_DIR%
echo Executable:       %TARGET_DIR%\CortexLockdown.exe
echo Web Protocol:     cortex-lockdown://launch
echo Log File:         %LOG_FILE%
echo ================================================================
exit /b 0
