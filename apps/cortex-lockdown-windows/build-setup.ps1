# CORTEX LOCKDOWN SINGLE-FILE INSTALLER BUILD SCRIPT
# Compiles a dedicated, unprivileged Windows Setup executable (CortexLockdown-Setup.exe)
# embedding the authoritative CortexLockdown-Hardened.exe payload.
# Target: Windows 10/11 x64 Institutional Baseline
# Strictly Zero Emojis Enforced. Additional Budget: INR 0.

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$binDir = Join-Path $scriptDir "bin"
$installerDir = Join-Path $scriptDir "installer"
$hardenedExe = Join-Path $binDir "CortexLockdown-Hardened.exe"
$setupExe = Join-Path $binDir "CortexLockdown-Setup.exe"

$expectedHardenedSha256 = "82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895"

Write-Host "================================================================"
Write-Host "COMPILING CORTEX LOCKDOWN DEDICATED SETUP INSTALLER"
Write-Host "================================================================"

# 1. Verify Hardened Payload
if (-not (Test-Path $hardenedExe)) {
    Write-Host "Hardened binary missing. Compiling via build-hardened.ps1..."
    & (Join-Path $scriptDir "build-hardened.ps1")
}

$hardenedHash = (Get-FileHash $hardenedExe -Algorithm SHA256).Hash
if ($hardenedHash -ne $expectedHardenedSha256) {
    Write-Error "Cannot compile installer: Hardened binary hash mismatch! Expected: $expectedHardenedSha256, Got: $hardenedHash"
    exit 1
}
Write-Host "Hardened payload verified: $hardenedExe (SHA-256: $hardenedHash)"

# 2. Compile Setup Executable with Embedded Payload
$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$manifestPath = Join-Path $installerDir "setup.manifest"

$sources = @(
    (Join-Path $installerDir "SetupAssemblyInfo.cs"),
    (Join-Path $installerDir "SetupProgram.cs")
)

$references = @(
    "System.dll",
    "System.Core.dll",
    "System.Data.dll",
    "System.Drawing.dll",
    "System.Windows.Forms.dll"
)
$refArgs = $references | ForEach-Object { "/r:$_" }

$argsList = @(
    "/target:winexe",
    "/platform:anycpu",
    "/optimize+",
    "/win32manifest:$manifestPath",
    "/resource:$hardenedExe,Payload.exe",
    "/out:$setupExe"
) + $refArgs + $sources

Write-Host "Compiling CortexLockdown-Setup.exe via csc.exe..."
& $cscPath $argsList

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $setupExe)) {
    Write-Error "CSC compilation of CortexLockdown-Setup.exe failed!"
    exit 1
}

$setupSize = (Get-Item $setupExe).Length
$setupHash = (Get-FileHash $setupExe -Algorithm SHA256).Hash

Write-Host "Installer compiled successfully!"
Write-Host "Output:   $setupExe"
Write-Host "Size:     $setupSize bytes"
Write-Host "SHA-256:  $setupHash"

# 3. Synchronize Distribution Mirrors
$repoRoot = (Get-Item $scriptDir).Parent.Parent.FullName
$destinations = @(
    (Join-Path $repoRoot "release\windows\CortexLockdown-Setup.exe"),
    (Join-Path $repoRoot "public\downloads\CortexLockdown-Setup.exe"),
    (Join-Path $repoRoot "dist\client\downloads\CortexLockdown-Setup.exe"),
    (Join-Path $repoRoot "dist\client\api\v1\lockdown\downloads\CortexLockdown-Setup.exe")
)

foreach ($dest in $destinations) {
    $parent = Split-Path -Parent $dest
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Copy-Item $setupExe -Destination $dest -Force
    Write-Host "Synchronized: $dest"
}

Write-Host "================================================================"
Write-Host "SETUP INSTALLER READY: $setupHash"
Write-Host "================================================================"
