// frontend/src/services/reportService.js
import api from './api';

export const reportService = {
  // Get all reports with pagination
  getReports: async (page = 1, limit = 20) => {
    try {
      const response = await api.get(`/api/reports?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching reports:', error);
      throw error;
    }
  },

  // Generate new report
  generateReport: async (reportType, periodStart, periodEnd) => {
    try {
      const response = await api.post('/api/reports/generate', {
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd
      });
      return response.data;
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  },

  // Get report by ID
  getReportById: async (reportId) => {
    try {
      const response = await api.get(`/api/reports/${reportId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching report:', error);
      throw error;
    }
  },

  // Get report status
  getReportStatus: async (reportId) => {
    try {
      const response = await api.get(`/api/reports/${reportId}/status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching report status:', error);
      throw error;
    }
  },

  // Delete report
  deleteReport: async (reportId) => {
    try {
      const response = await api.delete(`/api/reports/${reportId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  },

  // Download report PDF
  downloadReport: async (reportId) => {
    try {
      const response = await api.get(`/api/reports/download/${reportId}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error downloading report:', error);
      throw error;
    }
  }
};
