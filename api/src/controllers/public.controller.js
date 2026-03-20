/**
 * Public Controller
 * Handles public endpoints that don't require authentication
 */

const { supabaseAdmin } = require('../config/supabase');
const { success } = require('../utils/response');
const { DatabaseError, fromSupabaseError } = require('../utils/errors');
const { asyncHandler } = require('../middleware/asyncHandler');

class PublicController {
  /**
   * Health check endpoint
   */
  healthCheck(req, res) {
    res.json({
      status: 'ok',
      message: 'Veridian API is running!',
      version: '2.0.0'
    });
  }

  /**
   * Get public configuration
   */
  getConfig(req, res) {
    const isProduction = process.env.NODE_ENV === 'production';
    const apiUrl = process.env.API_URL || (isProduction 
      ? `https://${req.headers.host}`
      : `http://${req.headers.host?.replace(':3000', '') || 'localhost'}:3000`);

    res.json({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      apiUrl
    });
  }

  /**
   * Get all agencies (public)
   */
  getAgencies = asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('agencies')
      .select('id, name, type, region')
      .eq('is_active', true)
      .order('name');

    if (error) throw fromSupabaseError(error);
    
    res.json(success('Agencies fetched', { agencies: data || [] }));
  });

  /**
   * Get incident types (public)
   */
  getIncidentTypes = asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('incident_types')
      .select('id, name, description, color_code, icon, sort_order')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw fromSupabaseError(error);
    
    res.json(success('Incident types fetched', { incidentTypes: data || [] }));
  });
}

module.exports = new PublicController();
