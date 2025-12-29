const mongoose = require('mongoose');

// ------------------------
// Sub-schemas
// ------------------------

// Estimated budget schema
const estimatedBudgetSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    currency: { type: String, default: 'KES', trim: true, uppercase: true },
  },
  { _id: false }
);

// Location schema
const locationSchema = new mongoose.Schema(
  {
    address: { type: String, trim: true },
    county: { type: String, trim: true },
    city: { type: String, trim: true },
    area: { type: String, trim: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    landmark: { type: String, trim: true },
  },
  { _id: false }
);

// Scheduling schema
const schedulingSchema = new mongoose.Schema(
  {
    preferredDate: { type: Date },
    preferredTime: { type: String }, // e.g., "14:30"
    flexibility: {
      type: String,
      enum: ['flexible', 'strict'],
      default: 'flexible',
    },
    scheduledDateTime: { type: Date }, // Final agreed time
  },
  { _id: false }
);

// Proposals schema
const proposalSchema = new mongoose.Schema(
  {
    fundiId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    proposedPrice: { type: Number, required: true },
    estimatedDuration: { type: Number, required: true }, // in minutes or hours
    proposal: { type: String, trim: true },
    appliedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  { _id: false }
);

// Payment schema
const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ['mpesa', 'card', 'cash'],
required: true,
default: 'mpesa',
    },
    status: {
      type: String,
      enum: ['pending', 'escrow', 'released', 'refunded', 'failed'],
      default: 'pending',
    },


    accessCode: { type: String }, // Paystack access code
    
    // Escrow details
    escrowAmount: { type: Number, default: 0 },
    escrowDate: { type: Date },
    escrowTransactionId: { type: String }, // M-Pesa transaction ID
    escrowReference: { type: String }, // Your internal reference
    
    // Release details
    releaseAmount: { type: Number },
    releaseDate: { type: Date },
    releaseTransactionId: { type: String },
    releaseReference: { type: String },

        // Transfer status tracking
        transferStatus: { type: String }, // 'success', 'failed', 'pending'
        transferCompletedDate: { type: Date },
        transferFailureReason: { type: String },
    
    // Refund details (if job cancelled)
    refundAmount: { type: Number },
    refundDate: { type: Date },
    refundTransactionId: { type: String },
    refundReason: { type: String },
    
    // Platform commission
    platformFee: { type: Number, default: 0 },
    platformFeePercentage: { type: Number, default: 10 }, // 10% commission
    
    // Payment metadata
    paymentProvider: { type: String ,default: 'paystack'}, // 'flutterwave', 'daraja', etc
    providerResponse: { type: Object }, // Store full response for debugging
  },
  { _id: false }
);

// Work progress updates schema
const workProgressSchema = new mongoose.Schema(
  {
    updateBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: { type: String, trim: true },
    images: [{ type: String }], // URLs to progress images
    timestamp: { type: Date, default: Date.now },
    stage: {
      type: String,
      enum: ['started', 'in_progress', 'completed'],
      default: 'in_progress',
      required: true,
    },
  },
  { _id: false }
);

// Completion schema
const completionSchema = new mongoose.Schema(
  {
    completedAt: { type: Date },
    completionImages: [{ type: String }],
    customerApproved: { type: Boolean, default: false },
    completionNotes: { type: String, trim: true },
  },
  { _id: false }
);

// ------------------------
// Main Job Schema
// ------------------------
const jobSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fundiId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true,
    },
    subService: { type: String, required: true, trim: true },

    jobDetails: {
      title: { type: String, required: true, trim: true },
      description: { type: String, trim: true },
      images: [{ type: String }],
      urgency: {
        type: String,
        enum: ['low', 'medium', 'high', 'emergency'],
        default: 'low',
      },
      estimatedBudget: estimatedBudgetSchema,
    },

    location: locationSchema,
    scheduling: schedulingSchema,

    status: {
      type: String,
      enum: [
        'posted',
        'applied',
        'pending_payment_escrow',
        'assigned',
        'in_progress',
        'completed',
        'cancelled',
        'disputed',
      ],
      default: 'posted',
      index: true,
    },

    proposals: [proposalSchema],

    agreedPrice: { type: Number },
    actualPrice: { type: Number },

    payment: paymentSchema,

    workProgress: [workProgressSchema],

    completion: completionSchema,
  },
  {
    timestamps: true, // automatically adds createdAt and updatedAt
  }
);

// ------------------------
// Indexes for performance
// ------------------------
jobSchema.index({ status: 1 });
jobSchema.index({ 'location.coordinates': '2dsphere' }); // for geo queries
jobSchema.index({ 'proposals.fundiId': 1 });
jobSchema.index({ 'jobDetails.urgency': 1 });

module.exports = mongoose.model('Job', jobSchema);
