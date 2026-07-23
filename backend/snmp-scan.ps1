<#
================================================================================
 snmp-scan.ps1
 Script PowerShell autonome de decouverte reseau via SNMP v2c
 Independant de tout projet Node.js / PostgreSQL / backend ITSM.
 Version corrigee : affiche desormais la liste complete des equipements
 decouverts dans la console (en plus du fichier Excel), pas seulement les
 statistiques.
================================================================================

 PREREQUIS :
   - Windows PowerShell 5.1+ (fonctionne aussi en PowerShell 7+)
   - Module "ImportExcel" (pour generer le fichier .xlsx)
       Installation (une seule fois, voir instructions en bas de fichier) :
       Install-Module -Name ImportExcel -Scope CurrentUser -Force

 AUCUNE dependance a SharpSnmpLib : le client SNMP v2c (GET-Request / BER)
 est implemente ci-dessous en C# inline via Add-Type, 100% autonome.
================================================================================
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$StartIP,          # ex: 192.168.1.1

    [Parameter(Mandatory = $true)]
    [string]$EndIP,            # ex: 192.168.1.254

    [string]$Community = "public",

    [int]$TimeoutMs = 1200,

    [int]$Retries = 1,

    [string]$OutputFolder = ".\SNMP_Reports"
)

# ------------------------------------------------------------------------------
# 0. Verification / installation du module ImportExcel
# ------------------------------------------------------------------------------
if (-not (Get-Module -ListAvailable -Name ImportExcel)) {
    Write-Warning "Le module 'ImportExcel' n'est pas installe."
    Write-Host "Installation automatique en cours (utilisateur courant, sans droits admin requis)..." -ForegroundColor Yellow
    try {
        Install-Module -Name ImportExcel -Scope CurrentUser -Force -ErrorAction Stop
    }
    catch {
        Write-Error "Impossible d'installer ImportExcel automatiquement. Voir instructions manuelles en fin de script. Detail: $($_.Exception.Message)"
        exit 1
    }
}
Import-Module ImportExcel -ErrorAction Stop

# ------------------------------------------------------------------------------
# 1. Client SNMP v2c minimal (BER encode/decode) en C# inline - 100% autonome
# ------------------------------------------------------------------------------
$csharpSnmp = @"
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.IO;

namespace MiniSnmp
{
    public class SnmpResult
    {
        public bool Success = false;
        public Dictionary<string,string> Values = new Dictionary<string,string>();
    }

    public static class Ber
    {
        public static byte[] EncodeLength(int len)
        {
            if (len < 0x80) return new byte[] { (byte)len };
            List<byte> bytes = new List<byte>();
            int temp = len;
            while (temp > 0) { bytes.Insert(0, (byte)(temp & 0xFF)); temp >>= 8; }
            List<byte> result = new List<byte>();
            result.Add((byte)(0x80 | bytes.Count));
            result.AddRange(bytes);
            return result.ToArray();
        }

        public static byte[] Tlv(byte tag, byte[] value)
        {
            byte[] len = EncodeLength(value.Length);
            byte[] result = new byte[1 + len.Length + value.Length];
            result[0] = tag;
            Array.Copy(len, 0, result, 1, len.Length);
            Array.Copy(value, 0, result, 1 + len.Length, value.Length);
            return result;
        }

        public static byte[] EncodeInteger(int value)
        {
            byte[] raw;
            if (value == 0) { raw = new byte[] { 0 }; }
            else
            {
                List<byte> bytes = new List<byte>();
                int temp = value;
                bool neg = value < 0;
                while (temp != 0 && temp != -1)
                {
                    bytes.Insert(0, (byte)(temp & 0xFF));
                    temp >>= 8;
                }
                if (bytes.Count == 0) bytes.Add(0);
                if (!neg && (bytes[0] & 0x80) != 0) bytes.Insert(0, 0x00);
                raw = bytes.ToArray();
            }
            return Tlv(0x02, raw);
        }

        public static byte[] EncodeOctetString(string s)
        {
            return Tlv(0x04, Encoding.ASCII.GetBytes(s));
        }

        public static byte[] EncodeNull()
        {
            return Tlv(0x05, new byte[0]);
        }

