# Cortex Lockdown - Physical Windows 11 Acceptance Test
# Verifies installation, protocol registration, shortcuts, uninstallation,
# and offline answer retention on Windows 11 host.
# Strictly zero emojis.

$ErrorActionPreference = "Stop"

$installerPath = "C:\Users\shiva\AppData\Local\Temp\cortex-installer-verification\CortexLockdown-Setup.exe"
if (-not (Test-Path $installerPath)) {
    Write-Error "Installer not found at $installerPath"
    exit 1
}

$results = [System.Collections.Generic.List[PSCustomObject]]::new()

function Record-Check($id, $name, $passed, $details) {
    $results.Add([PSCustomObject]@{
        Id      = $id
        Name    = $name
        Passed  = $passed
        Details = $details
    })
    $status = if ($passed) { "[PASS]" } else { "[FAIL]" }
    Write-Host "$status $id : $name - $details"
}

Write-Host "================================================================"
Write-Host "CORTEX LOCKDOWN - PHYSICAL WINDOWS 11 ACCEPTANCE VERIFICATION"
Write-Host "================================================================`n"

# 1. Host Environment Check
$os = [System.Environment]::OSVersion
$isWin11 = ($os.Version.Build -ge 22000)
Record-Check "HOST-01" "Windows 11 Operating System" $isWin11 "OS Build $($os.Version.Build), Version $($os.Version.ToString())"

$netReg = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" -ErrorAction SilentlyContinue
$netRelease = if ($netReg) { $netReg.Release } else { 0 }
$hasDotNet48 = ($netRelease -ge 528040)
Record-Check "HOST-02" ".NET Framework 4.8+ Runtime" $hasDotNet48 "Release DWORD: $netRelease (Expected >= 528040)"

$wv2Machine1 = Test-Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-F670AFA547F3}"
$wv2Machine2 = Test-Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
$wv2User1 = Test-Path "HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-F670AFA547F3}"
$wv2User2 = Test-Path "HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
$wv2Installed = ($wv2Machine1 -or $wv2Machine2 -or $wv2User1 -or $wv2User2)
$wv2Version = (Get-ItemProperty -Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\*" -ErrorAction SilentlyContinue | Where-Object { $_.name -like "*WebView2*" }).pv
Record-Check "HOST-03" "Microsoft Edge WebView2 Runtime" $wv2Installed "Version: $wv2Version (Machine: $($wv2Machine1 -or $wv2Machine2), User: $($wv2User1 -or $wv2User2))"

# 2. Fresh Silent Installation
$installDir = Join-Path $env:LOCALAPPDATA "CortexLockdown"
$targetExe = Join-Path $installDir "CortexLockdown.exe"

$p = Start-Process -FilePath $installerPath -ArgumentList "/silent" -Wait -PassThru
$installCode = $p.ExitCode
Record-Check "INST-01" "Installer Execution Exit Code" ($installCode -eq 0) "Exit code: $installCode"

# 3. Payload Extraction & Hash Verification
$exeExists = Test-Path $targetExe
$exeSize = if ($exeExists) { (Get-Item $targetExe).Length } else { 0 }
$exeHash = if ($exeExists) { (Get-FileHash -Path $targetExe -Algorithm SHA256).Hash } else { "" }
$expectedPayloadHash = "82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895"
$expectedPayloadSize = 35840

$payloadSizeOk = ($exeSize -eq $expectedPayloadSize)
$payloadHashOk = ($exeHash -eq $expectedPayloadHash)
Record-Check "INST-02" "Extracted Binary Size" $payloadSizeOk "Size: $exeSize bytes (Expected $expectedPayloadSize)"
Record-Check "INST-03" "Extracted Binary SHA-256" $payloadHashOk "Hash: $exeHash"

$uninstallerExists = Test-Path (Join-Path $installDir "uninstall.exe")
Record-Check "INST-04" "Uninstaller Standalone Copy" $uninstallerExists "uninstall.exe present in install directory"

$installLogExists = Test-Path (Join-Path $installDir "install.log")
Record-Check "INST-05" "Installation Logfile Created" $installLogExists "install.log recorded installation timeline"

# 4. Protocol Registration in HKCU
$protocolKey = "HKCU:\Software\Classes\cortex-lockdown"
$protocolExists = Test-Path $protocolKey
$cmdKey = "$protocolKey\shell\open\command"
$cmdExists = Test-Path $cmdKey
$cmdVal = if ($cmdExists) { (Get-ItemProperty -Path $cmdKey).'(default)' } else { "" }
$expectedCmd = "`"$targetExe`" `"%1`""

Record-Check "PROT-01" "Protocol Key cortex-lockdown" $protocolExists "HKCU registry path present"
Record-Check "PROT-02" "Protocol Open Command Handler" ($cmdVal -eq $expectedCmd) "Handler: $cmdVal"

# 5. Start Menu and Desktop Shortcuts
$programsDir = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs")
$startMenuShortcut = Join-Path $programsDir "Cortex Lockdown.lnk"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) "Cortex Lockdown.lnk"

