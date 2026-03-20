/**
 * Incident Validators
 * Input validation schemas for incident routes
 */

const { z } = require('zod');
const { uuidSchema } = require('./auth.validator');

// ============================================
// ENUMS
// ============================================

const severityEnum = z.enum(['low', 'medium', 'high', 'critical']);
const incidentStatusEnum = z.enum(['pending_review', 'acknowledged', 'in_progress', 'resolved', 'closed', 'cancelled', 'active']);

// ============================================
// PARAMS SCHEMAS
// ============================================

const incidentIdParamsSchema = z.object({
  id: uuidSchema
});

const trackingIdParamsSchema = z.object({
  tracking_id: z.string().length(8, 'Tracking ID must be 8 characters')
});

// ============================================
// QUERY SCHEMAS
// ============================================

const incidentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: incidentStatusEnum.optional(),
  severity: severityEnum.optional(),
  incident_type_id: uuidSchema.optional(),
  reporter_id: uuidSchema.optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  search: z.string().max(100).optional()
});

// ============================================
// EXTRA FIELDS SCHEMA (prevents injection)
// ============================================

const extraFieldsSchema = z.object({
  reporter_contact: z.string().max(100).optional().nullable(),
  additional_notes: z.string().max(2000).optional().nullable(),
  vehicle_info: z.object({
    make: z.string().max(50).optional(),
    model: z.string().max(50).optional(),
    plate: z.string().max(20).optional(),
    color: z.string().max(30).optional()
  }).optional().nullable(),
  location_details: z.string().max(500).optional().nullable(),
  source: z.string().max(50).optional()
}).passthrough(); // Allow additional fields but validate known ones

// ============================================
// BODY SCHEMAS
// ============================================

const createIncidentSchema = z.object({
  incident_type_id: uuidSchema,
  severity: severityEnum,
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  extra_fields: extraFieldsSchema.optional()
});

const createPublicIncidentSchema = z.object({
  incident_type_id: uuidSchema,
  severity: severityEnum,
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  reporter_contact: z.string().max(100).optional().nullable(),
  extra_fields: extraFieldsSchema.optional()
});

const updateIncidentSchema = z.object({
  status: incidentStatusEnum.optional(),
  severity: severityEnum.optional(),
  description: z.string().max(5000).optional().nullable(),
  extra_fields: extraFieldsSchema.optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

// Legacy tracking ID schema (for backward compatibility)
const trackingIdSchema = trackingIdParamsSchema;

module.exports = {
  // Enums
  severityEnum,
  incidentStatusEnum,
  
  // Params
  incidentIdParamsSchema,
  trackingIdParamsSchema,
  
  // Query
  incidentsQuerySchema,
  
  // Body
  createIncidentSchema,
  createPublicIncidentSchema,
  updateIncidentSchema,
  extraFieldsSchema,
  
  // Legacy
  trackingIdSchema
};
