# get-live-state-test.ps1
# Version de TEST autonome — récupère l'état en direct d'un poste distant
# via WMI/CIM et exporte le résultat vers un fichier Microsoft Excel (.xlsx)
# via COM Automation (Excel.Application).
#
# Ce script est totalement independant : pas de Node.js, pas de PostgreSQL,
# pas de fichier .env, pas d'API REST. Il peut etre copie tel quel sur un
# poste Windows disposant de Microsoft Excel.
#
# Paramètres :
#   -ComputerName    : Nom du poste distant (obligatoire)
#   -TimeoutSec      : Timeout CIM (défaut: 10)
#   -RetryCount      : Nombre de tentatives (défaut: 1)
#   -RetryDelaySec   : Délai entre tentatives (défaut: 2)
#   -VerboseLogging  : Active les logs détaillés (défaut: $false)
#   -OutputFolder    : Dossier de destination du fichier Excel (défaut: dossier courant)

param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName,

    [int]$TimeoutSec = 10,
    [int]$RetryCount = 1,
    [int]$RetryDelaySec = 2,
    [switch]$VerboseLogging = $false,
    [string]$OutputFolder = (Get-Location).Path
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

# ─── Export Excel via COM Automation ────────────────────────────────────────────

function Export-LiveStateToExcel {
    param(
        [PSCustomObject]$State,
        [string]$ComputerName,
        [string]$OutputFolder
    )

    # Vérifier que Microsoft Excel est installé sur ce poste
    $excel = $null
    try {
        $excel = New-Object -ComObject Excel.Application
    } catch {
        Write-Log "Microsoft Excel n'est pas installé sur ce poste. Export impossible." -Level "ERROR"
        return $null
    }

    $workbook = $null
    $sheet = $null

    try {
        $excel.Visible = $false
        $excel.DisplayAlerts = $false

        $workbook = $excel.Workbooks.Add()
        $sheet = $workbook.Worksheets.Item(1)
        $sheet.Name = "Etat"

        # ── Construction du tableau disques (texte lisible) ──
        $disksText = ""
        if ($State.disks -and $State.disks.Count -gt 0) {
            $disksText = ($State.disks | ForEach-Object {
                "$($_.drive_letter) : $($_.free_gb) Go libres / $($_.total_gb) Go ($($_.used_pct)% utilisé)"
            }) -join " | "
        }

        $props = @(
            @("Nom du poste", $ComputerName),
            @("Utilisateur connecté", $State.current_user),
            @("CPU (utilisation %)", $State.cpu_usage),
            @("RAM (utilisation %)", $State.ram_usage),
            @("RAM totale (MB)", $State.ram_total_mb),
            @("RAM libre (MB)", $State.ram_free_mb),
            @("RAM totale (GB)", $State.ram_total_gb),
            @("Disques", $disksText),
            @("Espace disque total (GB)", $State.disk_total_gb),
            @("Espace disque libre (GB)", $State.disk_free_gb),
            @("Adresse IP", $State.ip_address),
            @("Adresse MAC", $State.mac_address),
            @("Fabricant", $State.manufacturer),
            @("Modèle", $State.model),
            @("Numéro de série", $State.serial_number),
            @("BIOS Fabricant", $State.bios_manufacturer),
            @("BIOS Version", $State.bios_version),
            @("Version Windows", $State.windows_version),
            @("Build Windows", $State.windows_build),
            @("Architecture", $State.architecture),
            @("Nombre de coeurs CPU", $State.cpu_count),
            @("Fréquence CPU (MHz)", $State.cpu_frequency_mhz),
            @("Firewall actif", $(if ($State.firewall_enabled) { "Oui" } else { "Non" })),
            @("Windows Defender actif", $(if ($null -eq $State.defender_enabled) { "N/A" } elseif ($State.defender_enabled) { "Oui" } else { "Non" })),
            @("Statut Defender", $(if ($null -eq $State.defender_status) { "N/A" } else { $State.defender_status })),
            @("Uptime (heures)", $State.uptime_hours),
            @("Date de la capture", (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
        )

        # ── En-têtes ──
        $sheet.Cells.Item(1, 1) = "Propriété"
        $sheet.Cells.Item(1, 2) = "Valeur"
        $headerRange = $sheet.Range($sheet.Cells.Item(1, 1), $sheet.Cells.Item(1, 2))
        $headerRange.Font.Bold = $true
        $headerRange.Interior.ColorIndex = 15

        $row = 2
        foreach ($p in $props) {
            $sheet.Cells.Item($row, 1) = $p[0]
            $sheet.Cells.Item($row, 2) = $p[1]
            $row++
        }

        $usedRange = $sheet.UsedRange
        $usedRange.EntireColumn.AutoFit() | Out-Null
        $sheet.Columns.Item(2).ColumnWidth = 60
        $sheet.Application.ActiveWindow.SplitRow = 1
        $sheet.Application.ActiveWindow.FreezePanes = $true

        # ── Sauvegarde ──
        if (-not (Test-Path $OutputFolder)) {
            New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
        }
        $safeName = $ComputerName -replace '[\\/:*?"<>|]', '_'
        $fileName = "Etat_${safeName}_$(Get-Date -Format 'yyyyMMdd_HHmm').xlsx"
        $fullPath = Join-Path $OutputFolder $fileName

        # 51 = xlOpenXMLWorkbook (.xlsx)
        $workbook.SaveAs($fullPath, 51)
        $workbook.Close($false)
        $excel.Quit()

        return $fullPath
    }
    catch {
        Write-Log "Erreur lors de la génération du fichier Excel : $_" -Level "ERROR"
        try { if ($workbook) { $workbook.Close($false) } } catch {}
        try { $excel.Quit() } catch {}
        return $null
    }
    finally {
        # ── Libération complète des objets COM ──
        if ($usedRange) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($usedRange) | Out-Null }
        if ($headerRange) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($headerRange) | Out-Null }
        if ($sheet) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($sheet) | Out-Null }
        if ($workbook) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null }
        if ($excel) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
        [System.GC]::Collect()
    }
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

    Write-Log "Génération du fichier Excel en cours..."
    $excelPath = Export-LiveStateToExcel -State $result -ComputerName $ComputerName -OutputFolder $OutputFolder

    if ($excelPath) {
        Write-Log "Fichier Excel généré avec succès : $excelPath" -Level "INFO"
        Write-Output "Fichier Excel : $excelPath"
    } else {
        Write-Log "Échec de la génération du fichier Excel." -Level "ERROR"
        exit 1
    }
} else {
    # Poste hors ligne ou inaccessible
    Write-Log "Poste inaccessible après $RetryCount tentative(s) (${durationMs}ms)" -Level "ERROR"
    exit 1
}
