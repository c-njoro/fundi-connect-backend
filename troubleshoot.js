// Run this script to troubleshoot Paystack M-PESA issues
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function troubleshootPaystack() {
  const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  
  if (!SECRET_KEY) {
    console.error('❌ PAYSTACK_SECRET_KEY not found in environment');
    return;
  }

  console.log('🔍 Starting Paystack M-PESA Troubleshooting...\n');

  // Step 1: Check available banks for Kenya
  console.log('1️⃣ Fetching available banks for Kenya...');
  try {
    const banksResponse = await axios.get(
      'https://api.paystack.co/bank?currency=KES&type=mobile_money',
      {
        headers: {
          Authorization: `Bearer ${SECRET_KEY}`,
        },
      }
    );
    
    console.log('✅ Available Mobile Money providers in Kenya:');
    banksResponse.data.data.forEach((bank) => {
      console.log(`   - Name: ${bank.name}, Code: ${bank.code}, Type: ${bank.type || 'N/A'}`);
    });
    console.log();
  } catch (error) {
    console.error('❌ Failed to fetch banks:', error.response?.data || error.message);
    console.log();
  }

  // Step 2: Check account balance
  console.log('2️⃣ Checking Paystack balance...');
  try {
    const balanceResponse = await axios.get(
      'https://api.paystack.co/balance',
      {
        headers: {
          Authorization: `Bearer ${SECRET_KEY}`,
        },
      }
    );
    
    console.log('✅ Account balances:');
    balanceResponse.data.data.forEach((bal) => {
      console.log(`   - ${bal.currency}: ${bal.balance / 100} (${bal.balance} kobo)`);
    });
    console.log();
  } catch (error) {
    console.error('❌ Failed to fetch balance:', error.response?.data || error.message);
    console.log();
  }

  // Step 3: Test recipient creation with different phone formats
  console.log('3️⃣ Testing M-PESA recipient creation with different formats...\n');
  
  const testPhones = [
    { format: 'Local (0720128694)', number: '0720128694' },
    { format: 'International (254720128694)', number: '254720128694' },
    { format: 'International with + (+254720128694)', number: '+254720128694' },
  ];

  for (const test of testPhones) {
    console.log(`   Testing: ${test.format}`);
    try {
      const payload = {
        type: 'mobile_money',
        name: 'Test User',
        account_number: test.number,
        bank_code: 'MPESA',
        currency: 'KES',
      };

      console.log(`   Payload:`, JSON.stringify(payload, null, 2));

      const response = await axios.post(
        'https://api.paystack.co/transferrecipient',
        payload,
        {
          headers: {
            Authorization: `Bearer ${SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`   ✅ SUCCESS! Recipient Code: ${response.data.data.recipient_code}`);
      console.log(`   Details:`, JSON.stringify(response.data.data.details, null, 2));
      
      // Clean up - delete the test recipient
      try {
        await axios.delete(
          `https://api.paystack.co/transferrecipient/${response.data.data.recipient_code}`,
          {
            headers: {
              Authorization: `Bearer ${SECRET_KEY}`,
            },
          }
        );
        console.log(`   🗑️  Test recipient deleted`);
      } catch (deleteError) {
        console.log(`   ⚠️  Could not delete test recipient (this is okay)`);
      }

    } catch (error) {
      console.error(`   ❌ FAILED!`);
      console.error(`   Error:`, error.response?.data || error.message);
    }
    console.log();
  }

  // Step 4: Check account activation status
  console.log('4️⃣ Checking account capabilities...');
  try {
    // Try to list existing transfer recipients
    const recipientsResponse = await axios.get(
      'https://api.paystack.co/transferrecipient',
      {
        headers: {
          Authorization: `Bearer ${SECRET_KEY}`,
        },
      }
    );
    
    console.log(`✅ You have ${recipientsResponse.data.data.length} existing recipients`);
    
    if (recipientsResponse.data.data.length > 0) {
      console.log('   Sample recipients:');
      recipientsResponse.data.data.slice(0, 3).forEach((r) => {
        console.log(`   - ${r.name} (${r.type}): ${r.details.account_number}`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to list recipients:', error.response?.data || error.message);
  }
  console.log();

  // Step 5: Summary and recommendations
  console.log('📋 TROUBLESHOOTING SUMMARY:\n');
  console.log('Common Issues:');
  console.log('1. ❗ Account not activated: Transfers require a REGISTERED business');
  console.log('2. ❗ Insufficient balance: Check your Paystack balance above');
  console.log('3. ❗ Wrong phone format: Test results show which format works');
  console.log('4. ❗ Invalid M-PESA number: Must be a valid Safaricom number\n');
  
  console.log('Next Steps:');
  console.log('• If "Account not activated" appears, contact support@paystack.com');
  console.log('• If phone format failed, use the working format shown above');
  console.log('• If balance is 0, add funds via Dashboard → Transfer → Top Up');
  console.log('• Check Paystack Dashboard → Settings → Account for activation status');
}

// Run the troubleshooting
troubleshootPaystack()
  .then(() => {
    console.log('\n✨ Troubleshooting complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });