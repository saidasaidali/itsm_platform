// backend/src/services/mock/simulationService.js
// @mode simulation - Service de données simulées (Mock Mode)
// Architecture centralisée : une seule source de vérité pour toutes les données simulées

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
// Bug #5 fix: import settingsEmitter pour invalider le cache quand les settings changent
import { settingsEmitter } from '../settingsService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const mockDir = join(__dirname, '../../mock')

// Cache du contexte de simulation en mémoire
let simulationContext = null

// ─── Lecture des fichiers JSON de mock ───────────────────────────────────────────
function loadJsonFile(filename) {
  try {
    const filePath = join(mockDir, filename)
    const data = readFileSync(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    console.error(`[simulationService] Erreur lecture ${filename}:`, err.message)
    return []
  }
}

// ─── Génère une adresse MAC cohérente à partir d'un hostname ─────────────────────
function generateMockMac(hostname) {
  let hash = 0
  for (let i = 0; i < hostname.length; i++) {
    hash = ((hash << 5) - hash) + hostname.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  const base = Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8)
  return `00:1A:${base.slice(0, 2)}:${base.slice(2, 4)}:${base.slice(4, 6)}:${base.slice(6, 8)}`
}

// ─── Détermine le type d'équipement depuis le hostname ───────────────────────────
function getAssetTypeFromHostname(hostname) {
  const h = (hostname || '').toLowerCase()
  if (h.includes('imp')) return 'Imprimante'
  if (h.includes('srv')) return 'Serveur'
  if (h.includes('dev')) return 'Ordinateur'
  if (h.includes('tech')) return 'Ordinateur'
  if (h.includes('user')) return 'Ordinateur'
  return 'Ordinateur'
}

// ─── Détermine le type depuis le device_type SNMP (pour les équipements réseau) ──
function getAssetTypeFromSnmpDeviceType(deviceType) {
  if (!deviceType) return null
  const d = deviceType.toLowerCase()
  if (d.includes('imprimante') || d.includes('printer')) return 'Imprimante'
  if (d.includes('switch')) return 'Switch'
  if (d.includes('routeur') || d.includes('router')) return 'Routeur'
  if (d.includes('point d') || d.includes('access point') || d.includes('wi-fi') || d.includes('wifi')) return "Point d'accès Wi-Fi"
  return 'Équipement réseau'
}

// ─── Détermine le department depuis le hostname ─────────────────────────────────
function getDepartmentFromHostname(hostname) {
  const h = (hostname || '').toLowerCase()
  if (h.includes('imp') || h.includes('user')) return 'Finance'
  if (h.includes('tech')) return 'Informatique'
  if (h.includes('srv')) return 'Datacenter'
  if (h.includes('dev')) return 'Développement'
  return 'Général'
}

// ─── Détermine l'office depuis le hostname ───────────────────────────────────────
function getOfficeFromHostname(hostname) {
  const h = (hostname || '').toLowerCase()
  if (h.includes('imp') || h.includes('user')) return 'Bureau A'
  if (h.includes('tech')) return 'Bureau IT'
  if (h.includes('srv')) return 'Salle Serveurs'
  if (h.includes('dev')) return 'Bureau C'
  return 'Bureau Principal'
}

// ─── Calcule le subnet depuis une IP ─────────────────────────────────────────────
function getSubnetFromIp(ip) {
  if (!ip) return null
  const parts = ip.split('.')
  return parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : null
}

// ─── Calcule le VLAN depuis le hostname ──────────────────────────────────────────
function getVlanFromHostname(hostname) {
  const h = (hostname || '').toLowerCase()
  if (h.includes('imp') || h.includes('user')) return 'VLAN10'
  if (h.includes('tech')) return 'VLAN20'
  if (h.includes('srv')) return 'VLAN30'
  if (h.includes('dev')) return 'VLAN40'
  return 'VLAN1'
}

// ─── Construit le contexte de simulation complet ───────────────────────────────────
function buildSimulationContext() {
  if (simulationContext) {
    return simulationContext
  }

  console.log('[SimulationService] Construction du contexte de simulation...')

  // Charger les données brutes
  const adData = loadJsonFile('fake-ad.json')
  const snmpData = loadJsonFile('fake-snmp.json')
  const liveStateData = loadJsonFile('fake-live-state.json')

  // Indexer par hostname pour faciliter la fusion
  const adByHostname = new Map()
  adData.forEach(item => adByHostname.set(item.hostname?.toLowerCase(), item))

  const snmpByHostname = new Map()
  snmpData.forEach(item => snmpByHostname.set(item.hostname?.toLowerCase(), item))

  const liveStateByHostname = new Map()
  liveStateData.forEach(item => liveStateByHostname.set(item.hostname?.toLowerCase(), item))

  // Construire la liste complète des assets (union de toutes les sources)
  const allHostnames = new Set([
    ...adByHostname.keys(),
    ...snmpByHostname.keys(),
    ...liveStateByHostname.keys()
  ])

  const assets = []
  const users = []
  const liveStates = []
  const relations = []

  let assetId = 1
  let userId = 1

  allHostnames.forEach(hostname => {
    const ad = adByHostname.get(hostname) || {}
    const snmp = snmpByHostname.get(hostname) || {}
    const live = liveStateByHostname.get(hostname) || {}

    // Déterminer le type — priorité: device_type SNMP > hostname AD
    const typeFromSnmp = snmp.device_type ? getAssetTypeFromSnmpDeviceType(snmp.device_type) : null
    const type = typeFromSnmp || getAssetTypeFromHostname(hostname)

    // Déterminer l'IP (priorité: AD > SNMP > LiveState)
    const ip = ad.ip || snmp.ip_address || live.ip || `192.168.25.${100 + assetId}`

    // Déterminer le department et office
    const department = getDepartmentFromHostname(hostname)
    const office = getOfficeFromHostname(hostname)

    // Déterminer le subnet et VLAN
    const subnet = getSubnetFromIp(ip)
    const vlan = getVlanFromHostname(hostname)

    // Bug #4 fix: asset_tag cohérent — on retire systématiquement le préfixe 'PC-' du hostname AD
    // Les imprimantes SNMP (HP-...) sont normalisées en PRN-
    // Résultat: PC-USER-001 → USER-001, PC-SRV-001 → SRV-001, PC-IMP-001 → IMP-001
    //           HP-LaserJet-M404-01 → PRN-LaserJet-M404-01
    const rawTag = hostname || `ASSET-${assetId}`
    const asset_tag = rawTag
      .replace(/^PC-/i, '')      // retire préfixe PC- des hostnames AD
      .replace(/^HP-/i, 'PRN-') // normalise les imprimantes SNMP HP- → PRN-

    const asset = {
      id: assetId,
      asset_tag: asset_tag,
      hostname: hostname,
      type: type,
      status: 'En service',

      // Réseau
      ip_address: ip,
      subnet: subnet,
      vlan: vlan,
      mac_address: ad.mac || snmp.mac_address || generateMockMac(hostname),

      // Localisation
      department: department,
      office: office,

      // Matériel
      manufacturer: ad.os || snmp.vendor || 'HP',
      model: ad.cpu || snmp.model || 'Inconnu',
      serial_number: ad.serial || snmp.serial || `SN-${hostname}-${assetId.toString().padStart(4, '0')}`,

      // Utilisateur
      assigned_to: ad.utilisateur ? userId : null,
      assigned_to_name: ad.utilisateur || null,

      // État Digital Twin
      is_online: live.status === 'online',
      cpu_usage: live.status === 'online' ? parseInt(live.cpu_usage?.replace('%', '') || '0') : 0,
      ram_usage: live.status === 'online' ? parseInt(live.ram_usage?.replace('%', '') || '0') : 0,
      // Bug #3 fix: disk_usage propagé dans l'asset ET dans liveStates
      disk_usage: live.status === 'online' ? parseInt(live.disk_usage?.replace('%', '') || '0') : 0,
      disk_free_gb: live.status === 'online' ? 250 * (1 - parseInt(live.disk_usage?.replace('%', '') || '0') / 100) : 0,
      last_seen: live.last_seen || new Date().toISOString(),

      // Relations (à calculer après)
      uses_printer: [],
    }

    assets.push(asset)

    // Créer l'utilisateur s'il y a lieu
    if (ad.utilisateur && !users.find(u => u.username === ad.utilisateur)) {
      users.push({
        id: userId,
        username: ad.utilisateur,
        email: `${ad.utilisateur.toLowerCase().replace(' ', '.')}@company.local`,
        role: ad.utilisateur.includes('Technicien') ? 'Technicien' : 'Utilisateur',
      })
      userId++
    }

    // Créer l'état Digital Twin
    // Bug #3 fix: disk_usage propagé pour que getDigitalTwinLiveStates() calcule diskFreeGB correctement
    liveStates.push({
      hostname: hostname,
      ip_address: ip,
      is_online: live.status === 'online',
      cpu_usage: asset.cpu_usage,
      ram_usage: asset.ram_usage,
      disk_usage: asset.disk_usage,
      disk_free_gb: asset.disk_free_gb,
      last_seen: live.last_seen || new Date().toISOString(),
    })

    assetId++
  })

  // Calculer les relations (PC -> Imprimante par même subnet/department/office)
  const computers = assets.filter(a => a.type === 'Ordinateur')
  const printers = assets.filter(a => a.type === 'Imprimante')

  computers.forEach(pc => {
    printers.forEach(printer => {
      const sameSubnet = pc.subnet === printer.subnet
      const sameDepartment = pc.department === printer.department
      const sameOffice = pc.office === printer.office

      if (sameSubnet || sameDepartment || sameOffice) {
        relations.push({
          source_asset_id: pc.id,
          source_asset_tag: pc.asset_tag,
          target_asset_id: printer.id,
          target_asset_tag: printer.asset_tag,
          relation_type: 'uses_printer',
          reason: sameSubnet ? 'same_subnet' : sameDepartment ? 'same_department' : 'same_office',
        })
        // Ajouter la relation à l'asset
        if (!pc.uses_printer.includes(printer.asset_tag)) {
          pc.uses_printer.push(printer.asset_tag)
        }
      }
    })
  })

  simulationContext = {
    assets,
    users,
    liveStates,
    relations,
    builtAt: new Date().toISOString(),
  }

  console.log(`[SimulationService] Contexte construit: ${assets.length} assets, ${users.length} users, ${relations.length} relations`)

  return simulationContext
}

// ─── API publique - Accès au contexte de simulation ───────────────────────────────

export function getSimulationContext() {
  return buildSimulationContext()
}

export function getAssets() {
  return buildSimulationContext().assets
}

export function getComputers() {
  return getAssets().filter(a => a.type === 'Ordinateur')
}

export function getPrinters() {
  return getAssets().filter(a => a.type === 'Imprimante')
}

export function getServers() {
  return getAssets().filter(a => a.type === 'Serveur')
}

export function getNetworkDevices() {
  return getAssets().filter(a => !['Ordinateur', 'Imprimante', 'Serveur'].includes(a.type))
}

// Bug #2 fix: getSNMPDevices inclut les imprimantes car elles sont découvertes via SNMP
// (contrairement à getNetworkDevices qui les exclut)
export function getSNMPDevices() {
  return getAssets().filter(a => !['Ordinateur', 'Serveur'].includes(a.type))
}

export function getUsers() {
  return buildSimulationContext().users
}

export function getLiveStates() {
  return buildSimulationContext().liveStates
}

export function getRelations() {
  return buildSimulationContext().relations
}

// ─── API de compatibilité (anciennes fonctions) ───────────────────────────────────

export function getFakeADComputers() {
  return getComputers()
}

// Bug #2 fix: getFakeSNMPDevices retourne maintenant les équipements réseau ET les imprimantes SNMP
export function getFakeSNMPDevices() {
  return getSNMPDevices()
}

export function getFakeLiveStates() {
  return getLiveStates()
}

export function getFakeLiveStatesWithVariation() {
  const states = getLiveStates()
  return states.map(state => {
    if (state.is_online) {
      const variation = () => Math.floor(Math.random() * 11) - 5
      return {
        ...state,
        cpu_usage: `${Math.max(0, Math.min(100, state.cpu_usage + variation()))}%`,
        ram_usage: `${Math.max(0, Math.min(100, state.ram_usage + variation()))}%`,
        last_seen: new Date().toISOString(),
      }
    }
    return state
  })
}

export function getRandomLiveState(hostname) {
  const states = getLiveStates()
  return states.find(s => s.hostname === hostname)
}

// ─── Génère des métadonnées réseau simulées (pour compatibilité) ───────────────────
export function generateSimulatedNetworkMetadata(asset) {
  return {
    adresse_ip: asset.ip_address,
    department: asset.department,
    office: asset.office,
  }
}

// ─── Retourne les états Digital Twin simulés (pour compatibilité) ─────────────────
export function getDigitalTwinLiveStates() {
  const states = getLiveStates()
  const variation = () => Math.floor(Math.random() * 11) - 5

  return states.map(state => {
    const isOnline = state.is_online
    const hostname = state.hostname || ''
    const isServer = hostname.toUpperCase().includes('SRV')
    const isDev = hostname.toUpperCase().includes('DEV')
    const isImp = hostname.toUpperCase().includes('IMP')
    const isTech = hostname.toUpperCase().includes('TECH')

    const defaultRamMB = isServer ? 32768 : isDev ? 16384 : 8192
    const defaultDiskTotalGB = isServer ? 500 : isDev ? 500 : 250
    const defaultCpuCount = isServer ? 8 : isDev ? 8 : 4
    const defaultCpuFreq = isServer ? 3200 : 2800

    const cpuWithVariation = isOnline ? Math.max(0, Math.min(100, state.cpu_usage + variation())) : 0
    const ramWithVariation = isOnline ? Math.max(0, Math.min(100, state.ram_usage + variation())) : 0
    // Bug #3 fix: disk_usage est maintenant présent dans state (propagé depuis buildSimulationContext)
    const diskUsagePercent = state.disk_usage ?? 0
    const diskFreeGB = Math.round(defaultDiskTotalGB * (1 - diskUsagePercent / 100) * 10) / 10

    return {
      hostname: hostname,
      ip_address: state.ip_address,
      is_online: isOnline,
      cpu_usage: cpuWithVariation,
      ram_usage: ramWithVariation,
      ram_total_mb: defaultRamMB,
      disk_free_gb: diskFreeGB,
      disk_total_gb: defaultDiskTotalGB,
      uptime_hours: isOnline ? (isServer ? 720 : isDev ? 120 : 48) : 0,
      current_user: isOnline
        ? (isServer ? 'SYSTEM' : isImp ? 'Administrateur' : `user.${hostname.toLowerCase()}`)
        : null,
      manufacturer: isServer ? 'Dell Inc.' : 'HP',
      model: isServer
        ? 'PowerEdge R740'
        : isDev
          ? 'ZBook Fury G10'
          : isImp
            ? 'EliteDesk 800 G6'
            : isTech
              ? 'ProDesk 400 G7'
              : 'ProBook 450 G10',
      serial_number: `SN-${hostname.replace('PC-', '')}-${Math.abs(hostname.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)).toString(36).toUpperCase().slice(0, 4)}`,
      windows_version: isServer ? 'Windows Server 2022 Standard' : 'Windows 11 Pro',
      windows_build: isServer ? '20348' : '22631',
      architecture: 'x64',
      cpu_count: defaultCpuCount,
      cpu_frequency_mhz: defaultCpuFreq,
      mac_address: generateMockMac(hostname),
      firewall_enabled: true,
      defender_enabled: true,
      defender_status: 'En cours d\'exécution',
      disks: [
        {
          drive: 'C:',
          label: isServer ? 'Système' : 'OS',
          total_gb: defaultDiskTotalGB,
          free_gb: diskFreeGB,
          filesystem: 'NTFS',
        },
      ],
    }
  })
}

// ─── Réinitialiser le cache (pour les tests ou manuellement) ──────────────────────
export function resetSimulationContext() {
  simulationContext = null
}

// Bug #5 fix: invalider automatiquement le cache quand les settings sont rechargés.
// Quand simulation_mode change (on ↔ off) ou que d'autres paramètres changent,
// le contexte simulé est reconstruit à la prochaine utilisation.
settingsEmitter.on('reloaded', () => {
  if (simulationContext !== null) {
    simulationContext = null
    console.log('[SimulationService] Cache simulationContext invalidé suite au rechargement des settings.')
  }
})
