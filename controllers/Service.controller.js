const Service = require('../models/Service.model');

// @desc    Create a new service
// @route   POST /api/services
// @access  Admin only
exports.createService = async (req, res) => {
  try {
    const { name, category, description, icon, subServices } = req.body;

    // Check if service already exists
    const existingService = await Service.findOne({ name });
    if (existingService) {
      return res.status(400).json({
        success: false,
        message: 'Service with this name already exists',
      });
    }

    const service = new Service({
      name,
      category,
      description,
      icon,
      subServices: subServices || [],
    });

    await service.save();

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to create service',
      error: error.message,
    });
  }
};

// @desc    Get all services (active only by default)
// @route   GET /api/services
// @access  Public
exports.getAllServices = async (req, res) => {
  try {
    const { category, isActive, search } = req.query;

    // Build query
    const query = {};

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by active status (default to active only)
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    } else {
      query.isActive = true; // default: show only active services
    }

    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const services = await Service.find(query).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
      error: error.message,
    });
  }
};

// @desc    Get single service by ID
// @route   GET /api/services/:id
// @access  Public
exports.getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service',
      error: error.message,
    });
  }
};

// @desc    Update a service
// @route   PUT /api/services/:id
// @access  Admin only
exports.updateService = async (req, res) => {
  try {
    const { name, category, description, icon, subServices, isActive } = req.body;

    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    // Check if updating name to an existing one
    if (name && name !== service.name) {
      const existingService = await Service.findOne({ name });
      if (existingService) {
        return res.status(400).json({
          success: false,
          message: 'Service with this name already exists',
        });
      }
    }

    // Update fields
    if (name) service.name = name;
    if (category) service.category = category;
    if (description !== undefined) service.description = description;
    if (icon !== undefined) service.icon = icon;
    if (subServices) service.subServices = subServices;
    if (isActive !== undefined) service.isActive = isActive;

    await service.save();

    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: service,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update service',
      error: error.message,
    });
  }
};

// @desc    Delete a service (soft delete - set isActive to false)
// @route   DELETE /api/services/:id
// @access  Admin only
exports.deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    // Soft delete - just deactivate
    service.isActive = false;
    await service.save();

    res.status(200).json({
      success: true,
      message: 'Service deactivated successfully',
      data: service,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete service',
      error: error.message,
    });
  }
};

// @desc    Permanently delete a service
// @route   DELETE /api/services/:id/permanent
// @access  Admin only
exports.permanentDeleteService = async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Service permanently deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete service',
      error: error.message,
    });
  }
};

// @desc    Get all service categories
// @route   GET /api/services/categories
// @access  Public
exports.getCategories = async (req, res) => {
  try {
    const categories = await Service.distinct('category', { isActive: true });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message,
    });
  }
};

// @desc    Add a sub-service to an existing service
// @route   POST /api/services/:id/sub-services
// @access  Admin only
exports.addSubService = async (req, res) => {
  try {
    const { name, description, estimatedDuration, suggestedPrice } = req.body;

    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    // Check if sub-service with same name already exists
    const existingSubService = service.subServices.find(
      (sub) => sub.name.toLowerCase() === name.toLowerCase()
    );

    if (existingSubService) {
      return res.status(400).json({
        success: false,
        message: 'Sub-service with this name already exists',
      });
    }

    service.subServices.push({
      name,
      description,
      estimatedDuration,
      suggestedPrice,
    });

    await service.save();

    res.status(201).json({
      success: true,
      message: 'Sub-service added successfully',
      data: service,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to add sub-service',
      error: error.message,
    });
  }
};

// @desc    Update a sub-service
// @route   PUT /api/services/:id/sub-services/:subServiceIndex
// @access  Admin only
exports.updateSubService = async (req, res) => {
  try {
    const { subServiceIndex } = req.params;
    const { name, description, estimatedDuration, suggestedPrice } = req.body;

    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    if (!service.subServices[subServiceIndex]) {
      return res.status(404).json({
        success: false,
        message: 'Sub-service not found',
      });
    }

    // Update sub-service fields
    if (name) service.subServices[subServiceIndex].name = name;
    if (description !== undefined)
      service.subServices[subServiceIndex].description = description;
    if (estimatedDuration)
      service.subServices[subServiceIndex].estimatedDuration = estimatedDuration;
    if (suggestedPrice)
      service.subServices[subServiceIndex].suggestedPrice = suggestedPrice;

    await service.save();

    res.status(200).json({
      success: true,
      message: 'Sub-service updated successfully',
      data: service,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update sub-service',
      error: error.message,
    });
  }
};

// @desc    Delete a sub-service
// @route   DELETE /api/services/:id/sub-services/:subServiceIndex
// @access  Admin only
exports.deleteSubService = async (req, res) => {
  try {
    const { subServiceIndex } = req.params;

    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    if (!service.subServices[subServiceIndex]) {
      return res.status(404).json({
        success: false,
        message: 'Sub-service not found',
      });
    }

    service.subServices.splice(subServiceIndex, 1);
    await service.save();

    res.status(200).json({
      success: true,
      message: 'Sub-service deleted successfully',
      data: service,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete sub-service',
      error: error.message,
    });
  }
};