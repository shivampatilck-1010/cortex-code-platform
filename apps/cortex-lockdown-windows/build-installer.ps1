# CORTEX LOCKDOWN WINDOWS PACKAGING & INSTALLER SCRIPT
# Produces verified distribution zip containing hardened binary and installer scripts
# Target: Windows 10/11 x64 Institutional Baseline

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$binDir = Join-Path $scriptDir "bin"
$hardenedExe = Join-Path $binDir "CortexLockdown-Hardened.exe"
$distDir = Join-Path $scriptDir "dist"

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

# 1. Verify or Compile Hardened Executable
Write-Host "[1/6] Verifying hardened release executable..."
$expectedHardenedSha256 = "82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895"

if (-not (Test-Path $hardenedExe)) {
    Write-Host "Compiling hardened binary via build-hardened.ps1..."
    & (Join-Path $scriptDir "build-hardened.ps1")
}

$currentHardenedHash = (Get-FileHash $hardenedExe -Algorithm SHA256).Hash
if ($currentHardenedHash -ne $expectedHardenedSha256) {
    Write-Host "Hardened binary hash mismatch. Recompiling..."
    & (Join-Path $scriptDir "build-hardened.ps1")
    $currentHardenedHash = (Get-FileHash $hardenedExe -Algorithm SHA256).Hash
    if ($currentHardenedHash -ne $expectedHardenedSha256) {
        Write-Error "Failed to produce authoritative hardened binary. Expected: $expectedHardenedSha256, Got: $currentHardenedHash"
        exit 1
    }
}

$hardenedSize = (Get-Item $hardenedExe).Length
Write-Host "Hardened binary verified: $hardenedExe ($hardenedSize bytes, SHA-256: $currentHardenedHash)"

# 2. Package Portable Distribution ZIP with Authoritative Hardened Payload
Write-Host "[2/6] Packaging distribution archive..."
$zipPath = Join-Path $distDir "CortexLockdown-Windows-x64.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

$tempStaging = Join-Path $distDir "staging"
if (Test-Path $tempStaging) { Remove-Item -Recurse -Force $tempStaging }
New-Item -ItemType Directory -Path $tempStaging -Force | Out-Null

# Copy hardened executable as standard CortexLockdown.exe (preserving exact binary contents)
Copy-Item $hardenedExe -Destination (Join-Path $tempStaging "CortexLockdown.exe")
Copy-Item (Join-Path $scriptDir "installer\install.bat") -Destination $tempStaging
Copy-Item (Join-Path $scriptDir "installer\uninstall.bat") -Destination $tempStaging
Copy-Item (Join-Path $scriptDir "installer\register-protocol.reg") -Destination $tempStaging

$readmeContent = @"
CORTEX LOCKDOWN - SECURE DESKTOP EXAMINATION CLIENT
Version: 1.0.0-hardened
Target: Windows 10/11 x64 Institutional Baseline
Payload SHA-256: 82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895

QUICK INSTALLATION:
1. Double-click install.bat to register the cortex-lockdown:// protocol and create Start Menu shortcuts.
2. Launch examinations directly from the Cortex classroom web portal.
3. To uninstall, run uninstall.bat.

SECURITY SPECIFICATIONS:
* OS Kiosk Mode with Low-Level Keyboard Hooks (WH_KEYBOARD_LL)
* Screen Capture Blocker (WDA_MONITOR)
* 21-Process Prohibited Watchdog (Task Manager, Snipping Tool, OBS, Discord, Wireshark, etc.)
* Zero-Tolerance Remote Session & Virtualization Detection
* Automated Real-Time Telemetry to Cortex Proctoring Feed
* Assembly Metadata and Windows Manifest for Antivirus Compatibility
* AES-256-GCM Encrypted Local Answer Persistence with PBKDF2 (100k)
"@
Set-Content -Path (Join-Path $tempStaging "README.txt") -Value $readmeContent -Encoding UTF8

