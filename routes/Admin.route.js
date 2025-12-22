// routes/Admin.route.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Admin.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

// All admin routes require authentication and admin role
router.use(protect, adminOnly);

// Dashboard statistics
router.get('/dashboard/stats', adminController.getDashboardStats);

// Pending fundis
router.get('/fundis/pending', adminController.getPendingFundis);

module.exports = router;