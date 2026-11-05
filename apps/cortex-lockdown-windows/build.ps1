# CORTEX LOCKDOWN WINDOWS COMPILER SCRIPT
# Compiles CortexLockdown.exe using built-in Windows .NET Framework 4.8 C# compiler (csc.exe)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputDir = Join-Path $scriptDir "bin"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$outputExe = Join-Path $outputDir "CortexLockdown.exe"

$sources = @(
    (Join-Path $scriptDir "src\Security\Win32Native.cs"),
    (Join-Path $scriptDir "src\Security\KeyboardHook.cs"),
    (Join-Path $scriptDir "src\Security\DisplayAffinity.cs"),
    (Join-Path $scriptDir "src\Security\ProcessWatchdog.cs"),
    (Join-Path $scriptDir "src\Security\ClipboardGuard.cs"),
    (Join-Path $scriptDir "src\Security\EnvironmentInspector.cs"),
    (Join-Path $scriptDir "src\Security\TelemetryDispatcher.cs"),
    (Join-Path $scriptDir "src\UI\MainWindow.cs"),
    (Join-Path $scriptDir "src\Program.cs")
)

$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $cscPath)) {
    Write-Error "csc.exe not found at $cscPath"
    exit 1
}

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
    "/out:$outputExe"
) + $refArgs + $sources

Write-Host "Compiling CortexLockdown.exe with csc.exe..."
& $cscPath $argsList

if ($LASTEXITCODE -eq 0 -and (Test-Path $outputExe)) {
    $sha256 = (Get-FileHash $outputExe -Algorithm SHA256).Hash
    $size = (Get-Item $outputExe).Length
    Write-Host "BUILD SUCCESSFUL!"
    Write-Host "Output: $outputExe"
    Write-Host "Size: $size bytes"
    Write-Host "SHA-256: $sha256"
} else {
    Write-Error "Build failed with exit code $LASTEXITCODE"
    exit 1
}
