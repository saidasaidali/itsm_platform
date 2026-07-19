// backend/src/controllers/suggestionController.js
import { getSuggestions } from '../services/autoTicketing/suggestionEngine.js';
import { t } from '../utils/i18n.js';

export async function getTicketSuggestions(req, res) {
  const { title, description, category, excludeTicketId } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: t(req, 'suggestions_missing_title') });
  }

  try {
    const suggestions = await getSuggestions(
      title.trim(),
      description?.trim() || '',
      category,
      excludeTicketId
    );

    return res.json({ success: true, ...suggestions });
  } catch (err) {
    console.error('[getTicketSuggestions]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}
