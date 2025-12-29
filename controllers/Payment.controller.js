// controllers/Payment.controller.js
const Job = require('../models/Job.model');
const User = require('../models/User.model');
const paymentService = require('../services/payment.service');
const crypto = require('crypto');

// @desc    Initiate escrow payment when accepting proposal
// @route   POST /api/payments/escrow/:jobId
// @access  Private (Customer only)
const initiateEscrowPayment = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { phoneNumber } = req.body;

    // Get job details
    const job = await Job.findById(jobId).populate('customerId');
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Verify user is the customer
    if (job.customerId._id.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Check if payment already in escrow
    if (job.payment.status === 'escrow') {
      return res.status(400).json({
        success: false,
        message: 'Payment already in escrow',
      });
    }

    const amount = job.agreedPrice;
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'No agreed price for this job',
      });
    }

    // Initiate payment
    const paymentResponse = await paymentService.initiateEscrowPayment({
      amount,
      email: job.customerId.email,
      phoneNumber: phoneNumber || job.customerId.phone,
      jobId: job._id,
      customerId: job.customerId._id,
    });

    if (!paymentResponse.success) {
      return res.status(400).json({
        success: false,
        message: paymentResponse.error,
      });
    }

    // Update job payment status
    job.payment.escrowReference = paymentResponse.reference;
    job.payment.paymentProvider = 'paystack';
    job.payment.accessCode = paymentResponse.accessCode;

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Payment initiated. Please complete the payment.',
      data: {
        paymentLink: paymentResponse.paymentLink,
        reference: paymentResponse.reference,
        accessCode: paymentResponse.accessCode,
      },
    });
  } catch (error) {
    console.error('Escrow initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message,
    });
  }
};

// @desc    Verify and confirm escrow payment
// @route   POST /api/payments/verify/:jobId
// @access  Private (Customer only)
const verifyEscrowPayment = async (req, res) => {
  try {
    const { jobId } = req.params;
    

    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    if (job.status !== 'pending_payment_escrow') {
      return res.status(400).json({
        success: false,
        message: 'Payment not in pending payment escrow',
      });
    }

    const escrowReference = job.payment.escrowReference;
    if (!escrowReference) {
      return res.status(400).json({
        success: false,
        message: 'No escrow reference found',
      });
    }

    // Verify payment with Paystack
    const verification = await paymentService.verifyPayment(escrowReference);

    if (!verification.success || verification.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        status: verification.status,
      });
    }

    // Calculate fees
    const fees = paymentService.calculateFees(verification.amount);

    // Update job payment
    job.payment.status = 'escrow';
    job.payment.escrowAmount = verification.amount;
    job.payment.escrowDate = new Date();
    job.payment.escrowTransactionId = verification.data.id;
    job.payment.platformFee = fees.platformFee;
    job.payment.providerResponse = verification.data;
    job.status = 'assigned';
    
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Payment confirmed and held in escrow',
      data: {
        amount: verification.amount,
        status: 'escrow',
        fees: fees,
      },
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message,
    });
  }
};

// @desc    Release funds to fundi when job is approved
// @route   POST /api/payments/release/:jobId
// @access  Private (Customer only)
const releaseFunds = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId).populate('fundiId');
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Verify customer owns the job
    if (job.customerId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Verify payment is in escrow
    if (job.payment.status !== 'escrow') {
      return res.status(400).json({
        success: false,
        message: 'Payment not in escrow',
      });
    }

    // Verify job is completed and approved
    if (job.status !== 'completed' || !job.completion.customerApproved) {
      return res.status(400).json({
        success: false,
        message: 'Job must be completed and approved',
      });
    }

    // Calculate fundi amount (minus platform fee)
    const fees = paymentService.calculateFees(
      job.payment.escrowAmount,
      job.payment.platformFeePercentage || 10
    );

    // Get or create transfer recipient for fundi
    let recipientCode = job.fundiId.fundiProfile?.paystackRecipientCode;

    if (!recipientCode) {
      const recipientResponse = await paymentService.createTransferRecipient({
        phoneNumber: job.fundiId.fundiProfile.bankDetails.mpesaNumber,
        fundiName: `${job.fundiId.firstName} ${job.fundiId.lastName}`,
        fundiId: job.fundiId._id,
      });

      if (!recipientResponse.success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to setup transfer recipient',
        });
      }

      recipientCode = recipientResponse.recipientCode;

      // Save recipient code to user profile for future use
      job.fundiId.fundiProfile.paystackRecipientCode = recipientCode;
      await job.fundiId.save();
    }

    // Release funds to fundi
    const releaseResponse = await paymentService.releaseFundsToFundi({
      amount: fees.fundiAmount,
      recipientCode: recipientCode,
      jobId: job._id,
      reference: `REL_${job._id}_${Date.now()}`,
      reason: `Payment for Job #${job._id}`,
    });

    if (!releaseResponse.success) {
      return res.status(400).json({
        success: false,
        message: releaseResponse.error,
      });
    }

    // Update job payment status
    job.payment.status = 'released';
    job.payment.releaseAmount = fees.fundiAmount;
    job.payment.releaseDate = new Date();
    job.payment.releaseTransactionId = releaseResponse.transferCode;
    job.payment.releaseReference = releaseResponse.reference;
    
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Funds released to fundi successfully',
      data: {
        fundiAmount: fees.fundiAmount,
        platformFee: fees.platformFee,
        status: 'released',
        transferReference: releaseResponse.reference,
      },
    });
  } catch (error) {
    console.error('Fund release error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to release funds',
      error: error.message,
    });
  }
};

