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

  sendOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;
    await authService.sendOtp(email);
    res.json(success('OTP sent to your email', { email }));
  });

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

  signup = asyncHandler(async (req, res) => {
    const user = await authService.signup(req.body, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(201).json(created('Account created successfully. Please wait for approval.', { user }));
  });

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

  getCurrentUser = asyncHandler(async (req, res) => {
    const user = req.user;
    
    const responseData = { user };
    
    if (req.tokenRefreshed) {
      responseData.access_token = req.token;
      responseData.refresh_token = req.refreshToken;
      responseData.token_refreshed = true;
    }
    
    res.json(success('User profile fetched', responseData));
  });

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

module.exports = new AuthController();
