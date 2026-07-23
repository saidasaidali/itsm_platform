# scan-network-test.ps1
# Version de TEST autonome — scan direct d'une plage d'IP (SANS Active Directory)
# via CIM/WMI, avec export automatique des resultats vers un fichier Excel (.xlsx)
# via COM Automation (Excel.Application).
#
# Ce script est totalement independant : pas de Node.js, pas de PostgreSQL,
# pas de fichier .env, pas d'API REST, pas d'Active Directory.
# Il scanne directement une plage d'adresses IP fournie en parametre.
#
# Parametres :
#   -StartIP           : Premiere adresse IP de la plage (obligatoire, ex: 192.168.1.1)
#   -EndIP             : Derniere adresse IP de la plage (obligatoire, ex: 192.168.1.254)
#   -TimeoutSec        : Timeout CIM par poste (defaut: 10)
#   -PingTimeoutMs     : Timeout du ping ICMP de pre-filtrage (defaut: 500)
#   -SkipPing          : Si active, saute le pre-filtrage ping et tente CIM sur TOUTES les IP
#   -Protocol          : Protocole CIM : "Wsman" (WinRM, defaut) ou "Dcom" (RPC/DCOM classique)
#   -MaxParallel       : Nombre max de postes interroges en parallele (defaut: 32)
#   -RetryCount        : Nombre de tentatives CIM par poste (defaut: 1)
#   -RetryDelaySec     : Delai entre tentatives (defaut: 2)
#   -VerboseLogging    : Active les logs detailles (defaut: $false)
#   -OutputFolder      : Dossier de destination du fichier Excel (defaut: dossier courant)
#
# Exemple :
#   .\scan-network-test.ps1 -StartIP 192.168.1.1 -EndIP 192.168.1.50 -VerboseLogging
#
# Prerequis :
#   - Microsoft Excel installe sur le poste qui execute le script (export .xlsx via COM)
#   - Pour interroger un poste distant en CIM, ce poste doit soit :
#       a) avoir WinRM active (Enable-PSRemoting) -> utiliser -Protocol Wsman (defaut)
#       b) accepter le DCOM/RPC classique (WMI historique) -> utiliser -Protocol Dcom
#   - Le compte qui execute le script doit avoir les droits d'administration sur les
#     postes cibles (sinon la creation de session CIM echouera silencieusement, et le
#     poste sera marque "hors ligne").

