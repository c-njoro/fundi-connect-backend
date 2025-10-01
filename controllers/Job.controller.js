const Job = require('../models/Job.model');
const User = require('../models/User.model');
const Service = require('../models/Service.model');

// @desc    Create a new job
// @route   POST /api/jobs
// @access  Private (Customer)
exports.createJob = async (req, res) => {
  try {
    const {
      serviceId,
      subService,
      jobDetails,
      location,
      scheduling,
      payment,
    } = req.body;

    // Verify service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    // Create job
    const job = new Job({
      customerId: req.userId,
      serviceId,
      subService,
      jobDetails,
      location,
      scheduling,
      payment: {
        method: payment?.method || 'mpesa',
        status: 'pending',
      },
      status: 'posted',
    });

    await job.save();

    // Populate service details
    await job.populate('serviceId customerId', 'name profile');

    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: job,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to create job',
      error: error.message,
    });
  }
};

// @desc    Get all jobs with filters
// @route   GET /api/jobs
// @access  Public
exports.getAllJobs = async (req, res) => {
  try {
    const {
      status,
      serviceId,
      urgency,
      city,
      county,
      lat,
      lng,
      radius,
      page = 1,
      limit = 20,
    } = req.query;

    // Build query
    const query = {};

    if (status) {
      query.status = status;
    } else {
      // Default: show only posted jobs for public view
      query.status = 'posted';
    }

    if (serviceId) {
      query.serviceId = serviceId;
    }

    if (urgency) {
      query['jobDetails.urgency'] = urgency;
    }

    if (city) {
      query['location.city'] = new RegExp(city, 'i');
    }

    if (county) {
      query['location.county'] = new RegExp(county, 'i');
    }

    // Geo query if coordinates provided
    if (lat && lng) {
      query['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: radius ? parseInt(radius) : 50000, // 50km default
        },
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const jobs = await Job.find(query)
      .populate('serviceId', 'name category icon')
      .populate('customerId', 'profile.firstName profile.lastName profile.avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Job.countDocuments(query);

    res.status(200).json({
      success: true,
      count: jobs.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: jobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs',
      error: error.message,
    });
  }
};

// @desc    Get single job by ID
// @route   GET /api/jobs/:id
// @access  Public
exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('serviceId', 'name category icon subServices')
      .populate('customerId', 'profile location')
      .populate('fundiId', 'profile fundiProfile location')
      .populate('proposals.fundiId', 'profile fundiProfile.ratings fundiProfile.completedJobs');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job',
      error: error.message,
    });
  }
};

// @desc    Update job details
// @route   PUT /api/jobs/:id
// @access  Private (Job owner only)
exports.updateJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Check ownership
    if (job.customerId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this job',
      });
    }

    // Only allow updates if job is still posted
    if (job.status !== 'posted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update job once proposals are accepted',
      });
    }

    const { jobDetails, location, scheduling } = req.body;

    if (jobDetails) {
      Object.keys(jobDetails).forEach((key) => {
        if (jobDetails[key] !== undefined) {
          job.jobDetails[key] = jobDetails[key];
        }
      });
    }

    if (location) {
      Object.keys(location).forEach((key) => {
        if (location[key] !== undefined) {
          job.location[key] = location[key];
        }
      });
    }

    if (scheduling) {
      Object.keys(scheduling).forEach((key) => {
        if (scheduling[key] !== undefined) {
          job.scheduling[key] = scheduling[key];
        }
      });
    }

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      data: job,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update job',
      error: error.message,
    });
  }
};

// @desc    Delete/Cancel a job
// @route   DELETE /api/jobs/:id
// @access  Private (Job owner only)
exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Check ownership
    if (job.customerId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this job',
      });
    }

    // If job has been assigned, just cancel it
    if (job.status === 'assigned' || job.status === 'in_progress') {
      job.status = 'cancelled';
      await job.save();

      return res.status(200).json({
        success: true,
        message: 'Job cancelled successfully',
        data: job,
      });
    }

    // Otherwise delete it
    await job.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Job deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete job',
      error: error.message,
    });
  }
};

// @desc    Submit a proposal for a job
// @route   POST /api/jobs/:id/proposals
// @access  Private (Fundi only)
exports.submitProposal = async (req, res) => {
  try {
    const { proposedPrice, estimatedDuration, proposal } = req.body;

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Check if job is still accepting proposals
    if (job.status !== 'posted') {
      return res.status(400).json({
        success: false,
        message: 'Job is no longer accepting proposals',
      });
    }

    // Check if fundi already submitted a proposal
    const existingProposal = job.proposals.find(
      (p) => p.fundiId.toString() === req.userId.toString()
    );

    if (existingProposal) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a proposal for this job',
      });
    }

    // Add proposal
    job.proposals.push({
      fundiId: req.userId,
      proposedPrice,
      estimatedDuration,
      proposal,
    });

    job.status = 'applied';
    await job.save();

    // Populate the new proposal
    await job.populate('proposals.fundiId', 'profile fundiProfile.ratings');

    res.status(201).json({
      success: true,
      message: 'Proposal submitted successfully',
      data: job,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to submit proposal',
      error: error.message,
    });
  }
};

