# ==============================================================================
# CORTEX LOCKDOWN RC1.2 - AUTHORITATIVE ARTIFACT CHECKSUM VERIFICATION (POWERSHELL)
# Strictly Zero Emojis Enforced. Additional Budget: INR 0.
# ==============================================================================

$manifest = @(
    @{
        Path = "..\..\bin\CortexLockdown-Hardened.exe"
        ExpectedHash = "82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895"
        Description = "Production Hardened Release Binary"
    },
    @{
        Path = "..\CortexLockdown-Windows-x64.zip"
        ExpectedHash = "08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30"
        Description = "Portable Distribution Archive"
    },
    @{
        Path = "..\..\bin\CortexLockdown.exe"
        ExpectedHash = "68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466"
        Description = "Baseline Demonstration Binary"
    }
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$allPassed = $true

Write-Host "Verifying Authoritative Cortex Lockdown Release Artifacts..." -ForegroundColor Cyan
Write-Host "Directory: $scriptDir"
Write-Host ""

foreach ($item in $manifest) {
    $fullPath = Join-Path $scriptDir $item.Path
    Write-Host "Checking: $($item.Description) ($fullPath)" -NoNewline
    if (-not (Test-Path $fullPath)) {
        Write-Host " [MISSING]" -ForegroundColor Red
        $allPassed = $false
        continue
    }

    $actualHash = (Get-FileHash -Algorithm SHA256 -Path $fullPath).Hash.ToUpper()
    if ($actualHash -eq $item.ExpectedHash) {
        Write-Host " [MATCHED]" -ForegroundColor Green
        Write-Host "  Hash: $actualHash" -ForegroundColor Gray
    } else {
        Write-Host " [MISMATCH]" -ForegroundColor Red
        Write-Host "  Expected: $($item.ExpectedHash)" -ForegroundColor Yellow
        Write-Host "  Actual:   $actualHash" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""
if ($allPassed) {
    Write-Host "ALL ARTIFACTS VERIFIED: BIT-FOR-BIT CRYPTOGRAPHIC INTEGRITY CONFIRMED." -ForegroundColor Green
    exit 0
} else {
    Write-Host "ERROR: ONE OR MORE ARTIFACTS FAILED VERIFICATION." -ForegroundColor Red
    exit 1
}
