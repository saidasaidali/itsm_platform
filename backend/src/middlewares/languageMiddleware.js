const languageMiddleware = (req, res, next) => {
  const raw = req.query.lang || req.headers['accept-language'] || 'fr'
  const lang = String(raw).split(',')[0].split('-')[0].trim().toLowerCase()

  req.lang = ['fr', 'ar', 'en'].includes(lang) ? lang : 'fr'

  next()
}

export default languageMiddleware
