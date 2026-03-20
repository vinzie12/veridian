/**
 * Authentication & Authorization Middleware
 * Comprehensive auth system with Supabase JWT, token refresh, and RBAC
 */

const { supabase, supabaseAdmin } = require('../config/supabase');
const userRepository = require('../repositories/user.repository');
const auditRepository = require('../repositories/audit.repository');
const { 
  UnauthorizedError, 
  ForbiddenError 
} = require('../utils/errors');
const { 
  hasResourcePermission, 
  hasPermission, 
  canCrossAgency, 
  isAdmin,
  canManageRole,
  getRolePermissions 
} = require('../config/permissions');
const jwt = require('jsonwebtoken');

// Token blacklist cache (for immediate revocation)
// In production, use Redis
const tokenBlacklist = new Map();
const BLACKLIST_TTL = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Extract Bearer token from request
 */
const extractToken = (req) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
};

/**
 * Check if token is blacklisted
 */
const isTokenBlacklisted = (token, userId) => {
  const key = `${userId}:${token.substring(0, 20)}`;
  return tokenBlacklist.has(key);
};

/**
 * Add token to blacklist
 */
const blacklistToken = (token, userId) => {
  const key = `${userId}:${token.substring(0, 20)}`;
  tokenBlacklist.set(key, Date.now());
  
  // Cleanup old entries periodically
  if (tokenBlacklist.size > 10000) {
    const now = Date.now();
    for (const [k, timestamp] of tokenBlacklist.entries()) {
      if (now - timestamp > BLACKLIST_TTL) {
        tokenBlacklist.delete(k);
      }
    }
  }
};

/**
 * Load and validate user profile
 */
const loadUserProfile = async (userId, token) => {
  const profile = await userRepository.findWithAgency(userId);
  
  if (!profile) {
    throw new ForbiddenError('Profile not provisioned. Contact your administrator.');
  }
  
  // Check account status
  if (profile.status === 'suspended') {
    throw new ForbiddenError('Account suspended. Contact your administrator.');
  }
  
  if (profile.status === 'pending') {
    throw new ForbiddenError('Account pending approval. Contact your administrator.');
  }
  
  if (profile.status === 'inactive') {
    throw new ForbiddenError('Account inactive. Contact your administrator.');
  }
  
  if (profile.status !== 'active') {
    throw new ForbiddenError(`Account is ${profile.status}. Contact your administrator.`);
  }
  
  // Check token blacklist
  if (isTokenBlacklisted(token, userId)) {
    throw new ForbiddenError('Token has been revoked. Please login again.');
  }
  
  return profile;
};

/**
 * Authenticate Supabase JWT (Primary authentication method)
 * - Verifies JWT with Supabase
 * - Loads user profile
 * - Checks account status
 * - Attaches user to request
 */
const authenticate = async (req, res, next) => {
  const token = extractToken(req);
  
  if (!token) {
    return next(new UnauthorizedError('Access denied. No token provided.'));
  }
  
  try {
    // Verify with Supabase
    const { data: { user, session }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return next(new ForbiddenError('Invalid or expired token.'));
    }
    
    // Load and validate profile
    const profile = await loadUserProfile(user.id, token);
    
    // Attach user to request
    req.user = {
      id: profile.id,
      email: user.email,
      role: profile.role,
      agency_id: profile.agency_id,
      status: profile.status,
      full_name: profile.full_name,
      badge_number: profile.badge_number,
      agency: profile.agencies,
      permissions: getRolePermissions(profile.role),
      sessionId: session?.id
    };
    
    req.token = token;
    req.authType = 'supabase';
    
    // Update last active (async, don't wait)
    userRepository.updateLastActive(profile.id).catch(console.error);
    
    next();
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof UnauthorizedError) {
      return next(err);
    }
    console.error('Auth middleware error:', err);
    return next(new ForbiddenError('Invalid or expired token.'));
  }
};

/**
 * Authenticate with optional token refresh
 * If token is expired but refresh_token is provided, attempts refresh
 */
