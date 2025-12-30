// routes/Upload.route.js
const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/Upload.controller');
const { protect } = require('../middleware/auth.middleware');
const {
  uploadSingle,
  uploadMultiple,
} = require('../config/cloudinary');

// All upload routes require authentication
router.use(protect);

// Upload single image
router.post('/single', uploadSingle, uploadController.uploadSingle);

// Upload multiple images
router.post('/multiple', uploadMultiple, uploadController.uploadMultiple);

// Delete image - FIXED: Use a wildcard route without regex
// This will match /upload/anything and /upload/anything/anything/anything
router.delete('/:publicId', uploadController.deleteImage);

module.exports = router;