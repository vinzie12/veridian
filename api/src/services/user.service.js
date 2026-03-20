/**
 * User Service
 * Business logic for user management operations
 */

const userRepository = require('../repositories/user.repository');
const agencyRepository = require('../repositories/agency.repository');
const auditRepository = require('../repositories/audit.repository');
const authRepository = require('../repositories/auth.repository');
const { NotFoundError, ValidationError, ConflictError, ForbiddenError } = require('../utils/errors');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

class UserService {
  /**
   * Get current user profile
   * @param {string} userId - User ID
   * @returns {object} User profile
   */
  async getCurrentUser(userId) {
    const user = await userRepository.findWithAgency(userId);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {object} updates - Profile updates
   * @param {object} context - Request context
   * @returns {object} Updated user
   */
  async updateProfile(userId, updates, context = {}) {
    const { full_name, badge_number } = updates;
    
    const updateData = {};
    if (full_name) updateData.full_name = full_name;
    if (badge_number) {
      // Check uniqueness if changing badge number
      const isUnique = await userRepository.isBadgeNumberUnique(badge_number, userId);
      if (!isUnique) {
        throw new ConflictError('Badge number already in use');
      }
      updateData.badge_number = badge_number;
    }

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    const user = await userRepository.updateById(userId, updateData);

    // Log audit
    await auditRepository.log({
      userId,
      action: 'update_profile',
      resourceType: 'user',
      resourceId: userId,
      details: updateData,
      ipAddress: context.ip,
      userAgent: context.userAgent
    });

    logger.info('User profile updated', { userId, fields: Object.keys(updateData) });

    return user;
  }

  /**
   * Set password for user (legacy)
   * @param {string} badgeNumber - User badge number
   * @param {string} password - New password
   * @param {object} context - Request context
   * @returns {object} Result
   */
  async setPassword(badgeNumber, password, context = {}) {
    const hash = await bcrypt.hash(password, 10);
    
    const user = await userRepository.setPasswordHash(badgeNumber, hash);

    // Log audit
    await auditRepository.log({
      userId: user.id,
      action: 'set_password',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: context.ip,
      userAgent: context.userAgent
    });

    logger.info('Password set for user', { badgeNumber });

    return { message: 'Password set successfully' };
  }

  /**
   * Provision new user (admin)
   * @param {object} userData - User data
   * @param {object} context - Request context
   * @returns {object} Created user
   */
  async provisionUser(userData, context = {}) {
    const { email, password, full_name, badge_number, agency_id, role, send_invite } = userData;

    if (!email || !full_name || !agency_id) {
      throw new ValidationError('Email, full name, and agency_id are required');
    }

    // Verify agency exists
    const agency = await agencyRepository.findById(agency_id);
    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    let authUser;
    let isNewUser = true;

    // Check if auth user exists
    const { users: existingAuthUsers, error: listError } = await authRepository.listUsers({
      filters: { email }
    });

    const existingAuthUser = existingAuthUsers?.[0];

    if (existingAuthUser) {
      // Check if profile exists
      const existingProfile = await userRepository.findById(existingAuthUser.id);
      
      if (existingProfile) {
        throw new ConflictError('User already provisioned');
      }

      authUser = existingAuthUser;
      isNewUser = false;
    } else {
      // Create new auth user
      if (send_invite) {
        const { user, error: inviteError } = await authRepository.inviteUserByEmail(email, {
          redirectTo: process.env.INVITE_REDIRECT_URL,
          metadata: { full_name, badge_number }
        });

        if (inviteError) {
          throw new ValidationError(inviteError.message);
        }
        authUser = user;
      } else {
        if (!password) {
          throw new ValidationError('Password is required when not sending invite');
        }

        const { user, error: createError } = await authRepository.createUser({
          email,
          password,
          emailConfirm: true,
          metadata: { full_name, badge_number }
        });

        if (createError) {
          throw new ValidationError(createError.message);
        }
        authUser = user;
      }
    }

    // Check badge number uniqueness
    if (badge_number) {
      const isUnique = await userRepository.isBadgeNumberUnique(badge_number, authUser.id);
      if (!isUnique) {
        // Rollback auth user if new
        if (isNewUser) {
          await authRepository.deleteUser(authUser.id);
        }
        throw new ConflictError('Badge number already in use');
      }
    }

    // Create profile
    const profile = await userRepository.create({
      id: authUser.id,
      email,
      full_name,
      badge_number,
      agency_id,
      role: role || 'field_responder',
      status: 'active'
    });

    // Log audit
    await auditRepository.log({
      userId: context.adminId,
      action: 'provision_user',
      resourceType: 'user',
      resourceId: profile.id,
      details: { email, role, agency_id, isNewUser },
      ipAddress: context.ip,
      userAgent: context.userAgent
    });

    logger.info('User provisioned', { userId: profile.id, email, role });

    return profile;
  }

  /**
   * Get users by agency with pagination
   * @param {string} agencyId - Agency ID
   * @param {object} options - Query options
   * @returns {Array|PaginatedResult} Users
   */
  async getUsersByAgency(agencyId, options = {}) {
    return userRepository.findByAgency(agencyId, options);
  }

  /**
   * Update user status
   * @param {string} userId - User ID
   * @param {string} status - New status
   * @param {object} context - Request context
   * @returns {object} Updated user
   */
  async updateStatus(userId, status, context = {}) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updated = await userRepository.updateById(userId, { status });

    // Log audit
    await auditRepository.log({
      userId: context.adminId,
      action: 'update_user_status',
      resourceType: 'user',
      resourceId: userId,
      details: { oldStatus: user.status, newStatus: status },
      ipAddress: context.ip,
      userAgent: context.userAgent
    });

    logger.info('User status updated', { userId, oldStatus: user.status, newStatus: status });

    return updated;
  }

