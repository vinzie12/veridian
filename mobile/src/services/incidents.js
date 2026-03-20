/**
 * Incidents Service
 * Handles all incident-related API calls
 */

import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './api';
import { log } from '../config/environment';

/**
 * Get incidents with filters and pagination
 */
export const getIncidents = async (options = {}) => {
  const { 
    page = 1, 
    limit = 20, 
    status, 
    severity, 
    incident_type_id,
    reporter_id,
    search 
  } = options;

  const params = { page, limit };
  if (status) params.status = status;
  if (severity) params.severity = severity;
  if (incident_type_id) params.incident_type_id = incident_type_id;
  if (reporter_id) params.reporter_id = reporter_id;
  if (search) params.search = search;

  const response = await apiGet('/incidents', params);
  
  log.debug('Fetched incidents:', response.data?.length);
  
  return response;
};

/**
 * Get single incident by ID
 */
export const getIncident = async (incidentId) => {
  const response = await apiGet(`/incidents/${incidentId}`);
  
  log.debug('Fetched incident:', incidentId);
  
  return response.data;
};

/**
 * Create new incident
 */
export const createIncident = async (incidentData) => {
  const response = await apiPost('/incidents', incidentData);
  
  log.info('Created incident:', response.data?.id);
  
  return response.data;
};

/**
 * Create public incident (anonymous)
 */
export const createPublicIncident = async (incidentData) => {
  const response = await apiPost('/incidents/public', incidentData, { skipAuth: true });
  
  log.info('Created public incident:', response.data?.tracking_id);
  
  return response.data;
};

/**
 * Get public incident by tracking ID
 */
export const getPublicIncident = async (trackingId) => {
  const response = await apiGet(`/incidents/public/${trackingId}`, null, { skipAuth: true });
  
  return response.data;
};

/**
 * Update incident
 */
export const updateIncident = async (incidentId, updates) => {
  const response = await apiPatch(`/incidents/${incidentId}`, updates);
  
  log.info('Updated incident:', incidentId);
  
  return response.data;
};

/**
 * Update incident status
 */
export const updateIncidentStatus = async (incidentId, status) => {
  const response = await apiPatch(`/incidents/${incidentId}/status`, { status });
  
  log.info('Updated incident status:', incidentId, status);
  
  return response.data;
};

/**
 * Delete incident
 */
export const deleteIncident = async (incidentId) => {
  await apiDelete(`/incidents/${incidentId}`);
  
  log.info('Deleted incident:', incidentId);
  
  return true;
};

/**
 * Get incident types
 */
export const getIncidentTypes = async () => {
  const response = await apiGet('/incident-types');
  
  return response.data || [];
};

export default {
  getIncidents,
  getIncident,
  createIncident,
  createPublicIncident,
  getPublicIncident,
  updateIncident,
  updateIncidentStatus,
  deleteIncident,
  getIncidentTypes,
};
