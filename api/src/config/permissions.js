/**
 * Role-Based Access Control (RBAC) Configuration
 * Comprehensive permission system with role hierarchy and resource-level permissions
 */

// Role hierarchy - higher roles inherit permissions from lower roles
const ROLE_HIERARCHY = [
  'viewer',           // Level 0 - Lowest
  'citizen',          // Level 1
  'field_responder',  // Level 2
  'dispatcher',       // Level 3
  'commander',        // Level 4
  'agency_admin',     // Level 5
  'super_admin'       // Level 6 - Highest
];

// Get role level (higher = more permissions)
const getRoleLevel = (role) => {
  const index = ROLE_HIERARCHY.indexOf(role);
  return index >= 0 ? index : -1;
};

// Check if roleA has equal or higher level than roleB
const hasRoleLevel = (roleA, roleB) => {
  return getRoleLevel(roleA) >= getRoleLevel(roleB);
};

// Resource-level permissions
const RESOURCE_PERMISSIONS = {
  // User management
  'user:read': ['agency_admin', 'super_admin'],
  'user:create': ['agency_admin', 'super_admin'],
  'user:update': ['agency_admin', 'super_admin'],
  'user:delete': ['super_admin'],
  'user:activate': ['agency_admin', 'super_admin'],
  'user:deactivate': ['agency_admin', 'super_admin'],
  
  // Incident management
  'incident:read': ['viewer', 'citizen', 'field_responder', 'dispatcher', 'commander', 'agency_admin', 'super_admin'],
  'incident:create': ['citizen', 'field_responder', 'dispatcher', 'commander', 'agency_admin', 'super_admin'],
  'incident:update': ['field_responder', 'dispatcher', 'commander', 'agency_admin', 'super_admin'],
  'incident:delete': ['commander', 'agency_admin', 'super_admin'],
  'incident:assign': ['dispatcher', 'commander', 'agency_admin', 'super_admin'],
  'incident:resolve': ['field_responder', 'dispatcher', 'commander', 'agency_admin', 'super_admin'],
  
  // Agency management
  'agency:read': ['field_responder', 'dispatcher', 'commander', 'agency_admin', 'super_admin'],
  'agency:update': ['agency_admin', 'super_admin'],
  'agency:delete': ['super_admin'],
  
  // Audit logs
  'audit:read': ['agency_admin', 'super_admin'],
  
  // Reports & Analytics
  'reports:view': ['commander', 'agency_admin', 'super_admin'],
  'reports:export': ['agency_admin', 'super_admin'],
  
  // System administration
  'admin:access': ['agency_admin', 'super_admin'],
  'admin:config': ['super_admin'],
  'admin:all_agencies': ['super_admin']
};

// Action-based permissions (for backward compatibility)
const ACTION_PERMISSIONS = {
  super_admin: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canAdmin: true,
    crossAgency: true,
    minRoleLevel: 0
  },
  agency_admin: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: false,
    canAdmin: true,
    crossAgency: false,
    minRoleLevel: 0
  },
  commander: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canAdmin: false,
    crossAgency: false,
    minRoleLevel: 0
  },
  dispatcher: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: false,
    canAdmin: false,
    crossAgency: false,
    minRoleLevel: 0
  },
  field_responder: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: false,
    canAdmin: false,
    crossAgency: false,
    minRoleLevel: 0
  },
  citizen: {
    canCreate: true,
    canRead: true,
    canUpdate: false,
    canDelete: false,
    canAdmin: false,
    crossAgency: false,
    minRoleLevel: 0
  },
  viewer: {
    canCreate: false,
    canRead: true,
    canUpdate: false,
    canDelete: false,
    canAdmin: false,
    crossAgency: false,
    minRoleLevel: 0
  }
};

// Legacy PERMISSIONS export for backward compatibility
const PERMISSIONS = ACTION_PERMISSIONS;

/**
 * Check if a role has a specific resource permission
 * @param {string} role - User role
 * @param {string} permission - Resource permission (e.g., 'user:create')
 * @returns {boolean}
 */
const hasResourcePermission = (role, permission) => {
  const allowedRoles = RESOURCE_PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
};

/**
 * Check if a role has a specific action permission
 * @param {string} role - User role
 * @param {string} action - Permission action (canCreate, canUpdate, canDelete, canAdmin, crossAgency)
 * @returns {boolean}
 */
const hasPermission = (role, action) => {
  const perms = ACTION_PERMISSIONS[role];
  return perms ? perms[action] === true : false;
};

/**
 * Check if role can access cross-agency resources
 * @param {string} role - User role
 * @returns {boolean}
 */
const canCrossAgency = (role) => {
  return hasPermission(role, 'crossAgency') || hasResourcePermission(role, 'admin:all_agencies');
};

/**
 * Check if role has admin access
 * @param {string} role - User role
 * @returns {boolean}
 */
const isAdmin = (role) => {
  return hasPermission(role, 'canAdmin') || hasResourcePermission(role, 'admin:access');
};

/**
 * Check if user can manage another user based on roles
 * @param {string} actorRole - Role of user performing action
 * @param {string} targetRole - Role of user being managed
 * @returns {boolean}
 */
const canManageRole = (actorRole, targetRole) => {
  // Super admin can manage anyone
  if (actorRole === 'super_admin') return true;
  
  // Agency admin can manage roles below them
  if (actorRole === 'agency_admin') {
    return getRoleLevel(targetRole) < getRoleLevel('agency_admin');
  }
  
  return false;
};

/**
 * Get all permissions for a role (for caching/frontend)
 * @param {string} role - User role
 * @returns {object}
 */
const getRolePermissions = (role) => {
  const actionPerms = ACTION_PERMISSIONS[role] || {};
  const resourcePerms = {};
  
  Object.entries(RESOURCE_PERMISSIONS).forEach(([perm, roles]) => {
    resourcePerms[perm] = roles.includes(role);
  });
  
  return {
    role,
    level: getRoleLevel(role),
    actions: actionPerms,
    resources: resourcePerms
  };
};

module.exports = {
  // Constants
  ROLE_HIERARCHY,
  RESOURCE_PERMISSIONS,
  ACTION_PERMISSIONS,
  PERMISSIONS, // Legacy export
  
  // Functions
  getRoleLevel,
  hasRoleLevel,
  hasResourcePermission,
  hasPermission,
  canCrossAgency,
  isAdmin,
  canManageRole,
  getRolePermissions
};
