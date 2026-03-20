/**
 * Agency Repository
 * All agency-related database operations
 */

const { BaseRepository, PaginatedResult } = require('./base.repository');
const { db } = require('./database');
const logger = require('../utils/logger');

class AgencyRepository extends BaseRepository {
  constructor() {
    super('agencies', { softDelete: true, timestamps: true });
  }

  /**
   * Find all active agencies
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findAllActive(options = {}) {
    try {
      let query = db.table(this.table)
        .select('id, name, type, region, is_active')
        .eq('is_active', true)
        .isNull(this.softDeleteField)
        .order('name', { ascending: true });

      if (options.type) {
        query = query.eq('type', options.type);
      }

      if (options.region) {
        query = query.eq('region', options.region);
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
   * Find agency by name
   * @param {string} name - Agency name
   * @returns {Promise<object|null>}
   */
  async findByName(name) {
    return this.findOneBy('name', name);
  }

  /**
   * Find agencies by type
   * @param {string} type - Agency type
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByType(type, options = {}) {
    return this.findBy('type', type, options);
  }

  /**
   * Find agencies by region
   * @param {string} region - Region
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByRegion(region, options = {}) {
    return this.findBy('region', region, options);
  }

  /**
   * Search agencies by name
   * @param {string} search - Search term
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async search(search, options = {}) {
    return this.findAll({
      search,
      searchFields: ['name'],
      ...options
    });
  }

  /**
   * Count users in agency
   * @param {string} agencyId - Agency ID
   * @returns {Promise<number>}
   */
  async countUsers(agencyId) {
    return db.count('users', [['agency_id', agencyId]]);
  }

  /**
   * Count incidents in agency
   * @param {string} agencyId - Agency ID
   * @returns {Promise<number>}
   */
  async countIncidents(agencyId) {
    return db.count('incidents', [['agency_id', agencyId]]);
  }

  /**
   * Check if name is unique
   * @param {string} name - Agency name
   * @param {string} excludeId - Agency ID to exclude
   * @returns {Promise<boolean>}
   */
  async isNameUnique(name, excludeId = null) {
    try {
      let query = db.table(this.table)
        .select('id')
        .eq('name', name)
        .isNull(this.softDeleteField);

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
   * Find agency with stats
   * @param {string} id - Agency ID
   * @returns {Promise<object|null>}
   */
  async findWithStats(id) {
    const agency = await this.findById(id);
    if (!agency) return null;

    const [userCount, incidentCount] = await Promise.all([
      this.countUsers(id),
      this.countIncidents(id)
    ]);

    return {
      ...agency,
      stats: {
        userCount,
        incidentCount
      }
    };
  }
}

// Export class for testing, singleton instance for production
module.exports = new AgencyRepository();
module.exports.AgencyRepository = AgencyRepository;
