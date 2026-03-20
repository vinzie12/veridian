/**
 * Database Client Abstraction
 * Provides a unified interface for database operations
 * Enables testing with mock implementations
 */

const { supabaseAdmin, supabase } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Query builder wrapper for Supabase
 * Provides a fluent interface that can be mocked for testing
 */
class QueryBuilder {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this._select = '*';
    this._filters = [];
    this._orders = [];
    this._limitValue = null;
    this._offsetValue = null;
    this._joins = [];
    this._singleMode = false;
  }

  /**
   * Select fields
   */
  select(fields) {
    this._select = fields;
    return this;
  }

  /**
   * Equal filter
   */
  eq(field, value) {
    this._filters.push({ method: 'eq', args: [field, value] });
    return this;
  }

  /**
   * Not equal filter
   */
  neq(field, value) {
    this._filters.push({ method: 'neq', args: [field, value] });
    return this;
  }

  /**
   * In array filter
   */
  in(field, values) {
    this._filters.push({ method: 'in', args: [field, values] });
    return this;
  }

  /**
   * Not in array filter
   */
  notIn(field, values) {
    this._filters.push({ method: 'not', args: [field, 'in', `(${values.join(',')})`] });
    return this;
  }

  /**
   * Is null filter
   */
  isNull(field) {
    this._filters.push({ method: 'is', args: [field, null] });
    return this;
  }

  /**
   * Is not null filter
   */
  isNotNull(field) {
    this._filters.push({ method: 'not', args: [field, 'is', null] });
    return this;
  }

  /**
   * Greater than
   */
  gt(field, value) {
    this._filters.push({ method: 'gt', args: [field, value] });
    return this;
  }

  /**
   * Greater than or equal
   */
  gte(field, value) {
    this._filters.push({ method: 'gte', args: [field, value] });
    return this;
  }

  /**
   * Less than
   */
  lt(field, value) {
    this._filters.push({ method: 'lt', args: [field, value] });
    return this;
  }

  /**
   * Less than or equal
   */
  lte(field, value) {
    this._filters.push({ method: 'lte', args: [field, value] });
    return this;
  }

  /**
   * Like filter (case-sensitive)
   */
  like(field, pattern) {
    this._filters.push({ method: 'like', args: [field, pattern] });
    return this;
  }

  /**
   * ILike filter (case-insensitive)
   */
  ilike(field, pattern) {
    this._filters.push({ method: 'ilike', args: [field, pattern] });
    return this;
  }

  /**
   * Or condition
   */
  or(condition) {
    this._filters.push({ method: 'or', args: [condition] });
    return this;
  }

  /**
   * Order by
   */
  order(field, options = {}) {
    this._orders.push({ field, options });
    return this;
  }

  /**
   * Limit results
   */
  limit(value) {
    this._limitValue = value;
    return this;
  }

  /**
   * Offset results (for pagination)
   */
  offset(value) {
    this._offsetValue = value;
    return this;
  }

  /**
   * Return single result
   */
  single() {
    this._singleMode = true;
    return this;
  }

  /**
   * Execute the query
   */
  async execute() {
    let query = this.client.from(this.table).select(this._select);

    // Apply filters
    for (const filter of this._filters) {
      query = query[filter.method](...filter.args);
    }

    // Apply ordering
    for (const order of this._orders) {
      query = query.order(order.field, order.options);
    }

    // Apply pagination
    if (this._limitValue) {
      query = query.limit(this._limitValue);
    }
    if (this._offsetValue) {
      query = query.range(this._offsetValue, this._offsetValue + (this._limitValue || 10) - 1);
    }

    // Single mode
    if (this._singleMode) {
      query = query.single();
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Database query error', {
        table: this.table,
        error: error.message,
        code: error.code
      });
      throw error;
    }

    return { data, count };
  }

  /**
   * Get all results
   */
  async get() {
    const { data } = await this.execute();
    return data;
  }

  /**
   * Get first result
   */
  async first() {
    this._singleMode = true;
    const { data } = await this.execute();
    return data;
  }
}

/**
 * Database client abstraction
 */
class DatabaseClient {
  constructor() {
    this.admin = supabaseAdmin;
    this.client = supabase;
  }

  /**
   * Create a query builder for a table
   */
  table(tableName) {
    return new QueryBuilder(this.admin, tableName);
  }

  /**
   * Raw query execution
   */
  async raw(sql, params = []) {
    const { data, error } = await this.admin.rpc('execute_sql', { query: sql, params });
    if (error) throw error;
    return data;
  }

  /**
   * Insert record(s)
   */
  async insert(tableName, data, options = {}) {
    const query = this.admin
      .from(tableName)
      .insert(data)
      .select(options.select || '*');

    const result = options.many ? query : query.single();
    const { data: resultData, error } = await result;

    if (error) {
      logger.error('Database insert error', {
        table: tableName,
        error: error.message,
        code: error.code
      });
      throw error;
    }

    return resultData;
  }

  /**
   * Update records
   */
  async update(tableName, data, filters = [], options = {}) {
    let query = this.admin
      .from(tableName)
      .update(data)
      .select(options.select || '*');

    for (const [field, value] of filters) {
      query = query.eq(field, value);
    }

    const { data: resultData, error } = await (options.many ? query : query.single());

    if (error) {
      logger.error('Database update error', {
        table: tableName,
        error: error.message,
        code: error.code
      });
      throw error;
    }

    return resultData;
  }

  /**
   * Delete records
   */
  async delete(tableName, filters = [], options = {}) {
    let query = this.admin
      .from(tableName)
      .delete()
      .select(options.select || '*');

    for (const [field, value] of filters) {
      query = query.eq(field, value);
    }

    const { data, error } = await (options.many ? query : query.single());

    if (error) {
      logger.error('Database delete error', {
        table: tableName,
        error: error.message,
        code: error.code
      });
      throw error;
    }

    return data;
  }

  /**
   * Count records
   */
  async count(tableName, filters = []) {
    let query = this.admin
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    for (const [field, value] of filters) {
      query = query.eq(field, value);
    }

    const { count, error } = await query;

    if (error) {
      logger.error('Database count error', {
        table: tableName,
        error: error.message
      });
      throw error;
    }

    return count;
  }

  /**
   * Execute a transaction (using Supabase RPC)
   */
  async transaction(callback) {
    // Note: Supabase doesn't support client-side transactions
    // This is a placeholder for when using Postgres functions
    // For now, we just execute the callback
    return callback(this);
  }

  /**
   * Check connection health
   */
  async healthCheck() {
    try {
      const { error } = await this.admin.from('agencies').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }
}

// Create singleton instance
const db = new DatabaseClient();

module.exports = {
  db,
  DatabaseClient,
  QueryBuilder
};
