# ==============================================================================
# Script: Deploy-CortexLockdown.ps1
# Programme: Cortex Lockdown v1.0
# Baseline: v1.0.0-rc3 (Master Programme Complete)
# Description: Production Enterprise Silent Deployment Script for Windows 10/11
# Security Standard: Strict Archive Path Traversal Defense, Dual Hash Verification,
#                    NTFS ACL Hardening, Transactional Rollback, Safe Protocol Registration.
# ==============================================================================

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$SourceZipPath = "..\..\apps\cortex-lockdown-windows\dist\CortexLockdown-Windows-x64.zip",

    [Parameter(Mandatory = $false)]
    [string]$ExpectedZipHash = "24E47B83D02EB3D2F9E1DE4BA84F8CD5B7A8EF363F1C29E22F80BE93480FA995",

    [Parameter(Mandatory = $false)]
    [string]$TargetDirectory = "C:\Program Files\CortexLockdown",

    [Parameter(Mandatory = $false)]
    [string]$ExpectedExeHash = "68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466",

    [Parameter(Mandatory = $false)]
    [string]$LogPath = "C:\ProgramData\CortexLockdown\deployment.log"
)

$ErrorActionPreference = "Stop"

function Write-DeployLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $logLine = "[$timestamp] [$Level] $Message"
    Write-Output $logLine
    try {
        $logDir = [System.IO.Path]::GetDirectoryName($LogPath)
        if (!(Test-Path -Path $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }
        Add-Content -Path $LogPath -Value $logLine -ErrorAction SilentlyContinue
    } catch {}
}

Write-DeployLog "Starting Cortex Lockdown Enterprise Deployment..." "INFO"

# 1. Privilege Verification
$currentUser = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-DeployLog "Deployment failed: Elevated Administrator privileges are required." "ERROR"
    Exit 3 # Exit Code 3: Insufficient Privileges
}

# 2. Dependency Verification: Microsoft Edge WebView2 Evergreen Runtime
Write-DeployLog "Verifying required runtime dependencies (Edge WebView2)..." "INFO"
$webView2Installed = $false
$wvPaths = @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
)

foreach ($key in $wvPaths) {
    if (Test-Path -Path $key) {
        $pv = (Get-ItemProperty -Path $key -ErrorAction SilentlyContinue).pv
        if ($pv -and $pv -ne "0.0.0.0") {
            $webView2Installed = $true
            Write-DeployLog "WebView2 Evergreen Runtime detected: Version $pv" "INFO"
            break
        }
    }
}

if (-not $webView2Installed) {
    # Check default file path fallback
    $wvFile = "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application"
    if (Test-Path -Path $wvFile) {
        $webView2Installed = $true
        Write-DeployLog "WebView2 Evergreen Runtime directory detected at $wvFile" "INFO"
    }
}

if (-not $webView2Installed) {
    Write-DeployLog "Warning: Microsoft Edge WebView2 Evergreen Runtime not detected. Kiosk UI requires WebView2." "WARN"
}

# 3. Source ZIP File Existence and Cryptographic Validation
if (-not (Test-Path -Path $SourceZipPath)) {
    # Attempt resolving relative to script root
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $resolvedPath = Join-Path -Path $scriptDir -ChildPath $SourceZipPath
    if (Test-Path -Path $resolvedPath) {
        $SourceZipPath = $resolvedPath
    } else {
        Write-DeployLog "Deployment failed: Source ZIP package not found at '$SourceZipPath'" "ERROR"
        Exit 2 # Exit Code 2: File Not Found
    }
}

$resolvedZip = (Resolve-Path -Path $SourceZipPath).Path
Write-DeployLog "Validating source ZIP archive: $resolvedZip" "INFO"
$actualZipHash = (Get-FileHash -Path $resolvedZip -Algorithm SHA256).Hash
if ($actualZipHash -ne $ExpectedZipHash) {
    Write-DeployLog "Security Error: Source ZIP hash mismatch! Expected: $ExpectedZipHash, Got: $actualZipHash" "ERROR"
    Exit 1 # Exit Code 1: Cryptographic Integrity Failure
}
Write-DeployLog "Source ZIP SHA-256 hash verified: $actualZipHash" "INFO"

# 4. Safe Unique Extraction with Path Traversal Protection
$tempDir = Join-Path -Path $env:TEMP -ChildPath ("cortex_deploy_" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Write-DeployLog "Created isolated temporary extraction workspace: $tempDir" "INFO"

$canonicalTemp = [System.IO.Path]::GetFullPath($tempDir)
if (-not $canonicalTemp.EndsWith([System.IO.Path]::DirectorySeparatorChar.ToString())) {
    $canonicalTemp += [System.IO.Path]::DirectorySeparatorChar
}

try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zipArchive = [System.IO.Compression.ZipFile]::OpenRead($resolvedZip)
    foreach ($entry in $zipArchive.Entries) {
        $destinationPath = [System.IO.Path]::GetFullPath((Join-Path -Path $tempDir -ChildPath $entry.FullName))
        
        # Path Traversal Check (Zip Slip mitigation)
        if (-not $destinationPath.StartsWith($canonicalTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Security Exception: Archive entry '${entry.FullName}' attempts directory traversal outside target!"
        }

        if ([string]::IsNullOrEmpty($entry.Name)) {
            # Directory entry
            New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
        } else {
            $parentDir = [System.IO.Path]::GetDirectoryName($destinationPath)
            if (!(Test-Path -Path $parentDir)) {
                New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
            }
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destinationPath, $true)
        }
    }
    $zipArchive.Dispose()
    Write-DeployLog "Archive extracted safely without directory traversal." "INFO"
} catch {
    Write-DeployLog "Archive extraction failure: $_" "ERROR"
    if (Test-Path -Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force }
    Exit 1
}

