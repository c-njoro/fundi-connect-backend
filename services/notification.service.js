// services/notification.service.js
const Notification = require('../models/Notification.model');
const notificationController = require('../controllers/Notification.controller');

// Generic creator
const createNotification = notificationController.createNotification;

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

module.exports = {
  createNotification,
  notifyJobApplied,
  notifyJobAssigned,
  notifyPaymentReceived,
  notifyJobCompleted,
  notifyJobCancelled,
  notifyReviewReceived,
};
