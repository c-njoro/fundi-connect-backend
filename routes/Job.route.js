// routes/Job.route.js
const express = require('express');
const router = express.Router();
const jobController = require('../controllers/Job.controller');
const { protect, customerOnly, fundiOnly } = require('../middleware/auth.middleware');

// Public routes
router.get('/', jobController.getAllJobs);
router.get('/:id', jobController.getJobById);

// Protected customer routes
router.post('/', protect, customerOnly, jobController.createJob);
router.put('/:id', protect, jobController.updateJob);
router.delete('/:id', protect, jobController.deleteJob);
router.patch('/:id/proposals/:proposalIndex/accept', protect, jobController.acceptProposal);
router.patch('/:id/approve', protect, jobController.approveCompletion);

// Protected fundi routes
router.get('/fundi/proposals', protect, fundiOnly, jobController.getFundiProposals);
router.get('/fundi/proposals/stats', protect, fundiOnly, jobController.getFundiProposalStats);
router.post('/:id/submit-proposal', protect, fundiOnly, jobController.submitProposal);
router.patch('/:id/start', protect, jobController.startJob);
router.patch('/:id/complete', protect, jobController.completeJob);

// Protected routes (both customer and fundi)
router.get('/me/my-jobs', protect, jobController.getMyJobs);
router.post('/:id/progress', protect, jobController.addWorkProgress);

module.exports = router;