# Verify payload inside staging before compression
$stagedExe = Join-Path $tempStaging "CortexLockdown.exe"
$stagedHash = (Get-FileHash $stagedExe -Algorithm SHA256).Hash
if ($stagedHash -ne $expectedHardenedSha256) {
    Write-Error "Staged executable hash corrupted before compression! Expected: $expectedHardenedSha256, Got: $stagedHash"
    exit 1
}

Compress-Archive -Path "$tempStaging\*" -DestinationPath $zipPath -Force
Remove-Item -Recurse -Force $tempStaging

$zipHash = (Get-FileHash $zipPath -Algorithm SHA256).Hash
$zipSize = (Get-Item $zipPath).Length
Write-Host "Distribution archive packaged: $zipPath ($zipSize bytes, SHA-256: $zipHash)"

# 3. Generate SHA-256 Manifest
Write-Host "[3/6] Generating SHA-256 manifest..."
$manifestPath = Join-Path $distDir "SHA256SUMS.txt"
$rc3Exe = Join-Path $binDir "CortexLockdown.exe"
$manifestLines = @(
    "$currentHardenedHash *bin/CortexLockdown-Hardened.exe",
    "$zipHash *dist/CortexLockdown-Windows-x64.zip"
)
if (Test-Path $rc3Exe) {
    $rc3Hash = (Get-FileHash $rc3Exe -Algorithm SHA256).Hash
    $manifestLines += "$rc3Hash *bin/CortexLockdown.exe"
}
Set-Content -Path $manifestPath -Value ($manifestLines -join "`r`n") -Encoding UTF8
Write-Host "Manifest written to $manifestPath"

# 4. Extract into Clean Temporary Directory and Verify Payload
Write-Host "[4/6] Verifying archive integrity via clean extraction..."
$verifyTemp = Join-Path $env:TEMP ("cortex_verify_" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $verifyTemp -Force | Out-Null

try {
    Expand-Archive -Path $zipPath -DestinationPath $verifyTemp -Force
    $extractedExe = Join-Path $verifyTemp "CortexLockdown.exe"
    if (-not (Test-Path $extractedExe)) {
        throw "Extracted archive missing CortexLockdown.exe"
    }
    $extractedHash = (Get-FileHash $extractedExe -Algorithm SHA256).Hash
    $extractedSize = (Get-Item $extractedExe).Length

    if ($extractedHash -ne $expectedHardenedSha256) {
        throw "Extracted payload hash mismatch! Expected: $expectedHardenedSha256, Got: $extractedHash"
    }
    Write-Host "Extraction verification PASSED: $extractedExe ($extractedSize bytes, SHA-256: $extractedHash)"
} finally {
    if (Test-Path $verifyTemp) {
        Remove-Item -Recurse -Force $verifyTemp -ErrorAction SilentlyContinue
    }
}

# 5. Check Inno Setup Compiler (iscc.exe)
Write-Host "[5/6] Checking for optional Inno Setup compiler..."
$isccCandidates = @(
    "C:\Program Files (x86)\Inno Setup 6\iscc.exe",
    "C:\Program Files\Inno Setup 6\iscc.exe",
    (Get-Command iscc -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
)

$isccPath = $null
foreach ($cand in $isccCandidates) {
    if ($cand -and (Test-Path $cand)) {
        $isccPath = $cand
        break
    }
}

if ($isccPath) {
    Write-Host "Found Inno Setup at $isccPath. Compiling installer..."
    $issFile = Join-Path $scriptDir "installer\cortex-lockdown.iss"
    & $isccPath $issFile
} else {
    Write-Host "Inno Setup (iscc.exe) not present on this host. Portable distribution ZIP is authoritative."
}

Write-Host "================================================================"
Write-Host "CORTEX LOCKDOWN WINDOWS PACKAGING COMPLETE"
Write-Host "================================================================"
Write-Host "Authoritative Payload: $hardenedExe"
Write-Host "  Size:                $hardenedSize bytes"
Write-Host "  SHA-256:             $currentHardenedHash"
Write-Host "Distribution Archive:  $zipPath"
Write-Host "  Size:                $zipSize bytes"
Write-Host "  SHA-256:             $zipHash"
Write-Host "Manifest:              $manifestPath"
Write-Host "================================================================"
