// controllers/Upload.controller.js
const { deleteImage, getPublicIdFromUrl } = require('../config/cloudinary');

// @desc    Upload single image
// @route   POST /api/upload/single
// @access  Private
exports.uploadSingle = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: req.file.path, // Cloudinary URL
        publicId: req.file.filename, // Cloudinary public_id
        originalName: req.file.originalname,
        size: req.file.size,
        format: req.file.format,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message,
    });
  }
};

// @desc    Upload multiple images
// @route   POST /api/upload/multiple
// @access  Private
exports.uploadMultiple = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedFiles = req.files.map(file => ({
      url: file.path,
      publicId: file.filename,
      originalName: file.originalname,
      size: file.size,
      format: file.format,
    }));

    res.status(200).json({
      success: true,
      message: `${req.files.length} images uploaded successfully`,
      data: uploadedFiles,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload images',
      error: error.message,
    });
  }
};



// @desc    Delete image
// @route   DELETE /api/upload/*
// @access  Private
exports.deleteImage = async (req, res) => {
    try {
      const encoded = req.params.publicId;
  
      if (!encoded) {
        return res.status(400).json({
          success: false,
          message: 'Public ID or URL is required',
        });
      }
  
      // Decode the URL-encoded value
      const decoded = decodeURIComponent(encoded);
  
      let publicId;
  
      // If full Cloudinary URL → extract public_id
      if (decoded.includes('cloudinary.com')) {
        const afterUpload = decoded.split('/upload/')[1];
  
        if (!afterUpload) {
          return res.status(400).json({
            success: false,
            message: 'Invalid Cloudinary URL',
          });
        }
  
        // remove version and extension
        publicId = afterUpload
          .replace(/^v\d+\//, '')
          .replace(/\.\w+$/, '');
      } else {
        // Otherwise assume it's already a public_id
        publicId = decoded;
      }
  
      const result = await deleteImage(publicId);
  
      if (result.result === 'ok' || result.result === 'not found') {
        return res.status(200).json({
          success: true,
          message: 'Image deleted successfully',
          publicId,
        });
      }
  
      return res.status(400).json({
        success: false,
        message: 'Failed to delete image',
        data: result,
      });
  
    } catch (error) {
      console.error('Delete error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete image',
        error: error.message,
      });
    }
  };
  
// module.exports = {
//   uploadSingle,
//   uploadMultiple,
//   deleteImage,
// };