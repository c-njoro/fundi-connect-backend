// services/payment.service.js
const axios = require('axios');

class PaymentService {
  constructor() {
    this.paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    this.paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY;
    this.baseURL = 'https://api.paystack.co';
    this.mpesaBankCode = null; // Cache the correct bank code
  }

  /**
   * Get the correct M-PESA bank code from Paystack
   * @returns {Promise<String>} The M-PESA bank code
   */
  async getMpesaBankCode() {
    if (this.mpesaBankCode) {
      return this.mpesaBankCode;
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/bank?currency=KES&type=mobile_money`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
          },
        }
      );

      // Find M-PESA in the list
      const mpesaBank = response.data.data.find(
        (bank) => bank.name.toUpperCase().includes('MPESA') || bank.code === 'MPESA'
      );

      if (!mpesaBank) {
        console.error('Available banks:', response.data.data);
        throw new Error('M-PESA not found in Paystack bank list');
      }

      this.mpesaBankCode = mpesaBank.code;
      console.log(`✅ Found M-PESA bank code: ${this.mpesaBankCode}`);
      return this.mpesaBankCode;
    } catch (error) {
      console.error('Failed to fetch M-PESA bank code:', error.response?.data);
      // Fallback to MPESA
      return 'MPESA';
    }
  }

  /**
   * Format M-PESA phone number - try WITHOUT + sign first
   * @param {String} phoneNumber - Raw phone number
   * @returns {Object} Formatted result with multiple format options
   */
  formatMpesaNumber(phoneNumber) {
    if (!phoneNumber) {
      return { 
        valid: false, 
        error: 'Phone number is required' 
      };
    }

    // Remove all spaces, dashes, and other non-digit characters
    let cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    console.log('Original phone:', phoneNumber);
    console.log('After cleaning:', cleaned);

    // Handle different formats and create TWO versions
    if (cleaned.startsWith('+254')) {
      // Format: +254XXXXXXXXX
      cleaned = cleaned.substring(1); // Remove + for format1
    } else if (cleaned.startsWith('254')) {
      // Format: 254XXXXXXXXX (already good for format1)
      cleaned = cleaned;
    } else if (cleaned.startsWith('0')) {
      // Format: 0XXXXXXXXX -> replace 0 with 254
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.match(/^[17]\d{8}$/)) {
      // Format: 7XXXXXXXX or 1XXXXXXXX (9 digits) -> add 254
      cleaned = '254' + cleaned;
    } else {
      return {
        valid: false,
        error: `Invalid phone format: "${phoneNumber}". Expected: 07XXXXXXXX, 2547XXXXXXXX, or +2547XXXXXXXX`
      };
    }

    // Validate: should be 254 followed by 9 digits starting with 7 or 1
    if (!cleaned.match(/^254[17]\d{8}$/)) {
      return {
        valid: false,
        error: `Invalid M-PESA number: "${cleaned}". Must be 254 followed by 9 digits starting with 7 or 1`
      };
    }

    // Return BOTH formats to try
    return {
      valid: true,
      format1: cleaned,           // 254XXXXXXXXX (NO plus sign)
      format2: '+' + cleaned,      // +254XXXXXXXXX (WITH plus sign)
      display: '0' + cleaned.substring(3), // 0XXXXXXXXX for display
      original: phoneNumber,
    };
  }

  /**
   * Initialize payment transaction (Customer pays to escrow)
   */
  async initiateEscrowPayment(data) {
    const { amount, email, phoneNumber, jobId, customerId } = data;

    try {
      const payload = {
        email: email,
        amount: amount * 100,
        currency: 'KES',
        reference: `JOB_${jobId}_${Date.now()}`,
        callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
        metadata: {
          jobId: jobId,
          customerId: customerId,
          paymentType: 'escrow',
          phoneNumber: phoneNumber,
          custom_fields: [
            {
              display_name: 'Job ID',
              variable_name: 'job_id',
              value: jobId,
            },
            {
              display_name: 'Payment Type',
              variable_name: 'payment_type',
              value: 'escrow',
            },
          ],
        },
        channels: ['mobile_money', 'card'],
      };

      const response = await axios.post(
        `${this.baseURL}/transaction/initialize`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        data: response.data.data,
        paymentLink: response.data.data.authorization_url,
        reference: response.data.data.reference,
        accessCode: response.data.data.access_code,
      };
    } catch (error) {
      console.error('Escrow payment initiation error:', error.response?.data);
      return {
        success: false,
        error: error.response?.data?.message || 'Payment initiation failed',
      };
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(reference) {
    try {
      const response = await axios.get(
        `${this.baseURL}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
          },
        }
      );

      return {
        success: true,
        status: response.data.data.status,
        amount: response.data.data.amount / 100,
        data: response.data.data,
      };
    } catch (error) {
      console.error('Payment verification error:', error.response?.data);
      return {
        success: false,
        error: 'Payment verification failed',
      };
    }
  }

  /**
   * Create M-PESA transfer recipient - tries multiple formats
   */
  async createTransferRecipient(data) {
    const { phoneNumber, fundiName, fundiId } = data;

    try {
      console.log('🔍 Creating M-PESA recipient for:', phoneNumber);

      // Get the correct bank code
      const bankCode = await this.getMpesaBankCode();

      // Format phone number
      const phoneResult = this.formatMpesaNumber(phoneNumber);
      
      if (!phoneResult.valid) {
        throw new Error(phoneResult.error);
      }

      // Try format1 first (WITHOUT + sign): 254XXXXXXXXX
      console.log('Attempt 1: Trying format WITHOUT + sign:', phoneResult.format1);
      
      const payload1 = {
        type: 'mobile_money',
        name: fundiName,
        account_number: phoneResult.format1, // 254XXXXXXXXX (no +)
        bank_code: bankCode,
        currency: 'KES',
        metadata: {
          fundiId: fundiId,
          originalPhone: phoneNumber,
        },
      };

      console.log('Payload:', JSON.stringify(payload1, null, 2));

      try {
        const response = await axios.post(
          `${this.baseURL}/transferrecipient`,
          payload1,
          {
            headers: {
              Authorization: `Bearer ${this.paystackSecretKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('✅ M-PESA recipient created (format 1):', {
          recipientCode: response.data.data.recipient_code,
          phone: phoneResult.format1,
        });

        return {
          success: true,
          recipientCode: response.data.data.recipient_code,
          data: response.data.data,
          phoneNumber: phoneResult.format1,
          displayPhone: phoneResult.display,
        };
      } catch (error1) {
        console.log('⚠️  Format 1 failed, trying format 2...');
        
        // Try format2 (WITH + sign): +254XXXXXXXXX
        console.log('Attempt 2: Trying format WITH + sign:', phoneResult.format2);
        
        const payload2 = {
          ...payload1,
          account_number: phoneResult.format2, // +254XXXXXXXXX (with +)
        };

        console.log('Payload:', JSON.stringify(payload2, null, 2));

        try {
          const response = await axios.post(
            `${this.baseURL}/transferrecipient`,
            payload2,
            {
              headers: {
                Authorization: `Bearer ${this.paystackSecretKey}`,
                'Content-Type': 'application/json',
              },
            }
          );

          console.log('✅ M-PESA recipient created (format 2):', {
            recipientCode: response.data.data.recipient_code,
            phone: phoneResult.format2,
          });

          return {
            success: true,
            recipientCode: response.data.data.recipient_code,
            data: response.data.data,
            phoneNumber: phoneResult.format2,
            displayPhone: phoneResult.display,
          };
        } catch (error2) {
          // Both formats failed
          throw error2;
        }
      }
    } catch (error) {
      console.error('❌ Create M-PESA recipient error:', {
        message: error.message,
        response: error.response?.data,
        phoneNumber: phoneNumber,
      });
      
      let errorMsg = 'Failed to create M-PESA recipient';
      
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
        
        // Check for common issues
        if (errorMsg.includes('not activated') || errorMsg.includes('not enabled')) {
          errorMsg += '. Your Paystack account needs to be REGISTERED to make transfers. Please complete business registration in your Paystack dashboard or contact support@paystack.com';
        } else if (errorMsg.includes('Account number is invalid')) {
          errorMsg += '. Please ensure the M-PESA number is valid and registered with Safaricom. Only Safaricom M-PESA numbers work in Kenya.';
        }
      } else if (error.message) {
        errorMsg = error.message;
      }

      return {
        success: false,
        error: errorMsg,
        details: error.response?.data,
        originalPhone: phoneNumber,
      };
    }
  }

  /**
   * Transfer money to fundi via M-PESA
   */
  async releaseFundsToFundi(data) {
    const { amount, recipientCode, jobId, reference, reason } = data;

    try {
      // Check balance
      const balanceResponse = await axios.get(
        `${this.baseURL}/balance`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
          },
        }
      );

      console.log('Available balance:', balanceResponse.data.data);

      const availableBalance = balanceResponse.data.data.find(b => b.currency === 'KES');
      if (!availableBalance || availableBalance.balance < amount * 100) {
        return {
          success: false,
          error: `Insufficient balance. Available: KES ${availableBalance?.balance ? availableBalance.balance / 100 : 0}, Required: KES ${amount}`,
        };
      }

      const payload = {
        source: 'balance',
        amount: amount * 100,
        recipient: recipientCode,
        reason: reason || `Payment for Job #${jobId}`,
        currency: 'KES',
        reference: reference || `MPESA_PAYOUT_${jobId}_${Date.now()}`,
      };

      console.log('Initiating M-PESA transfer:', payload);

      const response = await axios.post(
        `${this.baseURL}/transfer`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ M-PESA transfer initiated:', {
        transferCode: response.data.data.transfer_code,
        status: response.data.data.status,
      });

      return {
        success: true,
        data: response.data.data,
        transferCode: response.data.data.transfer_code,
        reference: response.data.data.reference,
        status: response.data.data.status,
      };
    } catch (error) {
      console.error('❌ M-PESA fund release error:', error.response?.data);
      
      let errorMsg = error.response?.data?.message || 'M-PESA transfer failed';
      
      if (error.response?.data?.meta?.nextStep) {
        errorMsg += `. ${error.response.data.meta.nextStep}`;
      }

      return {
        success: false,
        error: errorMsg,
        details: error.response?.data,
      };
    }
  }

  /**
   * Verify transfer status
   */
  async verifyTransfer(reference) {
    try {
      const response = await axios.get(
        `${this.baseURL}/transfer/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
          },
        }
      );

      return {
        success: true,
        status: response.data.data.status,
        data: response.data.data,
      };
    } catch (error) {
      console.error('Transfer verification error:', error.response?.data);
      return {
        success: false,
        error: 'Transfer verification failed',
      };
    }
  }

  /**
   * Initiate refund
   */
  async refundPayment(data) {
    const { reference, amount, merchantNote } = data;

    try {
      const payload = {
        transaction: reference,
        amount: amount ? amount * 100 : undefined,
        currency: 'KES',
        customer_note: 'Refund for cancelled job',
        merchant_note: merchantNote || 'Job cancelled - escrow refund',
      };

      const response = await axios.post(
        `${this.baseURL}/refund`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        data: response.data.data,
      };
    } catch (error) {
      console.error('Refund error:', error.response?.data);
      return {
        success: false,
        error: error.response?.data?.message || 'Refund failed',
      };
    }
  }

  /**
   * Calculate platform fee
   */
  calculateFees(amount, feePercentage = 10) {
    const platformFee = Math.round((amount * feePercentage) / 100);
    const fundiAmount = amount - platformFee;

    return {
      totalAmount: amount,
      platformFee,
      fundiAmount,
      feePercentage,
    };
  }
}

module.exports = new PaymentService();