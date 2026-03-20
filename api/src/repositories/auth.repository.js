/**
 * Auth Repository
 * Abstraction for Supabase Auth operations
 * Enables testing with mock implementations
 */

const { supabaseAdmin, supabase } = require('../config/supabase');
const logger = require('../utils/logger');

class AuthRepository {
  constructor() {
    this.admin = supabaseAdmin.auth.admin;
    this.client = supabase.auth;
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  /**
   * Sign in with email and password
   */
  async signInWithPassword(email, password) {
    const { data, error } = await this.client.signInWithPassword({ email, password });
    
    if (error) {
      logger.warn('Sign in failed', { email, error: error.message });
      return { error, data: null };
    }
    
    return { data, error: null };
  }

  /**
   * Sign in with OTP (magic link)
   */
  async signInWithOtp(email, options = {}) {
    const { data, error } = await this.client.signInWithOtp({
      email,
      options: {
        emailRedirectTo: options.redirectTo
      }
    });
    
    if (error) {
      logger.warn('OTP send failed', { email, error: error.message });
      return { error, data: null };
    }
    
    return { data, error: null };
  }

  /**
   * Verify OTP token
   */
  async verifyOtp(email, token, type = 'magiclink') {
    const { data, error } = await this.client.verifyOtp({
      email,
      token,
      type
    });
    
    if (error) {
      logger.warn('OTP verify failed', { email, type, error: error.message });
      return { error, data: null };
    }
    
    return { data, error: null };
  }

  /**
   * Sign out current session
   */
  async signOut() {
    const { error } = await this.client.signOut();
    return { error };
  }

  /**
   * Refresh session
   */
  async refreshSession(refreshToken) {
    const { data, error } = await this.client.refreshSession({
      refresh_token: refreshToken
    });
    
    if (error) {
      logger.warn('Session refresh failed', { error: error.message });
      return { error, data: null };
    }
    
    return { data, error: null };
  }

  // ============================================
  // TOKEN VERIFICATION
  // ============================================

  /**
   * Get user from token
   */
  async getUser(token) {
    const { data: { user }, error } = await this.client.getUser(token);
    
    if (error) {
      return { user: null, error };
    }
    
    return { user, error: null };
  }

  /**
   * Get current session
   */
  async getSession() {
    const { data: { session }, error } = await this.client.getSession();
    return { session, error };
  }

  // ============================================
  // ADMIN OPERATIONS
  // ============================================

  /**
   * Create user (admin)
   */
  async createUser(options) {
    const { data, error } = await this.admin.createUser({
      email: options.email,
      password: options.password,
      email_confirm: options.emailConfirm ?? true,
      user_metadata: options.metadata || {}
    });
    
    if (error) {
      logger.error('User creation failed', { email: options.email, error: error.message });
      return { error, user: null };
    }
    
    return { user: data.user, error: null };
  }

  /**
   * Invite user by email (admin)
   */
  async inviteUserByEmail(email, options = {}) {
    const { data, error } = await this.admin.inviteUserByEmail(email, {
      redirectTo: options.redirectTo,
      data: options.metadata
    });
    
    if (error) {
      logger.error('User invite failed', { email, error: error.message });
      return { error, user: null };
    }
    
    return { user: data.user, error: null };
  }

  /**
   * List users (admin)
   */
  async listUsers(options = {}) {
    const { data, error } = await this.admin.listUsers({
      page: options.page || 1,
      perPage: options.perPage || 50,
      filters: options.filters
    });
    
    if (error) {
      logger.error('List users failed', { error: error.message });
      return { error, users: null };
    }
    
    return { users: data.users, error: null };
  }

  /**
   * Get user by ID (admin)
   */
  async getUserById(userId) {
    const { data, error } = await this.admin.getUserById(userId);
    
    if (error) {
      return { user: null, error };
    }
    
    return { user: data.user, error: null };
  }

  /**
   * Update user (admin)
   */
  async updateUser(userId, options) {
    const { data, error } = await this.admin.updateUserById(userId, {
      email: options.email,
      password: options.password,
      user_metadata: options.metadata,
      email_confirm: options.emailConfirm
    });
    
    if (error) {
      logger.error('User update failed', { userId, error: error.message });
      return { error, user: null };
    }
    
    return { user: data.user, error: null };
  }

  /**
   * Delete user (admin)
   */
  async deleteUser(userId) {
    const { error } = await this.admin.deleteUser(userId);
    
    if (error) {
      logger.error('User deletion failed', { userId, error: error.message });
      return { error };
    }
    
    return { error: null };
  }

  // ============================================
  // PASSWORD RESET
  // ============================================

  /**
   * Send password reset email
   */
  async resetPassword(email, options = {}) {
    const { data, error } = await this.client.resetPasswordForEmail(email, {
      redirectTo: options.redirectTo
    });
    
    if (error) {
      logger.warn('Password reset failed', { email, error: error.message });
      return { error, data: null };
    }
    
    return { data, error: null };
  }

  /**
   * Update password (for current user)
   */
  async updatePassword(newPassword) {
    const { data, error } = await this.client.updateUser({
      password: newPassword
    });
    
    if (error) {
      logger.warn('Password update failed', { error: error.message });
      return { error, user: null };
    }
    
    return { user: data.user, error: null };
  }
}

// Export class for testing, singleton instance for production
module.exports = new AuthRepository();
module.exports.AuthRepository = AuthRepository;
