import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { askChatbot } from '../controllers/chatbotController.js';

const router = express.Router();

router.post('/ask', authenticate, askChatbot);

export default router;