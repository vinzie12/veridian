/**
 * Incident Controller
 * HTTP handlers for incident routes
 */

const incidentService = require('../services/incident.service');
const { success, created, updated, deleted, list, item, paginated } = require('../utils/response');
const { asyncHandler } = require('../middleware/asyncHandler');

class IncidentController {
  /**
   * Get all incidents
   */
  getIncidents = asyncHandler(async (req, res) => {
    const { page, limit, status, severity, incident_type_id, reporter_id, search } = req.query;
    const result = await incidentService.getIncidents(req.user, {
      page,
      limit,
      status,
      severity,
      incident_type_id,
      reporter_id,
      search
    });
    
    // Handle array result directly
    if (Array.isArray(result)) {
      return res.json(list('incidents', result));
    }
    
    // Handle paginated result from repository
    if (result && result.pagination) {
      return res.json(paginated('Incidents fetched successfully', result.data || [], result.pagination));
    }
    
    // Handle legacy format with meta
    if (result && result.meta) {
      return res.json(paginated('Incidents fetched successfully', result.incidents || result.data || [], {
        page: result.meta.page,
        limit: result.meta.limit,
        total: result.meta.total
      }));
    }
    
    // Fallback - ensure we always return an array
    return res.json(list('incidents', result?.incidents || result?.data || []));
  });

  /**
   * Get single incident
   */
  getIncident = asyncHandler(async (req, res) => {
    const incident = await incidentService.getIncident(req.params.id, req.user);
    
    res.json(item('Incident', { incident }));
  });

  /**
   * Create incident
   */
  createIncident = asyncHandler(async (req, res) => {
    const incident = await incidentService.createIncident(req.body, req.user, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(201).json(created('Incident created successfully', incident));
  });

  /**
   * Create public incident (anonymous)
   */
  createPublicIncident = asyncHandler(async (req, res) => {
    const result = await incidentService.createPublicIncident(req.body);
    
    res.status(201).json(created('Incident reported successfully. Use the tracking ID to check status.', result));
  });

  /**
   * Get public incident by tracking ID
   */
  getPublicIncident = asyncHandler(async (req, res) => {
    const incident = await incidentService.getPublicIncident(req.params.tracking_id);
    
    res.json(item('Incident', { incident }));
  });

  /**
   * Update incident
   */
  updateIncident = asyncHandler(async (req, res) => {
    const incident = await incidentService.updateIncident(
      req.params.id,
      req.body,
      req.user,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    
    res.json(updated('Incident updated successfully', { incident }));
  });

  /**
   * Update incident status
   */
  updateIncidentStatus = asyncHandler(async (req, res) => {
    const incident = await incidentService.updateIncidentStatus(
      req.params.id,
      req.body.status,
      req.user,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    
    res.json(updated('Incident status updated successfully', { incident }));
  });

  /**
   * Delete incident
   */
  deleteIncident = asyncHandler(async (req, res) => {
    await incidentService.deleteIncident(
      req.params.id,
      req.user,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    
    res.json(deleted('Incident deleted successfully'));
  });
}

module.exports = new IncidentController();
