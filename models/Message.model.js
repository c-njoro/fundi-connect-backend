const mongoose = require('mongoose');

const { Schema } = mongoose;

const MessageSchema = new Schema(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    message: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    messageType: {
      type: String,
      enum: ["text", "image", "location", "quote"],
      default: "text",
    },

    attachments: [
      {
        type: String,
        trim: true, // e.g., image URLs or file links
      },
    ],

    readStatus: {
      type: Boolean,
      default: false,
    },

    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

const Message = mongoose.model("Message", MessageSchema);

module.exports = Message;
