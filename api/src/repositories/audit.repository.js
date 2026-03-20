/**
 * Audit Repository
 * All audit log database operations
 */

const { db } = require('./database');
const { PaginatedResult } = require('./base.repository');
const logger = require('../utils/logger');

class AuditRepository {
  constructor() {
    this.table = 'audit_logs';
  }

  /**
   * Log an audit entry
   * @param {object} params - Audit parameters
   * @param {string} params.userId - User performing the action
   * @param {string} params.action - Action performed
   * @param {string} params.resourceType - Type of resource
   * @param {string} params.resourceId - Resource ID
   * @param {object} params.details - Additional details
   * @param {string} params.ipAddress - Client IP
   * @param {string} params.userAgent - Client user agent
   * @returns {Promise<void>}
   */
  async log({
    userId,
    action,
    resourceType = null,
    resourceId = null,
    details = {},
    ipAddress = null,
    userAgent = null
  }) {
    try {
      await db.insert(this.table, {
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
        ip_address: ipAddress,
        user_agent: userAgent
      });
      
      logger.debug('Audit log created', { action, userId, resourceType });
    } catch (error) {
      // Don't throw on audit errors - just log
      logger.error('Failed to log audit', {
        error: error.message,
        action,
        userId
      });
    }
  }

  /**
   * Find audit logs by user with pagination
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {Promise<Array|PaginatedResult>}
   */
  async findByUser(userId, options = {}) {
    try {
      let query = db.table(this.table)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Filter by action
      if (options.action) {
        query = query.eq('action', options.action);
      }

      // Filter by resource type
      if (options.resourceType) {
        query = query.eq('resource_type', options.resourceType);
      }

      // Date range
      if (options.startDate) {
        query = query.gte('created_at', options.startDate);
      }
      if (options.endDate) {
        query = query.lte('created_at', options.endDate);
      }

      // Pagination
      if (options.page && options.limit) {
        const page = parseInt(options.page);
        const limit = parseInt(options.limit);
        
        const total = await db.count(this.table, [['user_id', userId]]);
        const data = await query.limit(limit).offset((page - 1) * limit).get();
        
        return new PaginatedResult(data, total, page, limit);
      }

      if (options.limit) {
        query = query.limit(parseInt(options.limit));
      }

      return query.get();
    } catch (error) {
      logger.error('Failed to find audit logs by user', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Find audit logs by resource
   * @param {string} resourceType - Resource type
   * @param {string} resourceId - Resource ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByResource(resourceType, resourceId, options = {}) {
    try {
      let query = db.table(this.table)
        .select('*')
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(parseInt(options.limit));
      }

      return query.get();
    } catch (error) {
      logger.error('Failed to find audit logs by resource', { resourceType, resourceId, error: error.message });
      throw error;
    }
  }

  /**
   * Find audit logs by action
   * @param {string} action - Action type
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByAction(action, options = {}) {
    try {
      let query = db.table(this.table)
        .select('*')
        .eq('action', action)
        .order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(parseInt(options.limit));
      }

      return query.get();
    } catch (error) {
      logger.error('Failed to find audit logs by action', { action, error: error.message });
      throw error;
    }
  }

  /**
   * Find all audit logs with pagination
   * @param {object} options - Query options
   * @returns {Promise<PaginatedResult>}
   */
  async findAll(options = {}) {
    try {
      let query = db.table(this.table)
        .select(`
          *,
          users:user_id (id, email, full_name)
        `)
        .order('created_at', { ascending: false });

      // Filter by action
      if (options.action) {
        query = query.eq('action', options.action);
      }

      // Filter by user
      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }

      // Filter by resource type
      if (options.resourceType) {
        query = query.eq('resource_type', options.resourceType);
      }

      // Date range
      if (options.startDate) {
        query = query.gte('created_at', options.startDate);
      }
      if (options.endDate) {
        query = query.lte('created_at', options.endDate);
      }

      // Search
      if (options.search) {
        query = query.or(`action.ilike.%${options.search}%,resource_type.ilike.%${options.search}%`);
      }

      // Pagination
      if (options.page && options.limit) {
        const page = parseInt(options.page);
        const limit = parseInt(options.limit);
        
        const data = await query.limit(limit).offset((page - 1) * limit).get();
        const total = await db.count(this.table, []);
        
        return new PaginatedResult(data, total, page, limit);
      }

      if (options.limit) {
        query = query.limit(parseInt(options.limit));
      }

      return query.get();
    } catch (error) {
      logger.error('Failed to find all audit logs', { error: error.message });
      throw error;
    }
  }

  /**
   * Count audit logs
   * @param {object} filters - Optional filters
   * @returns {Promise<number>}
   */
  async count(filters = {}) {
    const filterEntries = Object.entries(filters);
    return db.count(this.table, filterEntries);
  }

  /**
   * Get audit summary statistics
   * @param {object} options - Filter options
   * @returns {Promise<object>}
   */
  async getSummary(options = {}) {
    try {
      let query = db.table(this.table)
        .select('action, resource_type');

      if (options.startDate) {
        query = query.gte('created_at', options.startDate);
      }
      if (options.endDate) {
        query = query.lte('created_at', options.endDate);
      }
      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }

      const logs = await query.get();

      const byAction = logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {});

      const byResourceType = logs.reduce((acc, log) => {
        if (log.resource_type) {
          acc[log.resource_type] = (acc[log.resource_type] || 0) + 1;
        }
        return acc;
      }, {});

      return {
        total: logs.length,
        byAction,
        byResourceType
      };
    } catch (error) {
      logger.error('Failed to get audit summary', { error: error.message });
      throw error;
    }
  }

  /**
   * Clean old audit logs
   * @param {number} daysOld - Delete logs older than this many days
   * @returns {Promise<number>}
   */
  async cleanOld(daysOld = 90) {
    try {
      const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
      
      const result = await db.delete(this.table, [
        ['created_at', 'lt', cutoff]
      ], { many: true });

      const count = Array.isArray(result) ? result.length : 0;
      logger.info('Old audit logs cleaned', { daysOld, count });
      
      return count;
    } catch (error) {
      logger.error('Failed to clean old audit logs', { error: error.message });
      throw error;
    }
  }
}

// Export class for testing, singleton instance for production
module.exports = new AuditRepository();
module.exports.AuditRepository = AuditRepository;
