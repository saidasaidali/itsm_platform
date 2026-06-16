# backend/src/services/networkDiscovery/scan-ad.ps1
# Scanne tous les postes du domaine AD et retourne du JSON
# Ce script est appelé automatiquement par le backend Node.js — ne pas planifier séparément

$ErrorActionPreference = "SilentlyContinue"
$results = @()

try {
    $computers = Get-ADComputer -Filter * -Property Name | Select-Object -ExpandProperty Name
} catch {
    Write-Output (@{ error = "Impossible de lister les postes AD : $_" } | ConvertTo-Json)
    exit 1
}

foreach ($computer in $computers) {
    try {
        $session = New-CimSession -ComputerName $computer -OperationTimeoutSec 5 -ErrorAction Stop

        $bios = Get-CimInstance -CimSession $session -ClassName Win32_BIOS
        $os   = Get-CimInstance -CimSession $session -ClassName Win32_OperatingSystem
        $cs   = Get-CimInstance -CimSession $session -ClassName Win32_ComputerSystem
        $net  = Get-CimInstance -CimSession $session -ClassName Win32_NetworkAdapterConfiguration |
                  Where-Object { $_.IPAddress -ne $null } | Select-Object -First 1

        $results += [PSCustomObject]@{
            hostname    = $computer
            username    = $cs.UserName
            ip_address  = $net.IPAddress[0]
            mac_address = $net.MACAddress
            serial      = $bios.SerialNumber
            os          = $os.Caption
        }

        Remove-CimSession $session
    } catch {
        # Poste hors ligne ou inaccessible — ignoré silencieusement
        continue
    }
}

# Sortie JSON unique, lue par le backend Node.js
$results | ConvertTo-Json -Compress