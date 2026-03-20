/**
 * Base Repository
 * Common database operations for all repositories
 * Provides pagination, soft delete, and transaction support
 */

const { db } = require('./database');
const logger = require('../utils/logger');
const { fromSupabaseError } = require('../utils/errors');

/**
 * Pagination result wrapper
 */
class PaginatedResult {
  constructor(data, total, page, limit) {
    this.data = data;
    this.pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    };
  }
}

class BaseRepository {
  constructor(tableName, options = {}) {
    this.table = tableName;
    this.softDeleteField = options.softDeleteField || 'deleted_at';
    this.useSoftDelete = options.softDelete ?? false;
    this.timestampFields = options.timestamps ?? true;
  }

  /**
   * Find all records with pagination
   * @param {object} options - Query options
   * @returns {Promise<Array|PaginatedResult>}
   */
  async findAll(options = {}) {
    try {
      let query = db.table(this.table)
        .select(options.select || '*');

      // Soft delete filter
      if (this.useSoftDelete && !options.includeDeleted) {
        query = query.isNull(this.softDeleteField);
      }

      // Apply filters
      if (options.filters) {
        for (const [field, value] of Object.entries(options.filters)) {
          if (value === null) {
            query = query.isNull(field);
          } else if (Array.isArray(value)) {
            query = query.in(field, value);
          } else {
            query = query.eq(field, value);
          }
        }
      }

      // Search filter
      if (options.search && options.searchFields) {
        const searchConditions = options.searchFields
          .map(field => `${field}.ilike.%${options.search}%`)
          .join(',');
        query = query.or(searchConditions);
      }

      // Ordering
      if (options.order) {
        query = query.order(options.order.column, { 
          ascending: options.order.ascending ?? false,
          nullsFirst: options.order.nullsFirst ?? false
        });
      }

      // Pagination
      if (options.page && options.limit) {
        const page = parseInt(options.page);
        const limit = parseInt(options.limit);
        const offset = (page - 1) * limit;

        // Get total count first
        const countFilters = options.filters 
          ? Object.entries(options.filters) 
          : [];
        const total = await db.count(this.table, countFilters);

        // Get paginated data
        const data = await query
          .limit(limit)
          .offset(offset)
          .get();

        return new PaginatedResult(data, total, page, limit);
      }

      // Simple limit without pagination
      if (options.limit) {
        query = query.limit(parseInt(options.limit));
      }

      return query.get();
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Find one record by ID
   * @param {string} id - Record ID
   * @param {object} options - Query options
   * @returns {Promise<object|null>}
   */
  async findById(id, options = {}) {
    try {
      let query = db.table(this.table)
        .select(options.select || '*')
        .eq('id', id);

      // Soft delete filter
      if (this.useSoftDelete && !options.includeDeleted) {
        query = query.isNull(this.softDeleteField);
      }

      const result = await query.single().first();
      return result;
    } catch (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw this._handleError(error);
    }
  }

  /**
   * Find one record by field value
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @param {object} options - Query options
   * @returns {Promise<object|null>}
   */
  async findOneBy(field, value, options = {}) {
    try {
      let query = db.table(this.table)
        .select(options.select || '*')
        .eq(field, value);

      // Soft delete filter
      if (this.useSoftDelete && !options.includeDeleted) {
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
   * Find records by field value
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findBy(field, value, options = {}) {
    try {
      let query = db.table(this.table)
        .select(options.select || '*')
        .eq(field, value);

      // Soft delete filter
      if (this.useSoftDelete && !options.includeDeleted) {
        query = query.isNull(this.softDeleteField);
      }

      if (options.order) {
        query = query.order(options.order.column, { ascending: options.order.ascending ?? false });
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
   * Find multiple records by array of IDs
   * @param {Array<string>} ids - Array of IDs
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByIds(ids, options = {}) {
    if (!ids || ids.length === 0) return [];

    try {
      let query = db.table(this.table)
        .select(options.select || '*')
        .in('id', ids);

      if (this.useSoftDelete && !options.includeDeleted) {
        query = query.isNull(this.softDeleteField);
      }

      return query.get();
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Create a new record
   * @param {object} data - Record data
   * @param {object} options - Query options
   * @returns {Promise<object>}
   */
  async create(data, options = {}) {
    try {
      // Add timestamps if enabled
      const recordData = this.timestampFields
        ? { ...data, created_at: data.created_at || new Date().toISOString() }
        : data;

      const result = await db.insert(this.table, recordData, { select: options.select || '*' });
      
      logger.debug('Record created', { table: this.table, id: result.id });
      
      return result;
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Create multiple records
   * @param {Array<object>} records - Array of record data
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async createMany(records, options = {}) {
    if (!records || records.length === 0) return [];

    try {
      const recordsData = this.timestampFields
        ? records.map(r => ({ ...r, created_at: r.created_at || new Date().toISOString() }))
        : records;

      const result = await db.insert(this.table, recordsData, { 
        select: options.select || '*',
        many: true 
      });

      logger.debug('Records created', { table: this.table, count: result.length });

      return result;
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Update a record by ID
   * @param {string} id - Record ID
   * @param {object} data - Update data
   * @param {object} options - Query options
   * @returns {Promise<object>}
   */
  async updateById(id, data, options = {}) {
    try {
      // Add updated_at timestamp
      const updateData = this.timestampFields
        ? { ...data, updated_at: new Date().toISOString() }
        : data;

      const result = await db.update(this.table, updateData, [['id', id]], { 
        select: options.select || '*' 
      });

      logger.debug('Record updated', { table: this.table, id });

      return result;
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Update multiple records
   * @param {string} field - Field to filter by
   * @param {*} value - Field value
   * @param {object} data - Update data
   * @returns {Promise<Array>}
   */
  async updateBy(field, value, data) {
    try {
      const updateData = this.timestampFields
        ? { ...data, updated_at: new Date().toISOString() }
        : data;

      const result = await db.update(this.table, updateData, [[field, value]], { many: true });

      logger.debug('Records updated', { table: this.table, field, value, count: result.length });

      return result;
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Soft delete a record by ID
   * @param {string} id - Record ID
   * @returns {Promise<object>}
   */
  async deleteById(id) {
    try {
      if (this.useSoftDelete) {
        // Soft delete - set deleted_at timestamp
        const result = await this.updateById(id, { [this.softDeleteField]: new Date().toISOString() });
        logger.debug('Record soft deleted', { table: this.table, id });
        return result;
      } else {
        // Hard delete
        const result = await db.delete(this.table, [['id', id]]);
        logger.debug('Record deleted', { table: this.table, id });
        return result;
      }
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Restore a soft-deleted record
   * @param {string} id - Record ID
   * @returns {Promise<object>}
   */
  async restoreById(id) {
    if (!this.useSoftDelete) {
      throw new Error('This repository does not use soft delete');
    }

    return this.updateById(id, { [this.softDeleteField]: null });
  }

  /**
   * Permanently delete a record (even if soft-deleted)
   * @param {string} id - Record ID
   * @returns {Promise<object>}
   */
  async forceDelete(id) {
    try {
      const result = await db.delete(this.table, [['id', id]]);
      logger.debug('Record force deleted', { table: this.table, id });
      return result;
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Count records
   * @param {object} filters - Optional filters
   * @returns {Promise<number>}
   */
  async count(filters = {}) {
    try {
      const filterEntries = Object.entries(filters);
      
      // Add soft delete filter
      if (this.useSoftDelete && !filters.includeDeleted) {
        filterEntries.push([this.softDeleteField, null]);
      }

      return db.count(this.table, filterEntries);
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * Check if record exists
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @returns {Promise<boolean>}
   */
  async exists(field, value) {
    const count = await this.count({ [field]: value });
    return count > 0;
  }

  /**
   * Begin a transaction (placeholder for future implementation)
   * @returns {Promise<object>}
   */
  async beginTransaction() {
    // Note: Supabase client doesn't support client-side transactions
    // This is a placeholder for when using Postgres functions
    logger.warn('Transactions not supported with Supabase client');
    return null;
  }

  /**
   * Handle database errors
   * @private
   */
  _handleError(error) {
    // Convert Supabase errors to application errors
    if (error.code && (error.code.startsWith('P') || error.code.match(/^23\d{2}$/))) {
      return fromSupabaseError(error);
    }

    logger.error('Database error', {
      table: this.table,
      error: error.message,
      code: error.code
    });

    return error;
  }
}

module.exports = { BaseRepository, PaginatedResult };