        public static byte[] EncodeOid(string oid)
        {
            string[] parts = oid.Split('.');
            List<int> nums = new List<int>();
            foreach (string p in parts) if (p.Length > 0) nums.Add(int.Parse(p));

            List<byte> body = new List<byte>();
            int first = nums[0] * 40 + nums[1];
            EncodeOidSubId(body, first);
            for (int i = 2; i < nums.Count; i++) EncodeOidSubId(body, nums[i]);
            return Tlv(0x06, body.ToArray());
        }

        private static void EncodeOidSubId(List<byte> body, int value)
        {
            if (value == 0) { body.Add(0); return; }
            List<byte> chunk = new List<byte>();
            int v = value;
            while (v > 0)
            {
                chunk.Insert(0, (byte)(v & 0x7F));
                v >>= 7;
            }
            for (int i = 0; i < chunk.Count - 1; i++) chunk[i] |= 0x80;
            body.AddRange(chunk);
        }

        // Parses one TLV starting at offset, returns tag, content bytes, and new offset
        public static void ReadTlv(byte[] data, ref int offset, out byte tag, out byte[] content)
        {
            tag = data[offset];
            offset++;
            int len = data[offset];
            offset++;
            if ((len & 0x80) != 0)
            {
                int numBytes = len & 0x7F;
                len = 0;
                for (int i = 0; i < numBytes; i++)
                {
                    len = (len << 8) | data[offset];
                    offset++;
                }
            }
            content = new byte[len];
            Array.Copy(data, offset, content, 0, len);
            offset += len;
        }

        public static string DecodeOid(byte[] content)
        {
            StringBuilder sb = new StringBuilder();
            int first = content[0];
            sb.Append(first / 40).Append(".").Append(first % 40);
            int val = 0;
            for (int i = 1; i < content.Length; i++)
            {
                val = (val << 7) | (content[i] & 0x7F);
                if ((content[i] & 0x80) == 0)
                {
                    sb.Append(".").Append(val);
                    val = 0;
                }
            }
            return sb.ToString();
        }

        public static long DecodeUnsignedInt(byte[] content)
        {
            long val = 0;
            foreach (byte b in content) val = (val << 8) | b;
            return val;
        }

        public static string DecodeValue(byte tag, byte[] content)
        {
            switch (tag)
            {
                case 0x02: // INTEGER
                    return DecodeUnsignedInt(content).ToString();
                case 0x04: // OCTET STRING
                    // Try printable ASCII; fall back to hex for binary (e.g. some serials)
                    bool printable = true;
                    foreach (byte b in content)
                        if (b < 0x20 || b > 0x7E) { printable = false; break; }
                    if (printable) return Encoding.ASCII.GetString(content).Trim();
                    StringBuilder hex = new StringBuilder();
                    foreach (byte b in content) hex.AppendFormat("{0:X2}", b);
                    return hex.ToString();
                case 0x06: // OID
                    return DecodeOid(content);
                case 0x40: // IpAddress
                    return string.Join(".", Array.ConvertAll(content, b => b.ToString()));
                case 0x41: // Counter32
                case 0x42: // Gauge32
                case 0x43: // TimeTicks
                    return DecodeUnsignedInt(content).ToString();
                case 0x46: // Counter64
                    return DecodeUnsignedInt(content).ToString();
                case 0x80: return "NoSuchObject";
                case 0x81: return "NoSuchInstance";
                case 0x82: return "EndOfMibView";
                case 0x05: return ""; // NULL
                default:
                    return "";
            }
        }
    }

