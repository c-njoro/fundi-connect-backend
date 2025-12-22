const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

//routers
const userRoutes = require('./routes/User.route');
const jobRoutes = require('./routes/Job.route');
const serviceRoutes = require('./routes/Service.route');
const reviewRoutes = require('./routes/Review.route');
const notificationRoutes = require('./routes/Notification.route');
const messageRoutes = require('./routes/Message.route');
const adminRoutes = require('./routes/Admin.route');

// Load environment variables
dotenv.config();

// Initialize app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON request bodies

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
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