# ==============================================================================
# Script: Uninstall-CortexLockdown.ps1
# Programme: Cortex Lockdown v1.0
# Baseline: v1.0.0-rc3 (Master Programme Complete)
# Description: Production Enterprise Silent Uninstallation Script for Windows 10/11
# Security Standard: Scoped File Removal, Clean Protocol Deregistration,
#                    Preservation of Student Work by Default, Audit Logging.
# ==============================================================================

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$TargetDirectory = "C:\Program Files\CortexLockdown",

    [Parameter(Mandatory = $false)]
    [switch]$PurgeUserData = $false,

    [Parameter(Mandatory = $false)]
    [string]$LogPath = "C:\ProgramData\CortexLockdown\deployment.log"
)

$ErrorActionPreference = "Stop"

function Write-UninstallLog {
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

Write-UninstallLog "Starting Cortex Lockdown Enterprise Uninstallation..." "INFO"

# 1. Privilege Verification
$currentUser = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-UninstallLog "Uninstallation failed: Elevated Administrator privileges are required." "ERROR"
    Exit 3 # Exit Code 3: Insufficient Privileges
}

# 2. Terminate Running Application Instances
$runningProcesses = Get-Process -Name "CortexLockdown" -ErrorAction SilentlyContinue
if ($runningProcesses) {
    Write-UninstallLog "Terminating active CortexLockdown process before uninstallation..." "INFO"
    $runningProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

# 3. Clean Protocol Registration in Registry
Write-UninstallLog "Removing protocol handler cortex-lockdown:// from HKLM..." "INFO"
$regKey = "HKLM:\SOFTWARE\Classes\cortex-lockdown"
if (Test-Path -Path $regKey) {
    try {
        Remove-Item -Path $regKey -Recurse -Force
        Write-UninstallLog "Protocol registration successfully removed from HKLM." "INFO"
    } catch {
        Write-UninstallLog "Warning: Could not remove protocol registry key: $_" "WARN"
    }
} else {
    Write-UninstallLog "Protocol registry key not present." "INFO"
}

# 4. Remove Target Installation Directory
if (Test-Path -Path $TargetDirectory) {
    Write-UninstallLog "Removing installation directory: $TargetDirectory" "INFO"
    try {
        $resolvedTarget = [System.IO.Path]::GetFullPath($TargetDirectory)
        $dirName = [System.IO.Path]::GetFileName($resolvedTarget.TrimEnd('\/'))
        $systemRoot = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Windows)
        $progFiles = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::ProgramFiles)
        
        # Absolute safety verification against root/system directories
        if ($resolvedTarget -eq $systemRoot -or $resolvedTarget -eq $progFiles -or $resolvedTarget -eq [System.IO.Path]::GetPathRoot($resolvedTarget)) {
            Write-UninstallLog "Safety abort: Target directory '$resolvedTarget' is a critical system directory!" "ERROR"
            Exit 5 # Exit Code 5: Path Safety Violation
        }
        
        if ($dirName -eq "CortexLockdown") {
            Remove-Item -Path $resolvedTarget -Recurse -Force
            Write-UninstallLog "Installation files removed successfully from $resolvedTarget." "INFO"
        } else {
            Write-UninstallLog "Safety abort: Target directory '$resolvedTarget' does not match 'CortexLockdown'." "ERROR"
            Exit 5 # Exit Code 5: Path Safety Violation
        }
    } catch {
        Write-UninstallLog "Error removing installation directory: $_" "ERROR"
        Exit 1
    }
} else {
    Write-UninstallLog "Installation directory does not exist: $TargetDirectory" "INFO"
}

# 5. Optional User Data Purge
if ($PurgeUserData) {
    Write-UninstallLog "PurgeUserData flag specified: Cleaning up student application caches..." "INFO"
    $localAppData = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::LocalApplicationData)
    $userCache = Join-Path -Path $localAppData -ChildPath "CortexLockdown"
    if (Test-Path -Path $userCache) {
        Remove-Item -Path $userCache -Recurse -Force -ErrorAction SilentlyContinue
        Write-UninstallLog "Removed local student cache: $userCache" "INFO"
    }
} else {
    Write-UninstallLog "Preserving student offline answer databases in LocalAppData by default." "INFO"
}

Write-UninstallLog "Cortex Lockdown enterprise uninstallation completed successfully." "SUCCESS"
Exit 0
