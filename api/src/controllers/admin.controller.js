/**
 * Admin Controller
 * HTTP handlers for admin routes
 */

const userService = require('../services/user.service');
const agencyRepository = require('../repositories/agency.repository');
const auditRepository = require('../repositories/audit.repository');
const { success } = require('../utils/response');
const { asyncHandler } = require('../middleware/asyncHandler');

class AdminController {
  /**
   * Provision new user
   */
  provisionUser = asyncHandler(async (req, res) => {
    const user = await userService.provisionUser(req.body, {
      adminId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    res.status(201).json(success('User provisioned', { user }));
  });

  /**
   * Update user status
   */
  updateUserStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const user = await userService.updateStatus(req.params.id, status, {
      adminId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    res.json(success('User status updated', { user }));
  });

  /**
   * Get audit logs
   */
  getAuditLogs = asyncHandler(async (req, res) => {
    const { user_id, action, resource_type, start_date, end_date, page, limit } = req.query;
    let logs;
    
    if (req.params.resourceType && req.params.resourceId) {
      // Get logs for specific resource
      logs = await auditRepository.findByResource(req.params.resourceType, req.params.resourceId);
    } else if (user_id) {
      // Get logs for specific user
      logs = await auditRepository.findByUser(user_id, { action, page, limit });
    } else {
      // Get all logs with filters
      logs = await auditRepository.findAll({ 
        action, 
        resource_type, 
        start_date, 
        end_date, 
        page, 
        limit 
      });
    }
    
    res.json(success('Audit logs fetched', { logs }));
  });

  /**
   * Get agencies
   */
  getAgencies = asyncHandler(async (req, res) => {
    const agencies = await agencyRepository.findAllActive();
    res.json(success('Agencies fetched', { agencies }));
  });
}

module.exports = new AdminController();
