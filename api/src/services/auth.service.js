/**
 * Auth Service
 * Business logic for authentication operations
 * Uses Supabase Auth exclusively
 */

const userRepository = require('../repositories/user.repository');
const auditRepository = require('../repositories/audit.repository');
const authAttemptRepository = require('../repositories/authAttempt.repository');
const authRepository = require('../repositories/auth.repository');
const { UnauthorizedError, ForbiddenError, ConflictError } = require('../utils/errors');
const logger = require('../utils/logger');

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

class AuthService {
  /**
   * Login with email and password
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
      await authAttemptRepository.clearFailures(email, context.ip);
    }

    // Sign in with Supabase Auth
    const { data, error } = await authRepository.signInWithPassword(email, password);

    if (error) {
      await authAttemptRepository.recordFailure(email, context.ip);
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

    const profile = await userRepository.findWithAgency(data.user.id);
    if (!profile) {
      throw new ForbiddenError('Profile not provisioned. Contact your administrator.');
    }

    await authAttemptRepository.clearFailures(email, context.ip);
    await auditRepository.log({
      userId: profile.id,
      action: 'login',
      resourceType: 'session',
      details: { method: 'password' },
      ipAddress: context.ip,
      userAgent: context.userAgent
    });
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
   */
  async sendOtp(email) {
    const profile = await userRepository.findByEmail(email);
    if (!profile) {
      throw new ForbiddenError('Profile not provisioned. Contact your administrator.');
    }

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
   */
  async verifyOtp(email, token, type = 'magiclink', context = {}) {
    const { data, error } = await authRepository.verifyOtp(email, token, type);

    if (error) {
      throw new UnauthorizedError(error.message);
    }

    const profile = await userRepository.findWithAgency(data.user.id);
    if (!profile) {
      throw new ForbiddenError('Profile not provisioned.');
    }

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
   * Sign up new user
   */
  async signup(userData, context = {}) {
    const { email, password, full_name, badge_number, agency_id } = userData;

    const role = 'citizen';

    const { user: authUser, error: authError } = await authRepository.createUser({
      email,
      password,
      emailConfirm: true,
      metadata: { full_name, badge_number }
    });

    if (authError) {
      throw new ConflictError(authError.message);
    }

    if (badge_number) {
      const isUnique = await userRepository.isBadgeNumberUnique(badge_number, authUser.id);
      if (!isUnique) {
        await authRepository.deleteUser(authUser.id);
        throw new ConflictError('Badge number already registered');
      }
    }

    const profile = await userRepository.create({
      id: authUser.id,
      email,
      full_name,
      badge_number,
      role: 'citizen',
      agency_id: null,
      status: 'pending'
    });

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

    await userRepository.updateLastActive(profile.id);

    return this._formatUser(profile, user.email);
  }

  /**
   * Refresh session
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

module.exports = new AuthService();
module.exports.AuthService = AuthService;
