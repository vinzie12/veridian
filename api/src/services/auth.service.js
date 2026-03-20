/**
 * Auth Service
 * Business logic for authentication operations
 */

const userRepository = require('../repositories/user.repository');
const auditRepository = require('../repositories/audit.repository');
const authAttemptRepository = require('../repositories/authAttempt.repository');
const authRepository = require('../repositories/auth.repository');
const { UnauthorizedError, ForbiddenError, ConflictError } = require('../utils/errors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

class AuthService {
  /**
   * Login with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {object} context - Request context (ip, userAgent)
   * @returns {object} Login result with tokens and user
   */
  async login(email, password, context = {}) {
    // SECURITY: Check for account lockout
    const failures = await authAttemptRepository.getFailureCount(email, context.ip);
    if (failures?.count >= MAX_FAILED_ATTEMPTS) {
      const lockoutEnds = new Date(failures.last_attempt).getTime() + LOCKOUT_DURATION_MS;
      if (Date.now() < lockoutEnds) {
        const remainingMinutes = Math.ceil((lockoutEnds - Date.now()) / 60000);
        throw new ForbiddenError(`Account temporarily locked. Try again in ${remainingMinutes} minutes.`);
      }
      // Lockout expired, clear old attempts
      await authAttemptRepository.clearFailures(email, context.ip);
    }

    // Sign in with Supabase Auth via repository
    const { data, error } = await authRepository.signInWithPassword(email, password);

    if (error) {
      // SECURITY: Record failed attempt
      await authAttemptRepository.recordFailure(email, context.ip);
      
      // SECURITY: Log failed auth attempt
      await auditRepository.log({
        userId: null,
        action: 'login_failed',
        resourceType: 'session',
        details: { email, reason: error.message },
        ipAddress: context.ip,
        userAgent: context.userAgent
      });
      
      throw new UnauthorizedError(error.message);
    }

    // Get user profile
    const profile = await userRepository.findWithAgency(data.user.id);
    if (!profile) {
      throw new ForbiddenError('Profile not provisioned. Contact your administrator.');
    }

    // SECURITY: Clear failed attempts on successful login
    await authAttemptRepository.clearFailures(email, context.ip);

    // Log audit
    await auditRepository.log({
      userId: profile.id,
      action: 'login',
      resourceType: 'session',
      details: { method: 'password' },
      ipAddress: context.ip,
      userAgent: context.userAgent
    });

    // Update last active
    await userRepository.updateLastActive(profile.id);

    logger.info('User logged in', { userId: profile.id, method: 'password' });

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: this._formatUser(profile, data.user.email)
    };
  }

  /**
   * Send OTP (magic link) to email
   * @param {string} email - User email
   * @returns {void}
   */
  async sendOtp(email) {
    // Check if user has a profile
    const profile = await userRepository.findByEmail(email);
    if (!profile) {
      throw new ForbiddenError('Profile not provisioned. Contact your administrator.');
    }

    // Send OTP via repository
    const { error } = await authRepository.signInWithOtp(email, {
      redirectTo: process.env.INVITE_REDIRECT_URL
    });

    if (error) {
      throw new UnauthorizedError(error.message);
    }
    
    logger.info('OTP sent', { email });
  }

  /**
   * Verify OTP token
   * @param {string} email - User email
   * @param {string} token - OTP token
   * @param {string} type - Token type
   * @param {object} context - Request context
   * @returns {object} Verification result
   */
  async verifyOtp(email, token, type = 'magiclink', context = {}) {
    const { data, error } = await authRepository.verifyOtp(email, token, type);

    if (error) {
      throw new UnauthorizedError(error.message);
    }

    // Get profile
    const profile = await userRepository.findWithAgency(data.user.id);
    if (!profile) {
      throw new ForbiddenError('Profile not provisioned.');
    }

    // Log audit
    await auditRepository.log({
      userId: profile.id,
      action: 'login',
      resourceType: 'session',
      details: { method: 'otp' },
      ipAddress: context.ip,
      userAgent: context.userAgent
    });

    logger.info('User logged in via OTP', { userId: profile.id });

    return {
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      user: this._formatUser(profile, email)
    };
  }

  /**
   * Legacy login with badge number and password
   * @param {string} badgeNumber - User badge number
   * @param {string} password - User password
   * @param {object} context - Request context
   * @returns {object} Login result
   */
  async legacyLogin(badgeNumber, password, context = {}) {
    // SECURITY: Check for account lockout
    const failures = await authAttemptRepository.getFailureCount(badgeNumber, context.ip);
    if (failures?.count >= MAX_FAILED_ATTEMPTS) {
      const lockoutEnds = new Date(failures.last_attempt).getTime() + LOCKOUT_DURATION_MS;
      if (Date.now() < lockoutEnds) {
        const remainingMinutes = Math.ceil((lockoutEnds - Date.now()) / 60000);
        throw new ForbiddenError(`Account temporarily locked. Try again in ${remainingMinutes} minutes.`);
      }
      await authAttemptRepository.clearFailures(badgeNumber, context.ip);
    }

    const user = await userRepository.findByBadgeNumber(badgeNumber);
    
    if (!user || !user.password_hash) {
      // SECURITY: Record failed attempt
      await authAttemptRepository.recordFailure(badgeNumber, context.ip);
      await auditRepository.log({
        userId: null,
        action: 'login_failed',
        resourceType: 'session',
        details: { badge_number: badgeNumber, method: 'legacy' },
        ipAddress: context.ip,
        userAgent: context.userAgent
      });
      throw new UnauthorizedError('Invalid badge number or password');
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      // SECURITY: Record failed attempt
      await authAttemptRepository.recordFailure(badgeNumber, context.ip);
      await auditRepository.log({
        userId: user.id,
        action: 'login_failed',
        resourceType: 'session',
        details: { badge_number: badgeNumber, method: 'legacy' },
        ipAddress: context.ip,
        userAgent: context.userAgent
      });
      throw new UnauthorizedError('Invalid badge number or password');
    }

    // SECURITY: Clear failed attempts on successful login
    await authAttemptRepository.clearFailures(badgeNumber, context.ip);

    // Generate legacy JWT with token version for revocation
    const token = jwt.sign(
      {
        user_id: user.id,
        agency_id: user.agency_id,
        role: user.role,
        version: user.token_version || 0 // SECURITY: Include version for revocation
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Log audit
    await auditRepository.log({
      userId: user.id,
      action: 'login',
      resourceType: 'session',
      details: { method: 'legacy' },
      ipAddress: context.ip,
      userAgent: context.userAgent
    });

    logger.info('User logged in via legacy', { userId: user.id });

    return {
      token,
      user: this._formatUser(user, user.email),
      warning: 'This login method will be deprecated. Please migrate to email login.'
    };
  }

  /**
   * Sign up new user
   * @param {object} userData - User data
   * @param {object} context - Request context
   * @returns {object} Created user
   */
  async signup(userData, context = {}) {
    const { email, password, full_name, badge_number, agency_id } = userData;

    // SECURITY: Force citizen role - users cannot self-assign elevated roles
    const role = 'citizen';

    // Create auth user with Supabase via repository
    const { user: authUser, error: authError } = await authRepository.createUser({
      email,
      password,
      emailConfirm: true,
      metadata: { full_name, badge_number }
    });

    if (authError) {
      throw new ConflictError(authError.message);
    }

    // Check badge number uniqueness
    if (badge_number) {
      const isUnique = await userRepository.isBadgeNumberUnique(badge_number, authUser.id);
      if (!isUnique) {
        // Rollback auth user
        await authRepository.deleteUser(authUser.id);
        throw new ConflictError('Badge number already registered');
      }
    }

    // Create profile
    const profile = await userRepository.create({
      id: authUser.id,
      email,
      full_name,
      badge_number,
      role: 'citizen', // SECURITY: Always citizen for self-signup
      agency_id: null, // Citizens have no agency
      status: 'pending' // SECURITY: Require admin approval
    });

    // Log audit
    await auditRepository.log({
      userId: profile.id,
      action: 'signup',
      resourceType: 'user',
      resourceId: profile.id,
      details: { role, agency_id },
      ipAddress: context.ip,
      userAgent: context.userAgent
    });

    logger.info('User signed up', { userId: profile.id, email });

    return this._formatUser(profile, email);
  }

  /**
   * Verify Supabase JWT and load profile
   * @param {string} token - JWT token
   * @returns {object} User profile
   */
  async verifyToken(token) {
    const { user, error } = await authRepository.getUser(token);

    if (error || !user) {
      return null;
    }

    const profile = await userRepository.findWithAgency(user.id);
    if (!profile) {
      return null;
    }

    // Update last active
    await userRepository.updateLastActive(profile.id);

    return this._formatUser(profile, user.email);
  }

  /**
   * Verify legacy JWT
   * @param {string} token - JWT token
   * @returns {object} Decoded user
   */
  verifyLegacyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return null;
    }
  }

  /**
   * Refresh session
   * @param {string} refreshToken - Refresh token
   * @returns {object} New session
   */
  async refreshSession(refreshToken) {
    const { data, error } = await authRepository.refreshSession(refreshToken);
    
    if (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    
    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at
    };
  }

  /**
   * Logout user
   * @param {string} userId - User ID
   * @param {object} context - Request context
   */
  async logout(userId, context = {}) {
    await authRepository.signOut();
    
    await auditRepository.log({
      userId,
      action: 'logout',
      resourceType: 'session',
      ipAddress: context.ip,
      userAgent: context.userAgent
    });
    
    logger.info('User logged out', { userId });
  }

  /**
   * Format user for response
   * @private
   */
  _formatUser(profile, email) {
    return {
      id: profile.id,
      email: email || profile.email,
      full_name: profile.full_name,
      badge_number: profile.badge_number,
      role: profile.role,
      agency: profile.agencies?.name,
      agency_id: profile.agency_id,
      status: profile.status
    };
  }
}

// Export class for testing, singleton instance for production
module.exports = new AuthService();
module.exports.AuthService = AuthService;
