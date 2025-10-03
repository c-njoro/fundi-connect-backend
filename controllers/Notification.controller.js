const Notification = require('../models/Notification.model');
const User = require('../models/User.model');

// @desc    Create a notification (internal helper function)
// @access  Internal
exports.createNotification = async (userId, type, title, message, data = {}) => {
  try {
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      data,
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// @desc    Get all notifications for current user
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const { isRead, type, page = 1, limit = 20 } = req.query;

    const query = { userId: req.userId };

    // Filter by read status
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    // Filter by type
    if (type) {
      query.type = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      userId: req.userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      unreadCount,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message,
    });
  }
};

// @desc    Get single notification by ID
// @route   GET /api/notifications/:id
// @access  Private (Owner only)
exports.getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    // Check ownership
    if (notification.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this notification',
      });
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification',
      error: error.message,
    });
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private (Owner only)
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    // Check ownership
    if (notification.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this notification',
      });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message,
    });
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.userId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to mark notifications as read',
      error: error.message,
    });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      userId: req.userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message,
    });
  }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private (Owner only)
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    // Check ownership
    if (notification.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this notification',
      });
    }

    await notification.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message,
    });
  }
};

// @desc    Delete all read notifications
// @route   DELETE /api/notifications/read
// @access  Private
exports.deleteAllRead = async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      userId: req.userId,
      isRead: true,
    });

    res.status(200).json({
      success: true,
      message: 'All read notifications deleted',
      data: {
        deletedCount: result.deletedCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete notifications',
      error: error.message,
    });
  }
};

// @desc    Delete all notifications
// @route   DELETE /api/notifications
// @access  Private
exports.deleteAllNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      userId: req.userId,
    });

    res.status(200).json({
      success: true,
      message: 'All notifications deleted',
      data: {
        deletedCount: result.deletedCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete notifications',
      error: error.message,
    });
  }
};

// ==================================================
// NOTIFICATION TRIGGER HELPERS
// These are called from other controllers
// ==================================================

// Job applied notification
exports.notifyJobApplied = async (customerId, jobId, fundiName) => {
  return await exports.createNotification(
    customerId,
    'job_applied',
    'New Proposal Received',
    `${fundiName} has applied to your job`,
    { jobId, type: 'job' }
  );
};

// Job assigned notification
exports.notifyJobAssigned = async (fundiId, jobId, jobTitle) => {
  return await exports.createNotification(
    fundiId,
    'job_assigned',
    'Job Assigned to You',
    `You have been assigned to: ${jobTitle}`,
    { jobId, type: 'job' }
  );
};

// Payment received notification
exports.notifyPaymentReceived = async (fundiId, amount, jobId) => {
  return await exports.createNotification(
    fundiId,
    'payment_received',
    'Payment Received',
    `You have received KES ${amount} for completed job`,
    { jobId, amount, type: 'payment' }
  );
};

// Job completed notification
exports.notifyJobCompleted = async (customerId, jobId, fundiName) => {
  return await exports.createNotification(
    customerId,
    'job_completed',
    'Job Completed',
    `${fundiName} has marked your job as completed. Please review and approve.`,
    { jobId, type: 'job' }
  );
};

// Job cancelled notification
exports.notifyJobCancelled = async (userId, jobId, jobTitle) => {
  return await exports.createNotification(
    userId,
    'job_cancelled',
    'Job Cancelled',
    `The job "${jobTitle}" has been cancelled`,
    { jobId, type: 'job' }
  );
};

// Review received notification
exports.notifyReviewReceived = async (fundiId, rating, reviewId) => {
  return await exports.createNotification(
    fundiId,
    'review_received',
    'New Review Received',
    `You received a ${rating}-star review`,
    { reviewId, rating, type: 'review' }
  );
};