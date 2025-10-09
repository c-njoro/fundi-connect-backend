const Review = require('../models/Review.model');
const Job = require('../models/Job.model');
const User = require('../models/User.model');
const notificationService = require('../services/notification.service');


// @desc    Create a review
// @route   POST /api/reviews
// @access  Private (Customer or Fundi)
exports.createReview = async (req, res) => {
  try {
    const { jobId, revieweeId, rating, review, categories, images } = req.body;

    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
      
    // Verify job is completed and approved
    if (job.status !== 'completed' || !job.completion.customerApproved) {
      return res.status(400).json({
        success: false,
        message: 'Can only review completed and approved jobs',
      });
    }

    // Verify user is part of the job
    const isCustomer = job.customerId.toString() === req.userId.toString();
    const isFundi = job.fundiId && job.fundiId.toString() === req.userId.toString();

    if (!isCustomer && !isFundi) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to review this job',
      });
    }

    // Verify reviewee is the other party
    const expectedRevieweeId = job.fundiId.toString();
    if (revieweeId.toString() !== expectedRevieweeId) {
      console.log(revieweeId, expectedRevieweeId);
      return res.status(400).json({
        success: false,
        message: 'Invalid reviewee',
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      jobId,
      reviewerId: req.userId,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this job',
      });
    }

    // Create review
    const newReview = new Review({
      jobId,
      reviewerId: req.userId,
      revieweeId,
      rating,
      review,
      categories,
      images: images || [],
      isVerified: true, // Auto-verify since job is completed
    });

    await newReview.save();

    // Update reviewee's rating (only if reviewing a fundi)
    if (isCustomer) {
      const fundi = await User.findById(revieweeId);
      if (fundi && fundi.isFundi) {
        await fundi.updateRating(rating);
      }

      // Send notification to fundi
      await notificationService.notifyReviewReceived(
        revieweeId,
        rating,
        newReview._id
      );
    }

    // Populate reviewer and reviewee info
    await newReview.populate('reviewerId revieweeId', 'profile');

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: newReview,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to create review',
      error: error.message,
    });
  }
};

// @desc    Get all reviews for a user (as reviewee)
// @route   GET /api/reviews/user/:userId
// @access  Public
exports.getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, rating } = req.query;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const query = { revieweeId: userId };

    // Filter by rating
    if (rating) {
      query.rating = parseInt(rating);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find(query)
      .populate('reviewerId', 'profile')
      .populate('jobId', 'jobDetails.title serviceId')
      .populate({
        path: 'jobId',
        populate: { path: 'serviceId', select: 'name icon' },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    // Calculate rating statistics
    const ratingStats = await Review.aggregate([
      { $match: { revieweeId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          avgQuality: { $avg: '$categories.quality' },
          avgTimeliness: { $avg: '$categories.timeliness' },
          avgCommunication: { $avg: '$categories.communication' },
          avgProfessionalism: { $avg: '$categories.professionalism' },
          totalReviews: { $sum: 1 },
          5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      statistics: ratingStats[0] || null,
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message,
    });
  }
};

// @desc    Get review by ID
// @route   GET /api/reviews/:id
// @access  Public
exports.getReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('reviewerId revieweeId', 'profile')
      .populate('jobId', 'jobDetails serviceId')
      .populate({
        path: 'jobId',
        populate: { path: 'serviceId', select: 'name icon' },
      });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch review',
      error: error.message,
    });
  }
};

// @desc    Get review for a specific job
// @route   GET /api/reviews/job/:jobId
// @access  Public
exports.getJobReviews = async (req, res) => {
  try {
    const { jobId } = req.params;

    const reviews = await Review.find({ jobId })
      .populate('reviewerId revieweeId', 'profile')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job reviews',
      error: error.message,
    });
  }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private (Reviewer only)
