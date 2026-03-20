/**
 * Admin Routes
 * Admin-only endpoints with proper authorization
 */

const router = require('express').Router();
const { validateBody, validateParams, validateQuery } = require('../middleware/validate');
const { 
  provisionUserSchema, 
  updateUserStatusSchema, 
  userIdParamsSchema,
  auditLogsQuerySchema,
  auditLogParamsSchema
} = require('../validators/user.validator');
const adminController = require('../controllers/admin.controller');
const { 
  authenticate, 
  requireAdmin, 
  requirePermission,
  requireAgencyScope,
  canManageUser 
} = require('./auth.middleware');

// All admin routes require authentication and admin privileges
router.use(authenticate);
router.use(requireAdmin);
router.use(requireAgencyScope);

// ============================================
// USER MANAGEMENT
// ============================================

router.post('/users', validateBody(provisionUserSchema), adminController.provisionUser);
router.patch('/users/:id/status', validateParams(userIdParamsSchema), canManageUser, validateBody(updateUserStatusSchema), adminController.updateUserStatus);

// ============================================
// AUDIT LOGS
// ============================================

router.get('/audit-logs', requirePermission('audit:read'), validateQuery(auditLogsQuerySchema), adminController.getAuditLogs);
router.get('/audit-logs/:resourceType/:resourceId', requirePermission('audit:read'), validateParams(auditLogParamsSchema), adminController.getAuditLogs);

// ============================================
// AGENCIES
// ============================================

router.get('/agencies', adminController.getAgencies);

module.exports = router;
