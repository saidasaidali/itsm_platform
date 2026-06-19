# backend/src/services/networkDiscovery/get-live-state.ps1
# Récupère CPU/RAM/disque/uptime d'un poste distant via WMI
param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName
)

$ErrorActionPreference = "Stop"

try {
    $session = New-CimSession -ComputerName $ComputerName -OperationTimeoutSec 8

    # CPU — moyenne sur l'instant
    $cpu = Get-CimInstance -CimSession $session -ClassName Win32_Processor |
           Measure-Object -Property LoadPercentage -Average |
           Select-Object -ExpandProperty Average

    # RAM
    $os = Get-CimInstance -CimSession $session -ClassName Win32_OperatingSystem
    $ramTotalMB = [math]::Round($os.TotalVisibleMemorySize / 1024, 0)
    $ramFreeMB  = [math]::Round($os.FreePhysicalMemory / 1024, 0)
    $ramUsedPct = [math]::Round((($ramTotalMB - $ramFreeMB) / $ramTotalMB) * 100, 2)

    # Disque système (C:)
    $disk = Get-CimInstance -CimSession $session -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'"
    $diskFreeGB  = [math]::Round($disk.FreeSpace / 1GB, 2)
    $diskTotalGB = [math]::Round($disk.Size / 1GB, 2)

    # Uptime
    $bootTime = $os.LastBootUpTime
    $uptimeHours = [math]::Round(((Get-Date) - $bootTime).TotalHours, 1)

    # Utilisateur connecté actuellement
    $cs = Get-CimInstance -CimSession $session -ClassName Win32_ComputerSystem
    $currentUser = $cs.UserName

    Remove-CimSession $session

    $result = [PSCustomObject]@{
        cpu_usage     = $cpu
        ram_usage     = $ramUsedPct
        ram_total_mb  = $ramTotalMB
        disk_free_gb  = $diskFreeGB
        disk_total_gb = $diskTotalGB
        uptime_hours  = $uptimeHours
        current_user  = $currentUser
    }

    $result | ConvertTo-Json -Compress
} catch {
    # Poste hors ligne ou inaccessible
    Write-Output (@{ error = "$_" } | ConvertTo-Json -Compress)
    exit 1
}