# 5. Extracted Executable Validation
$extractedExe = Join-Path -Path $tempDir -ChildPath "CortexLockdown.exe"
if (-not (Test-Path -Path $extractedExe)) {
    Write-DeployLog "Deployment failed: CortexLockdown.exe was not found in the extracted package." "ERROR"
    Remove-Item -Path $tempDir -Recurse -Force
    Exit 1
}

$actualExeHash = (Get-FileHash -Path $extractedExe -Algorithm SHA256).Hash
if ($actualExeHash -ne $ExpectedExeHash) {
    Write-DeployLog "Security Error: Extracted executable hash mismatch! Expected: $ExpectedExeHash, Got: $actualExeHash" "ERROR"
    Remove-Item -Path $tempDir -Recurse -Force
    Exit 1
}
Write-DeployLog "Extracted executable SHA-256 hash verified: $actualExeHash" "INFO"

# 6. Process Concurrency & Existing Installation Handling
$runningProcesses = Get-Process -Name "CortexLockdown" -ErrorAction SilentlyContinue
if ($runningProcesses) {
    Write-DeployLog "Active CortexLockdown instance detected. Stopping process for upgrade..." "WARN"
    $runningProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

# 7. Transactional Rollback Preparation
$rollbackDir = $null
if (Test-Path -Path $TargetDirectory) {
    $rollbackDir = Join-Path -Path $env:TEMP -ChildPath ("cortex_rollback_" + [System.Guid]::NewGuid().ToString("N"))
    Write-DeployLog "Backing up existing installation to $rollbackDir for rollback safety..." "INFO"
    Copy-Item -Path $TargetDirectory -Destination $rollbackDir -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $TargetDirectory -Force | Out-Null
}

# 8. Copy Verified Files to Protected Target Directory
try {
    Write-DeployLog "Copying verified binaries to target directory: $TargetDirectory" "INFO"
    $extractedFiles = Get-ChildItem -Path $tempDir
    foreach ($file in $extractedFiles) {
        Copy-Item -Path $file.FullName -Destination $TargetDirectory -Recurse -Force
    }
} catch {
    Write-DeployLog "File copy failed! Initiating rollback..." "ERROR"
    if ($rollbackDir -and (Test-Path -Path $rollbackDir)) {
        Copy-Item -Path "$rollbackDir\*" -Destination $TargetDirectory -Recurse -Force
        Remove-Item -Path $rollbackDir -Recurse -Force
    }
    Remove-Item -Path $tempDir -Recurse -Force
    Exit 4 # Exit Code 4: Installation Failed, Rolled Back
}

# Remove rollback backup on success
if ($rollbackDir -and (Test-Path -Path $rollbackDir)) {
    Remove-Item -Path $rollbackDir -Recurse -Force
}

# 9. Apply Restrictive NTFS Permissions
Write-DeployLog "Enforcing restrictive NTFS ACLs on $TargetDirectory..." "INFO"
$icaclsOutput = & icacls "$TargetDirectory" /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" "Users:(OI)(CI)RX" 2>&1
Write-DeployLog "NTFS permissions configured: SYSTEM and Administrators have Full Control, Standard Users have Read and Execute." "INFO"

# 10. Register Custom URI Protocol: cortex-lockdown://
$installedExe = Join-Path -Path $TargetDirectory -ChildPath "CortexLockdown.exe"
Write-DeployLog "Registering protocol handler cortex-lockdown:// pointing to $installedExe" "INFO"
try {
    $regKey = "HKLM:\SOFTWARE\Classes\cortex-lockdown"
    if (!(Test-Path -Path $regKey)) { New-Item -Path $regKey -Force | Out-Null }
    Set-ItemProperty -Path $regKey -Name "(Default)" -Value "URL:Cortex Lockdown Examination Protocol" -Force
    Set-ItemProperty -Path $regKey -Name "URL Protocol" -Value "" -Force

    $cmdKey = "$regKey\shell\open\command"
    if (!(Test-Path -Path $cmdKey)) { New-Item -Path $cmdKey -Force | Out-Null }
    $cmdString = "`"$installedExe`" `"%1`""
    Set-ItemProperty -Path $cmdKey -Name "(Default)" -Value $cmdString -Force
    Write-DeployLog "Protocol registration completed successfully in HKLM." "INFO"
} catch {
    Write-DeployLog "Warning: Failed to write to HKLM protocol registry: $_" "WARN"
}

# 11. Cleanup Temporary Workspace
if (Test-Path -Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
    Write-DeployLog "Cleaned up isolated temporary directory: $tempDir" "INFO"
}

Write-DeployLog "Cortex Lockdown enterprise silent installation completed successfully." "SUCCESS"
Exit 0 # Exit Code 0: Success