// @desc    Accept a proposal
// @route   PATCH /api/jobs/:id/proposals/:proposalIndex/accept
// @access  Private (Job owner only)
exports.acceptProposal = async (req, res) => {
  try {
    const { proposalIndex } = req.params;

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Check ownership
    if (job.customerId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept proposals for this job',
      });
    }

    const proposal = job.proposals[proposalIndex];

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }

    // Update proposal status
    job.proposals[proposalIndex].status = 'accepted';

    // Reject other proposals
    job.proposals.forEach((p, index) => {
      if (index !== parseInt(proposalIndex)) {
        p.status = 'rejected';
      }
    });

    // Assign job to fundi
    job.fundiId = proposal.fundiId;
    job.agreedPrice = proposal.proposedPrice;
    job.status = 'assigned';

    // Set payment to escrow if not cash
    if (job.payment.method !== 'cash') {
      job.payment.status = 'escrow';
      job.payment.escrowAmount = proposal.proposedPrice;
    }

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Proposal accepted successfully',
      data: job,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to accept proposal',
      error: error.message,
    });
  }
};

// @desc    Start job work
// @route   PATCH /api/jobs/:id/start
// @access  Private (Assigned fundi only)
exports.startJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Check if user is the assigned fundi
    if (!job.fundiId || job.fundiId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to start this job',
      });
    }

    if (job.status !== 'assigned') {
      return res.status(400).json({
        success: false,
        message: 'Job must be in assigned status to start',
      });
    }

    job.status = 'in_progress';
    job.workProgress.push({
      updateBy: req.userId,
      message: 'Job started',
      stage: 'started',
      timestamp: new Date(),
    });

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job started successfully',
      data: job,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to start job',
      error: error.message,
    });
  }
};

// @desc    Add work progress update
// @route   POST /api/jobs/:id/progress
// @access  Private (Customer or assigned fundi)
exports.addWorkProgress = async (req, res) => {
  try {
    const { message, images, stage } = req.body;

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Check if user is customer or assigned fundi
    const isCustomer = job.customerId.toString() === req.userId.toString();
    const isFundi = job.fundiId && job.fundiId.toString() === req.userId.toString();

    if (!isCustomer && !isFundi) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this job',
      });
    }

    job.workProgress.push({
      updateBy: req.userId,
      message,
      images: images || [],
      stage: stage || 'in_progress',
    });

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Progress update added successfully',
      data: job,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to add progress update',
      error: error.message,
    });
  }
};

// @desc    Complete a job
// @route   PATCH /api/jobs/:id/complete
// @access  Private (Assigned fundi only)
exports.completeJob = async (req, res) => {
  try {
    const { completionImages, completionNotes, actualPrice } = req.body;

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Check if user is the assigned fundi
    if (!job.fundiId || job.fundiId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete this job',
      });
    }

    if (job.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Job must be in progress to complete',
      });
    }

    job.completion = {
      completedAt: new Date(),
      completionImages: completionImages || [],
      completionNotes: completionNotes || '',
      customerApproved: false,
    };

    if (actualPrice) {
      job.actualPrice = actualPrice;
    }

    job.status = 'completed';

    // Add final progress update
    job.workProgress.push({
      updateBy: req.userId,
      message: 'Job completed',
      stage: 'completed',
      images: completionImages || [],
    });

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job marked as completed. Awaiting customer approval.',
      data: job,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to complete job',
      error: error.message,
    });
  }
};

// @desc    Approve job completion and release payment
// @route   PATCH /api/jobs/:id/approve
// @access  Private (Customer only)
exports.approveCompletion = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Check if user is the customer
    if (job.customerId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to approve this job',
      });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Job must be completed before approval',
      });
    }

    job.completion.customerApproved = true;

    // Release payment if in escrow
    if (job.payment.status === 'escrow') {
      job.payment.status = 'released';
      job.payment.releaseDate = new Date();
    }

    await job.save();

    // Update fundi's completed jobs count
    const fundi = await User.findById(job.fundiId);
    if (fundi) {
      await fundi.incrementCompletedJobs();
    }

    res.status(200).json({
      success: true,
      message: 'Job completion approved and payment released',
      data: job,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to approve job completion',
      error: error.message,
    });
  }
};

// @desc    Get user's jobs (as customer or fundi)
// @route   GET /api/jobs/my-jobs
// @access  Private
exports.getMyJobs = async (req, res) => {
  try {
    const { role, status, page = 1, limit = 20 } = req.query;

    const query = {};

    // Filter by role
    if (role === 'customer') {
      query.customerId = req.userId;
    } else if (role === 'fundi') {
      query.fundiId = req.userId;
    } else {
      // Show all jobs (customer or fundi)
      query.$or = [{ customerId: req.userId }, { fundiId: req.userId }];
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const jobs = await Job.find(query)
      .populate('serviceId', 'name category icon')
      .populate('customerId', 'profile')
      .populate('fundiId', 'profile fundiProfile.ratings')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Job.countDocuments(query);

    res.status(200).json({
      success: true,
      count: jobs.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: jobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your jobs',
      error: error.message,
    });
  }
};