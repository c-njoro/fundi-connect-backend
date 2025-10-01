const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Sub-schemas (keeping your existing structure)
const verificationDocumentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g., "ID", "certificate"
    url: { type: String, required: true }, // link to stored document
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const scheduleDaySchema = new mongoose.Schema(
  {
    available: { type: Boolean, default: false },
    hours: {
      start: { type: String }, // e.g., "08:00"
      end: { type: String },   // e.g., "17:00"
    },
  },
  { _id: false }
);

const portfolioSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    images: [{ type: String }], // URLs to project images
    completedDate: { type: Date },
  },
  { _id: false }
);

const pricingSchema = new mongoose.Schema(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    rateType: { type: String, enum: ['hourly', 'fixed', 'negotiable'], required: true },
    minRate: { type: Number, required: true },
    maxRate: { type: Number },
    currency: { type: String, default: 'KES' },
  },
  { _id: false }
);

const certificationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    issuedBy: { type: String },
    dateIssued: { type: Date },
    expiryDate: { type: Date },
    certificateUrl: { type: String }, // URL to certificate document
    verified: { type: Boolean, default: false },
  },
  { _id: false }
);

// Main consolidated User schema
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: [/^(\+254|0)[17]\d{8}$/, 'Please provide a valid Kenyan phone number'],
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['customer', 'fundi', 'both', 'admin'],
      default: 'customer',
    },

    // Basic profile (always present)
    profile: {
      firstName: { type: String, trim: true, required: true },
      lastName: { type: String, trim: true, required: true },
      avatar: { type: String, default: null },
      dateOfBirth: { type: Date },
      gender: { type: String, enum: ['male', 'female', 'other', null], default: null },
      languages: [{ type: String }],
      isVerified: { type: Boolean, default: false },
      verificationDocuments: [verificationDocumentSchema],
    },

    location: {
      county: { type: String, trim: true },
      city: { type: String, trim: true },
      area: { type: String, trim: true },
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: [Number], // [longitude, latitude]
      },
    },

    // Fundi-specific profile (only populated when role includes 'fundi')
    fundiProfile: {
      services: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Service',
        },
      ],
      experience: { type: Number, default: 0, min: 0 },
      bio: { type: String, maxlength: 1000 },

      portfolio: [portfolioSchema],

      availability: {
        schedule: {
          monday: { type: scheduleDaySchema, default: {} },
          tuesday: { type: scheduleDaySchema, default: {} },
          wednesday: { type: scheduleDaySchema, default: {} },
          thursday: { type: scheduleDaySchema, default: {} },
          friday: { type: scheduleDaySchema, default: {} },
          saturday: { type: scheduleDaySchema, default: {} },
          sunday: { type: scheduleDaySchema, default: {} },
        },
        currentStatus: {
          type: String,
          enum: ['available', 'busy', 'offline'],
          default: 'offline',
        },
        lastUpdated: { type: Date, default: Date.now },
      },

      pricing: [pricingSchema],

      ratings: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        totalReviews: { type: Number, default: 0, min: 0 },
      },

      completedJobs: { type: Number, default: 0, min: 0 },
      cancelledJobs: { type: Number, default: 0, min: 0 },

      certifications: [certificationSchema],

      bankDetails: {
        accountName: { type: String },
        accountNumber: { type: String },
        bankName: { type: String },
        mpesaNumber: { type: String, match: [/^(\+254|0)[17]\d{8}$/, 'Invalid M-Pesa number'] },
      },

      // Additional fundi status fields
      profileStatus: {
        type: String,
        enum: ['draft', 'pending_review', 'approved', 'suspended', 'rejected'],
        default: 'draft',
      },
      applicationDate: { type: Date },
      approvedDate: { type: Date },
      rejectionReason: { type: String },
      suspensionReason: { type: String },
    },

    // Account status and metadata
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    
    // For password reset
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for faster searches
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'location.coordinates': '2dsphere' }); // geo queries
userSchema.index({ 'fundiProfile.services': 1 }); // for fundi service searches
userSchema.index({ 'fundiProfile.profileStatus': 1 }); // for admin filtering
userSchema.index({ 'location.city': 1, 'fundiProfile.services': 1 }); // compound index
userSchema.index({ 'fundiProfile.ratings.average': -1 }); // for sorting by rating
userSchema.index({ createdAt: -1 }); // for recent users

// Virtual to check if user is a fundi
userSchema.virtual('isFundi').get(function() {
  return this.role === 'fundi' || this.role === 'both';
});

