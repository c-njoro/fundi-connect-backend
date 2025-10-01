const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

// @desc    Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // Extract token from "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Please login to access this resource.',
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token (exclude password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found. Token is invalid.',
        });
      }

      // Check if user account is active
      if (!req.user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact support.',
        });
      }

      // Attach user ID to request for easy access
      req.userId = req.user._id;

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token is invalid or expired. Please login again.',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message,
    });
  }
};

// @desc    Restrict to admin only
exports.adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }
};

// @desc    Restrict to fundi only
exports.fundiOnly = (req, res, next) => {
  if (req.user && req.user.isFundi) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Fundi account required.',
    });
  }
};

// @desc    Restrict to customer only
exports.customerOnly = (req, res, next) => {
  if (req.user && req.user.isCustomer) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Customer account required.',
    });
  }
};

// @desc    Restrict to approved fundis only
exports.approvedFundiOnly = (req, res, next) => {
  if (
    req.user &&
    req.user.isFundi &&
    req.user.fundiProfile.profileStatus === 'approved'
  ) {
    next();
  } else if (req.user && req.user.isFundi) {
    return res.status(403).json({
      success: false,
      message: 'Fundi profile is not approved yet. Please wait for admin approval.',
    });
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Approved fundi account required.',
    });
  }
};

// @desc    Verify user owns the resource
exports.verifyOwnership = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    // Get resource user ID from request params or body
    const resourceUserId =
      req.params[resourceUserIdField] ||
      req.body[resourceUserIdField] ||
      req.resource?.[resourceUserIdField]; // if resource is loaded in previous middleware

    if (!resourceUserId) {
      return res.status(400).json({
        success: false,
        message: 'Resource user ID not found',
      });
    }

    // Check if current user owns the resource or is admin
    if (
      req.userId.toString() === resourceUserId.toString() ||
      req.user.role === 'admin'
    ) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this resource.',
      });
    }
  };
};

// @desc    Optional authentication - attach user if token exists but don't require it
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
        req.userId = req.user?._id;
      } catch (error) {
        // Token invalid, but that's okay for optional auth
        req.user = null;
        req.userId = null;
      }
    }

    next();
  } catch (error) {
    next();
  }
};