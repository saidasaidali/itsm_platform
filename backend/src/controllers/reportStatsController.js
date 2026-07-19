// backend/src/controllers/reportStatsController.js
// Contrôleur pour les endpoints de statistiques de rapports

import { t } from '../utils/i18n.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import * as reportStatsService from '../services/reportStatsService.js';

// ─── GET /api/reports/stats/all — Obtenir toutes les statistiques ──────────────
export const getAllStats = asyncHandler(async (req, res) => {
  const { period_start, period_end } = req.query;

  console.log('=== API STATS ===');
  console.log('Période reçue:', period_start, 'à', period_end);
  console.log('Filtres reçus:', req.query);

  if (!period_start || !period_end) {
    return res.status(400).json({
      success: false,
      message: 'Les paramètres period_start et period_end sont requis'
    });
  }

  const filters = {
    department: req.query.department,
    service: req.query.service,
    asset_type: req.query.asset_type,
    status: req.query.status,
    priority: req.query.priority,
    category: req.query.category,
    assigned_to: req.query.assigned_to,
    created_by: req.query.created_by
  };

  // Filtrer les valeurs vides
  Object.keys(filters).forEach(key => {
    if (!filters[key]) delete filters[key];
  });

  console.log('Filtres appliqués:', filters);
  console.log('Appel du service de statistiques...');

  const stats = await reportStatsService.getAllReportStats(period_start, period_end, filters);

  console.log('Statistiques reçues du service:', stats ? 'OK' : 'NULL');
  if (stats) {
    console.log('Structure des stats:', {
      hasAssets: !!stats.assets,
      hasUsers: !!stats.users,
      hasTickets: !!stats.tickets,
      hasSecurity: !!stats.security,
      hasAI: !!stats.ai,
      hasPlatform: !!stats.platform
    });
  }

  if (!stats) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des statistiques'
    });
  }

  return res.json({
    success: true,
    data: stats
  });
});

// ─── GET /api/reports/stats/assets — Statistiques du parc informatique ──────────
export const getAssetStats = asyncHandler(async (req, res) => {
  const { period_start, period_end } = req.query;

  if (!period_start || !period_end) {
    return res.status(400).json({
      success: false,
      message: 'Les paramètres period_start et period_end sont requis'
    });
  }

  const filters = {
    department: req.query.department,
    service: req.query.service,
    asset_type: req.query.asset_type,
    status: req.query.status
  };

  Object.keys(filters).forEach(key => {
    if (!filters[key]) delete filters[key];
  });

  const stats = await reportStatsService.getAssetParkStats(period_start, period_end, filters);

  if (!stats) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des statistiques du parc informatique'
    });
  }

  return res.json({
    success: true,
    data: stats
  });
});

// ─── GET /api/reports/stats/users — Statistiques des utilisateurs ──────────────
export const getUserStats = asyncHandler(async (req, res) => {
  const { period_start, period_end } = req.query;

  if (!period_start || !period_end) {
    return res.status(400).json({
      success: false,
      message: 'Les paramètres period_start et period_end sont requis'
    });
  }

  const stats = await reportStatsService.getUserStats(period_start, period_end);

  if (!stats) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des statistiques des utilisateurs'
    });
  }

  return res.json({
    success: true,
    data: stats
  });
});

// ─── GET /api/reports/stats/tickets — Statistiques des tickets ─────────────────
export const getTicketStats = asyncHandler(async (req, res) => {
  const { period_start, period_end } = req.query;

  if (!period_start || !period_end) {
    return res.status(400).json({
      success: false,
      message: 'Les paramètres period_start et period_end sont requis'
    });
  }

  const filters = {
    priority: req.query.priority,
    category: req.query.category,
    status: req.query.status,
    assigned_to: req.query.assigned_to,
    created_by: req.query.created_by
  };

  Object.keys(filters).forEach(key => {
    if (!filters[key]) delete filters[key];
  });

  const stats = await reportStatsService.getTicketStats(period_start, period_end, filters);

  if (!stats) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des statistiques des tickets'
    });
  }

  return res.json({
    success: true,
    data: stats
  });
});

// ─── GET /api/reports/stats/security — Statistiques de sécurité ────────────────
export const getSecurityStats = asyncHandler(async (req, res) => {
  const { period_start, period_end } = req.query;

  if (!period_start || !period_end) {
    return res.status(400).json({
      success: false,
      message: 'Les paramètres period_start et period_end sont requis'
    });
  }

  const stats = await reportStatsService.getSecurityStats(period_start, period_end);

  if (!stats) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des statistiques de sécurité'
    });
  }

  return res.json({
    success: true,
    data: stats
  });
});

// ─── GET /api/reports/stats/network — Statistiques de découverte réseau ─────────
export const getNetworkStats = asyncHandler(async (req, res) => {
  const { period_start, period_end } = req.query;

  if (!period_start || !period_end) {
    return res.status(400).json({
      success: false,
      message: 'Les paramètres period_start et period_end sont requis'
    });
  }

  const stats = await reportStatsService.getNetworkDiscoveryStats(period_start, period_end);

  if (!stats) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des statistiques de découverte réseau'
    });
  }

  return res.json({
    success: true,
    data: stats
  });
});

// ─── GET /api/reports/stats/ai — Statistiques de l'assistant IA ────────────────
export const getAIStats = asyncHandler(async (req, res) => {
  const { period_start, period_end } = req.query;

  if (!period_start || !period_end) {
    return res.status(400).json({
      success: false,
      message: 'Les paramètres period_start et period_end sont requis'
    });
  }

  const stats = await reportStatsService.getAIAssistantStats(period_start, period_end);

  if (!stats) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des statistiques de l\'assistant IA'
    });
  }

  return res.json({
    success: true,
    data: stats
  });
});

// ─── GET /api/reports/stats/platform — Statistiques d'activité plateforme ───────
export const getPlatformStats = asyncHandler(async (req, res) => {
  const { period_start, period_end } = req.query;

  if (!period_start || !period_end) {
    return res.status(400).json({
      success: false,
      message: 'Les paramètres period_start et period_end sont requis'
    });
  }

  const stats = await reportStatsService.getPlatformActivityStats(period_start, period_end);

  if (!stats) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des statistiques d\'activité'
    });
  }

  return res.json({
    success: true,
    data: stats
  });
});

// ─── GET /api/reports/filters — Obtenir les filtres disponibles ────────────────
export const getFilters = asyncHandler(async (req, res) => {
  const filters = await reportStatsService.getAvailableFilters();

  if (!filters) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des filtres'
    });
  }

  return res.json({
    success: true,
    data: filters
  });
});