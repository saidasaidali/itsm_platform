// backend/src/utils/validationUtils.js
// Utilitaires de validation partagés entre tous les contrôleurs

/**
 * Valide qu'un paramètre est un nombre valide (non NaN)
 * @param {string|number} id - L'ID à valider
 * @param {object} req - L'objet request Express (pour la traduction)
 * @param {object} res - L'objet response Express
 * @returns {boolean} true si valide, false si invalide (et envoie la réponse 400)
 */
export function validateId(id, req, res) {
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: req?.t ? req.t('invalid_id') : 'ID invalide' });
    return false;
  }
  return true;
}

/**
 * Valide qu'un champ requis est présent et non vide
 * @param {string} value - La valeur à valider
 * @param {string} fieldName - Le nom du champ (pour le message d'erreur)
 * @param {object} req - L'objet request Express
 * @param {object} res - L'objet response Express
 * @returns {boolean} true si valide, false si invalide
 */
export function validateRequired(value, fieldName, req, res) {
  if (!value || (typeof value === 'string' && !value.trim())) {
    res.status(400).json({
      success: false,
      message: req?.t ? req.t('field_required', { field: fieldName }) : `Le champ ${fieldName} est requis`
    });
    return false;
  }
  return true;
}

/**
 * Valide qu'une ressource existe (non undefined/null)
 * @param {*} resource - La ressource à vérifier
 * @param {string} notFoundMessage - Le message si non trouvé
 * @param {object} req - L'objet request Express
 * @param {object} res - L'objet response Express
 * @returns {boolean} true si existe, false si inexistante
 */
export function validateResourceExists(resource, notFoundMessage, req, res) {
  if (!resource || (Array.isArray(resource) && resource.length === 0)) {
    res.status(404).json({ success: false, message: notFoundMessage });
    return false;
  }
  return true;
}