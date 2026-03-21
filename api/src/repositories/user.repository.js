/**
 * User Repository
 * All user-related database operations
 */

const { BaseRepository, PaginatedResult } = require('./base.repository');
const { db } = require('./database');
const logger = require('../utils/logger');

class UserRepository extends BaseRepository {
  constructor() {
    super('users', { softDelete: false, timestamps: false });
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<object|null>}
   */
  async findByEmail(email) {
    return this.findOneBy('email', email);
  }

  /**
   * Find user by badge number
   * @param {string} badgeNumber - User badge number
   * @returns {Promise<object|null>}
   */
  async findByBadgeNumber(badgeNumber) {
    return this.findOneBy('badge_number', badgeNumber);
  }

  /**
   * Find user with agency info
   * @param {string} id - User ID
   * @returns {Promise<object|null>}
   */
  async findWithAgency(id) {
    try {
      let query = db.table(this.table)
        .select(`
          id,
          email,
          full_name,
          badge_number,
          role,
          status,
          agency_id,
          token_version,
          last_active,
          created_at,
          agencies:agencies!fk_users_agency_id (id, name)
        `)
        .eq('id', id);

      // Soft delete filter only if enabled
      if (this.useSoftDelete) {
        query = query.isNull(this.softDeleteField);
      }

      const result = await query.single().first();
      
      return result;
    } catch (error) {
      if (error.code === 'PGRST116') return null;
      throw this._handleError(error);
    }
  }

  /**
   * Increment token version (used for session revocation)
   * @param {string} id - User ID
   * @returns {Promise<void>}
   */
  async incrementTokenVersion(id) {
    try {
      // Use raw SQL for atomic increment
      const user = await this.findById(id, { select: 'token_version' });
      
      await this.updateById(id, { 
        token_version: (user?.token_version || 0) + 1 
      });
      
      logger.debug('Token version incremented', { userId: id });
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Find users by agency with pagination
   * @param {string} agencyId - Agency ID
   * @param {object} options - Query options
   * @returns {Promise<Array|PaginatedResult>}
   */
  async findByAgency(agencyId, options = {}) {
    try {
      let query = db.table(this.table)
        .select(`
          id,
          email,
          full_name,
          badge_number,
          role,
          status,
          last_active,
          created_at
        `)
        .eq('agency_id', agencyId);

      // Soft delete filter only if enabled
      if (this.useSoftDelete) {
        query = query.isNull(this.softDeleteField);
      }

      if (options.role) {
        query = query.eq('role', options.role);
      }

      if (options.status) {
        query = query.eq('status', options.status);
      }

      query = query.order('full_name', { ascending: true });

      // Pagination
      if (options.page && options.limit) {
        const page = parseInt(options.page);
        const limit = parseInt(options.limit);
        
        const total = await this.count({ agency_id: agencyId });
        const data = await query.limit(limit).offset((page - 1) * limit).get();
        
        return new PaginatedResult(data, total, page, limit);
      }

      if (options.limit) {
        query = query.limit(parseInt(options.limit));
      }

      return query.get();
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Update user's last active timestamp
   * @param {string} id - User ID
   * @returns {Promise<void>}
   */
  async updateLastActive(id) {
    await this.updateById(id, { last_active: new Date().toISOString() });
  }

  /**
   * Update push token
   * @param {string} id - User ID
   * @param {string} pushToken - Push notification token
   * @returns {Promise<void>}
   */
  async updatePushToken(id, pushToken) {
    await this.updateById(id, { push_token: pushToken });
  }

  /**
   * Set password hash (legacy)
   * @param {string} badgeNumber - User badge number
   * @param {string} passwordHash - Bcrypt hash
   * @returns {Promise<object>}
   */
  async setPasswordHash(badgeNumber, passwordHash) {
    try {
      const result = await db.update(this.table, 
        { password_hash: passwordHash },
        [['badge_number', badgeNumber]]
      );
      
      logger.debug('Password hash set', { badgeNumber });
      
      return result;
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Find users by role
   * @param {string} role - User role
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByRole(role, options = {}) {
    return this.findBy('role', role, options);
  }

  /**
   * Find active users
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findActive(options = {}) {
    return this.findAll({
      filters: { status: 'active' },
      ...options
    });
  }

  /**
   * Search users by name or email
   * @param {string} search - Search term
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async search(search, options = {}) {
    return this.findAll({
      search,
      searchFields: ['full_name', 'email', 'badge_number'],
      ...options
    });
  }

  /**
   * Check if email is unique
   * @param {string} email - Email to check
   * @param {string} excludeId - User ID to exclude
   * @returns {Promise<boolean>}
   */
  async isEmailUnique(email, excludeId = null) {
    try {
      let query = db.table(this.table)
        .select('id')
        .eq('email', email);

      // Soft delete filter only if enabled
      if (this.useSoftDelete) {
        query = query.isNull(this.softDeleteField);
      }

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const result = await query.limit(1).get();
      return result.length === 0;
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Check if badge number is unique
   * @param {string} badgeNumber - Badge number to check
   * @param {string} excludeId - User ID to exclude
   * @returns {Promise<boolean>}
   */
  async isBadgeNumberUnique(badgeNumber, excludeId = null) {
    if (!badgeNumber) return true;
    
    try {
      let query = db.table(this.table)
        .select('id')
        .eq('badge_number', badgeNumber);

      // Soft delete filter only if enabled
      if (this.useSoftDelete) {
        query = query.isNull(this.softDeleteField);
      }

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const result = await query.limit(1).get();
      return result.length === 0;
    } catch (error) {
      throw this._handleError(error);
    }
  }
}

// Export class for testing, singleton instance for production
module.exports = new UserRepository();
module.exports.UserRepository = UserRepository;
