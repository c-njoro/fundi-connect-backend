// routes/Review.route.js
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/Review.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

// Public routes
router.get('/user/:userId', reviewController.getUserReviews);
router.get('/top-fundis', reviewController.getTopFundis);
router.get('/job/:jobId', reviewController.getJobReviews);
router.get('/:id', reviewController.getReviewById);

// Protected routes
router.post('/', protect, reviewController.createReview);
router.get('/my-reviews', protect, reviewController.getMyReviews);
router.put('/:id', protect, reviewController.updateReview);
router.patch('/:id/response', protect, reviewController.addResponse);
router.delete('/:id', protect, reviewController.deleteReview);

module.exports = router;