// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
// const dotenv = require('dotenv');
// dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'fundiconnect', // Folder name in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 1000, height: 1000, crop: 'limit' }, // Max dimensions
      { quality: 'auto' }, // Automatic quality optimization
    ],
  },
});

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  },
});

// Different upload configurations
const uploadSingle = upload.single('image');
const uploadMultiple = upload.array('images', 10); // Max 10 images
const uploadFields = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'images', maxCount: 10 },
]);

// Helper function to delete image from Cloudinary
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
};

// Helper function to extract public_id from Cloudinary URL
const getPublicIdFromUrl = (url) => {
  // Example URL: https://res.cloudinary.com/demo/image/upload/v1234567890/fundiconnect/abc123.jpg
  // Extract: fundiconnect/abc123
  const parts = url.split('/');
  const uploadIndex = parts.indexOf('upload');
  if (uploadIndex !== -1 && uploadIndex + 2 < parts.length) {
    const folderAndFile = parts.slice(uploadIndex + 2).join('/');
    return folderAndFile.replace(/\.[^/.]+$/, ''); // Remove extension
  }
  return null;
};

module.exports = {
  cloudinary,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  deleteImage,
  getPublicIdFromUrl,
};