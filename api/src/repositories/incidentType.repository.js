/**
 * Incident Type Repository
 * All incident type database operations
 */

const { db, QueryBuilder } = require('./database');

class IncidentTypeRepository {
  constructor() {
    this.table = 'incident_types';
  }

  /**
   * Find all active incident types
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findAllActive(options = {}) {
    const query = db.table(this.table)
      .select('id, name, description, color_code, icon, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (options.limit) {
      query.limit(options.limit);
    }

    return query.get();
  }

  /**
   * Find all incident types including inactive
   * @returns {Promise<Array>}
   */
  async findAll() {
    return db.table(this.table)
      .select('id, name, description, color_code, icon, sort_order, is_active')
      .order('sort_order', { ascending: true })
      .get();
  }

  /**
   * Find incident type by ID
   * @param {string} id - Incident type ID
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    return db.table(this.table)
      .select('*')
      .eq('id', id)
      .single()
      .first();
  }

  /**
   * Find incident type by name
   * @param {string} name - Incident type name
   * @returns {Promise<object|null>}
   */
  async findByName(name) {
    return db.table(this.table)
      .select('*')
      .eq('name', name)
      .single()
      .first();
  }

  /**
   * Create incident type
   * @param {object} data - Incident type data
   * @returns {Promise<object>}
   */
  async create(data) {
    return db.insert(this.table, {
      ...data,
      is_active: data.is_active ?? true,
      sort_order: data.sort_order ?? 0
    });
  }

  /**
   * Update incident type
   * @param {string} id - Incident type ID
   * @param {object} data - Update data
   * @returns {Promise<object>}
   */
  async updateById(id, data) {
    return db.update(this.table, data, [['id', id]]);
  }

  /**
   * Soft delete (deactivate) incident type
   * @param {string} id - Incident type ID
   * @returns {Promise<object>}
   */
  async deactivate(id) {
    return this.updateById(id, { is_active: false });
  }

  /**
   * Reactivate incident type
   * @param {string} id - Incident type ID
   * @returns {Promise<object>}
   */
  async activate(id) {
    return this.updateById(id, { is_active: true });
  }

  /**
   * Check if name exists
   * @param {string} name - Incident type name
   * @param {string} excludeId - ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async nameExists(name, excludeId = null) {
    let query = db.table(this.table)
      .select('id')
      .eq('name', name);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const result = await query.limit(1).get();
    return result.length > 0;
  }

  /**
   * Count incidents of this type
   * @param {string} id - Incident type ID
   * @returns {Promise<number>}
   */
  async countIncidents(id) {
    return db.count('incidents', [['incident_type_id', id]]);
  }
}

// Export class for testing, singleton instance for production
module.exports = new IncidentTypeRepository();
module.exports.IncidentTypeRepository = IncidentTypeRepository;