  /**
   * Update user role
   * @param {string} userId - User ID
   * @param {string} role - New role
   * @param {object} context - Request context
   * @returns {object} Updated user
   */
  async updateRole(userId, role, context = {}) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updated = await userRepository.updateById(userId, { role });

    // Log audit
    await auditRepository.log({
      userId: context.adminId,
      action: 'update_user_role',
      resourceType: 'user',
      resourceId: userId,
      details: { oldRole: user.role, newRole: role },
      ipAddress: context.ip,
      userAgent: context.userAgent
    });

    logger.info('User role updated', { userId, oldRole: user.role, newRole: role });

    return updated;
  }

  /**
   * Soft delete user
   * @param {string} userId - User ID
   * @param {object} context - Request context
   * @returns {object} Deleted user
   */
  async deleteUser(userId, context = {}) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const deleted = await userRepository.deleteById(userId);

    // Log audit
    await auditRepository.log({
      userId: context.adminId,
      action: 'delete_user',
      resourceType: 'user',
      resourceId: userId,
      details: { email: user.email },
      ipAddress: context.ip,
      userAgent: context.userAgent
    });

    logger.info('User deleted', { userId, email: user.email });

    return deleted;
  }

  /**
   * Search users
   * @param {string} search - Search term
   * @param {object} options - Query options
   * @returns {Array} Users
   */
  async searchUsers(search, options = {}) {
    return userRepository.search(search, options);
  }

  /**
   * Get user statistics
   * @param {string} agencyId - Agency ID (optional)
   * @returns {object} Statistics
   */
  async getUserStats(agencyId = null) {
    const total = await userRepository.count(agencyId ? { agency_id: agencyId } : {});
    const active = await userRepository.count({ status: 'active', ...(agencyId && { agency_id: agencyId }) });
    const pending = await userRepository.count({ status: 'pending', ...(agencyId && { agency_id: agencyId }) });

    return {
      total,
      active,
      pending,
      inactive: total - active - pending
    };
  }
}

// Export class for testing, singleton instance for production
module.exports = new UserService();
module.exports.UserService = UserService;