    public static class SnmpClient
    {
        public static SnmpResult Get(string ip, string community, int timeoutMs, int retries, string[] oids)
        {
            SnmpResult result = new SnmpResult();

            List<byte> vbListBytes = new List<byte>();
            foreach (string oid in oids)
            {
                byte[] oidBytes = Ber.EncodeOid(oid);
                byte[] nullBytes = Ber.EncodeNull();
                byte[] vbContent = new byte[oidBytes.Length + nullBytes.Length];
                Array.Copy(oidBytes, 0, vbContent, 0, oidBytes.Length);
                Array.Copy(nullBytes, 0, vbContent, oidBytes.Length, nullBytes.Length);
                byte[] vb = Ber.Tlv(0x30, vbContent);
                vbListBytes.AddRange(vb);
            }
            byte[] varBindings = Ber.Tlv(0x30, vbListBytes.ToArray());

            int requestId = new Random().Next(1, int.MaxValue);
            byte[] reqIdBytes = Ber.EncodeInteger(requestId);
            byte[] errStatus = Ber.EncodeInteger(0);
            byte[] errIndex = Ber.EncodeInteger(0);

            List<byte> pduContent = new List<byte>();
            pduContent.AddRange(reqIdBytes);
            pduContent.AddRange(errStatus);
            pduContent.AddRange(errIndex);
            pduContent.AddRange(varBindings);

            byte[] pdu = Ber.Tlv(0xA0, pduContent.ToArray()); // GetRequest-PDU

            byte[] versionBytes = Ber.EncodeInteger(1); // SNMPv2c = 1
            byte[] communityBytes = Ber.EncodeOctetString(community);

            List<byte> msgContent = new List<byte>();
            msgContent.AddRange(versionBytes);
            msgContent.AddRange(communityBytes);
            msgContent.AddRange(pdu);

            byte[] message = Ber.Tlv(0x30, msgContent.ToArray());

            using (UdpClient udp = new UdpClient())
            {
                udp.Client.ReceiveTimeout = timeoutMs;
                IPEndPoint remoteEP = new IPEndPoint(IPAddress.Parse(ip), 161);

                int attempt = 0;
                while (attempt <= retries)
                {
                    attempt++;
                    try
                    {
                        udp.Send(message, message.Length, remoteEP);
                        IPEndPoint responseEP = new IPEndPoint(IPAddress.Any, 0);
                        udp.Client.ReceiveTimeout = timeoutMs;
                        byte[] response = udp.Receive(ref responseEP);

                        int offset = 0;
                        byte tag; byte[] content;
                        Ber.ReadTlv(response, ref offset, out tag, out content); // outer SEQUENCE

                        int innerOffset = 0;
                        byte[] inner = content;
                        Ber.ReadTlv(inner, ref innerOffset, out tag, out content); // version
                        Ber.ReadTlv(inner, ref innerOffset, out tag, out content); // community
                        byte pduTag; byte[] pduBytes;
                        Ber.ReadTlv(inner, ref innerOffset, out pduTag, out pduBytes); // PDU (0xA2 = GetResponse)

                        int pOffset = 0;
                        Ber.ReadTlv(pduBytes, ref pOffset, out tag, out content); // request-id
                        Ber.ReadTlv(pduBytes, ref pOffset, out tag, out content); // error-status
                        Ber.ReadTlv(pduBytes, ref pOffset, out tag, out content); // error-index
                        byte vbsTag; byte[] vbsContent;
                        Ber.ReadTlv(pduBytes, ref pOffset, out vbsTag, out vbsContent); // varbind list

                        int vOffset = 0;
                        while (vOffset < vbsContent.Length)
                        {
                            byte vbTag; byte[] vbContent2;
                            Ber.ReadTlv(vbsContent, ref vOffset, out vbTag, out vbContent2); // each varbind SEQUENCE

                            int innerVOffset = 0;
                            byte oidTag; byte[] oidContent;
                            Ber.ReadTlv(vbContent2, ref innerVOffset, out oidTag, out oidContent);
                            string oidStr = Ber.DecodeOid(oidContent);

                            byte valTag; byte[] valContent;
                            Ber.ReadTlv(vbContent2, ref innerVOffset, out valTag, out valContent);
                            string valStr = Ber.DecodeValue(valTag, valContent);

                            result.Values[oidStr] = valStr;
                        }

                        result.Success = true;
                        return result;
                    }
                    catch (Exception)
                    {
                        // silencieux : on retente ou on abandonne proprement
                    }
                }
            }
            return result; // Success = false si aucune reponse
        }
    }
}
"@

Add-Type -TypeDefinition $csharpSnmp -Language CSharp -ErrorAction Stop

# ------------------------------------------------------------------------------
# 2. OID standards utilises
# ------------------------------------------------------------------------------
$OID_SYSDESCR    = "1.3.6.1.2.1.1.1.0"
$OID_SYSOBJECTID = "1.3.6.1.2.1.1.2.0"
$OID_SYSUPTIME   = "1.3.6.1.2.1.1.3.0"
$OID_SYSNAME     = "1.3.6.1.2.1.1.5.0"

