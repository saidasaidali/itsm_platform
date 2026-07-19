// backend/src/routes/calendarRoutes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import {
  getEvents, getEventById, createEvent,
  updateEvent, deleteEvent, getStats, duplicateEvent, getAutoEvents,
  getEventParticipants, addParticipant, updateParticipantStatus, removeParticipant
} from '../controllers/calendarController.js';
import {
  suggestBestDate, detectConflicts, recommendTechnician, suggestMaintenancePeriod,
  detectAvailableSlots, suggestBestDuration
} from '../controllers/calendarSmartAssistantController.js';
import { registerCalendarClient } from '../services/calendarSyncService.js';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Événements automatiques (tous rôles authentifiés)
router.get('/auto-events', getAutoEvents);

// Statistiques (tous rôles authentifiés)
router.get('/stats', getStats);

// CRUD événements
router.get('/events', getEvents);
router.get('/events/:id', getEventById);
router.post('/events', authorize('Admin', 'Technicien'), createEvent);
router.put('/events/:id', authorize('Admin', 'Technicien'), updateEvent);
router.post('/events/:id/duplicate', authorize('Admin', 'Technicien'), duplicateEvent);
router.delete('/events/:id', authorize('Admin', 'Technicien'), deleteEvent);

// Participants
router.get('/events/:id/participants', getEventParticipants);
router.post('/events/:id/participants', authorize('Admin', 'Technicien'), addParticipant);
router.put('/events/:id/participants/:userId', authorize('Admin', 'Technicien'), updateParticipantStatus);
router.delete('/events/:id/participants/:userId', authorize('Admin', 'Technicien'), removeParticipant);

// Smart Assistant - Intelligence planning
router.get('/smart-assistant/suggest-date', authorize('Admin', 'Technicien'), suggestBestDate);
router.get('/smart-assistant/detect-conflicts', authorize('Admin', 'Technicien'), detectConflicts);
router.get('/smart-assistant/recommend-technician', authorize('Admin', 'Technicien'), recommendTechnician);
router.get('/smart-assistant/suggest-duration', authorize('Admin', 'Technicien'), suggestBestDuration);
router.get('/smart-assistant/detect-available-slots', authorize('Admin', 'Technicien'), detectAvailableSlots);
router.get('/smart-assistant/suggest-maintenance/:asset_id', authorize('Admin', 'Technicien'), suggestMaintenancePeriod);

// SSE - Synchronisation temps réel du calendrier
router.get('/sync', authenticate, (req, res) => {
  // Configuration SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Désactiver le buffering Nginx
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  
  // Envoyer un commentaire pour garder la connexion ouverte
  res.write(': connected\n\n');
  
  // Enregistrer le client
  registerCalendarClient(res);
  
  // Envoyer un heartbeat toutes les 30 secondes pour garder la connexion alive
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (err) {
      console.error('[CalendarSync] Erreur heartbeat:', err.message);
      clearInterval(heartbeatInterval);
    }
  }, 30000);
  
  // Nettoyer à la déconnexion
  req.on('close', () => {
    clearInterval(heartbeatInterval);
  });
});

export default router;
