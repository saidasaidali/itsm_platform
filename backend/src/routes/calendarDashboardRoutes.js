// backend/src/routes/calendarDashboardRoutes.js
import { Router } from 'express'
import { authenticate } from '../middlewares/authMiddleware.js'
import { authorize } from '../middlewares/roleMiddleware.js'
import { getCalendarDashboard } from '../controllers/calendarDashboardController.js'

const router = Router()
router.use(authenticate)

// Tous les rôles authentifiés peuvent voir le dashboard
router.get('/', getCalendarDashboard)

export default router