const authenticateWithRefresh = async (req, res, next) => {
  const token = extractToken(req);
  const refreshToken = req.headers['x-refresh-token'];
  
  if (!token) {
    return next(new UnauthorizedError('Access denied. No token provided.'));
  }
  
  try {
    // Try to verify the access token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!error && user) {
      // Token is valid, proceed normally
      const profile = await loadUserProfile(user.id, token);
      
      req.user = {
        id: profile.id,
        email: user.email,
        role: profile.role,
        agency_id: profile.agency_id,
        status: profile.status,
        full_name: profile.full_name,
        badge_number: profile.badge_number,
        agency: profile.agencies,
        permissions: getRolePermissions(profile.role)
      };
      req.token = token;
      req.authType = 'supabase';
      
      userRepository.updateLastActive(profile.id).catch(console.error);
      return next();
    }
    
    // Token invalid/expired, try refresh if refresh token provided
    if (refreshToken && error?.message?.includes('expired')) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });
      
      if (refreshError || !refreshData.user) {
        return next(new ForbiddenError('Session expired. Please login again.'));
      }
      
      const profile = await loadUserProfile(refreshData.user.id, refreshData.session.access_token);
      
      req.user = {
        id: profile.id,
        email: refreshData.user.email,
        role: profile.role,
        agency_id: profile.agency_id,
        status: profile.status,
        full_name: profile.full_name,
        badge_number: profile.badge_number,
        agency: profile.agencies,
        permissions: getRolePermissions(profile.role)
      };
      req.token = refreshData.session.access_token;
      req.refreshToken = refreshData.session.refresh_token;
      req.authType = 'supabase';
      req.tokenRefreshed = true;
      
      userRepository.updateLastActive(profile.id).catch(console.error);
      return next();
    }
    
    return next(new ForbiddenError('Invalid or expired token.'));
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof UnauthorizedError) {
      return next(err);
    }
    console.error('Auth middleware error:', err);
    return next(new ForbiddenError('Invalid or expired token.'));
  }
};

/**
 * Legacy JWT authentication (for migration period only)
 * @deprecated Use authenticate() instead
 */
const authenticateLegacy = async (req, res, next) => {
  const token = extractToken(req);
  
  if (!token) {
    return next(new UnauthorizedError('Access denied. No token provided.'));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Load user to check status and token version
    const user = await userRepository.findById(decoded.user_id || decoded.id);
    
    if (!user) {
      return next(new ForbiddenError('User not found.'));
    }
    
    if (user.status !== 'active') {
      return next(new ForbiddenError(`Account is ${user.status}. Contact your administrator.`));
    }
    
    // Check token version for revocation
    if (decoded.version !== undefined && decoded.version !== (user.token_version || 0)) {
      return next(new ForbiddenError('Token has been revoked. Please login again.'));
    }
    
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      agency_id: user.agency_id,
      status: user.status,
      full_name: user.full_name,
      badge_number: user.badge_number,
      permissions: getRolePermissions(user.role)
    };
    req.token = token;
    req.authType = 'legacy';
    
    userRepository.updateLastActive(user.id).catch(console.error);
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new ForbiddenError('Token expired. Please login again.'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new ForbiddenError('Invalid token.'));
    }
    return next(new ForbiddenError('Invalid or expired token.'));
  }
};

/**
 * Hybrid authentication (supports both Supabase and Legacy)
 * Use during migration period only
 */
const authenticateHybrid = async (req, res, next) => {
  const token = extractToken(req);
  
  if (!token) {
    return next(new UnauthorizedError('Access denied. No token provided.'));
  }
  
  // Try Supabase first (preferred)
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!error && user) {
      const profile = await loadUserProfile(user.id, token);
      
      req.user = {
        id: profile.id,
        email: user.email,
        role: profile.role,
        agency_id: profile.agency_id,
        status: profile.status,
        full_name: profile.full_name,
        badge_number: profile.badge_number,
        agency: profile.agencies,
        permissions: getRolePermissions(profile.role)
      };
      req.token = token;
      req.authType = 'supabase';
      
      userRepository.updateLastActive(profile.id).catch(console.error);
      return next();
    }
  } catch (supabaseError) {
    // Fall through to legacy
  }
  
  // Fall back to legacy JWT
  return authenticateLegacy(req, res, next);
};

// ============================================
// AUTHORIZATION MIDDLEWARE
// ============================================

/**
 * Require specific resource permission
 * @param {string} permission - Resource permission (e.g., 'user:create', 'incident:read')
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }
    
    if (!hasResourcePermission(req.user.role, permission)) {
      return next(new ForbiddenError(
        `Access denied. Your role (${req.user.role}) cannot perform: ${permission}`
      ));
    }
    
    next();
  };
};

/**
 * Require admin access (agency_admin or super_admin)
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required.'));
  }
  
  if (!isAdmin(req.user.role)) {
    return next(new ForbiddenError(
      'Access denied. Administrator privileges required.'
    ));
  }
  
  next();
};

/**
 * Require super admin access
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required.'));
  }
  
  if (req.user.role !== 'super_admin') {
    return next(new ForbiddenError(
      'Access denied. Super administrator privileges required.'
    ));
  }
  
  next();
};

/**
 * Require specific role
 * @param {string|string[]} roles - Required role(s)
 */
