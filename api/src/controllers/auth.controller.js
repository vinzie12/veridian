/**
 * Auth Controller
 * HTTP handlers for authentication routes
 */

const authService = require('../services/auth.service');
const authRepository = require('../repositories/auth.repository');
const { success, created, action } = require('../utils/response');
const { UnauthorizedError } = require('../utils/errors');
const { asyncHandler } = require('../middleware/asyncHandler');

class AuthController {
  /**
   * Login with email/password
   */
  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(action('login', 'Login successful', {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_at: result.expires_at,
      user: result.user
    }));
  });

  /**
   * Send OTP (magic link)
   */
  sendOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;
    await authService.sendOtp(email);
    
    res.json(success('OTP sent to your email', { email }));
  });

  /**
   * Verify OTP
   */
  verifyOtp = asyncHandler(async (req, res) => {
    const { email, token, type } = req.body;
    const result = await authService.verifyOtp(email, token, type || 'magiclink', {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(action('verify', 'Verification successful', {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      user: result.user
    }));
  });

  /**
   * Legacy login
   */
  legacyLogin = asyncHandler(async (req, res) => {
    const { badge_number, password } = req.body;
    const result = await authService.legacyLogin(badge_number, password, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(action('login', 'Login successful (legacy)', {
      token: result.token,
      user: result.user,
      warning: result.warning
    }));
  });

  /**
   * Sign up
   */
  signup = asyncHandler(async (req, res) => {
    const user = await authService.signup(req.body, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(201).json(created('Account created successfully. Please wait for approval.', { user }));
  });

  /**
   * Refresh access token
   */
  refreshToken = asyncHandler(async (req, res) => {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      throw new UnauthorizedError('Refresh token is required');
    }
    
    const { data, error } = await authRepository.refreshSession(refresh_token);
    
    if (error) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
    
    res.json(action('refresh', 'Token refreshed', {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email
      }
    }));
  });

  /**
   * Get current user
   */
  getCurrentUser = asyncHandler(async (req, res) => {
    const user = req.user;
    
    const responseData = { user };
    
    // Include refreshed tokens if they were refreshed
    if (req.tokenRefreshed) {
      responseData.access_token = req.token;
      responseData.refresh_token = req.refreshToken;
      responseData.token_refreshed = true;
    }
    
    res.json(success('User profile fetched', responseData));
  });

  /**
   * Logout response
   */
  logoutResponse = asyncHandler(async (req, res) => {
    const userId = req.user?.id || req.user?.user_id;
    
    await authService.logout(userId, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(action('logout', 'Logged out successfully'));
  });
}

module.exports = new AuthController();