param(
    [Parameter(Mandatory = $true)]
    [string]$StartIP,

    [Parameter(Mandatory = $true)]
    [string]$EndIP,

    [int]$TimeoutSec = 10,
    [int]$PingTimeoutMs = 500,
    [switch]$SkipPing = $false,

    [ValidateSet("Wsman", "Dcom")]
    [string]$Protocol = "Wsman",

    [int]$MaxParallel = 32,
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

function Convert-IpToInt {
    param([string]$Ip)
    $bytes = [System.Net.IPAddress]::Parse($Ip).GetAddressBytes()
    [Array]::Reverse($bytes)
    return [BitConverter]::ToUInt32($bytes, 0)
}

function Convert-IntToIp {
    param([uint32]$Int)
    $bytes = [BitConverter]::GetBytes($Int)
    [Array]::Reverse($bytes)
    return ([System.Net.IPAddress]::new($bytes)).ToString()
}

function Test-HostAlive {
    param(
        [string]$IpAddress,
        [int]$TimeoutMs = 500
    )
    $ping = $null
    try {
        $ping = New-Object System.Net.NetworkInformation.Ping
        $reply = $ping.Send($IpAddress, $TimeoutMs)
        return ($reply.Status -eq [System.Net.NetworkInformation.IPStatus]::Success)
    }
    catch {
        return $false
    }
    finally {
        if ($ping) { $ping.Dispose() }
    }
}

function Get-ComputerInfoViaCim {
    param(
        [string]$ComputerName,
        [int]$TimeoutSec,
        [int]$RetryCount,
        [int]$RetryDelaySec,
        [string]$Protocol = "Wsman",
        [switch]$VerboseLogging = $false
    )

    for ($attempt = 1; $attempt -le $RetryCount; $attempt++) {
        $session = $null
        try {
            if ($VerboseLogging) {
                Write-Log "Tentative $attempt/$RetryCount pour $ComputerName (timeout: ${TimeoutSec}s, protocole: $Protocol)" -Level "DEBUG"
            }

            if ($Protocol -eq "Dcom") {
                $sessionOption = New-CimSessionOption -Protocol Dcom
                $session = New-CimSession -ComputerName $ComputerName -OperationTimeoutSec $TimeoutSec -SessionOption $sessionOption -ErrorAction Stop
            }
            else {
                $session = New-CimSession -ComputerName $ComputerName -OperationTimeoutSec $TimeoutSec -ErrorAction Stop
            }

            # ── Interrogations CIM via une seule session ──
            $bios = Get-CimInstance -CimSession $session -ClassName Win32_BIOS -ErrorAction Stop
            $os   = Get-CimInstance -CimSession $session -ClassName Win32_OperatingSystem -ErrorAction Stop
            $cs   = Get-CimInstance -CimSession $session -ClassName Win32_ComputerSystem -ErrorAction Stop
            $net  = Get-CimInstance -CimSession $session -ClassName Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue |
                        Where-Object { $null -ne $_.IPAddress -and $_.IPEnabled -eq $true } |
                        Select-Object -First 1

            # ── Informations supplementaires ──
            $processor = Get-CimInstance -CimSession $session -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
            $memory    = Get-CimInstance -CimSession $session -ClassName Win32_PhysicalMemory -ErrorAction SilentlyContinue
            $disk      = Get-CimInstance -CimSession $session -ClassName Win32_LogicalDisk -ErrorAction SilentlyContinue | Where-Object { $_.DriveType -eq 3 }
            $firewall  = Get-CimInstance -CimSession $session -ClassName Win32_FirewallRule -ErrorAction SilentlyContinue | Select-Object -First 1
            $defender  = $null
            try {
                $defender = Get-CimInstance -CimSession $session -ClassName MSFT_MpComputerStatus -Namespace "root\Microsoft\Windows\Defender" -ErrorAction Stop
            } catch {
                # Windows Defender peut ne pas etre disponible — ignorer silencieusement
            }

            # ── Calcul de la memoire totale ──
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

            # ── Informations reseau ──
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

            # ── Resultat ──
            # NOTE CORRIGEE : hostname utilisait $computer (variable inexistante dans
            # le script original) au lieu de $ComputerName -> corrige ci-dessous.
            $result = [PSCustomObject]@{
                hostname          = $ComputerName
                username          = $cs.UserName
                ip_address        = if ($net) { $net.IPAddress[0] } else { $ComputerName }
                mac_address       = if ($net) { $net.MACAddress } else { $null }
                serial            = $bios.SerialNumber
                os                = $os.Caption
                manufacturer      = $cs.Manufacturer
                model             = $cs.Model
                bios_manufacturer = $biosManufacturer
                bios_version      = $biosVersion
                windows_version   = $windowsVersion
                windows_build     = $windowsBuild
                architecture      = $architecture
                cpu_count         = $cpuCount
                cpu_frequency_mhz = $cpuFrequency
                ram_total_gb      = $totalMemoryGB
                disks             = $diskInfo
                network           = $networkInfo
                logged_in_user    = $cs.UserName
                uptime_hours      = $uptimeHours
                firewall_enabled  = $firewallEnabled
                defender_enabled  = $defenderEnabled
                defender_status   = $defenderStatus
                is_online         = $true
            }

            return $result
        }
        catch {
            if ($VerboseLogging) {
                Write-Log "Echec tentative $attempt/$RetryCount pour $ComputerName : $_" -Level "WARN"
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

    # Poste hors ligne ou inaccessible apres toutes les tentatives
    if ($VerboseLogging) {
        Write-Log "$ComputerName est hors ligne ou inaccessible en CIM apres $RetryCount tentative(s)" -Level "WARN"
    }
    return $null
}

# ─── Export Excel via COM Automation ────────────────────────────────────────────

function Export-ScanResultsToExcel {
    param(
        [array]$Results,
        [hashtable]$Summary,
        [string]$OutputFolder
    )

    $excel = $null
    try {
        $excel = New-Object -ComObject Excel.Application
    } catch {
        Write-Log "Microsoft Excel n'est pas installe sur ce poste. Export impossible." -Level "ERROR"
        return $null
    }

    $workbook = $null
    $sheetMachines = $null
    $sheetResume = $null
    $usedRange = $null
    $headerRange = $null
    $resumeUsedRange = $null
    $resumeHeaderRange = $null

    try {
        $excel.Visible = $false
        $excel.DisplayAlerts = $false

        $workbook = $excel.Workbooks.Add()

        # ── Feuille 1 : Machines (la liste complete des equipements) ──
        $sheetMachines = $workbook.Worksheets.Item(1)
        $sheetMachines.Name = "Machines"

        $headers = @(
            "Hostname / IP", "Utilisateur", "Adresse IP", "Adresse MAC", "Numero de serie",
            "OS", "Fabricant", "Modele", "BIOS Fabricant", "BIOS Version",
            "Version Windows", "Build", "Architecture", "CPU (coeurs)", "Frequence CPU (MHz)",
            "RAM (GB)", "Uptime (h)", "Firewall", "Defender Actif", "Defender Statut", "Statut Online"
        )

        for ($col = 0; $col -lt $headers.Count; $col++) {
            $sheetMachines.Cells.Item(1, $col + 1) = $headers[$col]
        }
        $headerRange = $sheetMachines.Range($sheetMachines.Cells.Item(1, 1), $sheetMachines.Cells.Item(1, $headers.Count))
        $headerRange.Font.Bold = $true
        $headerRange.Interior.ColorIndex = 15

        $row = 2
        foreach ($m in $Results) {
            $sheetMachines.Cells.Item($row, 1)  = $m.hostname
            $sheetMachines.Cells.Item($row, 2)  = $m.username
            $sheetMachines.Cells.Item($row, 3)  = $m.ip_address
            $sheetMachines.Cells.Item($row, 4)  = $m.mac_address
            $sheetMachines.Cells.Item($row, 5)  = $m.serial
            $sheetMachines.Cells.Item($row, 6)  = $m.os
            $sheetMachines.Cells.Item($row, 7)  = $m.manufacturer
            $sheetMachines.Cells.Item($row, 8)  = $m.model
            $sheetMachines.Cells.Item($row, 9)  = $m.bios_manufacturer
            $sheetMachines.Cells.Item($row, 10) = $m.bios_version
            $sheetMachines.Cells.Item($row, 11) = $m.windows_version
            $sheetMachines.Cells.Item($row, 12) = $m.windows_build
            $sheetMachines.Cells.Item($row, 13) = $m.architecture
            $sheetMachines.Cells.Item($row, 14) = $m.cpu_count
            $sheetMachines.Cells.Item($row, 15) = $m.cpu_frequency_mhz
            $sheetMachines.Cells.Item($row, 16) = $m.ram_total_gb
            $sheetMachines.Cells.Item($row, 17) = $m.uptime_hours
            $sheetMachines.Cells.Item($row, 18) = if ($m.firewall_enabled) { "Actif" } else { "Inactif" }
            $sheetMachines.Cells.Item($row, 19) = if ($null -eq $m.defender_enabled) { "N/A" } elseif ($m.defender_enabled) { "Oui" } else { "Non" }
            $sheetMachines.Cells.Item($row, 20) = if ($null -eq $m.defender_status) { "N/A" } else { $m.defender_status }
            $sheetMachines.Cells.Item($row, 21) = if ($m.is_online) { "En ligne" } else { "Hors ligne" }
            $row++
        }

        $usedRange = $sheetMachines.UsedRange
        $usedRange.EntireColumn.AutoFit() | Out-Null
        $sheetMachines.Application.ActiveWindow.SplitRow = 1
        $sheetMachines.Application.ActiveWindow.FreezePanes = $true

        # ── Feuille 2 : Resume ──
        $sheetResume = $workbook.Worksheets.Add()
        $sheetResume.Name = "Resume"

        $resumeData = @(
            @("Nombre total d'IP scannees", $Summary.total),
            @("Nombre en ligne", $Summary.online),
            @("Nombre hors ligne", $Summary.offline),
            @("Nombre d'erreurs", $Summary.errors),
            @("Duree du scan (ms)", $Summary.duration_ms),
            @("Date du scan", (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
        )

        $sheetResume.Cells.Item(1, 1) = "Propriete"
        $sheetResume.Cells.Item(1, 2) = "Valeur"
        $resumeHeaderRange = $sheetResume.Range($sheetResume.Cells.Item(1, 1), $sheetResume.Cells.Item(1, 2))
        $resumeHeaderRange.Font.Bold = $true
        $resumeHeaderRange.Interior.ColorIndex = 15

        $r = 2
        foreach ($line in $resumeData) {
            $sheetResume.Cells.Item($r, 1) = $line[0]
            $sheetResume.Cells.Item($r, 2) = $line[1]
            $r++
        }
        $resumeUsedRange = $sheetResume.UsedRange
        $resumeUsedRange.EntireColumn.AutoFit() | Out-Null

        $sheetMachines.Activate()

        if (-not (Test-Path $OutputFolder)) {
            New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
        }
        $fileName = "Inventaire_Parc_$(Get-Date -Format 'yyyyMMdd_HHmm').xlsx"
        $fullPath = Join-Path $OutputFolder $fileName

        $workbook.SaveAs($fullPath, 51) # 51 = xlOpenXMLWorkbook (.xlsx)
        $workbook.Close($false)
        $excel.Quit()

        return $fullPath
    }
    catch {
        Write-Log "Erreur lors de la generation du fichier Excel : $_" -Level "ERROR"
        try { if ($workbook) { $workbook.Close($false) } } catch {}
        try { $excel.Quit() } catch {}
        return $null
    }
    finally {
        if ($resumeUsedRange) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($resumeUsedRange) | Out-Null }
        if ($resumeHeaderRange) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($resumeHeaderRange) | Out-Null }
        if ($sheetResume) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($sheetResume) | Out-Null }
        if ($usedRange) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($usedRange) | Out-Null }
        if ($headerRange) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($headerRange) | Out-Null }
        if ($sheetMachines) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($sheetMachines) | Out-Null }
        if ($workbook) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null }
        if ($excel) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
        [System.GC]::Collect()
    }
}

