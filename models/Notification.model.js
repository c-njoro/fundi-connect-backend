import mongoose from "mongoose";

const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "job_applied",
        "job_assigned",
        "payment_received",
        "job_completed",
        "job_cancelled",
        "review_received",
      ],
      required: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 200,
      required: true,
    },

    message: {
      type: String,
      trim: true,
      maxlength: 1000,
      required: true,
    },

    data: {
      type: Schema.Types.Mixed, // allows flexible data structure
      default: {},
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

const Notification = mongoose.model("Notification", NotificationSchema);

export default Notification;
