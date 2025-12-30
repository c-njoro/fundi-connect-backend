const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

//routers

const userRoutes = require('./routes/User.route');
const jobRoutes = require('./routes/Job.route');
const serviceRoutes = require('./routes/Service.route');
const reviewRoutes = require('./routes/Review.route');
const notificationRoutes = require('./routes/Notification.route');
const messageRoutes = require('./routes/Message.route');
const adminRoutes = require('./routes/Admin.route');
const paymentRoutes = require('./routes/Payment.route');
const uploadRoutes = require('./routes/Upload.route')


// Initialize app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON request bodies


app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File is too large. Maximum size is 5MB.',
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 10 files.',
      });
    }
  }
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  
  next();
});

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/upload', uploadRoutes)


// Routes
app.get('/', (req, res) => {
  res.send('API is running...');
});



// Start server
const PORT = process.env.PORT || 5000;
// Function to start the server
const startServer = async () => {
    try {
      await connectDB(); // Wait until MongoDB connects
      app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error.message);
      process.exit(1); // Exit process with failure
    }
  };
  
  startServer();