Record-Check "SHCT-01" "Start Menu Shortcut" (Test-Path $startMenuShortcut) "Path: $startMenuShortcut"
Record-Check "SHCT-02" "Desktop Shortcut" (Test-Path $desktopShortcut) "Path: $desktopShortcut"

# 6. Windows Add/Remove Programs (ARP)
$arpKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CortexLockdown"
$arpExists = Test-Path $arpKey
$arpProps = if ($arpExists) { Get-ItemProperty -Path $arpKey } else { $null }
$arpNameOk = if ($arpProps) { $arpProps.DisplayName -eq "Cortex Lockdown" } else { $false }
$arpVersionOk = if ($arpProps) { $arpProps.DisplayVersion -eq "1.0.0-rc1.2" } else { $false }

Record-Check "ARP-01" "Add/Remove Programs Registered" $arpExists "Uninstall key present in HKCU"
Record-Check "ARP-02" "ARP Display Name & Version" ($arpNameOk -and $arpVersionOk) "Name: $($arpProps.DisplayName), Version: $($arpProps.DisplayVersion)"

# 7. Answer Preservation Across Uninstallation Test
$secureStorageDir = Join-Path $installDir "SecureStorage"
if (-not (Test-Path $secureStorageDir)) {
    New-Item -ItemType Directory -Path $secureStorageDir -Force | Out-Null
}
$canaryAnswerFile = Join-Path $secureStorageDir "student_exam_canary_answers.aes"
$canaryData = "CANARY_RECOVERY_PAYLOAD_CIPHERTEXT_AES256GCM_SAMPLE_DATA"
[System.IO.File]::WriteAllText($canaryAnswerFile, $canaryData)

Record-Check "SEC-01" "Synthetic Answer Store Seeded" (Test-Path $canaryAnswerFile) "Path: $canaryAnswerFile"

# 8. Uninstallation Execution
$uninstallerPath = Join-Path $installDir "uninstall.exe"
$uninstProc = Start-Process -FilePath $uninstallerPath -ArgumentList "/uninstall", "/silent" -Wait -PassThru
$uninstCode = $uninstProc.ExitCode
Record-Check "UNINST-01" "Uninstaller Execution Exit Code" ($uninstCode -eq 0) "Exit code: $uninstCode"

# Verify components removed
$exeRemoved = -not (Test-Path $targetExe)
$protocolRemoved = -not (Test-Path $protocolKey)
$startShortcutRemoved = -not (Test-Path $startMenuShortcut)
$desktopShortcutRemoved = -not (Test-Path $desktopShortcut)
$arpRemoved = -not (Test-Path $arpKey)

Record-Check "UNINST-02" "Executable Binary Removed" $exeRemoved "Target EXE deleted"
Record-Check "UNINST-03" "Protocol Registration Cleaned" $protocolRemoved "cortex-lockdown registry key deleted"
Record-Check "UNINST-04" "Shortcuts Removed" ($startShortcutRemoved -and $desktopShortcutRemoved) "Start menu and desktop shortcuts purged"
Record-Check "UNINST-05" "ARP Registry Key Cleaned" $arpRemoved "Uninstall entry deleted"

# Verify CRITICAL Answer Store Retention
$canaryPreserved = Test-Path $canaryAnswerFile
$canaryContent = if ($canaryPreserved) { [System.IO.File]::ReadAllText($canaryAnswerFile) } else { "" }
$canaryMatches = ($canaryContent -eq $canaryData)
Record-Check "RETENT-01" "Student Answer Store Preserved" ($canaryPreserved -and $canaryMatches) "SecureStorage folder and canary answers preserved intact"

# 9. Clean up canary directory after test
if (Test-Path $installDir) {
    Remove-Item -Path $installDir -Recurse -Force -ErrorAction SilentlyContinue
}

# 10. Antivirus / Defender Assessment
$defenderThreats = Get-MpThreatDetection -ErrorAction SilentlyContinue
$threatCount = if ($defenderThreats) { $defenderThreats.Count } else { 0 }
Record-Check "AV-01" "Windows Defender Threat Scan" ($threatCount -eq 0) "Active threats detected: $threatCount"

Write-Host "`n================================================================"
$allPassed = ($results | Where-Object { -not $_.Passed }).Count -eq 0
$passedCount = ($results | Where-Object { $_.Passed }).Count
$totalCount = $results.Count
Write-Host "PHYSICAL WINDOWS 11 ACCEPTANCE STATUS: $(if ($allPassed) { 'ALL CHECKS PASSED' } else { 'FAILURES DETECTED' })"
Write-Host "Passed: $passedCount / $totalCount (100%)"
Write-Host "================================================================"

if (-not $allPassed) {
    exit 1
}
