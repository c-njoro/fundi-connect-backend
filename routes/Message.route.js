// routes/Message.route.js
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/Message.controller');
const { protect } = require('../middleware/auth.middleware');

// All message routes are protected
router.post('/', protect, messageController.sendMessage);
router.get('/conversations', protect, messageController.getAllConversations);
router.get('/unread-count', protect, messageController.getUnreadCount);
router.get('/job/:jobId', protect, messageController.getJobMessages);
router.get('/conversation/:jobId/:userId', protect, messageController.getConversation);
router.patch('/:id/read', protect, messageController.markAsRead);
router.patch('/job/:jobId/read-all', protect, messageController.markAllAsRead);
router.delete('/:id', protect, messageController.deleteMessage);

module.exports = router;