// @desc    Refund payment if job is cancelled
// @route   POST /api/payments/refund/:jobId
// @access  Private (Admin or Customer)
const refundPayment = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;

    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Only allow if payment is in escrow
    if (job.payment.status !== 'escrow') {
      return res.status(400).json({
        success: false,
        message: 'Payment not in escrow',
      });
    }

    // Initiate refund
    const refundResponse = await paymentService.refundPayment({
      reference: job.payment.escrowReference,
      amount: job.payment.escrowAmount,
      merchantNote: reason || 'Job cancelled by customer',
    });

    if (!refundResponse.success) {
      return res.status(400).json({
        success: false,
        message: refundResponse.error,
      });
    }

    // Update job payment
    job.payment.status = 'refunded';
    job.payment.refundAmount = job.payment.escrowAmount;
    job.payment.refundDate = new Date();
    job.payment.refundReason = reason;
    job.status = 'cancelled';
    
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Payment refunded successfully',
      data: {
        refundAmount: job.payment.refundAmount,
        status: 'refunded',
      },
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: error.message,
    });
  }
};

// @desc    Webhook to handle Paystack payment callbacks
// @route   POST /api/payments/webhook
// @access  Public (but verify signature)
const handleWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Unauthorized');
    }

    const event = req.body;
    
    // Handle successful charge
    if (event.event === 'charge.success') {
      const { reference, amount, metadata } = event.data;
      
      const jobId = metadata.jobId;
      
      const job = await Job.findById(jobId);
      if (job && job.payment.status !== 'escrow') {
        const fees = paymentService.calculateFees(amount / 100); // Convert from kobo

        job.payment.status = 'escrow';
        job.payment.escrowAmount = amount / 100;
        job.payment.escrowDate = new Date();
        job.payment.escrowTransactionId = event.data.id;
        job.payment.platformFee = fees.platformFee;
        job.payment.providerResponse = event.data;
        job.status = 'assigned';
        
        await job.save();
      }
    }

    // Handle successful transfer (payout to fundi)
    if (event.event === 'transfer.success') {
      const { reference } = event.data;
      
      // Find job by release reference
      const job = await Job.findOne({ 'payment.releaseReference': reference });
      if (job) {
        job.payment.transferStatus = 'success';
        job.payment.transferCompletedDate = new Date();
        await job.save();
      }
    }

    // Handle failed transfer
    if (event.event === 'transfer.failed') {
      const { reference, reason } = event.data;
      
      const job = await Job.findOne({ 'payment.releaseReference': reference });
      if (job) {
        job.payment.transferStatus = 'failed';
        job.payment.transferFailureReason = reason;
        // Consider reverting payment status to escrow
        await job.save();
      }
    }

    res.status(200).send('Webhook received');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Webhook processing failed');
  }
};


// @desc    Test Paystack connection
// @route   GET /api/payments/test
// @access  Private (Admin)
const testConnection = async (req, res) => {
  try {
    const axios = require('axios');
    
    const response = await axios.get(
      'https://api.paystack.co/balance',
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: 'Paystack connection successful',
      data: response.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Paystack connection failed',
      error: error.response?.data || error.message,
    });
  }
};

module.exports = {
  initiateEscrowPayment,
  verifyEscrowPayment,
  releaseFunds,
  refundPayment,
  handleWebhook,
  testConnection,
};