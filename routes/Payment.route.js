// routes/Payment.route.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/Payment.controller');
const { protect, customerOnly, adminOnly } = require('../middleware/auth.middleware');

// Customer initiates escrow payment
router.post('/escrow/:jobId', protect, customerOnly, paymentController.initiateEscrowPayment);

// Verify escrow payment
router.post('/verify/:jobId', protect, customerOnly, paymentController.verifyEscrowPayment);

// Release funds to fundi
router.post('/release/:jobId', protect, customerOnly, paymentController.releaseFunds);

// Refund payment
router.post('/refund/:jobId', protect, paymentController.refundPayment);

// Webhook for Flutterwave callbacks
router.post('/webhook', paymentController.handleWebhook);

// Test Paystack connection
router.get('/test', protect, adminOnly, paymentController.testConnection);

module.exports = router;