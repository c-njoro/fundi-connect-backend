// routes/Service.route.js
const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/Service.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

// Public routes
router.get('/', serviceController.getAllServices);
router.get('/categories', serviceController.getCategories);
router.get('/:id', serviceController.getServiceById);

// Admin only routes
router.post('/', protect, adminOnly, serviceController.createService);
router.put('/:id', protect, adminOnly, serviceController.updateService);
router.delete('/:id', protect, adminOnly, serviceController.deleteService);
router.delete('/:id/permanent', protect, adminOnly, serviceController.permanentDeleteService);

// Sub-service routes
router.post('/:id/sub-services', protect, adminOnly, serviceController.addSubService);
router.put('/:id/sub-services/:subServiceIndex', protect, adminOnly, serviceController.updateSubService);
router.delete('/:id/sub-services/:subServiceIndex', protect, adminOnly, serviceController.deleteSubService);

module.exports = router;