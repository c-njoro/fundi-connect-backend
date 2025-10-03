// routes/Notification.route.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/Notification.controller');
const { protect } = require('../middleware/auth.middleware');

// All notification routes are protected
router.get('/', protect, notificationController.getNotifications);
router.get('/unread-count', protect, notificationController.getUnreadCount);
router.get('/:id', protect, notificationController.getNotificationById);
router.patch('/read-all', protect, notificationController.markAllAsRead);
router.patch('/:id/read', protect, notificationController.markAsRead);
router.delete('/read', protect, notificationController.deleteAllRead);
router.delete('/:id', protect, notificationController.deleteNotification);
router.delete('/', protect, notificationController.deleteAllNotifications);

module.exports = router;