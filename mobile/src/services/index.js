/**
 * Services Index
 * Central export for all services
 */

// New API Client (recommended)
export { 
  default as apiClient,
  api,
  apiRequest,
  ApiError,
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearAuth,
  setApiBaseUrl,
  getApiBaseUrl,
  authService,
  incidentService,
  callService as callServiceNew,
  configService,
} from './apiClient';

// Legacy exports (backward compatibility)
export { default as api, apiGet, apiPost, apiPut, apiPatch, apiDelete } from './api';
export { default as authStorage, getToken, setToken, getRefreshToken, setRefreshToken, getUser, setUser, setSession, clearAuth as clearAuthLegacy, isAuthenticated } from './authStorage';
export { default as authServiceLegacy, login, sendOtp, verifyOtp, signup, logout, refreshToken, getCurrentUser, updateProfile } from './auth';
export { default as incidentsService, getIncidents, getIncident, createIncident, createPublicIncident, getPublicIncident, updateIncident, updateIncidentStatus, deleteIncident, getIncidentTypes } from './incidents';
