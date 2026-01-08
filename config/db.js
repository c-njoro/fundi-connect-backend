const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.LIVE_MONGO);
    console.log('✅ MongoDB Connected Successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    process.exit(1); // Exit on failure
  }
};

module.exports = connectDB;
