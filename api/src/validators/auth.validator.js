/**
 * Auth Validators
 * Input validation schemas for auth routes
 */

const { z } = require('zod');

// ============================================
// COMMON PATTERNS (reusable)
// ============================================

const emailSchema = z.string().email('Invalid email format').max(255);

const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Simple password for login (less strict)
const loginPasswordSchema = z.string().min(1, 'Password is required');

const fullNameSchema = z.string().min(2, 'Full name must be at least 2 characters').max(100);
const badgeNumberSchema = z.string().min(1, 'Badge number is required').max(50);
const uuidSchema = z.string().uuid('Invalid ID format');

// ============================================
// AUTH SCHEMAS
// ============================================

const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema
});

const sendOtpSchema = z.object({
  email: emailSchema
});

const verifyOtpSchema = z.object({
  email: emailSchema,
  token: z.string().min(1, 'Token is required'),
  type: z.enum(['magiclink', 'signup', 'recovery', 'invite']).optional()
});

const legacyLoginSchema = z.object({
  badge_number: badgeNumberSchema,
  password: loginPasswordSchema
});

const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: fullNameSchema,
  badge_number: z.string().max(50).optional().nullable(),
  agency_id: uuidSchema.optional().nullable()
});

const setPasswordSchema = z.object({
  badge_number: badgeNumberSchema,
  password: passwordSchema
});

const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required')
});

// Profile update schema
const updateProfileSchema = z.object({
  full_name: fullNameSchema.optional(),
  badge_number: z.string().max(50).optional().nullable()
}).refine(data => data.full_name || data.badge_number !== undefined, {
  message: 'At least one field must be provided'
});

module.exports = {
  // Common patterns
  emailSchema,
  passwordSchema,
  fullNameSchema,
  badgeNumberSchema,
  uuidSchema,
  
  // Auth schemas
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  legacyLoginSchema,
  signupSchema,
  setPasswordSchema,
  refreshTokenSchema,
  updateProfileSchema
};