exports.updateReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    // Check ownership
    if (review.reviewerId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review',
      });
    }

    // Only allow updates within 24 hours of creation
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (review.createdAt < twentyFourHoursAgo) {
      return res.status(400).json({
        success: false,
        message: 'Can only update reviews within 24 hours of creation',
      });
    }

    const { rating, review: reviewText, categories, images } = req.body;

    // Store old rating before update
    const oldRating = review.rating;

    // Update fields
    if (rating) review.rating = rating;
    if (reviewText !== undefined) review.review = reviewText;
    if (categories) review.categories = categories;
    if (images !== undefined) review.images = images;

    await review.save();

    // Update fundi's rating if rating changed
    if (rating && rating !== oldRating) {
      const reviewee = await User.findById(review.revieweeId);
      if (reviewee && reviewee.isFundi) {
        // Recalculate rating by removing old and adding new
        const currentAvg = reviewee.fundiProfile.ratings.average;
        const totalReviews = reviewee.fundiProfile.ratings.totalReviews;
        
        // Remove old rating contribution
        const sumWithoutOld = currentAvg * totalReviews - oldRating;
        // Add new rating
        const newAverage = (sumWithoutOld + rating) / totalReviews;
        
        reviewee.fundiProfile.ratings.average = Math.round(newAverage * 10) / 10;
        await reviewee.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: review,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update review',
      error: error.message,
    });
  }
};

// @desc    Add response to review
// @route   PATCH /api/reviews/:id/response
// @access  Private (Reviewee only)
exports.addResponse = async (req, res) => {
  try {
    const { response } = req.body;

    if (!response) {
      return res.status(400).json({
        success: false,
        message: 'Response text is required',
      });
    }

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    // Check if user is the reviewee
    if (review.revieweeId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to respond to this review',
      });
    }

    review.response = response;
    await review.save();

    res.status(200).json({
      success: true,
      message: 'Response added successfully',
      data: review,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to add response',
      error: error.message,
    });
  }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private (Reviewer only or Admin)
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    // Check ownership or admin
    const isOwner = review.reviewerId.toString() === req.userId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review',
      });
    }

    // Update fundi's rating by removing this review's contribution
    const reviewee = await User.findById(review.revieweeId);
    if (reviewee && reviewee.isFundi) {
      const currentAvg = reviewee.fundiProfile.ratings.average;
      const totalReviews = reviewee.fundiProfile.ratings.totalReviews;
      
      if (totalReviews > 1) {
        // Recalculate average without this review
        const sumWithoutReview = currentAvg * totalReviews - review.rating;
        const newAverage = sumWithoutReview / (totalReviews - 1);
        
        reviewee.fundiProfile.ratings.average = Math.round(newAverage * 10) / 10;
        reviewee.fundiProfile.ratings.totalReviews = totalReviews - 1;
      } else {
        // This was the only review
        reviewee.fundiProfile.ratings.average = 0;
        reviewee.fundiProfile.ratings.totalReviews = 0;
      }
      
      await reviewee.save();
    }

    await review.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete review',
      error: error.message,
    });
  }
};

// @desc    Get reviews given by user
// @route   GET /api/reviews/my-reviews
// @access  Private
exports.getMyReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find({ reviewerId: req.userId })
      .populate('revieweeId', 'profile')
      .populate('jobId', 'jobDetails.title serviceId')
      .populate({
        path: 'jobId',
        populate: { path: 'serviceId', select: 'name icon' },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({ reviewerId: req.userId });

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your reviews',
      error: error.message,
    });
  }
};

// @desc    Get top rated fundis
// @route   GET /api/reviews/top-fundis
// @access  Public
exports.getTopFundis = async (req, res) => {
  try {
    const { limit = 10, serviceId } = req.query;

    // Build query for fundis
    const fundiQuery = {
      $or: [{ role: 'fundi' }, { role: 'both' }],
      'fundiProfile.profileStatus': 'approved',
      'fundiProfile.ratings.totalReviews': { $gte: 3 }, // At least 3 reviews
    };

    if (serviceId) {
      fundiQuery['fundiProfile.services'] = serviceId;
    }

    const topFundis = await User.find(fundiQuery)
      .select('profile fundiProfile location')
      .populate('fundiProfile.services', 'name icon')
      .sort({
        'fundiProfile.ratings.average': -1,
        'fundiProfile.completedJobs': -1,
      })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: topFundis.length,
      data: topFundis,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top fundis',
      error: error.message,
    });
  }
};