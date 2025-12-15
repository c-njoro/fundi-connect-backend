// routes/User.route.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/User.controller');
const { protect, adminOnly, fundiOnly } = require('../middleware/auth.middleware');

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);
router.get('/fundis', userController.searchFundis);
router.get('/fundis/available', userController.getAvailableFundis);
router.get('/fundis/:id', userController.getFundiById);

// Protected routes (authenticated users)
router.get('/profile', protect, userController.getProfile);
router.put('/profile', protect, userController.updateProfile);
router.put('/change-password', protect, userController.changePassword);
router.delete('/profile', protect, userController.deactivateAccount);

// Fundi routes
router.post('/become-fundi', protect, userController.becomeFundi);
router.put('/fundi-profile', protect, fundiOnly, userController.updateFundiProfile);
router.patch('/availability', protect, fundiOnly, userController.updateAvailability);

// Admin routes
router.get('/admin/all', protect, adminOnly, userController.getAllUsers);
router.get('/admin/pending-fundis', protect, adminOnly, userController.getPendingFundis);
router.patch('/admin/fundi/:id/status', protect, adminOnly, userController.updateFundiStatus);

module.exports = router;