# ─── Programme principal ────────────────────────────────────────────────────────

$ErrorActionPreference = "SilentlyContinue"
$results = @()
$offlineComputers = @()
$errorCount = 0
$startTime = Get-Date

Write-Log "Demarrage du scan reseau direct (sans AD) : $StartIP -> $EndIP"
Write-Log "Parametres : timeout CIM=${TimeoutSec}s, protocole=$Protocol, parallelisme=$MaxParallel, tentatives=$RetryCount"

$startInt = Convert-IpToInt -Ip $StartIP
$endInt   = Convert-IpToInt -Ip $EndIP

if ($endInt -lt $startInt) {
    Write-Log "L'adresse IP de fin doit etre superieure ou egale a l'adresse de debut." -Level "ERROR"
    exit 1
}

$allIps = for ($cur = $startInt; $cur -le $endInt; $cur++) { Convert-IntToIp -Int $cur }
Write-Log "$($allIps.Count) adresse(s) IP a analyser dans la plage demandee"

if (-not $SkipPing) {
    Write-Log "Pre-filtrage ICMP (ping) pour ne garder que les postes actifs (accelere le scan)..."
    $computers = @()
    $pingedCount = 0
    foreach ($ip in $allIps) {
        $pingedCount++
        Write-Progress -Activity "Pre-filtrage ping" -Status "Test de $ip ($pingedCount / $($allIps.Count))" -PercentComplete (($pingedCount / $allIps.Count) * 100)
        if (Test-HostAlive -IpAddress $ip -TimeoutMs $PingTimeoutMs) {
            $computers += $ip
        }
    }
    Write-Progress -Activity "Pre-filtrage ping" -Completed
    Write-Log "$($computers.Count) poste(s) repondent au ping sur $($allIps.Count) IP testees"
}
else {
    Write-Log "Pre-filtrage ping desactive (-SkipPing) : tentative CIM directe sur toutes les IP"
    $computers = $allIps
}

