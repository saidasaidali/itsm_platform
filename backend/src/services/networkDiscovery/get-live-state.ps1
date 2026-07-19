# backend/src/services/networkDiscovery/get-live-state.ps1
# Récupère les informations en direct d'un poste distant via WMI/CIM
# Appelé par le backend Node.js pour le Digital Twin
#
# Paramètres :
#   -ComputerName    : Nom du poste distant (obligatoire)
#   -TimeoutSec      : Timeout CIM (défaut: 10)
#   -RetryCount      : Nombre de tentatives (défaut: 1)
#   -RetryDelaySec   : Délai entre tentatives (défaut: 2)
#   -VerboseLogging  : Active les logs détaillés (défaut: $false)

param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName,

    [int]$TimeoutSec = 10,
    [int]$RetryCount = 1,
    [int]$RetryDelaySec = 2,
    [switch]$VerboseLogging = $false
)

# ─── Fonctions utilitaires ─────────────────────────────────────────────────────

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Output "[$timestamp] [$Level] $Message"
}

function Get-LiveStateViaCim {
    param(
        [string]$ComputerName,
        [int]$TimeoutSec,
        [int]$RetryCount,
        [int]$RetryDelaySec
    )

    for ($attempt = 1; $attempt -le $RetryCount; $attempt++) {
        $session = $null
        try {
            if ($VerboseLogging) {
                Write-Log "Tentative $attempt/$RetryCount pour $ComputerName (timeout: ${TimeoutSec}s)" -Level "DEBUG"
            }

            $session = New-CimSession -ComputerName $ComputerName -OperationTimeoutSec $TimeoutSec -ErrorAction Stop

            # ── CPU — moyenne sur l'instant ──
            $cpu = Get-CimInstance -CimSession $session -ClassName Win32_Processor -ErrorAction Stop |
                   Measure-Object -Property LoadPercentage -Average |
                   Select-Object -ExpandProperty Average

            # ── RAM ──
            $os = Get-CimInstance -CimSession $session -ClassName Win32_OperatingSystem -ErrorAction Stop
            $ramTotalMB = [math]::Round($os.TotalVisibleMemorySize / 1024, 0)
            $ramFreeMB  = [math]::Round($os.FreePhysicalMemory / 1024, 0)
            $ramUsedPct = [math]::Round((($ramTotalMB - $ramFreeMB) / $ramTotalMB) * 100, 2)

            # ── Tous les disques (pas seulement C:) ──
            $disks = Get-CimInstance -CimSession $session -ClassName Win32_LogicalDisk -ErrorAction SilentlyContinue |
                     Where-Object { $_.DriveType -eq 3 }
            $diskInfo = @()
            $totalDiskGB = 0
            $totalFreeGB = 0
            if ($disks) {
                $diskInfo = $disks | ForEach-Object {
                    $dTotal = [math]::Round($_.Size / 1GB, 2)
                    $dFree  = [math]::Round($_.FreeSpace / 1GB, 2)
                    $totalDiskGB += $dTotal
                    $totalFreeGB += $dFree
                    @{
                        drive_letter = $_.DeviceID
                        total_gb     = $dTotal
                        free_gb      = $dFree
                        used_pct     = if ($_.Size -gt 0) { [math]::Round((($_.Size - $_.FreeSpace) / $_.Size) * 100, 2) } else { 0 }
                    }
                }
            }

            # ── Uptime ──
            $uptimeHours = 0
            if ($os.LastBootUpTime) {
                $uptimeHours = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 2)
            }

            # ── Utilisateur connecté ──
            $cs = Get-CimInstance -CimSession $session -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue
            $currentUser = if ($cs) { $cs.UserName } else { $null }

            # ── Informations supplémentaires ──
            $processor = Get-CimInstance -CimSession $session -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
            $memory    = Get-CimInstance -CimSession $session -ClassName Win32_PhysicalMemory -ErrorAction SilentlyContinue
            $net       = Get-CimInstance -CimSession $session -ClassName Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue |
                            Where-Object { $null -ne $_.IPAddress -and $_.IPEnabled -eq $true } |
                            Select-Object -First 1
            $firewall  = Get-CimInstance -CimSession $session -ClassName Win32_FirewallRule -ErrorAction SilentlyContinue | Select-Object -First 1
            $defender  = $null
            try {
                $defender = Get-CimInstance -CimSession $session -ClassName MSFT_MpComputerStatus -Namespace "root\Microsoft\Windows\Defender" -ErrorAction Stop
            } catch {
                # Windows Defender peut ne pas être disponible
            }

            # ── Mémoire totale ──
            $totalMemoryGB = 0
            if ($memory) {
                $totalMemoryGB = [math]::Round(($memory | Measure-Object -Property Capacity -Sum).Sum / 1GB, 2)
            } elseif ($cs -and $cs.TotalPhysicalMemory) {
                $totalMemoryGB = [math]::Round($cs.TotalPhysicalMemory / 1GB, 2)
            }

            # ── Version Windows ──
            $windowsVersion = ""
            $windowsBuild = ""
            $architecture = ""
            if ($os) {
                $windowsVersion = $os.Version
                $windowsBuild = $os.BuildNumber
                $architecture = $os.OSArchitecture
            }

            # ── BIOS ──
            $bios = Get-CimInstance -CimSession $session -ClassName Win32_BIOS -ErrorAction SilentlyContinue
            $biosManufacturer = if ($bios) { $bios.Manufacturer } else { "" }
            $biosVersion = if ($bios) { $bios.SMBIOSBIOSVersion } else { "" }
            $serialNumber = if ($bios) { $bios.SerialNumber } else { "" }

            # ── Processeur ──
            $cpuCount = 0
            $cpuFrequency = 0
            if ($processor) {
                $cpuCount = $processor.NumberOfLogicalProcessors
                $cpuFrequency = $processor.MaxClockSpeed
            }

            # ── Firewall ──
            $firewallEnabled = if ($firewall) { $true } else { $false }

            # ── Windows Defender ──
            $defenderEnabled = $null
            $defenderStatus = $null
            if ($defender) {
                $defenderEnabled = $defender.AntivirusEnabled
                $defenderStatus = $defender.AntivirusSignatureStatus
            }

            # ── Informations réseau ──
            $ipAddress = if ($net) { $net.IPAddress[0] } else { $null }
            $macAddress = if ($net) { $net.MACAddress } else { $null }

            # ── Constructeur et modèle ──
            $manufacturer = if ($cs) { $cs.Manufacturer } else { "" }
            $model = if ($cs) { $cs.Model } else { "" }

            Remove-CimSession $session
            $session = $null

            # ── Résultat complet ──
            $result = [PSCustomObject]@{
                # Champs existants (rétrocompatibilité)
                cpu_usage       = $cpu
                ram_usage       = $ramUsedPct
                ram_total_mb    = $ramTotalMB
                ram_free_mb     = $ramFreeMB
                disk_free_gb    = $totalFreeGB
                disk_total_gb   = $totalDiskGB
                uptime_hours    = $uptimeHours
                current_user    = $currentUser

                # Nouveaux champs enrichis
                manufacturer    = $manufacturer
                model           = $model
                serial_number   = $serialNumber
                bios_manufacturer = $biosManufacturer
                bios_version    = $biosVersion
                windows_version = $windowsVersion
                windows_build   = $windowsBuild
                architecture    = $architecture
                cpu_count       = $cpuCount
                cpu_frequency_mhz = $cpuFrequency
                ram_total_gb    = $totalMemoryGB
                disks           = $diskInfo
                ip_address      = $ipAddress
                mac_address     = $macAddress
                firewall_enabled = $firewallEnabled
                defender_enabled = $defenderEnabled
                defender_status = $defenderStatus
                is_online       = $true
            }

            return $result
        }
        catch {
            if ($VerboseLogging) {
                Write-Log "Échec tentative $attempt/$RetryCount pour $ComputerName : $_" -Level "WARN"
            }
            if ($attempt -lt $RetryCount) {
                Start-Sleep -Seconds $RetryDelaySec
            }
        }
        finally {
            if ($null -ne $session) {
                try {
                    Remove-CimSession $session -ErrorAction SilentlyContinue
                } catch {
                    # Ignorer les erreurs de fermeture de session
                }
            }
        }
    }

    # Poste hors ligne après toutes les tentatives
    if ($VerboseLogging) {
        Write-Log "$ComputerName est hors ligne après $RetryCount tentative(s)" -Level "WARN"
    }
    return $null
}

# ─── Programme principal ────────────────────────────────────────────────────────

$ErrorActionPreference = "SilentlyContinue"
$startTime = Get-Date

if ($VerboseLogging) {
    Write-Log "Interrogation de $ComputerName (timeout: ${TimeoutSec}s, tentatives: ${RetryCount})"
}

$result = Get-LiveStateViaCim -ComputerName $ComputerName -TimeoutSec $TimeoutSec -RetryCount $RetryCount -RetryDelaySec $RetryDelaySec

$durationMs = [math]::Round(((Get-Date) - $startTime).TotalMilliseconds, 0)

if ($result -and $result.is_online) {
    if ($VerboseLogging) {
        Write-Log "$ComputerName répond en ${durationMs}ms" -Level "INFO"
    }
    $result | ConvertTo-Json -Depth 10 -Compress
} else {
    # Poste hors ligne ou inaccessible
    $errorResult = @{
        error       = "Poste inaccessible après $RetryCount tentative(s) (${durationMs}ms)"
        hostname    = $ComputerName
        is_online   = $false
        duration_ms = $durationMs
    }
    Write-Output ($errorResult | ConvertTo-Json -Compress)
    exit 1
}