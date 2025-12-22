// controllers/Admin.controller.js
const User = require('../models/User.model');
const Job = require('../models/Job.model');
const Service = require('../models/Service.model');
const Review = require('../models/Review.model');
const mongoose = require('mongoose');

// @desc    Get comprehensive admin dashboard statistics
// @route   GET /api/admin/dashboard/stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    // Parallel queries for better performance
    const [
      userStats,
      jobStats,
      fundiStats,
      revenueStats,
      recentActivity,
      topPerformers,
      serviceDistribution
    ] = await Promise.all([
      getUserStats(),
      getJobStats(),
      getFundiStats(),
      getRevenueStats(),
      getRecentActivity(),
      getTopPerformers(),
      getServiceDistribution()
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: userStats,
        jobs: jobStats,
        fundis: fundiStats,
        revenue: revenueStats,
        recentActivity,
        topPerformers,
        services: serviceDistribution,
        lastUpdated: new Date(),
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message,
    });
  }
};

// Helper function: User Statistics
async function getUserStats() {
  const now = new Date();
  const startOfToday = new Date(now.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(now.setDate(now.getDate() - 7));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalUsers,
    totalCustomers,
    totalFundis,
    activeUsers,
    newToday,
    newThisWeek,
    newThisMonth,
    lastMonthCount,
    userGrowth
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ $or: [{ role: 'fundi' }, { role: 'both' }] }),
    User.countDocuments({ lastLogin: { $gte: startOfWeek } }),
    User.countDocuments({ createdAt: { $gte: startOfToday } }),
    User.countDocuments({ createdAt: { $gte: startOfWeek } }),
    User.countDocuments({ createdAt: { $gte: startOfMonth } }),
    User.countDocuments({ createdAt: { $gte: lastMonth, $lt: startOfMonth } }),
    User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      { $limit: 30 }
    ])
  ]);

  // Calculate growth percentage
  const growthPercentage = lastMonthCount > 0 
    ? Math.round(((newThisMonth - lastMonthCount) / lastMonthCount) * 100)
    : 0;

  return {
    total: totalUsers,
    customers: totalCustomers,
    fundis: totalFundis,
    activeUsers,
    new: {
      today: newToday,
      thisWeek: newThisWeek,
      thisMonth: newThisMonth,
    },
    growth: {
      percentage: growthPercentage,
      trend: growthPercentage >= 0 ? 'up' : 'down',
      chart: userGrowth
    }
  };
}

// Helper function: Job Statistics
async function getJobStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalJobs,
    postedJobs,
    inProgressJobs,
    completedJobs,
    cancelledJobs,
    disputedJobs,
    jobsThisMonth,
    jobActivity,
    avgCompletionTime
  ] = await Promise.all([
    Job.countDocuments(),
    Job.countDocuments({ status: 'posted' }),
    Job.countDocuments({ status: 'in_progress' }),
    Job.countDocuments({ status: 'completed' }),
    Job.countDocuments({ status: 'cancelled' }),
    Job.countDocuments({ status: 'disputed' }),
    Job.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Job.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          posted: {
            $sum: { $cond: [{ $eq: ['$status', 'posted'] }, 1, 0] }
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]),
    Job.aggregate([
      {
        $match: {
          status: 'completed',
          'completion.completedAt': { $exists: true }
        }
      },
      {
        $project: {
          duration: {
            $subtract: ['$completion.completedAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$duration' }
        }
      }
    ])
  ]);

  // Calculate success rate
  const successRate = totalJobs > 0
    ? Math.round((completedJobs / totalJobs) * 100)
    : 0;

  // Calculate dispute rate
  const disputeRate = totalJobs > 0
    ? Math.round((disputedJobs / totalJobs) * 100)
    : 0;

  // Convert avg completion time to days
  const avgDays = avgCompletionTime[0]?.avgDuration
    ? Math.round(avgCompletionTime[0].avgDuration / (1000 * 60 * 60 * 24))
    : 0;

  return {
    total: totalJobs,
    byStatus: {
      posted: postedJobs,
      inProgress: inProgressJobs,
      completed: completedJobs,
      cancelled: cancelledJobs,
      disputed: disputedJobs,
    },
    thisMonth: jobsThisMonth,
    successRate,
    disputeRate,
    avgCompletionDays: avgDays,
    activityChart: jobActivity,
  };
}

// Helper function: Fundi Statistics
async function getFundiStats() {
  const [
    totalApplications,
    pendingApplications,
    approvedFundis,
    rejectedApplications,
    suspendedFundis,
    activeFundis,
    topRatedFundis
  ] = await Promise.all([
    User.countDocuments({ fundiProfile: { $exists: true } }),
    User.countDocuments({ 'fundiProfile.profileStatus': 'pending_review' }),
    User.countDocuments({ 'fundiProfile.profileStatus': 'approved' }),
    User.countDocuments({ 'fundiProfile.profileStatus': 'rejected' }),
    User.countDocuments({ 'fundiProfile.profileStatus': 'suspended' }),
    User.countDocuments({
      'fundiProfile.profileStatus': 'approved',
      lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }),
    User.find({
      'fundiProfile.profileStatus': 'approved',
      'fundiProfile.ratings.totalReviews': { $gte: 3 }
    })
      .select('profile fundiProfile.ratings fundiProfile.completedJobs')
      .sort({ 'fundiProfile.ratings.average': -1 })
      .limit(5)
  ]);

  return {
    total: totalApplications,
    pending: pendingApplications,
    approved: approvedFundis,
    rejected: rejectedApplications,
    suspended: suspendedFundis,
    active: activeFundis,
    topRated: topRatedFundis,
  };
}

