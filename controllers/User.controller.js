const User = require('../models/User.model');
const jwt = require('jsonwebtoken');

// Ensure location.coordinates is always valid GeoJSON
const ensureValidGeoJSON = (location = {}) => {
  if (!location.coordinates || !Array.isArray(location.coordinates.coordinates)) {
    // Default fallback coordinates (Nairobi CBD)
    location.coordinates = {
      type: 'Point',
      coordinates: [36.8219, -1.2921], // [longitude, latitude]
    };
  } else if (
    location.coordinates.coordinates.length !== 2 ||
    typeof location.coordinates.coordinates[0] !== 'number' ||
    typeof location.coordinates.coordinates[1] !== 'number'
  ) {
    // Fix malformed coordinate values
    location.coordinates = {
      type: 'Point',
      coordinates: [36.8219, -1.2921],
    };
  }

  // Always enforce correct type
  location.coordinates.type = 'Point';
  return location;
};


// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};


//get all users
// @route   GET /api/users/admin/all
// @access  Admin only
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get all users',
      error: error.message,
    });
  }
};

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { email, phone, password, profile, location } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone already exists',
      });
    }

    // Create new user
    const user = new User({
      email,
      phone,
      password, // Will be hashed by pre-save hook
      profile,
      location,
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.toSafeObject(),
        token,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Registration failed',
      error: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toSafeObject(),
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message,
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isFundi) {
      await user.getFundiProfileWithServices();
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message,
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { profile, location } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update profile fields
    if (profile) {
      Object.keys(profile).forEach((key) => {
        if (profile[key] !== undefined) {
          user.profile[key] = profile[key];
        }
      });
    }

    // Update location
   // Update location safely
if (location) {
  Object.keys(location).forEach((key) => {
    if (location[key] !== undefined) {
      user.location[key] = location[key];
    }
  });

  // Ensure valid GeoJSON before saving
  user.location = ensureValidGeoJSON(user.location);
}

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user.toSafeObject(),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message,
    });
  }
};

// @desc    Apply to become a fundi
// @route   POST /api/users/become-fundi
// @access  Private
exports.becomeFundi = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if already a fundi
    if (user.isFundi) {
      return res.status(400).json({
        success: false,
        message: 'User is already a fundi',
      });
    }

    // Apply to become fundi
    await user.becomeFundi(req.body);

    res.status(200).json({
      success: true,
      message: 'Fundi application submitted successfully. Awaiting approval.',
      data: user.toSafeObject(),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to submit fundi application',
      error: error.message,
    });
  }
};

// @desc    Update fundi profile
// @route   PUT /api/users/fundi-profile
// @access  Private (Fundi only)
exports.updateFundiProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.isFundi) {
      return res.status(403).json({
        success: false,
        message: 'User is not a fundi',
      });
    }

    // Update fundi profile fields
    const allowedFields = [
      'services',
      'experience',
      'bio',
      'portfolio',
      'pricing',
      'certifications',
      'bankDetails',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        user.fundiProfile[field] = req.body[field];
      }
    });

    const currentTime = new Date();

    // Update availability schedule if provided
    if (req.body.schedule) {
      user.fundiProfile.availability.schedule = req.body.schedule;
      user.fundiProfile.availability.lastUpdated = currentTime;
    }

    if(req.body.currentStatus){
      user.fundiProfile.availability.currentStatus = req.body.currentStatus;
      user.fundiProfile.availability.lastUpdated = currentTime;
    }

    user.location = ensureValidGeoJSON(user.location);

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Fundi profile updated successfully',
      data: user.toSafeObject(),
    });
  } catch (error) {
    console.log("Error updating fundi profile", error);
    res.status(400).json({
      success: false,
      message: 'Failed to update fundi profile',
      error: error.message,
    });
  }
};

// @desc    Update fundi availability status
// @route   PATCH /api/users/availability
// @access  Private (Fundi only)
exports.updateAvailability = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['available', 'busy', 'offline'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: available, busy, or offline',
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.isFundi) {
      return res.status(403).json({
        success: false,
        message: 'User is not a fundi',
      });
    }

    await user.updateAvailabilityStatus(status);

    res.status(200).json({
      success: true,
      message: 'Availability status updated',
      data: {
        status: user.fundiProfile.availability.currentStatus,
        lastUpdated: user.fundiProfile.availability.lastUpdated,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update availability',
      error: error.message,
    });
  }
};

// @desc    Search for fundis
// @route   GET /api/users/fundis
// @access  Public
exports.searchFundis = async (req, res) => {
  try {
    const { serviceId, city, county, lat, lng, radius, limit } = req.query;

    // Build location object
    const location = {};
    if (lat && lng) {
      location.coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) };
    } else if (city) {
      location.city = city;
    } else if (county) {
      location.county = county;
    }

    const options = {
      radius: radius ? parseInt(radius) : 10000, // default 10km
      limit: limit ? parseInt(limit) : 20,
    };

    const fundis = await User.findFundisByLocationAndService(
      location,
      serviceId,
      options
    );

    res.status(200).json({
      success: true,
      count: fundis.length,
      data: fundis,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to search fundis',
      error: error.message,
    });
  }
};

// @desc    Get available fundis
// @route   GET /api/users/fundis/available
// @access  Public
exports.getAvailableFundis = async (req, res) => {
  try {
    const { serviceId, city } = req.query;

    const location = city ? { city } : {};

    const fundis = await User.findAvailableFundis(serviceId, location);

    res.status(200).json({
      success: true,
      count: fundis.length,
      data: fundis,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available fundis',
      error: error.message,
    });
  }
};

// @desc    Get fundi by ID (public profile)
// @route   GET /api/users/fundis/:id
// @access  Public
exports.getFundiById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .populate('fundiProfile.services');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Fundi not found',
      });
    }

    if (!user.isFundi) {
      return res.status(400).json({
        success: false,
        message: 'User is not a fundi',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fundi',
      error: error.message,
    });
  }
};

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password',
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = newPassword; // Will be hashed by pre-save hook
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to change password',
      error: error.message,
    });
  }
};

// @desc    Get pending fundi applications (Admin only)
// @route   GET /api/users/admin/pending-fundis
// @access  Private/Admin
exports.getPendingFundis = async (req, res) => {
  try {
    const pendingFundis = await User.getPendingFundiApplications();

    res.status(200).json({
      success: true,
      count: pendingFundis.length,
      data: pendingFundis,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending applications',
      error: error.message,
    });
  }
};

// @desc    Approve/Reject fundi application (Admin only)
// @route   PATCH /api/users/admin/fundi/:id/status
// @access  Private/Admin
exports.updateFundiStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;

    if (!['approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: approved, rejected, or suspended',
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.isFundi) {
      return res.status(400).json({
        success: false,
        message: 'User is not a fundi',
      });
    }

    user.fundiProfile.profileStatus = status;

    if (status === 'approved') {
      user.fundiProfile.approvedDate = new Date();
    } else if (status === 'rejected') {
      user.fundiProfile.rejectionReason = reason;
    } else if (status === 'suspended') {
      user.fundiProfile.suspensionReason = reason;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: `Fundi application ${status}`,
      data: user.toSafeObject(),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update fundi status',
      error: error.message,
    });
  }
};

// @desc    Deactivate user account
// @route   DELETE /api/users/profile
// @access  Private
exports.deactivateAccount = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate account',
      error: error.message,
    });
  }
};