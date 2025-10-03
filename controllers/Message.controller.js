const Message = require('../models/Message.model');
const Job = require('../models/Job.model');
const User = require('../models/User.model');

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { jobId, receiverId, message, messageType, attachments } = req.body;

    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Verify user is part of the job (customer or assigned fundi)
    const isCustomer = job.customerId.toString() === req.userId.toString();
    const isFundi = job.fundiId && job.fundiId.toString() === req.userId.toString();

    if (!isCustomer && !isFundi) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages for this job',
      });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found',
      });
    }

    // Verify receiver is part of the job
    const isReceiverCustomer = job.customerId.toString() === receiverId;
    const isReceiverFundi = job.fundiId && job.fundiId.toString() === receiverId;

    if (!isReceiverCustomer && !isReceiverFundi) {
      return res.status(400).json({
        success: false,
        message: 'Receiver is not part of this job',
      });
    }

    // Create message
    const newMessage = new Message({
      jobId,
      senderId: req.userId,
      receiverId,
      message,
      messageType: messageType || 'text',
      attachments: attachments || [],
    });

    await newMessage.save();

    // Populate sender and receiver info
    await newMessage.populate('senderId receiverId', 'profile');

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to send message',
      error: error.message,
    });
  }
};

// @desc    Get all messages for a job
// @route   GET /api/messages/job/:jobId
// @access  Private (Job participants only)
exports.getJobMessages = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify job exists and user is part of it
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const isCustomer = job.customerId.toString() === req.userId.toString();
    const isFundi = job.fundiId && job.fundiId.toString() === req.userId.toString();

    if (!isCustomer && !isFundi) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view messages for this job',
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find({ jobId })
      .populate('senderId receiverId', 'profile.firstName profile.lastName profile.avatar')
      .sort({ sentAt: 1 }) // Oldest first
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({ jobId });

    // Mark messages as read for current user
    await Message.updateMany(
      {
        jobId,
        receiverId: req.userId,
        readStatus: false,
      },
      { readStatus: true }
    );

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: messages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message,
    });
  }
};

// @desc    Get conversation between two users for a specific job
// @route   GET /api/messages/conversation/:jobId/:userId
// @access  Private
exports.getConversation = async (req, res) => {
  try {
    const { jobId, userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Verify user is part of the job
    const isCustomer = job.customerId.toString() === req.userId.toString();
    const isFundi = job.fundiId && job.fundiId.toString() === req.userId.toString();

    if (!isCustomer && !isFundi) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this conversation',
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get messages between current user and specified user
    const messages = await Message.find({
      jobId,
      $or: [
        { senderId: req.userId, receiverId: userId },
        { senderId: userId, receiverId: req.userId },
      ],
    })
      .populate('senderId receiverId', 'profile.firstName profile.lastName profile.avatar')
      .sort({ sentAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({
      jobId,
      $or: [
        { senderId: req.userId, receiverId: userId },
        { senderId: userId, receiverId: req.userId },
      ],
    });

    // Mark received messages as read
    await Message.updateMany(
      {
        jobId,
        senderId: userId,
        receiverId: req.userId,
        readStatus: false,
      },
      { readStatus: true }
    );

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: messages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation',
      error: error.message,
    });
  }
};

// @desc    Get all conversations for current user
// @route   GET /api/messages/conversations
// @access  Private
exports.getAllConversations = async (req, res) => {
  try {
    // Get all jobs where user is customer or fundi
    const jobs = await Job.find({
      $or: [{ customerId: req.userId }, { fundiId: req.userId }],
    }).select('_id customerId fundiId serviceId status');

    if (jobs.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const jobIds = jobs.map((job) => job._id);

    // Get last message for each conversation
    const conversations = await Promise.all(
      jobs.map(async (job) => {
        const otherUserId =
          job.customerId.toString() === req.userId.toString()
            ? job.fundiId
            : job.customerId;

        // Get last message
        const lastMessage = await Message.findOne({
          jobId: job._id,
        })
          .sort({ sentAt: -1 })
          .populate('senderId receiverId', 'profile.firstName profile.lastName profile.avatar');

        // Count unread messages
        const unreadCount = await Message.countDocuments({
          jobId: job._id,
          receiverId: req.userId,
          readStatus: false,
        });

        // Get other user details
        const otherUser = await User.findById(otherUserId).select(
          'profile.firstName profile.lastName profile.avatar'
        );

        return {
          jobId: job._id,
          job: await job.populate('serviceId', 'name icon'),
          otherUser,
          lastMessage,
          unreadCount,
        };
      })
    );

    // Filter out conversations with no messages and sort by last message time
    const activeConversations = conversations
      .filter((conv) => conv.lastMessage)
      .sort((a, b) => b.lastMessage.sentAt - a.lastMessage.sentAt);

    res.status(200).json({
      success: true,
      count: activeConversations.length,
      data: activeConversations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message,
    });
  }
};

// @desc    Mark message as read
// @route   PATCH /api/messages/:id/read
// @access  Private (Receiver only)
exports.markAsRead = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Check if user is the receiver
    if (message.receiverId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to mark this message as read',
      });
    }

    message.readStatus = true;
    await message.save();

    res.status(200).json({
      success: true,
      message: 'Message marked as read',
      data: message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to mark message as read',
      error: error.message,
    });
  }
};

// @desc    Mark all messages in a job as read
// @route   PATCH /api/messages/job/:jobId/read-all
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    const { jobId } = req.params;

    // Verify job exists and user is part of it
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const isCustomer = job.customerId.toString() === req.userId.toString();
    const isFundi = job.fundiId && job.fundiId.toString() === req.userId.toString();

    if (!isCustomer && !isFundi) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const result = await Message.updateMany(
      {
        jobId,
        receiverId: req.userId,
        readStatus: false,
      },
      { readStatus: true }
    );

    res.status(200).json({
      success: true,
      message: 'All messages marked as read',
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to mark messages as read',
      error: error.message,
    });
  }
};

// @desc    Get unread message count
// @route   GET /api/messages/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Message.countDocuments({
      receiverId: req.userId,
      readStatus: false,
    });

    res.status(200).json({
      success: true,
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message,
    });
  }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:id
// @access  Private (Sender only)
exports.deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Check if user is the sender
    if (message.senderId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message',
      });
    }

    // Only allow deletion within 5 minutes of sending
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (message.sentAt < fiveMinutesAgo) {
      return res.status(400).json({
        success: false,
        message: 'Can only delete messages within 5 minutes of sending',
      });
    }

    await message.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message,
    });
  }
};