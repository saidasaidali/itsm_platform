// frontend/src/services/reportService.js
// Service pour les rapports IT

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '') + '/api';
const TOKEN_KEY = 'itsm-auth-token';

// ── Génération de rapport ──────────────────────────────────────────────────────

export async function generateReport(reportType, periodStart, periodEnd, filters = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  
  const response = await fetch(`${API_BASE}/reports/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      report_type: reportType,
      period_start: periodStart,
      period_end: periodEnd,
      filters: filters
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erreur lors de la génération du rapport');
  }

  return response.json();
}

// ── Récupération de l'historique ──────────────────────────────────────────────

export async function getReports(page = 1, limit = 20) {
  const token = localStorage.getItem(TOKEN_KEY);
  
  const response = await fetch(
    `${API_BASE}/reports?page=${page}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Erreur lors de la récupération des rapports');
  }

  return response.json();
}

// ── Récupération d'un rapport ─────────────────────────────────────────────────

export async function getReportById(id) {
  const token = localStorage.getItem(TOKEN_KEY);
  
  const response = await fetch(`${API_BASE}/reports/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Erreur lors de la récupération du rapport');
  }

  return response.json();
}

// ── Suppression d'un rapport ──────────────────────────────────────────────────

export async function deleteReport(id) {
  const token = localStorage.getItem(TOKEN_KEY);
  
  const response = await fetch(`${API_BASE}/reports/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erreur lors de la suppression du rapport');
  }

  return response.json();
}

// ── Téléchargement d'un rapport ───────────────────────────────────────────────

export async function downloadReport(id, filename) {
  const token = localStorage.getItem(TOKEN_KEY);
  
  const response = await fetch(`${API_BASE}/reports/download/${id}?token=${encodeURIComponent(token)}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Erreur lors du téléchargement du rapport');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// ── Vérification du statut ────────────────────────────────────────────────────

export async function getReportStatus(id) {
  const token = localStorage.getItem(TOKEN_KEY);
  
  const response = await fetch(`${API_BASE}/reports/${id}/status`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Erreur lors de la vérification du statut');
  }

  return response.json();
}

// ── Récupération des statistiques ─────────────────────────────────────────────

export async function getStats(periodStart, periodEnd, filters = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  
  const params = new URLSearchParams({
    period_start: periodStart,
    period_end: periodEnd
  });

  if (filters.department) params.append('department', filters.department);
  if (filters.service) params.append('service', filters.service);
  if (filters.asset_type) params.append('asset_type', filters.asset_type);
  if (filters.status) params.append('status', filters.status);
  if (filters.priority) params.append('priority', filters.priority);
  if (filters.category) params.append('category', filters.category);
  if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
  if (filters.created_by) params.append('created_by', filters.created_by);

  const response = await fetch(`${API_BASE}/reports/stats/all?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Erreur lors de la récupération des statistiques');
  }

  return response.json();
}

// ── Récupération des filtres disponibles ──────────────────────────────────────

export async function getAvailableFilters() {
  const token = localStorage.getItem(TOKEN_KEY);
  
  const response = await fetch(`${API_BASE}/reports/filters`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Erreur lors de la récupération des filtres');
  }

  return response.json();
}
