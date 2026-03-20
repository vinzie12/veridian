/**
 * Repository Index
 * Central export point for all repositories
 * Enables easy imports and dependency injection for testing
 */

// Core database abstraction
const { db, DatabaseClient, QueryBuilder } = require('./database');

// Base repository class
const { BaseRepository, PaginatedResult } = require('./base.repository');

// Domain repositories (singleton instances)
const userRepository = require('./user.repository');
const agencyRepository = require('./agency.repository');
const incidentRepository = require('./incident.repository');
const incidentTypeRepository = require('./incidentType.repository');
const auditRepository = require('./audit.repository');
const authRepository = require('./auth.repository');
const authAttemptRepository = require('./authAttempt.repository');

// Export class constructors for testing
const { UserRepository } = require('./user.repository');
const { AgencyRepository } = require('./agency.repository');
const { IncidentRepository } = require('./incident.repository');
const { IncidentTypeRepository } = require('./incidentType.repository');
const { AuditRepository } = require('./audit.repository');
const { AuthRepository } = require('./auth.repository');
const { AuthAttemptRepository } = require('./authAttempt.repository');

module.exports = {
  // Database abstraction
  db,
  DatabaseClient,
  QueryBuilder,
  
  // Base classes
  BaseRepository,
  PaginatedResult,
  
  // Repository instances (for production)
  userRepository,
  agencyRepository,
  incidentRepository,
  incidentTypeRepository,
  auditRepository,
  authRepository,
  authAttemptRepository,
  
  // Repository classes (for testing/DI)
  UserRepository,
  AgencyRepository,
  IncidentRepository,
  IncidentTypeRepository,
  AuditRepository,
  AuthRepository,
  AuthAttemptRepository
};
