# backend/src/services/networkDiscovery/scan-ad.ps1
# Scanne tous les postes du domaine AD et retourne du JSON
# Ce script est appelé automatiquement par le backend Node.js — ne pas planifier séparément
#
# Paramètres optionnels (passés en arguments nommés) :
#   -TimeoutSec        : Timeout CIM par poste (défaut: 10)
#   -MaxParallel       : Nombre max de postes interrogés en parallèle (défaut: 32)
#   -RetryCount        : Nombre de tentatives par poste (défaut: 1)
#   -RetryDelaySec     : Délai entre tentatives (défaut: 2)
#   -VerboseLogging    : Active les logs détaillés (défaut: $false)

param(
    [int]$TimeoutSec = 10,
    [int]$MaxParallel = 32,
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

function Get-ComputerInfoViaCim {
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

            # ── Interrogations CIM parallélisées via une seule session ──
            $bios = Get-CimInstance -CimSession $session -ClassName Win32_BIOS -ErrorAction Stop
            $os   = Get-CimInstance -CimSession $session -ClassName Win32_OperatingSystem -ErrorAction Stop
            $cs   = Get-CimInstance -CimSession $session -ClassName Win32_ComputerSystem -ErrorAction Stop
            $net  = Get-CimInstance -CimSession $session -ClassName Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue |
                        Where-Object { $null -ne $_.IPAddress -and $_.IPEnabled -eq $true } |
                        Select-Object -First 1

            # ── Informations supplémentaires ──
            $processor = Get-CimInstance -CimSession $session -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
            $memory    = Get-CimInstance -CimSession $session -ClassName Win32_PhysicalMemory -ErrorAction SilentlyContinue
            $disk      = Get-CimInstance -CimSession $session -ClassName Win32_LogicalDisk -ErrorAction SilentlyContinue | Where-Object { $_.DriveType -eq 3 }
            $firewall  = Get-CimInstance -CimSession $session -ClassName Win32_FirewallRule -ErrorAction SilentlyContinue | Select-Object -First 1
            $defender  = $null
            try {
                $defender = Get-CimInstance -CimSession $session -ClassName MSFT_MpComputerStatus -Namespace "root\Microsoft\Windows\Defender" -ErrorAction Stop
            } catch {
                # Windows Defender peut ne pas être disponible — ignorer silencieusement
            }

            # ── Calcul de la mémoire totale ──
            $totalMemoryGB = 0
            if ($memory) {
                $totalMemoryGB = [math]::Round(($memory | Measure-Object -Property Capacity -Sum).Sum / 1GB, 2)
            } elseif ($cs.TotalPhysicalMemory) {
                $totalMemoryGB = [math]::Round($cs.TotalPhysicalMemory / 1GB, 2)
            }

            # ── Informations disques ──
            $diskInfo = @()
            if ($disk) {
                $diskInfo = $disk | ForEach-Object {
                    @{
                        drive_letter  = $_.DeviceID
                        total_gb      = [math]::Round($_.Size / 1GB, 2)
                        free_gb       = [math]::Round($_.FreeSpace / 1GB, 2)
                        used_pct      = if ($_.Size -gt 0) { [math]::Round((($_.Size - $_.FreeSpace) / $_.Size) * 100, 2) } else { 0 }
                    }
                }
            }

            # ── Informations réseau ──
            $networkInfo = @()
            if ($net) {
                $networkInfo = @($net | ForEach-Object {
                    @{
                        ip_address  = $_.IPAddress[0]
                        mac_address = $_.MACAddress
                        description = $_.Description
                    }
                })
            }

            # ── Uptime ──
            $uptimeHours = 0
            if ($os.LastBootUpTime) {
                $uptimeHours = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 2)
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
            $biosManufacturer = ""
            $biosVersion = ""
            if ($bios) {
                $biosManufacturer = $bios.Manufacturer
                $biosVersion = $bios.SMBIOSBIOSVersion
            }

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

            # ── Résultat ──
            $result = [PSCustomObject]@{
                # Champs existants (rétrocompatibilité)
                hostname        = $computer
                username        = $cs.UserName
                ip_address      = if ($net) { $net.IPAddress[0] } else { $null }
                mac_address     = if ($net) { $net.MACAddress } else { $null }
                serial          = $bios.SerialNumber
                os              = $os.Caption

                # Nouveaux champs enrichis
                manufacturer    = $cs.Manufacturer
                model           = $cs.Model
                bios_manufacturer = $biosManufacturer
                bios_version    = $biosVersion
                windows_version = $windowsVersion
                windows_build   = $windowsBuild
                architecture    = $architecture
                cpu_count       = $cpuCount
                cpu_frequency_mhz = $cpuFrequency
                ram_total_gb    = $totalMemoryGB
                disks           = $diskInfo
                network         = $networkInfo
                logged_in_user  = $cs.UserName
                uptime_hours    = $uptimeHours
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

    # Poste hors ligne ou inaccessible après toutes les tentatives
    if ($VerboseLogging) {
        Write-Log "$ComputerName est hors ligne après $RetryCount tentative(s)" -Level "WARN"
    }
    return $null
}

# ─── Programme principal ────────────────────────────────────────────────────────

$ErrorActionPreference = "SilentlyContinue"
$results = @()
$offlineComputers = @()
$errorCount = 0
$startTime = Get-Date

Write-Log "Démarrage du scan AD (timeout: ${TimeoutSec}s, parallélisme: ${MaxParallel}, tentatives: ${RetryCount})"

try {
    $computers = Get-ADComputer -Filter * -Property Name | Select-Object -ExpandProperty Name
    Write-Log "$($computers.Count) poste(s) trouvé(s) dans l'Active Directory"
} catch {
    Write-Log "Impossible de lister les postes AD : $_" -Level "ERROR"
    $errorResult = @{
        error       = "Impossible de lister les postes AD : $_"
        total       = 0
        online      = 0
        offline     = 0
        errors      = 1
        duration_ms = 0
    }
    Write-Output ($errorResult | ConvertTo-Json -Compress)
    exit 1
}

# ── Traitement parallélisé avec limite de concurrence ──
$computerQueue = [System.Collections.Queue]::new($computers)
$activeJobs = @{}
$completedCount = 0

while ($computerQueue.Count -gt 0 -or $activeJobs.Count -gt 0) {
    # Démarrer de nouveaux jobs si la limite n'est pas atteinte
    while ($computerQueue.Count -gt 0 -and $activeJobs.Count -lt $MaxParallel) {
        $computer = $computerQueue.Dequeue()
        $job = Start-Job -ScriptBlock {
            param($comp, $timeout, $retry, $delay, $verbose)
            $result = Get-ComputerInfoViaCim -ComputerName $comp -TimeoutSec $timeout -RetryCount $retry -RetryDelaySec $delay -VerboseLogging:$verbose
            return $result
        } -ArgumentList $computer, $TimeoutSec, $RetryCount, $RetryDelaySec, $VerboseLogging
        $activeJobs[$job.Id] = $computer
    }

    # Attendre qu'au moins un job se termine
    if ($activeJobs.Count -gt 0) {
        $completed = Wait-Job -Job ($activeJobs.Keys | ForEach-Object { Get-Job -Id $_ }) -Any -TimeoutSec 1
        if ($completed) {
            foreach ($job in $completed) {
                $computerName = $activeJobs[$job.Id]
                try {
                    $data = Receive-Job -Job $job
                    if ($data -and $data.is_online) {
                        $results += $data
                    } else {
                        $offlineComputers += $computerName
                    }
                } catch {
                    $errorCount++
                    $offlineComputers += $computerName
                    if ($VerboseLogging) {
                        Write-Log "Erreur réception résultat pour $computerName : $_" -Level "ERROR"
                    }
                }
                Remove-Job -Job $job -Force
                $activeJobs.Remove($job.Id)
                $completedCount++
            }
        }
    }
}

$durationMs = [math]::Round(((Get-Date) - $startTime).TotalMilliseconds, 0)
$onlineCount = $results.Count
$offlineCount = $offlineComputers.Count

Write-Log "Scan AD terminé en ${durationMs}ms — $onlineCount en ligne, $offlineCount hors ligne, $errorCount erreur(s)"

# ── Sortie JSON unique, lue par le backend Node.js ──
$output = @{
    computers = $results
    summary   = @{
        total       = $computers.Count
        online      = $onlineCount
        offline     = $offlineCount
        errors      = $errorCount
        duration_ms = $durationMs
    }
}
$output | ConvertTo-Json -Depth 10 -Compress