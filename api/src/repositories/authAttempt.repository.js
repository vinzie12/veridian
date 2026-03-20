/**
 * Auth Attempt Repository
 * Tracks failed authentication attempts for account lockout
 */

const { supabaseAdmin } = require('../config/supabase');

class AuthAttemptRepository {
  /**
   * Record a failed authentication attempt
   * @param {string} email - Email attempted
   * @param {string} ip - IP address
   * @returns {Promise<object>}
   */
  async recordFailure(email, ip) {
    const key = `${email.toLowerCase()}:${ip}`;
    const now = new Date().toISOString();

    // Try to increment existing record
    const { data: existing } = await supabaseAdmin
      .from('auth_attempts')
      .select('id, count')
      .eq('key', key)
      .single();

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('auth_attempts')
        .update({
          count: existing.count + 1,
          last_attempt: now
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }

    // Create new record
    const { data, error } = await supabaseAdmin
      .from('auth_attempts')
      .insert({
        key,
        email: email.toLowerCase(),
        ip_address: ip,
        count: 1,
        last_attempt: now
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get failure count for email+IP combination
   * @param {string} email - Email
   * @param {string} ip - IP address
   * @returns {Promise<object|null>}
   */
  async getFailureCount(email, ip) {
    const key = `${email.toLowerCase()}:${ip}`;
    
    const { data, error } = await supabaseAdmin
      .from('auth_attempts')
      .select('count, last_attempt')
      .eq('key', key)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Clear failures after successful login
   * @param {string} email - Email
   * @param {string} ip - IP address
   * @returns {Promise<void>}
   */
  async clearFailures(email, ip) {
    const key = `${email.toLowerCase()}:${ip}`;
    
    await supabaseAdmin
      .from('auth_attempts')
      .delete()
      .eq('key', key);
  }

  /**
   * Clean up old attempts (run periodically)
   * @param {number} olderThanMinutes - Minutes threshold
   * @returns {Promise<void>}
   */
  async cleanupOldAttempts(olderThanMinutes = 30) {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();
    
    await supabaseAdmin
      .from('auth_attempts')
      .delete()
      .lt('last_attempt', cutoff);
  }
}

module.exports = new AuthAttemptRepository();
