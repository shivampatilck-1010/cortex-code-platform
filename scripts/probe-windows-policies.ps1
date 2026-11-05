Write-Host "=== 1. OS AND SYSTEM INFO ==="
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture | Format-List

Write-Host "=== 2. DOMAIN AND WORKGROUP MEMBERSHIP ==="
Get-CimInstance Win32_ComputerSystem | Select-Object Name, Domain, PartOfDomain, Workgroup | Format-List

Write-Host "=== 3. USER ACCOUNT AND PRIVILEGES ==="
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
$adminRole = [System.Security.Principal.WindowsBuiltInRole]::Administrator
$isAdmin = $principal.IsInRole($adminRole)
Write-Host "Current User: $($identity.Name)"
Write-Host "Is Administrator: $isAdmin"
Write-Host "User SID: $($identity.User.Value)"

Write-Host "=== 4. APPLOCKER AND WDAC SERVICES ==="
Get-Service -Name AppIDSvc, AppLockerFLTr -ErrorAction SilentlyContinue | Select-Object Name, DisplayName, Status, StartType | Format-Table

Write-Host "=== 5. PROTOCOL REGISTRATION STATUS ==="
if (Test-Path "HKCU:\Software\Classes\cortex-lockdown\shell\open\command") {
    Get-ItemProperty -Path "HKCU:\Software\Classes\cortex-lockdown\shell\open\command" | Format-List
} else {
    Write-Host "HKCU Protocol handler NOT found."
}

Write-Host "=== 6. TASK MANAGER POLICIES ==="
$userPolicy = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System" -ErrorAction SilentlyContinue
$machinePolicy = Get-ItemProperty -Path "HKLM:\Software\Microsoft\Windows\CurrentVersion\Policies\System" -ErrorAction SilentlyContinue
Write-Host "HKCU DisableTaskMgr: $($userPolicy.DisableTaskMgr)"
Write-Host "HKLM DisableTaskMgr: $($machinePolicy.DisableTaskMgr)"

Write-Host "=== 7. APPLOCKER EFFECTIVE POLICY ==="
try {
    $effectivePolicy = Get-AppLockerPolicy -Effective -ErrorAction Stop
    Write-Host "AppLocker Effective Policy retrieved successfully."
    $effectivePolicy.RuleCollections | ForEach-Object {
        Write-Host "Collection: $($_.RuleCollectionType) - Count: $($_.Count)"
    }
} catch {
    Write-Host "AppLocker Policy Query Output: $($_.Exception.Message)"
}
