/**
 * Auth Routes
 * Authentication endpoints with refresh token support
 */

const router = require('express').Router();
const { validateBody } = require('../middleware/validate');
const { authLimiter, createAccountLimiter, sensitiveLimiter } = require('../middleware/rateLimiter');
const { 
  loginSchema, 
  sendOtpSchema, 
  verifyOtpSchema, 
  legacyLoginSchema, 
  signupSchema, 
  refreshTokenSchema 
} = require('../validators/auth.validator');
const authController = require('../controllers/auth.controller');
const { 
  authenticate, 
  logout,
  logoutAll 
} = require('./auth.middleware');

// ============================================
// PUBLIC ROUTES (no authentication required)
// ============================================

router.post('/login', authLimiter, validateBody(loginSchema), authController.login);
router.post('/login/otp', sensitiveLimiter, validateBody(sendOtpSchema), authController.sendOtp);
router.post('/login/verify-otp', sensitiveLimiter, validateBody(verifyOtpSchema), authController.verifyOtp);
router.post('/login-legacy', authLimiter, validateBody(legacyLoginSchema), authController.legacyLogin);
router.post('/signup', createAccountLimiter, validateBody(signupSchema), authController.signup);
router.post('/refresh', authLimiter, validateBody(refreshTokenSchema), authController.refreshToken);

// ============================================
// PROTECTED ROUTES (authentication required)
// ============================================

router.get('/me', authenticate, authController.getCurrentUser);
router.post('/logout', authenticate, logout, authController.logoutResponse);
router.post('/logout-all', authenticate, logoutAll, authController.logoutResponse);

module.exports = router;