# Numero de serie : on tente plusieurs OID courants (Entity-MIB + Printer-MIB)
$OID_SERIAL_ENTITY  = "1.3.6.1.2.1.47.1.1.1.1.11.1"   # entPhysicalSerialNum (index 1)
$OID_SERIAL_PRINTER = "1.3.6.1.2.1.43.5.1.1.17.1"     # prtGeneralSerialNumber

# ------------------------------------------------------------------------------
# 3. Fonctions utilitaires
# ------------------------------------------------------------------------------
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

function Format-Uptime {
    param([string]$Ticks)
    if ([string]::IsNullOrEmpty($Ticks)) { return "" }
    $t = 0
    if (-not [long]::TryParse($Ticks, [ref]$t)) { return $Ticks }
    $ts = [TimeSpan]::FromSeconds($t / 100.0)
    return "{0}j {1}h {2}m" -f $ts.Days, $ts.Hours, $ts.Minutes
}

function Get-DeviceType {
    param(
        [string]$Description,
        [string]$SysObjectId
    )

    $desc = $Description.ToLower()

    if ($desc -match "printer|imprimante|laserjet|officejet|deskjet") { return "Printer" }
    if ($desc -match "firewall|pare-feu|pfsense|fortigate|palo alto|checkpoint|asa") { return "Firewall" }
    if ($desc -match "access point|wireless controller|point d'acces|unifi ap|aironet") { return "Access Point" }
    if ($desc -match "nas|synology|qnap|storage array|freenas|truenas") { return "NAS" }
    if ($desc -match "router|routeur|isr|mikrotik routeros") { return "Router" }
    if ($desc -match "switch|commutateur|catalyst|procurve") { return "Switch" }
    if ($desc -match "windows server|linux|ubuntu server|esxi|vmware|hyper-v|server") { return "Server" }

    switch -Wildcard ($SysObjectId) {
        "*1.3.6.1.4.1.9.1*"    { return "Router" }      # Cisco
        "*1.3.6.1.4.1.2636*"   { return "Router" }      # Juniper
        "*1.3.6.1.4.1.11.2*"   { return "Printer" }      # HP
        "*1.3.6.1.4.1.6027*"   { return "Switch" }       # Foundry/Brocade
        default { return "Unknown" }
    }
}

function Get-Manufacturer {
    param([string]$Description)
    if ($Description -match "cisco") { return "Cisco" }
    if ($Description -match "hp|hewlett") { return "HP" }
    if ($Description -match "dell") { return "Dell" }
    if ($Description -match "juniper") { return "Juniper" }
    if ($Description -match "huawei") { return "Huawei" }
    if ($Description -match "d-link") { return "D-Link" }
    if ($Description -match "tp-link") { return "TP-Link" }
    if ($Description -match "mikrotik") { return "MikroTik" }
    if ($Description -match "ubiquiti|unifi") { return "Ubiquiti" }
    if ($Description -match "fortinet|fortigate") { return "Fortinet" }
    if ($Description -match "synology") { return "Synology" }
    if ($Description -match "qnap") { return "QNAP" }
    return "Inconnu"
}

# ------------------------------------------------------------------------------
# 4. Scan principal
# ------------------------------------------------------------------------------
if (-not (Test-Path $OutputFolder)) {
    New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
}

$startInt = Convert-IpToInt -Ip $StartIP
$endInt   = Convert-IpToInt -Ip $EndIP

if ($endInt -lt $startInt) {
    Write-Error "L'adresse IP de fin doit etre superieure ou egale a l'adresse de debut."
    exit 1
}

$totalIps = ($endInt - $startInt) + 1
Write-Host "=== Scan SNMP en cours : $StartIP -> $EndIP ($totalIps adresses) ===" -ForegroundColor Cyan

$scanStart = Get-Date
$discovered = New-Object System.Collections.Generic.List[Object]
$scannedCount = 0

