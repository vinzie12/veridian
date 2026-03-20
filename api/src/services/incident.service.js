/**
 * Incident Service
 * Business logic for incident operations
 */

const incidentRepository = require('../repositories/incident.repository');
const userRepository = require('../repositories/user.repository');
const auditRepository = require('../repositories/audit.repository');
const { generateUniqueTrackingId } = require('../utils/trackingId');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');
const { canCrossAgency, hasPermission } = require('../config/permissions');

class IncidentService {
  /**
   * Get incidents visible to user
   * @param {object} user - Current user
   * @param {object} options - Query options
   * @returns {Array} Incidents
   */
  async getIncidents(user, options = {}) {
    const crossAgency = canCrossAgency(user.role);
    
    let incidents;
    
    // Citizens see their own reports and public incidents
    if (user.role === 'citizen') {
      incidents = await incidentRepository.findVisibleToCitizen(user.id, options);
    } else if (options.submitted_by === 'me') {
      // User viewing their own reports
      incidents = await incidentRepository.findByAgency(null, {
        reporterId: user.id,
        ...options
      });
    } else {
      incidents = await incidentRepository.findVisibleToUser(
        user.agency_id,
        crossAgency,
        options
      );
    }

    // Handle null/undefined or paginated results
    if (!incidents) {
      return [];
    }
    
    // Handle paginated result
    if (incidents.data && incidents.pagination) {
      return {
        ...incidents,
        data: incidents.data.map(incident => this._transformIncident(incident))
      };
    }

    // Transform data
    return incidents.map(incident => this._transformIncident(incident));
  }

  /**
   * Get single incident by ID
   * @param {string} id - Incident ID
   * @param {object} user - Current user
   * @returns {object} Incident
   */
  async getIncident(id, user) {
    const incident = await incidentRepository.findWithDetails(id);
    
    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    // Check access
    const crossAgency = canCrossAgency(user.role);
    const hasAccess = incident.agency_id === user.agency_id ||
                      incident.agency_id === null ||
                      crossAgency;

    if (!hasAccess) {
      throw new ForbiddenError('Access denied to this incident');
    }

    return this._transformIncident(incident);
  }

  /**
   * Create a new incident
   * @param {object} data - Incident data
   * @param {object} user - Current user
   * @param {object} context - Request context
   * @returns {object} Created incident
   */
  async createIncident(data, user, context = {}) {
    const { incident_type_id, severity, latitude, longitude, address, description, extra_fields } = data;

    if (!incident_type_id || !severity) {
      throw new ValidationError('incident_type_id and severity are required');
    }

    // Generate tracking ID for citizens
    let trackingId = null;
    if (user.role === 'citizen') {
      trackingId = await generateUniqueTrackingId(
        (id) => incidentRepository.trackingIdExists(id)
      );
    }

    const incident = await incidentRepository.create({
      agency_id: user.agency_id,
      reporter_id: user.id,
      incident_type_id,
      tracking_id: trackingId,
      severity,
      latitude,
      longitude,
      address,
      description,
      extra_fields: extra_fields || {},
      status: 'pending_review'
    });

    // Log audit
    await auditRepository.log({
      userId: user.id,
      action: 'create_incident',
      resourceType: 'incident',
      resourceId: incident.id,
      details: { incident_type_id, severity },
      ipAddress: context.ip,
      userAgent: context.userAgent
    });

    return {
      ...incident,
      tracking_id: trackingId
    };
  }

  /**
   * Create public incident (anonymous)
   * @param {object} data - Incident data
   * @returns {object} Created incident with tracking ID
   */
  async createPublicIncident(data) {
    const { incident_type_id, severity, latitude, longitude, address, description, reporter_contact, extra_fields } = data;

    if (!incident_type_id || !severity) {
      throw new ValidationError('incident_type_id and severity are required');
    }

    // Generate unique tracking ID
    const trackingId = await generateUniqueTrackingId(
      (id) => incidentRepository.trackingIdExists(id)
    );

    if (!trackingId) {
      throw new ValidationError('Failed to generate tracking ID');
    }

    const incident = await incidentRepository.create({
      agency_id: null,
      reporter_id: null,
      incident_type_id,
      tracking_id: trackingId,
      severity,
      latitude,
      longitude,
      address,
      description,
      extra_fields: {
        ...extra_fields,
        reporter_contact: reporter_contact || null,
        source: 'public_report'
      },
      status: 'pending_review'
    });

    return {
      incident,
      tracking_id: trackingId
    };
  }

  /**
   * Get public incident by tracking ID
   * @param {string} trackingId - Tracking ID
   * @returns {object} Incident
   */
  async getPublicIncident(trackingId) {
    const incident = await incidentRepository.findByTrackingId(trackingId);
    
    if (!incident) {
      throw new NotFoundError('Incident not found. Check your tracking ID.');
    }

    return incident;
  }

  /**
   * Update incident
   * @param {string} id - Incident ID
   * @param {object} data - Update data
   * @param {object} user - Current user
   * @param {object} context - Request context
   * @returns {object} Updated incident
   */
  async updateIncident(id, data, user, context = {}) {
    const { status, description, extra_fields } = data;

    // Get incident first
    const incident = await incidentRepository.findById(id);
    
    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    // Check access
    const crossAgency = canCrossAgency(user.role);
    const hasAccess = incident.agency_id === user.agency_id ||
                      incident.agency_id === null ||
                      crossAgency;

    if (!hasAccess) {
      throw new ForbiddenError('Access denied to this incident');
    }

    // Update
    const updated = await incidentRepository.updateById(id, {
      status,
      description,
      extra_fields,
      updated_at: new Date().toISOString()
    });

    // Log audit
    await auditRepository.log({
      userId: user.id,
      action: 'update_incident',
      resourceType: 'incident',
      resourceId: id,
      details: { status, updates: Object.keys(data) },
      ipAddress: context.ip,
      userAgent: context.userAgent
    });

    return updated;
  }

  /**
   * Delete incident
   * @param {string} id - Incident ID
   * @param {object} user - Current user
   * @param {object} context - Request context
   * @returns {object} Deleted incident
   */
  async deleteIncident(id, user, context = {}) {
    const incident = await incidentRepository.deleteWithAgencyCheck(id, user.agency_id);
    
    if (!incident) {
      throw new NotFoundError('Incident not found or no access');
    }

    // Log audit
    await auditRepository.log({
      userId: user.id,
      action: 'delete_incident',
      resourceType: 'incident',
      resourceId: id,
      details: { incident_type: incident.incident_type },
      ipAddress: context.ip,
      userAgent: context.userAgent
    });

    return incident;
  }

  /**
   * Transform incident for response
   * @private
   */
  _transformIncident(incident) {
    return {
      ...incident,
      incident_type: incident.incident_types?.name || incident.incident_type || 'unknown',
      incident_icon: incident.incident_types?.icon || '⚠️',
      incident_color: incident.incident_types?.color_code || '#666'
    };
  }
}

module.exports = new IncidentService();
