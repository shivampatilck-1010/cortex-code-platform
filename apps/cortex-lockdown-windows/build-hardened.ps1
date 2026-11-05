# Compiles a metadata-hardened build with AssemblyInfo and app.manifest

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputDir = Join-Path $scriptDir "bin"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$outputExe = Join-Path $outputDir "CortexLockdown-Hardened.exe"
$manifestPath = Join-Path $scriptDir "src\app.manifest"

$sources = @(
    (Join-Path $scriptDir "src\Properties\AssemblyInfo.cs"),
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
    "/out:$outputExe"
) + $refArgs + $sources

Write-Host "Compiling metadata-hardened executable with csc.exe..."
& $cscPath $argsList

if ($LASTEXITCODE -eq 0 -and (Test-Path $outputExe)) {
    $sha256 = (Get-FileHash $outputExe -Algorithm SHA256).Hash
    $size = (Get-Item $outputExe).Length
    $info = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($outputExe)
    Write-Host "BUILD SUCCESSFUL!"
    Write-Host "Output: $outputExe"
    Write-Host "Size: $size bytes"
    Write-Host "SHA-256: $sha256"
    Write-Host "Company: $($info.CompanyName)"
    Write-Host "Description: $($info.FileDescription)"
    Write-Host "Product: $($info.ProductName)"
    Write-Host "Version: $($info.FileVersion)"
}
