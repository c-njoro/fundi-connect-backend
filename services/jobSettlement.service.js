const Job = require('../models/Job.model');
const User = require('../models/User.model');
const paymentService = require('../services/payment.service');


const approveAndReleaseJob = async ({ jobId, customerId }) => {
    const job = await Job.findById(jobId).populate('fundiId');
  
    if (!job) throw new Error('Job not found');
  
    if (job.customerId.toString() !== customerId.toString()) {
      throw new Error('Not authorized');
    }
  
    if (job.status !== 'completed') {
      throw new Error('Job must be completed before approval');
    }
  
    if (job.completion.customerApproved) {
      throw new Error('Job already approved');
    }

  

  
   
  
    if(job.payment.status === "released") {
      throw new Error('Payment already released for this job');
    }
  
    job.completion.customerApproved = true;
      await job.save();


    // 💵 If payment is cash, stop here
    if (job.payment.method === 'cash') {
      job.payment.status = 'released';
      job.payment.releaseAmount = job.agreedPrice;
      job.payment.releaseDate = new Date();
      job.payment.releaseTransactionId = `CASH_${job._id}_${Date.now()}`;
      job.payment.releaseReference = `CASH_${job._id}_${Date.now()}`;
      job.completion.customerApproved = true;
      await job.save();
      return { payment: 'cash', released: true };
    }
  
    // 💵 Escrow validation
    if (job.payment.status !== 'escrow') {
      throw new Error('Payment not in escrow');
    }
  
    // 💰 Calculate payout
    const fees = paymentService.calculateFees(
      job.payment.escrowAmount,
      job.payment.platformFeePercentage || 10
    );
  
    // 📱 Check if fundi has M-PESA number
    const mpesaNumber = job.fundiId.fundiProfile?.bankDetails?.mpesaNumber || 
                        job.fundiId.fundiProfile?.mpesaNumber || 
                        job.fundiId.phone;
  
    if (!mpesaNumber) {
      throw new Error('Fundi has not provided M-PESA number. Please update your profile with M-PESA details.');
    }
  
    console.log('Processing payout to M-PESA:', mpesaNumber);
  
    // 🏦 Setup M-PESA recipient
    let recipientCode = job.fundiId.fundiProfile?.paystackRecipientCode;
  
    if (!recipientCode) {
      const recipient = await paymentService.createTransferRecipient({
        phoneNumber: mpesaNumber,
        fundiName: `${job.fundiId.firstName} ${job.fundiId.lastName}`,
        fundiId: job.fundiId._id,
      });
  
      if (!recipient.success) {
        console.error('M-PESA recipient creation failed:', recipient.error);
        throw new Error(`Failed to setup M-PESA recipient: ${recipient.error}`);
      }
  
      recipientCode = recipient.recipientCode;
      
      // Save recipient code for future use
      if (!job.fundiId.fundiProfile) {
        job.fundiId.fundiProfile = {};
      }
      job.fundiId.fundiProfile.paystackRecipientCode = recipientCode;
      
      // Also save the cleaned M-PESA number
      if (!job.fundiId.fundiProfile.bankDetails) {
        job.fundiId.fundiProfile.bankDetails = {};
      }
      job.fundiId.fundiProfile.bankDetails.mpesaNumber = recipient.phoneNumber || mpesaNumber;
      
      await job.fundiId.save();
      console.log('Saved recipient code for fundi:', job.fundiId._id);
    }
  
    // 🚀 Release funds via M-PESA
    console.log('Releasing funds to M-PESA:', {
      amount: fees.fundiAmount,
      recipientCode,
      jobId: job._id,
    });
  
    const transfer = await paymentService.releaseFundsToFundi({
      amount: fees.fundiAmount,
      recipientCode,
      jobId: job._id,
      reference: `MPESA_JOB_${job._id}_${Date.now()}`,
      reason: `Payment for Job #${job._id}`,
    });
  
    if (!transfer.success) {
      console.error('M-PESA transfer failed:', transfer.error);
      throw new Error(`M-PESA transfer failed: ${transfer.error}`);
    }
  
    console.log('M-PESA transfer successful:', transfer.reference);
  
    // 🧾 Update job payment
    job.payment.status = 'released';
    job.payment.releaseAmount = fees.fundiAmount;
    job.payment.releaseDate = new Date();
    job.payment.releaseTransactionId = transfer.transferCode;
    job.payment.releaseReference = transfer.reference;
    job.payment.releaseMethod = 'mpesa';
    job.completion.customerApproved = true;
  
    await job.save();
  
    // 📈 Update fundi stats
    const fundi = await User.findById(job.fundiId._id);
    if (fundi) {
      await fundi.incrementCompletedJobs();
      fundi.fundiProfile.portfolio = fundi.fundiProfile.portfolio || [];
      fundi.fundiProfile.portfolio.push({
        title: job.jobDetails.title,
        description: job.jobDetails.description,
        images: job.completion.completionImages,
        completedDate: job.completion.completedAt,
      });
      await fundi.save();
    }
  
    return {
      released: true,
      fundiAmount: fees.fundiAmount,
      platformFee: fees.platformFee,
      reference: transfer.reference,
      transferCode: transfer.transferCode,
      mpesaNumber: mpesaNumber,
      status: transfer.status,
    };
  };


  module.exports = {
    approveAndReleaseJob,
  };