// Helper function: Revenue Statistics (placeholder - implement based on payment model)
async function getRevenueStats() {
  // This is a placeholder - implement based on your payment/transaction model
  const completedJobs = await Job.find({ status: 'completed' })
    .select('agreedPrice actualPrice createdAt')
    .sort({ 'completion.completedAt': -1 })
    .limit(100);

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  let totalRevenue = 0;
  let monthlyRevenue = 0;

  completedJobs.forEach(job => {
    const amount = job.actualPrice || job.agreedPrice || 0;
    totalRevenue += amount;
    
    if (job.createdAt >= thisMonth) {
      monthlyRevenue += amount;
    }
  });

  // Platform commission (assume 10%)
  const platformRevenue = Math.round(totalRevenue * 0.1);
  const monthlyPlatformRevenue = Math.round(monthlyRevenue * 0.1);

  return {
    totalTransactions: totalRevenue,
    platformRevenue,
    monthlyRevenue: monthlyPlatformRevenue,
    avgTransactionValue: completedJobs.length > 0 
      ? Math.round(totalRevenue / completedJobs.length)
      : 0,
  };
}

// Helper function: Recent Activity
async function getRecentActivity() {
  const [recentUsers, recentJobs, recentReviews] = await Promise.all([
    User.find()
      .select('profile email createdAt role')
      .sort({ createdAt: -1 })
      .limit(5),
    Job.find()
      .select('jobDetails.title status customerId createdAt')
      .populate('customerId', 'profile.firstName profile.lastName')
      .sort({ createdAt: -1 })
      .limit(5),
    Review.find()
      .select('rating reviewerId revieweeId createdAt')
      .populate('reviewerId', 'profile.firstName profile.lastName')
      .populate('revieweeId', 'profile.firstName profile.lastName')
      .sort({ createdAt: -1 })
      .limit(5)
  ]);

  // Combine and sort by date
  const activities = [
    ...recentUsers.map(u => ({
      type: 'user_registration',
      description: `${u.profile.firstName} ${u.profile.lastName} registered as ${u.role}`,
      timestamp: u.createdAt,
      data: u
    })),
    ...recentJobs.map(j => ({
      type: 'job_posted',
      description: `New job posted: ${j.jobDetails.title}`,
      timestamp: j.createdAt,
      data: j
    })),
    ...recentReviews.map(r => ({
      type: 'review_posted',
      description: `${r.reviewerId.profile.firstName} reviewed ${r.revieweeId.profile.firstName} (${r.rating}★)`,
      timestamp: r.createdAt,
      data: r
    }))
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

  return activities;
}

// Helper function: Top Performers
async function getTopPerformers() {
  const [topFundis, topCustomers, popularServices] = await Promise.all([
    User.find({
      'fundiProfile.profileStatus': 'approved',
      'fundiProfile.completedJobs': { $gt: 0 }
    })
      .select('profile fundiProfile.ratings fundiProfile.completedJobs fundiProfile.services')
      .populate('fundiProfile.services', 'name')
      .sort({ 'fundiProfile.completedJobs': -1 })
      .limit(10),
    
    Job.aggregate([
      {
        $group: {
          _id: '$customerId',
          jobCount: { $sum: 1 },
          completedJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      },
      { $sort: { jobCount: -1 } },
      { $limit: 10 }
    ]),
    
    Job.aggregate([
      {
        $group: {
          _id: '$serviceId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ])
  ]);

  // Populate customer details
  const customerIds = topCustomers.map(c => c._id);
  const customerDetails = await User.find({ _id: { $in: customerIds } })
    .select('profile');

  const customersWithDetails = topCustomers.map(c => {
    const details = customerDetails.find(d => d._id.toString() === c._id.toString());
    return {
      ...c,
      profile: details?.profile
    };
  });

  // Populate service details
  const serviceIds = popularServices.map(s => s._id);
  const serviceDetails = await Service.find({ _id: { $in: serviceIds } })
    .select('name category icon');

  const servicesWithDetails = popularServices.map(s => {
    const details = serviceDetails.find(d => d._id.toString() === s._id.toString());
    return {
      ...s,
      service: details
    };
  });

  return {
    fundis: topFundis,
    customers: customersWithDetails,
    services: servicesWithDetails,
  };
}

// Helper function: Service Distribution
async function getServiceDistribution() {
  const distribution = await Job.aggregate([
    {
      $group: {
        _id: '$serviceId',
        count: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);

  // Populate service details
  const serviceIds = distribution.map(d => d._id);
  const services = await Service.find({ _id: { $in: serviceIds } })
    .select('name category icon');

  return distribution.map(d => {
    const service = services.find(s => s._id.toString() === d._id.toString());
    return {
      service: service,
      totalJobs: d.count,
      completedJobs: d.completed,
      completionRate: d.count > 0 ? Math.round((d.completed / d.count) * 100) : 0
    };
  });
}

// @desc    Get pending fundi applications with details
// @route   GET /api/admin/fundis/pending
// @access  Private/Admin
const getPendingFundis = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const pendingFundis = await User.find({
      'fundiProfile.profileStatus': 'pending_review'
    })
      .select('profile fundiProfile location createdAt')
      .populate('fundiProfile.services', 'name category')
      .sort({ 'fundiProfile.applicationDate': 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments({
      'fundiProfile.profileStatus': 'pending_review'
    });

    res.status(200).json({
      success: true,
      count: pendingFundis.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: pendingFundis,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending fundis',
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getPendingFundis,
};