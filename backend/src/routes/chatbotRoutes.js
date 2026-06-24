import express from 'express';
import { askChatbot, sendMessage, syncAll, getTopCases, getSessionHistory } from '../controllers/chatbotController.js';

const router = express.Router();

router.post('/ask', askChatbot);
router.post('/message', sendMessage);
router.post('/sync-all', syncAll);
router.get('/top-cases', getTopCases);
router.get('/history/:session_key', getSessionHistory);

export default router;
