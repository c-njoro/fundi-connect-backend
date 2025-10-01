const mongoose = require('mongoose');

// Suggested price schema for sub-services
const suggestedPriceSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    currency: {
      type: String,
      default: 'KES',
      uppercase: true,
      trim: true,
    },
  },
  { _id: false } // no separate _id for this subdocument
);

// Sub-service schema
const subServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    estimatedDuration: { type: Number, required: true }, // in minutes
    suggestedPrice: { type: suggestedPriceSchema, required: true },
  },
  { _id: false }
);

// Main service schema
const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true, // no duplicate service names
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true, // e.g., "Home Maintenance", "Construction"
    },
    description: { type: String, trim: true },
    icon: { type: String }, // URL or icon name
    isActive: { type: Boolean, default: true },
    subServices: [subServiceSchema],
  },
  {
    timestamps: { createdAt: true, updatedAt: true }, // auto manage dates
  }
);

// Index for faster queries
serviceSchema.index({ name: 1 });
serviceSchema.index({ category: 1 });
serviceSchema.index({ isActive: 1 });

module.exports = mongoose.model('Service', serviceSchema);
