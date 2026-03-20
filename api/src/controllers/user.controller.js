/**
 * User Controller
 * HTTP handlers for user routes
 */

const userService = require('../services/user.service');
const { success, updated, deleted, list, item } = require('../utils/response');
const { asyncHandler } = require('../middleware/asyncHandler');

class UserController {
  /**
   * Get current user profile
   */
  getCurrentUser = asyncHandler(async (req, res) => {
    const userId = req.user.id || req.user.user_id;
    const user = await userService.getCurrentUser(userId);
    
    res.json(item('User profile', { user }));
  });

  /**
   * Update current user profile
   */
  updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id || req.user.user_id;
    const { full_name, badge_number } = req.body;
    const user = await userService.updateProfile(userId, { full_name, badge_number }, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(updated('Profile updated successfully', { user }));
  });

  /**
   * Set password (legacy)
   */
  setPassword = asyncHandler(async (req, res) => {
    const { badge_number, password } = req.body;
    const result = await userService.setPassword(badge_number, password, {
      adminId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(success(result.message));
  });

  /**
   * Get users by agency
   */
  getUsersByAgency = asyncHandler(async (req, res) => {
    const { role, status, page, limit } = req.query;
    const agencyId = req.agencyScope || req.user.agency_id;
    const result = await userService.getUsersByAgency(agencyId, { role, status, page, limit });
    
    // Handle paginated result
    if (result.pagination) {
      res.json(list('users', result.data, result.pagination));
    } else {
      res.json(list('users', result));
    }
  });

  /**
   * Update user status (admin)
   */
  updateStatus = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { status } = req.body;
    
    const user = await userService.updateStatus(userId, status, {
      adminId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(updated('User status updated', { user }));
  });

  /**
   * Update user role (admin)
   */
  updateRole = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;
    
    const user = await userService.updateRole(userId, role, {
      adminId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(updated('User role updated', { user }));
  });

  /**
   * Delete user (admin)
   */
  deleteUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    await userService.deleteUser(userId, {
      adminId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(deleted('User deleted successfully'));
  });

  /**
   * Search users
   */
  searchUsers = asyncHandler(async (req, res) => {
    const { q, page, limit } = req.query;
    const result = await userService.searchUsers(q, { page, limit });
    
    if (result.pagination) {
      res.json(list('users', result.data, result.pagination));
    } else {
      res.json(list('users', result));
    }
  });

  /**
   * Get user statistics
   */
  getUserStats = asyncHandler(async (req, res) => {
    const agencyId = req.agencyScope || req.user.agency_id;
    const stats = await userService.getUserStats(agencyId);
    
    res.json(success('User statistics fetched', { stats }));
  });
}

module.exports = new UserController();
