// frontend/src/services/calendarSyncClient.js
// Client SSE pour la synchronisation temps réel du calendrier

/**
 * Gère la connexion SSE pour les mises à jour automatiques du calendrier
 */

class CalendarSyncClient {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 3000; // 3 secondes
    this.heartbeatTimeout = null;
    this.connected = false;
  }

  /**
   * Établit la connexion SSE
   * @param {string} token - JWT token d'authentification
   */
  connect(token) {
    if (this.eventSource) {
      this.disconnect();
    }

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    try {
      this.eventSource = new EventSource(`${baseUrl}/api/calendar/sync?token=${token}`);
      
      this.eventSource.onopen = () => {
        console.log('[CalendarSync] Connexion SSE établie');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', { timestamp: new Date().toISOString() });
      };

      this.eventSource.onmessage = (event) => {
        try {
          // Ignorer les commentaires (heartbeat)
          if (event.data === 'connected' || event.data === '') {
            return;
          }
          
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          console.warn('[CalendarSync] Erreur parsing message:', err.message);
        }
      };

      this.eventSource.onerror = (err) => {
        console.error('[CalendarSync] Erreur de connexion SSE:', err);
        this.connected = false;
        this.handleReconnect(token);
      };
    } catch (err) {
      console.error('[CalendarSync] Erreur création EventSource:', err.message);
      this.handleReconnect(token);
    }
  }

  /**
   * Gère les messages entrants
   */
  handleMessage(data) {
    switch (data.type) {
      case 'connected':
        console.log('[CalendarSync] Connecté au serveur SSE');
        this.emit('connected', data);
        break;
        
      case 'event_created':
        console.log('[CalendarSync] Nouvel événement créé');
        this.emit('event_created', data.data);
        this.emit('refresh_calendar', data);
        break;
        
      case 'event_updated':
        console.log('[CalendarSync] Événement mis à jour');
        this.emit('event_updated', data.data);
        this.emit('refresh_calendar', data);
        break;
        
      case 'event_deleted':
        console.log('[CalendarSync] Événement supprimé');
        this.emit('event_deleted', data.data);
        this.emit('refresh_calendar', data);
        break;
        
      case 'ticket_updated':
        console.log('[CalendarSync] Ticket mis à jour:', data.data?.action || 'unknown');
        this.emit('ticket_updated', data.data);
        this.emit('refresh_calendar', data);
        break;
        
      case 'asset_updated':
        console.log('[CalendarSync] Équipement mis à jour');
        this.emit('asset_updated', data.data);
        this.emit('refresh_calendar', data);
        break;
        
      case 'refresh_all':
        console.log('[CalendarSync] Rafraîchissement complet demandé');
        this.emit('refresh_all', data);
        this.emit('refresh_calendar', data);
        break;
        
      default:
        console.log('[CalendarSync] Type de message inconnu:', data.type);
    }
  }

  /**
   * Gère la reconnexion avec backoff exponentiel
   */
  handleReconnect(token) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[CalendarSync] Nombre max de tentatives de reconnexion atteint');
      this.emit('max_retries_reached');
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts),
      30000 // Max 30 secondes
    );

    this.reconnectAttempts++;
    console.log(`[CalendarSync] Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${delay}ms`);

    setTimeout(() => {
      this.connect(token);
    }, delay);
  }

  /**
   * Déconnecte le client SSE
   */
  disconnect() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.connected = false;
    this.reconnectAttempts = 0;
    console.log('[CalendarSync] Déconnecté');
  }

  /**
   * Ajoute un écouteur d'événement
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction de rappel
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    
    // Retourne une fonction de nettoyage
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(callback);
        if (index !== -1) {
          eventListeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Émet un événement vers tous les écouteurs
   */
  emit(event, data) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[CalendarSync] Erreur dans l'écouteur ${event}:`, err);
        }
      });
    }
  }

  /**
   * Vérifie si la connexion est active
   */
  isConnected() {
    return this.connected;
  }
}

// Singleton
const calendarSyncClient = new CalendarSyncClient();

export default calendarSyncClient;