// Virtual to check if user is a customer
userSchema.virtual('isCustomer').get(function() {
  return this.role === 'customer' || this.role === 'both';
});

// Virtual for full name
userSchema.virtual('profile.fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
  // Only hash password if it's modified or new
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to upgrade user to fundi
userSchema.methods.becomeFundi = async function(fundiData) {
  // Update role based on current role
  if (this.role === 'customer') {
    this.role = 'both';
  } else if (this.role === 'admin') {
    // Admin stays admin
    return this;
  } else {
    this.role = 'fundi';
  }

  // Initialize fundi profile
  this.fundiProfile = {
    services: fundiData.services || [],
    experience: fundiData.experience || 0,
    bio: fundiData.bio || '',
    portfolio: fundiData.portfolio || [],
    pricing: fundiData.pricing || [],
    certifications: fundiData.certifications || [],
    bankDetails: fundiData.bankDetails || {},
    profileStatus: 'pending_review',
    applicationDate: new Date(),
    availability: {
      schedule: fundiData.schedule || {},
      currentStatus: 'offline',
    },
  };

  return await this.save();
};

// Method to update fundi availability status
userSchema.methods.updateAvailabilityStatus = async function(status) {
  if (!this.isFundi) {
    throw new Error('User is not a fundi');
  }
  
  this.fundiProfile.availability.currentStatus = status;
  this.fundiProfile.availability.lastUpdated = new Date();
  return await this.save();
};

// Method to update fundi rating (called after new review)
userSchema.methods.updateRating = async function(newRating) {
  if (!this.isFundi) {
    throw new Error('User is not a fundi');
  }

  const currentAvg = this.fundiProfile.ratings.average;
  const currentTotal = this.fundiProfile.ratings.totalReviews;
  
  const newTotal = currentTotal + 1;
  const newAverage = ((currentAvg * currentTotal) + newRating) / newTotal;
  
  this.fundiProfile.ratings.average = Math.round(newAverage * 10) / 10; // round to 1 decimal
  this.fundiProfile.ratings.totalReviews = newTotal;
  
  return await this.save();
};

// Method to increment completed jobs
userSchema.methods.incrementCompletedJobs = async function() {
  if (!this.isFundi) {
    throw new Error('User is not a fundi');
  }
  
  this.fundiProfile.completedJobs += 1;
  return await this.save();
};

// Method to get fundi profile with populated services
userSchema.methods.getFundiProfileWithServices = function() {
  return this.populate('fundiProfile.services');
};

// Method to get safe user data (exclude sensitive fields)
userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.fundiProfile?.bankDetails;
  return obj;
};

// Static method to find fundis by location and service
userSchema.statics.findFundisByLocationAndService = function(location, serviceId, options = {}) {
  const query = {
    $or: [{ role: 'fundi' }, { role: 'both' }],
    'fundiProfile.profileStatus': 'approved',
    isActive: true,
  };

  // Add service filter if provided
  if (serviceId) {
    query['fundiProfile.services'] = serviceId;
  }

  // Handle location-based search
  if (location.coordinates && location.coordinates.lat && location.coordinates.lng) {
    query['location.coordinates'] = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [location.coordinates.lng, location.coordinates.lat],
        },
        $maxDistance: options.radius || 10000, // 10km default
      },
    };
  } else if (location.city) {
    query['location.city'] = new RegExp(location.city, 'i');
  } else if (location.county) {
    query['location.county'] = new RegExp(location.county, 'i');
  }

  return this.find(query)
    .populate('fundiProfile.services')
    .select('-password -resetPasswordToken -resetPasswordExpires')
    .sort({ 
      'fundiProfile.ratings.average': -1,
      'fundiProfile.completedJobs': -1 
    })
    .limit(options.limit || 20);
};

// Static method to find available fundis
userSchema.statics.findAvailableFundis = function(serviceId, location) {
  return this.findFundisByLocationAndService(location, serviceId)
    .where('fundiProfile.availability.currentStatus').equals('available');
};

// Static method for admin to get pending fundi applications
userSchema.statics.getPendingFundiApplications = function() {
  return this.find({
    $or: [{ role: 'fundi' }, { role: 'both' }],
    'fundiProfile.profileStatus': 'pending_review',
  })
    .select('-password -resetPasswordToken -resetPasswordExpires')
    .sort({ 'fundiProfile.applicationDate': 1 });
};

module.exports = mongoose.model('User', userSchema);