const requireRole = (roles) => {
  const roleList = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }
    
    if (!roleList.includes(req.user.role)) {
      return next(new ForbiddenError(
        `Access denied. Required role: ${roleList.join(' or ')}. Your role: ${req.user.role}`
      ));
    }
    
    next();
  };
};

/**
 * Check action permission (backward compatible)
 * @param {string} action - Action permission (canCreate, canUpdate, canDelete)
 */
const checkPermission = (action) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }
    
    if (!hasPermission(req.user.role, action)) {
      return next(new ForbiddenError(
        `Access denied. Your role (${req.user.role}) cannot perform this action.`
      ));
    }
    
    next();
  };
};

/**
 * Require agency scoping (user can only access their own agency)
 * Sets req.agencyScope for use in controllers
 */
const requireAgencyScope = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required.'));
  }
  
  // Super admins can access all agencies
  if (canCrossAgency(req.user.role)) {
    req.agencyScope = null; // No scoping
    return next();
  }
  
  // Citizens don't have agency assignment - they see their own reports
  if (req.user.role === 'citizen') {
    req.agencyScope = null;
    req.isCitizen = true;
    return next();
  }
  
  // Everyone else is scoped to their agency
  if (!req.user.agency_id) {
    return next(new ForbiddenError('User has no agency assignment.'));
  }
  
  req.agencyScope = req.user.agency_id;
  next();
};

/**
 * Validate user can manage target user
 * Use for user management endpoints
 */
const canManageUser = (req, res, next) => {
  const targetUserId = req.params.id || req.body.user_id;
  
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required.'));
  }
  
  // Self-management is always allowed for some extent
  if (targetUserId === req.user.id) {
    req.isSelfEdit = true;
    return next();
  }
  
  // Load target user to check their role
  userRepository.findById(targetUserId)
    .then(targetUser => {
      if (!targetUser) {
        return next(new ForbiddenError('Target user not found.'));
      }
      
      // Check if actor can manage target's role
      if (!canManageRole(req.user.role, targetUser.role)) {
        return next(new ForbiddenError(
          `Access denied. You cannot manage users with role: ${targetUser.role}`
        ));
      }
      
      // Check agency scoping
      if (!canCrossAgency(req.user.role) && targetUser.agency_id !== req.user.agency_id) {
        return next(new ForbiddenError(
          'Access denied. You can only manage users in your agency.'
        ));
      }
      
      req.targetUser = targetUser;
      next();
    })
    .catch(err => next(err));
};

/**
 * Optional authentication - attaches user if token present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  const token = extractToken(req);
  
  if (!token) {
    req.user = null;
    return next();
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!error && user) {
      const profile = await userRepository.findWithAgency(user.id);
      
      if (profile && profile.status === 'active') {
        req.user = {
          id: profile.id,
          email: user.email,
          role: profile.role,
          agency_id: profile.agency_id,
          status: profile.status,
          full_name: profile.full_name,
          badge_number: profile.badge_number,
          agency: profile.agencies,
          permissions: getRolePermissions(profile.role)
        };
        req.token = token;
        req.authType = 'supabase';
      }
    }
  } catch (err) {
    // Silently ignore errors for optional auth
  }
  
  next();
};

/**
 * Logout helper - blacklist current token
 */
const logout = async (req, res, next) => {
  try {
    if (req.token && req.user) {
      blacklistToken(req.token, req.user.id);
    }
    
    // Log audit
    await auditRepository.log({
      userId: req.user?.id,
      action: 'logout',
      resourceType: 'session',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Logout all sessions - increment token version
 */
const logoutAll = async (req, res, next) => {
  try {
    if (req.user) {
      await userRepository.incrementTokenVersion(req.user.id);
      
      await auditRepository.log({
        userId: req.user.id,
        action: 'logout_all',
        resourceType: 'session',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    }
    
    next();
  } catch (err) {
    next(err);
  }
};

// ============================================
// LEGACY EXPORTS (backward compatibility)
// ============================================
const authenticateSupabaseToken = authenticate;
const authenticateLegacyToken = authenticateLegacy;

module.exports = {
  // Primary authentication
  authenticate,
  authenticateWithRefresh,
  optionalAuth,
  
  // Legacy authentication (deprecated)
  authenticateLegacy,
  authenticateHybrid,
  authenticateSupabaseToken,
  authenticateLegacyToken,
  
  // Authorization
  requirePermission,
  requireAdmin,
  requireSuperAdmin,
  requireRole,
  checkPermission,
  requireAgencyScope,
  canManageUser,
  
  // Session management
  logout,
  logoutAll,
  blacklistToken,
  
  // Utilities
  extractToken,
  
  // Export supabase clients for backward compatibility
  supabase,
  supabaseAdmin
};
