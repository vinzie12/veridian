/**
 * User Validators
 * Input validation schemas for user routes
 */

const { z } = require('zod');
const { emailSchema, fullNameSchema, badgeNumberSchema, uuidSchema } = require('./auth.validator');

// ============================================
// ENUMS
// ============================================

const roleEnum = z.enum(['citizen', 'field_responder', 'dispatcher', 'commander', 'agency_admin', 'super_admin', 'viewer']);
const statusEnum = z.enum(['active', 'inactive', 'suspended', 'pending']);

// ============================================
// PARAMS SCHEMAS
// ============================================

const userIdParamsSchema = z.object({
  id: uuidSchema
});

const incidentIdParamsSchema = z.object({
  incidentId: uuidSchema
});

// ============================================
// QUERY SCHEMAS
// ============================================

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).optional()
});

const usersQuerySchema = paginationQuerySchema.extend({
  role: roleEnum.optional(),
  status: statusEnum.optional(),
  search: z.string().max(100).optional()
});

const auditLogsQuerySchema = paginationQuerySchema.extend({
  user_id: uuidSchema.optional(),
  action: z.string().max(50).optional(),
  resource_type: z.string().max(50).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional()
});

// ============================================
// BODY SCHEMAS
// ============================================

const provisionUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').optional().nullable(),
  full_name: fullNameSchema,
  badge_number: z.string().max(50).optional().nullable(),
  agency_id: uuidSchema,
  role: roleEnum.optional(),
  send_invite: z.boolean().optional()
});

const updateUserStatusSchema = z.object({
  status: statusEnum
});

const updateUserRoleSchema = z.object({
  role: roleEnum
});

const updateProfileSchema = z.object({
  full_name: fullNameSchema.optional(),
  badge_number: z.string().max(50).optional().nullable()
}).refine(data => data.full_name || data.badge_number !== undefined, {
  message: 'At least one field must be provided'
});

const callTokenSchema = z.object({
  incidentId: uuidSchema,
  role: z.enum(['admin', 'reporter']).optional()
});

// ============================================
// RESOURCE TYPE PARAMS
// ============================================

const auditLogParamsSchema = z.object({
  resourceType: z.string().min(1).max(50),
  resourceId: uuidSchema
});

module.exports = {
  // Enums
  roleEnum,
  statusEnum,
  
  // Params
  userIdParamsSchema,
  incidentIdParamsSchema,
  auditLogParamsSchema,
  
  // Query
  paginationQuerySchema,
  usersQuerySchema,
  auditLogsQuerySchema,
  
  // Body
  provisionUserSchema,
  updateUserStatusSchema,
  updateUserRoleSchema,
  updateProfileSchema,
  callTokenSchema
};
