// backend/src/services/calendarSyncService.js
// Service de synchronisation temps réel pour le calendrier via SSE
import pool from '../db.js';

// Stockage des clients SSE connectés
const calendarClients = new Set();

/**
 * Enregistre un client SSE pour le calendrier
 */
export function registerCalendarClient(res) {
  calendarClients.add(res);
  
  // Envoyer un message de confirmation
  sendToClient(res, {
    type: 'connected',
    message: 'Connexion au calendrier établie',
    timestamp: new Date().toISOString()
  });
  
  // Nettoyer à la déconnexion
  res.on('close', () => {
    calendarClients.delete(res);
  });
  
  // Garder la connexion ouverte
  res.on('error', (err) => {
    console.error('[CalendarSync] Erreur client SSE:', err.message);
    calendarClients.delete(res);
  });
}

/**
 * Envoie un message à tous les clients connectés
 */
export function broadcastToCalendarClients(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  
  calendarClients.forEach((client) => {
    try {
      client.write(message);
    } catch (err) {
      console.error('[CalendarSync] Erreur envoi message:', err.message);
      calendarClients.delete(client);
    }
  });
}

/**
 * Envoie un message à un client spécifique
 */
function sendToClient(client, data) {
  try {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    client.write(message);
  } catch (err) {
    console.error('[CalendarSync] Erreur envoi message client:', err.message);
    calendarClients.delete(client);
  }
}

/**
 * Notifie les clients d'une mise à jour d'événement
 */
export function notifyEventCreated(event) {
  broadcastToCalendarClients({
    type: 'event_created',
    data: event,
    timestamp: new Date().toISOString()
  });
}

/**
 * Notifie les clients d'une mise à jour d'événement
 */
export function notifyEventUpdated(event) {
  broadcastToCalendarClients({
    type: 'event_updated',
    data: event,
    timestamp: new Date().toISOString()
  });
}

/**
 * Notifie les clients d'une suppression d'événement
 */
export function notifyEventDeleted(eventId) {
  broadcastToCalendarClients({
    type: 'event_deleted',
    data: { id: eventId },
    timestamp: new Date().toISOString()
  });
}

/**
 * Notifie les clients d'une mise à jour de ticket
 */
export function notifyTicketUpdated(ticket) {
  broadcastToCalendarClients({
    type: 'ticket_updated',
    data: ticket,
    timestamp: new Date().toISOString()
  });
}

/**
 * Notifie les clients d'une mise à jour d'équipement
 */
export function notifyAssetUpdated(asset) {
  broadcastToCalendarClients({
    type: 'asset_updated',
    data: asset,
    timestamp: new Date().toISOString()
  });
}

/**
 * Notifie les clients de recharger toutes les données
 */
export function notifyRefreshAll() {
  broadcastToCalendarClients({
    type: 'refresh_all',
    message: 'Les données du calendrier ont été modifiées. Veuillez recharger.',
    timestamp: new Date().toISOString()
  });
}

/**
 * Retourne le nombre de clients connectés
 */
export function getConnectedClientsCount() {
  return calendarClients.size;
}

export default {
  registerCalendarClient,
  broadcastToCalendarClients,
  notifyEventCreated,
  notifyEventUpdated,
  notifyEventDeleted,
  notifyTicketUpdated,
  notifyAssetUpdated,
  notifyRefreshAll,
  getConnectedClientsCount
};