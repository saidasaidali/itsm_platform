// frontend/src/utils/translate.js
import i18n from '../i18n'

export const translateRole = (role) => {
  if (!role) return ''
  const key = `roles.${role}`
  return i18n.exists(key) ? i18n.t(key) : role
}

export const translateTicketStatus = (status) => {
  if (!status) return ''
  const key = `tickets.status.${status}`
  return i18n.exists(key) ? i18n.t(key) : status
}

export const translateAssetStatus = (status) => {
  if (!status) return ''
  const key = `assets.status.${status}`
  return i18n.exists(key) ? i18n.t(key) : status
}

export const translateAssetType = (type) => {
  if (!type) return ''
  const key = `assets.type.${type}`
  return i18n.exists(key) ? i18n.t(key) : type
}

export const translateCategory = (category) => {
  if (!category) return ''
  const key = `knowledge.category.${category}`
  return i18n.exists(key) ? i18n.t(key) : category
}

export const translatePriority = (priority) => {
  if (!priority) return ''
  const key = `tickets.priority.${priority}`
  return i18n.exists(key) ? i18n.t(key) : priority
}

export const translateTicketCategory = (category) => {
  if (!category) return ''
  const key = `tickets.category.${category}`
  return i18n.exists(key) ? i18n.t(key) : category
}

export const translateNetworkType = (type) => {
  if (!type) return ''
  const key = `dashboard.network.types.${type}`
  return i18n.exists(key) ? i18n.t(key) : type
}

const ID_PLACEHOLDERS = {
  tickets: 'ticketId',
  assets: 'assetId',
  knowledge: 'articleId',
  users: 'userId',
}

export const getBreadcrumbLabel = (segments, upToIndex) => {
  const keyParts = []
  for (let j = 0; j <= upToIndex; j++) {
    const seg = segments[j]
    if (/^\d+$/.test(seg)) {
      const parent = segments[j - 1]
      keyParts.push(ID_PLACEHOLDERS[parent] || seg)
    } else {
      keyParts.push(seg)
    }
  }
  const key = `breadcrumb.${keyParts.join('_')}`
  return i18n.exists(key) ? i18n.t(key) : null
}

// Traduction des messages de notification du backend
export const translateNotificationMessage = (message) => {
  if (!message) return ''
  
  // Patterns de traduction avec remplacement dynamique
  const patterns = [
    // Ticket non assigné
    {
      regex: /Le ticket #(\d+) "([^"]+)" n'est pas assigné depuis plus de 2 heures/,
      key: 'notifications.messages.unassigned_ticket',
      replacements: ['id', 'title']
    },
    // Nouveau ticket
    {
      regex: /"([^"]+)" créé par (.+)/,
      key: 'notifications.messages.ticket_created',
      replacements: ['title', 'creator']
    },
    // Statut changé
    {
      regex: /Le statut est passé à "([^"]+)" par (.+)/,
      key: 'notifications.messages.status_changed',
      replacements: ['status', 'actor']
    },
    // Ticket assigné
    {
      regex: /"([^"]+)" vous a été assigné par (.+)/,
      key: 'notifications.messages.ticket_assigned',
      replacements: ['title', 'actor']
    },
    // Nouveau commentaire
    {
      regex: /(.+) a ajouté un commentaire/,
      key: 'notifications.messages.new_comment',
      replacements: ['author']
    },
    // SLA dépassé
    {
      regex: /Le ticket "([^"]+)" a dépassé son délai de résolution/,
      key: 'notifications.messages.sla_breached',
      replacements: ['title']
    },
    // Ticket clôturé
    {
      regex: /Votre ticket a été clôturé par (.+)/,
      key: 'notifications.messages.ticket_closed',
      replacements: ['actor']
    },
    // Anomalies
    {
      regex: /L'équipement "([^"]+)" est affecté à "([^"]+)" mais utilisé par "([^"]+)" \(IP: ([^)]+)\)/,
      key: 'notifications.messages.user_mismatch',
      replacements: ['asset', 'assigned', 'detected', 'ip']
    },
    {
      regex: /Un appareil non répertorié a été détecté : (.+) \(IP: ([^,]+), MAC: ([^)]+)\)/,
      key: 'notifications.messages.unknown_device',
      replacements: ['hostname', 'ip', 'mac']
    },
    {
      regex: /L'adresse MAC de "([^"]+)" a changé : ([^ ]+) → ([^.]+)/,
      key: 'notifications.messages.mac_changed',
      replacements: ['asset', 'old', 'new']
    },
    {
      regex: /L'adresse IP de "([^"]+)" a changé : ([^ ]+) → ([^.]+)/,
      key: 'notifications.messages.ip_changed',
      replacements: ['asset', 'old', 'new']
    },
    {
      regex: /"([^"]+)" n'a jamais été détecté sur le réseau depuis sa création/,
      key: 'notifications.messages.never_seen',
      replacements: ['asset']
    },
    {
      regex: /"([^"]+)" est réapparu sur le réseau après (\d+) jour\(s\) d'absence/,
      key: 'notifications.messages.reappeared',
      replacements: ['asset', 'days']
    },
    {
      regex: /"([^"]+)" n'a pas répondu depuis (\d+) jour\(s\)/,
      key: 'notifications.messages.missing',
      replacements: ['asset', 'days']
    },
    // Nouvel équipement détecté
    {
      regex: /Nouvel équipement détecté : (.+)/,
      key: 'notifications.messages.new_asset_detected',
      replacements: ['asset']
    },
  ]
  
  // Chercher un pattern qui correspond
  for (const pattern of patterns) {
    const match = message.match(pattern.regex)
    if (match) {
      const values = match.slice(1)
      const params = {}
      pattern.replacements.forEach((key, index) => {
        params[key] = values[index]
      })
      return i18n.t(pattern.key, params)
    }
  }
  
  // Si aucun pattern ne correspond, retourner le message original
  return message
}