if ($computers.Count -eq 0) {
    Write-Log "Aucun poste actif detecte dans la plage. Fin du scan." -Level "WARN"
    $summary = @{ total = $allIps.Count; online = 0; offline = $allIps.Count; errors = 0; duration_ms = 0 }
    $excelPath = Export-ScanResultsToExcel -Results @() -Summary $summary -OutputFolder $OutputFolder
    if ($excelPath) { Write-Output "Fichier Excel : $excelPath" }
    exit 0
}

# ── Traitement parallelise avec limite de concurrence ──
$computerQueue = [System.Collections.Queue]::new($computers)
$activeJobs = @{}
$completedCount = 0

while ($computerQueue.Count -gt 0 -or $activeJobs.Count -gt 0) {
    while ($computerQueue.Count -gt 0 -and $activeJobs.Count -lt $MaxParallel) {
        $computer = $computerQueue.Dequeue()
        $job = Start-Job -ScriptBlock {
            param($comp, $timeout, $retry, $delay, $protocol, $verbose)

            function Get-ComputerInfoViaCim {
                param(
                    [string]$ComputerName,
                    [int]$TimeoutSec,
                    [int]$RetryCount,
                    [int]$RetryDelaySec,
                    [string]$Protocol = "Wsman",
                    [switch]$VerboseLogging = $false
                )
                for ($attempt = 1; $attempt -le $RetryCount; $attempt++) {
                    $session = $null
                    try {
                        if ($Protocol -eq "Dcom") {
                            $sessionOption = New-CimSessionOption -Protocol Dcom
                            $session = New-CimSession -ComputerName $ComputerName -OperationTimeoutSec $TimeoutSec -SessionOption $sessionOption -ErrorAction Stop
                        } else {
                            $session = New-CimSession -ComputerName $ComputerName -OperationTimeoutSec $TimeoutSec -ErrorAction Stop
                        }
                        $bios = Get-CimInstance -CimSession $session -ClassName Win32_BIOS -ErrorAction Stop
                        $os   = Get-CimInstance -CimSession $session -ClassName Win32_OperatingSystem -ErrorAction Stop
                        $cs   = Get-CimInstance -CimSession $session -ClassName Win32_ComputerSystem -ErrorAction Stop
                        $net  = Get-CimInstance -CimSession $session -ClassName Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue |
                                    Where-Object { $null -ne $_.IPAddress -and $_.IPEnabled -eq $true } | Select-Object -First 1
                        $processor = Get-CimInstance -CimSession $session -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
                        $memory    = Get-CimInstance -CimSession $session -ClassName Win32_PhysicalMemory -ErrorAction SilentlyContinue
                        $firewall  = Get-CimInstance -CimSession $session -ClassName Win32_FirewallRule -ErrorAction SilentlyContinue | Select-Object -First 1
                        $defender  = $null
                        try {
                            $defender = Get-CimInstance -CimSession $session -ClassName MSFT_MpComputerStatus -Namespace "root\Microsoft\Windows\Defender" -ErrorAction Stop
                        } catch {}

                        $totalMemoryGB = 0
                        if ($memory) {
                            $totalMemoryGB = [math]::Round(($memory | Measure-Object -Property Capacity -Sum).Sum / 1GB, 2)
                        } elseif ($cs.TotalPhysicalMemory) {
                            $totalMemoryGB = [math]::Round($cs.TotalPhysicalMemory / 1GB, 2)
                        }

                        $uptimeHours = 0
                        if ($os.LastBootUpTime) { $uptimeHours = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 2) }

                        $cpuCount = 0; $cpuFrequency = 0
                        if ($processor) { $cpuCount = $processor.NumberOfLogicalProcessors; $cpuFrequency = $processor.MaxClockSpeed }

                        $firewallEnabled = if ($firewall) { $true } else { $false }
                        $defenderEnabled = $null; $defenderStatus = $null
                        if ($defender) { $defenderEnabled = $defender.AntivirusEnabled; $defenderStatus = $defender.AntivirusSignatureStatus }

                        return [PSCustomObject]@{
                            hostname          = $ComputerName
                            username          = $cs.UserName
                            ip_address        = if ($net) { $net.IPAddress[0] } else { $ComputerName }
                            mac_address       = if ($net) { $net.MACAddress } else { $null }
                            serial            = $bios.SerialNumber
                            os                = $os.Caption
                            manufacturer      = $cs.Manufacturer
                            model             = $cs.Model
                            bios_manufacturer = $bios.Manufacturer
                            bios_version      = $bios.SMBIOSBIOSVersion
                            windows_version   = $os.Version
                            windows_build     = $os.BuildNumber
                            architecture      = $os.OSArchitecture
                            cpu_count         = $cpuCount
                            cpu_frequency_mhz = $cpuFrequency
                            ram_total_gb      = $totalMemoryGB
                            logged_in_user    = $cs.UserName
                            uptime_hours      = $uptimeHours
                            firewall_enabled  = $firewallEnabled
                            defender_enabled  = $defenderEnabled
                            defender_status   = $defenderStatus
                            is_online         = $true
                        }
                    }
                    catch {
                        if ($attempt -lt $RetryCount) { Start-Sleep -Seconds $RetryDelaySec }
                    }
                    finally {
                        if ($null -ne $session) { try { Remove-CimSession $session -ErrorAction SilentlyContinue } catch {} }
                    }
                }
                return $null
            }

            $result = Get-ComputerInfoViaCim -ComputerName $comp -TimeoutSec $timeout -RetryCount $retry -RetryDelaySec $delay -Protocol $protocol -VerboseLogging:$verbose
            return $result
        } -ArgumentList $computer, $TimeoutSec, $RetryCount, $RetryDelaySec, $Protocol, $VerboseLogging
        $activeJobs[$job.Id] = $computer
    }

    if ($activeJobs.Count -gt 0) {
        $completed = Wait-Job -Job ($activeJobs.Keys | ForEach-Object { Get-Job -Id $_ }) -Any -TimeoutSec 1
        if ($completed) {
            foreach ($job in $completed) {
                $computerName = $activeJobs[$job.Id]
                try {
                    $data = Receive-Job -Job $job
                    if ($data -and $data.is_online) {
                        $results += $data
                        if ($VerboseLogging) { Write-Log "$computerName -> reponse CIM recue" -Level "DEBUG" }
                    } else {
                        $offlineComputers += $computerName
                    }
                } catch {
                    $errorCount++
                    $offlineComputers += $computerName
                    if ($VerboseLogging) {
                        Write-Log "Erreur reception resultat pour $computerName : $_" -Level "ERROR"
                    }
                }
                Remove-Job -Job $job -Force
                $activeJobs.Remove($job.Id)
                $completedCount++
                Write-Progress -Activity "Scan CIM" -Status "$completedCount / $($computers.Count) postes traites" -PercentComplete (($completedCount / $computers.Count) * 100)
            }
        }
    }
}
Write-Progress -Activity "Scan CIM" -Completed

