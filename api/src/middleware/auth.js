const { createClient } = require('@supabase/supabase-js');

// Supabase client for JWT verification (uses anon key)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Supabase admin client for server-side operations (service role key)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// ============================================
// SUPABASE JWT MIDDLEWARE (Single-ID Model)
// Rule: public.users.id MUST equal auth.users.id
// ============================================
const authenticateSupabaseToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // Verify the JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    // Load profile from public.users where id = auth.users.id (single-ID model)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        full_name,
        badge_number,
        role,
        status,
        agency_id,
        agencies:agencies!fk_users_agency_id (id, name)
      `)
      .eq('id', user.id)
      .single();

    // If no profile exists, user is not provisioned - return 403
    if (profileError || !profile) {
      return res.status(403).json({ 
        error: 'Profile not provisioned. Contact your administrator.' 
      });
    }

    // Set req.user with profile data
    req.user = {
      id: profile.id,
      email: user.email,
      role: profile.role,
      agency_id: profile.agency_id,
      status: profile.status,
      full_name: profile.full_name,
      badge_number: profile.badge_number,
      agency: profile.agencies
    };

    // Update last_active
    await supabaseAdmin
      .from('users')
      .update({ last_active: new Date().toISOString() })
      .eq('id', req.user.id);

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

// ============================================
// LEGACY JWT MIDDLEWARE (for migration period)
// ============================================
const jwt = require('jsonwebtoken');

const authenticateLegacyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.isLegacyToken = true;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

// ============================================
// HYBRID MIDDLEWARE (supports both token types during migration)
// ============================================
const authenticateHybrid = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  // Try Supabase JWT first
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      // Valid Supabase token - load profile by id (single-ID model)
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select(`
          id,
          email,
          full_name,
          badge_number,
          role,
          status,
          agency_id,
          agencies:agencies!fk_users_agency_id (id, name)
        `)
        .eq('id', user.id)
        .single();

      if (profile) {
        req.user = {
          id: profile.id,
          email: user.email,
          role: profile.role,
          agency_id: profile.agency_id,
          status: profile.status,
          full_name: profile.full_name,
          badge_number: profile.badge_number,
          agency: profile.agencies
        };
        req.isSupabaseToken = true;

        // Update last_active
        await supabaseAdmin
          .from('users')
          .update({ last_active: new Date().toISOString() })
          .eq('id', req.user.id);

        return next();
      }
      
      // Profile not provisioned - return 403
      return res.status(403).json({ 
        error: 'Profile not provisioned. Contact your administrator.' 
      });
    }
  } catch (supabaseError) {
    // Not a Supabase token, try legacy
  }

  // Try legacy JWT
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.isLegacyToken = true;
    return next();
  } catch (legacyError) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

// ============================================
// ROLE PERMISSION MATRIX
// ============================================
const PERMISSIONS = {
  super_admin:    { canCreate: true,  canUpdate: true,  canDelete: true,  crossAgency: true  },
  agency_admin:   { canCreate: true,  canUpdate: true,  canDelete: false, crossAgency: false },
  commander:      { canCreate: true,  canUpdate: true,  canDelete: false, crossAgency: false },
  dispatcher:     { canCreate: true,  canUpdate: true,  canDelete: false, crossAgency: false },
  field_responder:{ canCreate: true,  canUpdate: false, canDelete: false, crossAgency: false },
  viewer:         { canCreate: false, canUpdate: false, canDelete: false, crossAgency: false }
};

// Middleware to check permissions
const checkPermission = (action) => (req, res, next) => {
  const role = req.user.role;
  const perms = PERMISSIONS[role];
  
  if (!perms) {
    return res.status(403).json({ 
      error: `Access denied. Unknown role: ${role}` 
    });
  }

  if (!perms[action]) {
    return res.status(403).json({ 
      error: `Access denied. Your role (${role}) cannot perform this action.` 
    });
  }

  // Check agency scoping for non-crossAgency roles
  if (!perms.crossAgency && req.targetAgencyId && req.targetAgencyId !== req.user.agency_id) {
    return res.status(403).json({ 
      error: 'Access denied. You can only access resources in your agency.' 
    });
  }

  next();
};

// ============================================
// AGENCY SCOPING HELPER
// ============================================
const scopeByAgency = (req, query) => {
  const perms = PERMISSIONS[req.user.role];
  
  // Super admins can see all agencies
  if (perms && perms.crossAgency) {
    return query;
  }
  
  // Everyone else is scoped to their agency
  return query.eq('agency_id', req.user.agency_id);
};

// ============================================
// AUDIT LOG HELPER
// ============================================
const logAudit = async (supabaseAdmin, {
  userId,
  action,
  resourceType = null,
  resourceId = null,
  details = {},
  ipAddress = null,
  userAgent = null
}) => {
  try {
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
        ip_address: ipAddress,
        user_agent: userAgent
      });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
};

module.exports = {
  supabase,
  supabaseAdmin,
  authenticateSupabaseToken,
  authenticateLegacyToken,
  authenticateHybrid,
  checkPermission,
  PERMISSIONS,
  scopeByAgency,
  logAudit
};
