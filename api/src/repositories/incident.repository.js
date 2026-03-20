/**
 * Incident Repository
 * All incident-related database operations
 */

const { BaseRepository, PaginatedResult } = require('./base.repository');
const { db } = require('./database');
const logger = require('../utils/logger');

class IncidentRepository extends BaseRepository {
  constructor() {
    super('incidents', { softDelete: false, timestamps: true });
  }

  /**
   * Find incident with related data
   * @param {string} id - Incident ID
   * @returns {Promise<object|null>}
   */
  async findWithDetails(id) {
    try {
      let query = db.table(this.table)
        .select(`
          *,
          incident_types:incident_type_id (id, name, icon, color_code)
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
   * Find by tracking ID
   * @param {string} trackingId - Public tracking ID
   * @returns {Promise<object|null>}
   */
  async findByTrackingId(trackingId) {
    try {
      let query = db.table(this.table)
        .select('id, tracking_id, incident_type_id, severity, status, address, created_at, updated_at')
        .eq('tracking_id', trackingId.toUpperCase());

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
   * Find incidents by agency with pagination
   * @param {string} agencyId - Agency ID
   * @param {object} options - Query options
   * @returns {Promise<Array|PaginatedResult>}
   */
  async findByAgency(agencyId, options = {}) {
    try {
      let query = db.table(this.table)
        .select(`
          *,
          incident_types:incident_type_id (id, name, icon, color_code)
        `)
        .order('created_at', { ascending: false });

      // Soft delete filter only if enabled
      if (this.useSoftDelete) {
        query = query.isNull(this.softDeleteField);
      }
      
      // Handle agency scoping
      if (agencyId) {
        query = query.eq('agency_id', agencyId);
      } else {
        query = query.isNull('agency_id');
      }
      
      // Filter by status
      if (options.status) {
        if (Array.isArray(options.status)) {
          query = query.in('status', options.status);
        } else {
          query = query.eq('status', options.status);
        }
      } else if (options.filter === 'active') {
        query = query.notIn('status', ['resolved', 'closed', 'cancelled']);
      } else if (options.filter === 'closed') {
        query = query.in('status', ['resolved', 'closed', 'cancelled']);
      }
      
      // Filter by severity
      if (options.severity) {
        query = query.eq('severity', options.severity);
      }
      
      // Filter by incident type
      if (options.incident_type_id) {
        query = query.eq('incident_type_id', options.incident_type_id);
      }
      
      // Filter by reporter
      if (options.reporterId) {
        query = query.eq('reporter_id', options.reporterId);
      }
      
      // Search
      if (options.search) {
        query = query.or(`description.ilike.%${options.search}%,address.ilike.%${options.search}%`);
      }
      
      // Pagination
      if (options.page && options.limit) {
        const page = parseInt(options.page);
        const limit = parseInt(options.limit);
        
        const total = await this.count({ agency_id: agencyId });
        const data = await query.limit(limit).offset((page - 1) * limit).get();
        
        return new PaginatedResult(data, total, page, limit);
      }
      
      // Apply limit
      if (options.limit) {
        query = query.limit(parseInt(options.limit));
      }
      
      return query.get();
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Find incidents visible to user (agency + anonymous)
   * @param {string} agencyId - User's agency ID
   * @param {boolean} crossAgency - Can user see all agencies?
   * @param {object} options - Query options
   * @returns {Promise<Array|PaginatedResult>}
   */
  async findVisibleToUser(agencyId, crossAgency, options = {}) {
    try {
      let query = db.table(this.table)
        .select(`
          *,
          incident_types:incident_type_id (id, name, icon, color_code)
        `)
        .order('created_at', { ascending: false });

      // Soft delete filter only if enabled
      if (this.useSoftDelete) {
        query = query.isNull(this.softDeleteField);
      }
      
      // Agency scoping
      if (crossAgency) {
        // Can see all - no filter
      } else if (agencyId) {
        // Can see own agency + anonymous incidents
        query = query.or(`agency_id.eq.${agencyId},agency_id.is.null`);
      } else {
        // No agency - can only see own reports
        if (options.reporterId) {
          query = query.eq('reporter_id', options.reporterId);
        }
      }
      
      // Filter by status
      if (options.status) {
        const statusValues = Array.isArray(options.status) ? options.status : [options.status];
        // Backward compat: mobile sends status=active meaning non-closed statuses
        if (statusValues.length === 1 && statusValues[0] === 'active') {
          query = query.notIn('status', ['resolved', 'closed', 'cancelled']);
        } else {
          query = query.in('status', statusValues);
        }
      } else if (options.filter === 'active') {
        query = query.notIn('status', ['resolved', 'closed', 'cancelled']);
      } else if (options.filter === 'closed') {
        query = query.in('status', ['resolved', 'closed', 'cancelled']);
      }
      
      // Filter by severity
      if (options.severity) {
        query = query.eq('severity', options.severity);
      }
      
      // Filter by incident type
      if (options.incident_type_id) {
        query = query.eq('incident_type_id', options.incident_type_id);
      }
      
      // Pagination
      if (options.page && options.limit) {
        const page = parseInt(options.page);
        const limit = parseInt(options.limit);
        
        const data = await query.limit(limit).offset((page - 1) * limit).get();
        const total = await this.count({ agency_id: agencyId });
        
        return new PaginatedResult(data, total, page, limit);
      }
      
      // Apply limit
      if (options.limit) {
        query = query.limit(parseInt(options.limit));
      }
      
      return query.get();
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Check if tracking ID exists
   * @param {string} trackingId - Tracking ID to check
   * @returns {Promise<boolean>}
   */
  async trackingIdExists(trackingId) {
    const existing = await this.findByTrackingId(trackingId);
    return !!existing;
  }

  /**
   * Update incident status
   * @param {string} id - Incident ID
   * @param {string} status - New status
   * @param {object} additionalData - Additional fields to update
   * @returns {Promise<object>}
   */
  async updateStatus(id, status, additionalData = {}) {
    return this.updateById(id, { status, ...additionalData });
  }

  /**
   * Delete incident with agency check
   * @param {string} id - Incident ID
   * @param {string} agencyId - User's agency ID
   * @returns {Promise<object|null>}
   */
  async deleteWithAgencyCheck(id, agencyId) {
    try {
      const result = await db.delete(this.table, [
        ['id', id],
        ['agency_id', agencyId]
      ]);
      
      logger.debug('Incident deleted with agency check', { id, agencyId });
      
      return result;
    } catch (error) {
      if (error.code === 'PGRST116') return null;
      throw this._handleError(error);
    }
  }

  /**
   * Find incidents by reporter
   * @param {string} reporterId - Reporter ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByReporter(reporterId, options = {}) {
    return this.findBy('reporter_id', reporterId, options);
  }

  /**
   * Find incidents by type
   * @param {string} incidentTypeId - Incident type ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByType(incidentTypeId, options = {}) {
    return this.findBy('incident_type_id', incidentTypeId, options);
  }

  /**
   * Count incidents by status
   * @param {string} agencyId - Agency ID (optional)
   * @returns {Promise<object>}
   */
  async countByStatus(agencyId = null) {
    try {
      let query = db.table(this.table)
        .select('status');

      // Soft delete filter only if enabled
      if (this.useSoftDelete) {
        query = query.isNull(this.softDeleteField);
      }

      if (agencyId) {
        query = query.eq('agency_id', agencyId);
      }

      const incidents = await query.get();
      
      const counts = incidents.reduce((acc, inc) => {
        acc[inc.status] = (acc[inc.status] || 0) + 1;
        return acc;
      }, {});
      
      return counts;
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Find recent incidents
   * @param {number} hours - Hours to look back
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findRecent(hours = 24, options = {}) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    try {
      let query = db.table(this.table)
        .select(`
          *,
          incident_types:incident_type_id (id, name, icon, color_code)
        `)
        .gte('created_at', since)
        .order('created_at', { ascending: false });

      // Soft delete filter only if enabled
      if (this.useSoftDelete) {
        query = query.isNull(this.softDeleteField);
      }

      if (options.agencyId) {
        query = query.eq('agency_id', options.agencyId);
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
   * Find incidents visible to citizen (own reports)
   * @param {string} userId - Citizen user ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findVisibleToCitizen(userId, options = {}) {
    try {
      let query = db.table(this.table)
        .select(`
          *,
          incident_types:incident_type_id (id, name, icon, color_code)
        `)
        .eq('reporter_id', userId)
        .order('created_at', { ascending: false });

      // Soft delete filter only if enabled
      if (this.useSoftDelete) {
        query = query.isNull(this.softDeleteField);
      }

      // Filter by status
      if (options.status) {
        query = query.in('status', Array.isArray(options.status) ? options.status : [options.status]);
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(parseInt(options.limit));
      }

      return query.get();
    } catch (error) {
      throw this._handleError(error);
    }
  }
}

// Export class for testing, singleton instance for production
module.exports = new IncidentRepository();
module.exports.IncidentRepository = IncidentRepository;
