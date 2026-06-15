# agent/report-asset.ps1
# À planifier via Tâches Planifiées Windows (toutes les heures)

$backendUrl = "http://192.168.X.X:3000/api/assets/heartbeat"  # ← votre IP serveur
$apiKey = $env:ASSET_AGENT_KEY  # ← même valeur que .env                         # ← à définir

# Collecter les infos du poste
$hostname   = $env:COMPUTERNAME
$username   = $env:USERNAME
$ip         = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' } | Select-Object -First 1).IPAddress
$mac        = (Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1).MacAddress
$serial     = (Get-WmiObject Win32_BIOS).SerialNumber
$os         = (Get-WmiObject Win32_OperatingSystem).Caption

$body = @{
  hostname    = $hostname
  username    = $username
  ip_address  = $ip
  mac_address = $mac
  serial      = $serial
  os          = $os
  reported_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
} | ConvertTo-Json

try {
  Invoke-RestMethod -Uri $backendUrl -Method POST `
    -ContentType "application/json" `
    -Headers @{ "x-api-key" = $apiKey } `
    -Body $body
  Write-Host "✅ Rapport envoyé : $hostname / $username / $ip"
} catch {
  Write-Host "❌ Erreur envoi : $_"
}