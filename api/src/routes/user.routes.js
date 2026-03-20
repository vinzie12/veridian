/**
 * User Routes
 * User profile and settings endpoints
 */

const router = require('express').Router();
const { validateBody, validateQuery } = require('../middleware/validate');
const { setPasswordSchema, updateProfileSchema } = require('../validators/auth.validator');
const { usersQuerySchema } = require('../validators/user.validator');
const userController = require('../controllers/user.controller');
const { 
  authenticate, 
  requirePermission,
  requireAgencyScope 
} = require('./auth.middleware');

// All user routes require authentication
router.use(authenticate);

// ============================================
// PROFILE ENDPOINTS
// ============================================

router.get('/me', userController.getCurrentUser);
router.patch('/me', validateBody(updateProfileSchema), userController.updateProfile);

// ============================================
// PASSWORD MANAGEMENT
// ============================================

router.post('/set-password', requirePermission('canUpdate'), validateBody(setPasswordSchema), userController.setPassword);

// ============================================
// AGENCY USERS
// ============================================

router.get('/agency', requireAgencyScope, validateQuery(usersQuerySchema), userController.getUsersByAgency);

module.exports = router;