for ($cur = $startInt; $cur -le $endInt; $cur++) {
    $ip = Convert-IntToIp -Int $cur
    $scannedCount++
    Write-Progress -Activity "Scan SNMP" -Status "Test de $ip ($scannedCount / $totalIps)" -PercentComplete (($scannedCount / $totalIps) * 100)

    try {
        $oidsToQuery = @($OID_SYSDESCR, $OID_SYSOBJECTID, $OID_SYSUPTIME, $OID_SYSNAME)
        $res = [MiniSnmp.SnmpClient]::Get($ip, $Community, $TimeoutMs, $Retries, $oidsToQuery)

        if ($res.Success -and $res.Values.ContainsKey($OID_SYSDESCR)) {

            $description = $res.Values[$OID_SYSDESCR]
            $sysObjectId = $res.Values[$OID_SYSOBJECTID]
            $uptimeRaw   = $res.Values[$OID_SYSUPTIME]
            $hostname    = $res.Values[$OID_SYSNAME]

            $serial = ""
            try {
                $resSerial = [MiniSnmp.SnmpClient]::Get($ip, $Community, $TimeoutMs, 0, @($OID_SERIAL_ENTITY, $OID_SERIAL_PRINTER))
                foreach ($key in @($OID_SERIAL_ENTITY, $OID_SERIAL_PRINTER)) {
                    if ($resSerial.Values.ContainsKey($key)) {
                        $val = $resSerial.Values[$key]
                        if ($val -and $val -notin @("NoSuchObject","NoSuchInstance","EndOfMibView","")) {
                            $serial = $val
                            break
                        }
                    }
                }
            } catch {
                # Non bloquant : certains equipements ne supportent pas ces OID
            }

            $type = Get-DeviceType -Description $description -SysObjectId $sysObjectId
            $vendor = Get-Manufacturer -Description $description

            $discovered.Add([PSCustomObject]@{
                IP            = $ip
                Hostname      = $hostname
                Description   = $description
                Vendor        = $vendor
                Model         = $description
                SerialNumber  = $serial
                SysObjectID   = $sysObjectId
                Uptime        = Format-Uptime -Ticks $uptimeRaw
                Type          = $type
            })

            Write-Host "  [+] $ip -> $type ($description)" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  [!] $ip -> pas de reponse / erreur ignoree" -ForegroundColor DarkGray
        continue
    }
}

Write-Progress -Activity "Scan SNMP" -Completed
$scanEnd = Get-Date
$duration = $scanEnd - $scanStart

Write-Host ""
Write-Host "=== Scan termine : $($discovered.Count) equipement(s) trouve(s) sur $totalIps IP scannees en $([math]::Round($duration.TotalSeconds,1))s ===" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 4bis. Affichage de la LISTE COMPLETE des equipements decouverts (console)
#       -> corrige la demande : ne pas se limiter aux statistiques
# ------------------------------------------------------------------------------
if ($discovered.Count -gt 0) {
    Write-Host ""
    Write-Host "=== Liste des equipements decouverts ===" -ForegroundColor Cyan
    $discovered | Sort-Object Type, IP | Format-Table -AutoSize -Property IP, Hostname, Type, Vendor, Description, SerialNumber, Uptime
}
else {
    Write-Host ""
    Write-Host "Aucun equipement n'a repondu au SNMP sur cette plage (verifier la communaute, le port UDP/161, ou qu'un service SNMP est actif sur les cibles)." -ForegroundColor Yellow
}

# ------------------------------------------------------------------------------
# 5. Export Excel (.xlsx) avec ImportExcel
# ------------------------------------------------------------------------------
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$outputFile = Join-Path $OutputFolder "SNMP_Audit_$timestamp.xlsx"

$hasResults = $discovered.Count -gt 0

# Feuille principale "Equipements" (liste complete, pas seulement un resume)
$excelParams = @{
    Path          = $outputFile
    WorksheetName = "Equipements"
    AutoSize      = $true
    FreezeTopRow  = $true
    BoldTopRow    = $true
}

if ($hasResults) {
    $discovered | Export-Excel @excelParams
} else {
    [PSCustomObject]@{ IP="";Hostname="";Description="";Vendor="";Model="";SerialNumber="";SysObjectID="";Uptime="";Type="" } |
        Export-Excel @excelParams
}

# Statistiques pour la feuille Summary
$nbPrinters  = ($discovered | Where-Object { $_.Type -eq "Printer" }).Count
$nbSwitches  = ($discovered | Where-Object { $_.Type -eq "Switch" }).Count
$nbRouters   = ($discovered | Where-Object { $_.Type -eq "Router" }).Count
$nbServers   = ($discovered | Where-Object { $_.Type -eq "Server" }).Count
$nbOthers    = ($discovered | Where-Object { $_.Type -notin @("Printer","Switch","Router","Server") }).Count

$summaryData = @(
    [PSCustomObject]@{ Indicateur = "Nombre total d'IP scannees";       Valeur = $totalIps }
    [PSCustomObject]@{ Indicateur = "Nombre d'equipements decouverts";  Valeur = $discovered.Count }
    [PSCustomObject]@{ Indicateur = "Nombre d'imprimantes";             Valeur = $nbPrinters }
    [PSCustomObject]@{ Indicateur = "Nombre de switches";               Valeur = $nbSwitches }
    [PSCustomObject]@{ Indicateur = "Nombre de routeurs";               Valeur = $nbRouters }
    [PSCustomObject]@{ Indicateur = "Nombre de serveurs";                Valeur = $nbServers }
    [PSCustomObject]@{ Indicateur = "Nombre d'autres equipements";      Valeur = $nbOthers }
    [PSCustomObject]@{ Indicateur = "Duree du scan";                    Valeur = "$([math]::Round($duration.TotalSeconds,1)) secondes" }
    [PSCustomObject]@{ Indicateur = "Date/heure du scan";               Valeur = $scanStart.ToString("yyyy-MM-dd HH:mm:ss") }
    [PSCustomObject]@{ Indicateur = "Plage IP";                         Valeur = "$StartIP -> $EndIP" }
)

$summaryData | Export-Excel -Path $outputFile -WorksheetName "Summary" -AutoSize -BoldTopRow -FreezeTopRow

Write-Host ""
Write-Host "Fichier Excel genere : $outputFile" -ForegroundColor Yellow
Write-Host "  -> Feuille 'Equipements' : liste complete des equipements decouverts" -ForegroundColor Yellow
Write-Host "  -> Feuille 'Summary'     : statistiques globales du scan" -ForegroundColor Yellow
Write-Host "=== Termine ===" -ForegroundColor Cyan

<#
================================================================================
 INSTRUCTIONS D'EXECUTION SUR UN PC WINDOWS DU MINISTERE
================================================================================

1) Copier le fichier "snmp-scan.ps1" sur le PC cible (cle USB, partage reseau,
   ou copier/coller direct). Aucun autre fichier n'est necessaire.

