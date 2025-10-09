const Notification = require('../models/Notification.model');

// ==================================================
// NOTIFICATION SERVICE
// Helper functions to create notifications
// Use these in your controllers instead of importing controller
// ==================================================

// Generic notification creator
const createNotification = async (userId, type, title, message, data = {}) => {
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
    // Don't throw - notifications shouldn't break main flow
    return null;
  }
};

// Job applied notification
const notifyJobApplied = async (customerId, jobId, fundiName) => {
  return await createNotification(
    customerId,
    'job_applied',
    'New Proposal Received',
    `${fundiName} has applied to your job`,
    { jobId, type: 'job' }
  );
};

// Job assigned notification
const notifyJobAssigned = async (fundiId, jobId, jobTitle) => {
  return await createNotification(
    fundiId,
    'job_assigned',
    'Job Assigned to You',
    `You have been assigned to: ${jobTitle}`,
    { jobId, type: 'job' }
  );
};

// Payment received notification
const notifyPaymentReceived = async (fundiId, amount, jobId) => {
  return await createNotification(
    fundiId,
    'payment_received',
    'Payment Received',
    `You have received KES ${amount} for completed job`,
    { jobId, amount, type: 'payment' }
  );
};

// Job completed notification
const notifyJobCompleted = async (customerId, jobId, fundiName) => {
  return await createNotification(
    customerId,
    'job_completed',
    'Job Completed',
    `${fundiName} has marked your job as completed. Please review and approve.`,
    { jobId, type: 'job' }
  );
};

// Job cancelled notification
const notifyJobCancelled = async (userId, jobId, jobTitle) => {
  return await createNotification(
    userId,
    'job_cancelled',
    'Job Cancelled',
    `The job "${jobTitle}" has been cancelled`,
    { jobId, type: 'job' }
  );
};

// Review received notification
const notifyReviewReceived = async (fundiId, rating, reviewId) => {
  return await createNotification(
    fundiId,
    'review_received',
    'New Review Received',
    `You received a ${rating}-star review`,
    { reviewId, rating, type: 'review' }
  );
};

// New message notification (optional - use if not using Socket.io)
const notifyNewMessage = async (receiverId, senderId, senderName, jobId) => {
  return await createNotification(
    receiverId,
    'new_message',
    'New Message',
    `${senderName} sent you a message`,
    { jobId, senderId, type: 'message' }
  );
};

// Export all notification functions
module.exports = {
  createNotification,
  notifyJobApplied,
  notifyJobAssigned,
  notifyPaymentReceived,
  notifyJobCompleted,
  notifyJobCancelled,
  notifyReviewReceived,
  notifyNewMessage,
};