$durationMs = [math]::Round(((Get-Date) - $startTime).TotalMilliseconds, 0)
$onlineCount = $results.Count
$offlineCount = $offlineComputers.Count

Write-Log "Scan reseau termine en ${durationMs}ms — $onlineCount en ligne, $offlineCount hors ligne/inaccessible, $errorCount erreur(s)"

# ── Affichage de la liste complete des postes decouverts (console) ──
if ($results.Count -gt 0) {
    Write-Host ""
    Write-Host "=== Liste des postes decouverts ===" -ForegroundColor Cyan
    $results | Format-Table -AutoSize -Property hostname, ip_address, os, manufacturer, model, ram_total_gb, cpu_count, uptime_hours
}
else {
    Write-Host ""
    Write-Host "Aucun poste n'a repondu en CIM (verifier droits admin / WinRM / pare-feu)." -ForegroundColor Yellow
}

$summary = @{
    total       = $allIps.Count
    online      = $onlineCount
    offline     = $offlineCount
    errors      = $errorCount
    duration_ms = $durationMs
}

# ── Export automatique vers Excel ──
Write-Log "Generation du fichier Excel en cours..."
$excelPath = Export-ScanResultsToExcel -Results $results -Summary $summary -OutputFolder $OutputFolder

if ($excelPath) {
    Write-Log "Fichier Excel genere avec succes : $excelPath" -Level "INFO"
    Write-Output "Fichier Excel : $excelPath"
} else {
    Write-Log "Echec de la generation du fichier Excel." -Level "ERROR"
    exit 1
}

<#
================================================================================
 UTILISATION
================================================================================
1) Copier scan-network-test.ps1 sur un poste Windows du reseau a tester
   (avec Microsoft Excel installe).

2) Autoriser l'execution (session courante uniquement) :
       Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

3) Lancer, par exemple sur une plage de 20 IP :
       .\scan-network-test.ps1 -StartIP 192.168.1.1 -EndIP 192.168.1.20 -VerboseLogging

4) Si les postes cibles n'ont pas WinRM active (Enable-PSRemoting), utiliser DCOM :
       .\scan-network-test.ps1 -StartIP 192.168.1.1 -EndIP 192.168.1.20 -Protocol Dcom

5) Le compte executant le script doit avoir les droits admin sur les postes cibles,
   sinon la creation de session CIM echoue et le poste apparait "hors ligne".
================================================================================
#>