2) Autoriser l'execution de scripts PowerShell (si necessaire) :
   Ouvrir PowerShell EN TANT QU'ADMINISTRATEUR et executer :

       Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

   (Cette commande n'affecte que la session courante, aucune modification
   permanente de la politique systeme.)

3) Se placer dans le dossier contenant le script :

       cd "C:\Chemin\Vers\Le\Dossier"

4) Lancer le scan, par exemple :

       .\snmp-scan.ps1 -StartIP 192.168.1.1 -EndIP 192.168.1.254

   Options disponibles :
       -Community   (defaut "public")
       -TimeoutMs   (defaut 1200 ms)
       -Retries     (defaut 1)
       -OutputFolder (defaut ".\SNMP_Reports")

   Exemple complet :

       .\snmp-scan.ps1 -StartIP 192.168.1.1 -EndIP 192.168.1.254 `
                        -Community public -TimeoutMs 1500 -Retries 2 `
                        -OutputFolder "C:\Audits\SNMP"

5) Le script installe automatiquement le module "ImportExcel" au premier
   lancement (via Install-Module, depuis le PowerShell Gallery officiel)
   s'il n'est pas deja present. Si le PC n'a pas d'acces Internet, installer
   le module manuellement au prealable depuis un poste connecte :

       Save-Module -Name ImportExcel -Path "C:\Temp\Modules"

   puis copier le dossier du module dans :

       C:\Users\<utilisateur>\Documents\WindowsPowerShell\Modules\

6) A la fin du scan, la LISTE COMPLETE des equipements decouverts s'affiche
   directement dans la console (colonnes IP, Hostname, Type, Vendor,
   Description, SerialNumber, Uptime), en plus du fichier Excel cree dans
   le dossier de sortie, nomme automatiquement :

       SNMP_Audit_2026-07-23_14-32.xlsx

   Il contient :
     - Feuille "Equipements" : liste complete avec toutes les colonnes
     - Feuille "Summary" : statistiques globales du scan

7) Prerequis reseau : le PC doit pouvoir joindre les hotes cibles en UDP/161
   (SNMP). Verifier qu'aucun pare-feu local/reseau ne bloque ce port sortant.

================================================================================
#>