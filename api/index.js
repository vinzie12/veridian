const express = require('express');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:19006'],
  credentials: true
}));
app.use(express.json());

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
// HYBRID AUTH MIDDLEWARE — supports both legacy JWT and Supabase JWT
// ============================================
const authenticateToken = async (req, res, next) => {
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
  citizen:        { canCreate: true,  canUpdate: false, canDelete: false, crossAgency: false },
  viewer:         { canCreate: false, canUpdate: false, canDelete: false, crossAgency: false }
};

// Middleware to check permissions
const checkPermission = (action) => (req, res, next) => {
  const role = req.user.role;
  const perms = PERMISSIONS[role];
  if (!perms || !perms[action]) {
    return res.status(403).json({ 
      error: `Access denied. Your role (${role}) cannot perform this action.` 
    });
  }
  next();
};

// ============================================
// PUBLIC ROUTES — no login required
// ============================================

// Get Supabase config for mobile app
app.get('/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    apiUrl: process.env.API_URL || `http://${req.headers.host?.replace(':3000', '') || 'localhost'}:3000`
  });
});

// Get list of agencies for signup form
app.get('/agencies', async (req, res) => {
  try {
    const { data: agencies, error } = await supabaseAdmin
      .from('agencies')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error fetching agencies:', error);
      return res.status(500).json({ error: 'Failed to fetch agencies' });
    }

    res.json({ agencies: agencies || [] });
  } catch (err) {
    console.error('Agencies route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get list of incident types (public - for quick report)
app.get('/incident-types', async (req, res) => {
  try {
    const { data: incidentTypes, error } = await supabaseAdmin
      .from('incident_types')
      .select('id, name, description, color_code, icon, sort_order')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error fetching incident types:', error);
      return res.status(500).json({ error: 'Failed to fetch incident types' });
    }

    res.json({ incidentTypes: incidentTypes || [] });
  } catch (err) {
    console.error('Incident types route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('agencies').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Veridian API is running!', agencies: data });
});

// Sign in with email/password (Supabase Auth) - NEW
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Get user profile from public.users by id (single-ID model)
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
      .eq('id', data.user.id)
      .single();

    if (!profile) {
      return res.status(403).json({ error: 'Profile not provisioned. Contact your administrator.' });
    }

    res.json({
      message: 'Login successful',
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: profile.id,
        email: data.user.email,
        full_name: profile.full_name,
        badge_number: profile.badge_number,
        role: profile.role,
        agency: profile.agencies?.name,
        agency_id: profile.agency_id,
        status: profile.status
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Legacy login with badge_number/password - kept for migration
app.post('/auth/login-legacy', async (req, res) => {
  const { badge_number, password } = req.body;

  if (!badge_number || !password) {
    return res.status(400).json({ error: 'Badge number and password are required' });
  }

  const { data: user, error } = await supabaseAdmin
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
    .eq('badge_number', badge_number)
    .single();

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid badge number or password' });
  }

  // Verify password
  const bcrypt = require('bcryptjs');
  if (!user.password_hash) {
    return res.status(401).json({ error: 'Please use email login instead' });
  }
  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid badge number or password' });
  }

  const token = jwt.sign(
    {
      user_id: user.id,
      agency_id: user.agency_id,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    message: 'Login successful (legacy)',
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      badge_number: user.badge_number,
      role: user.role,
      agency: user.agencies?.name
    },
    warning: 'This login method will be deprecated. Please migrate to email login.'
  });
});

// Sign up new user (creates Supabase Auth user + profile)
app.post('/auth/signup', async (req, res) => {
  const { badge_number, password, full_name, email, role, agency_id } = req.body;

  // Agency required for responders, optional for citizens
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Email, password, and full name are required' });
  }

  const isCitizen = role === 'citizen';
  
  if (!isCitizen && !agency_id) {
    return res.status(400).json({ error: 'Agency is required for responder accounts' });
  }

  try {
    // Create auth user with Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        badge_number
      }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Check if badge number already exists
    if (badge_number) {
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('badge_number')
        .eq('badge_number', badge_number)
        .single();

      if (existing) {
        // Rollback auth user
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return res.status(400).json({ error: 'Badge number already registered' });
      }
    }

    // Create profile in public.users with id = auth.users.id (single-ID model)
    const { data: user, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,  // CRITICAL: Use auth user's ID
        email,
        full_name,
        badge_number,
        role: role || 'field_responder',
        agency_id: isCitizen ? null : agency_id, // Null for citizens
        status: 'active'
      })
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
      .single();

    if (profileError) {
      // Rollback auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: profileError.message });
    }

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        badge_number: user.badge_number,
        role: user.role,
        agency: user.agencies?.name,
        status: user.status
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// ============================================
// PROTECTED ROUTES — login required
// ============================================
app.get('/incidents', authenticateToken, async (req, res) => {
  try {
    const { filter, submitted_by, limit } = req.query; // 'active', 'closed', 'all', 'submitted_by=me', limit
    
    let query = supabaseAdmin
      .from('incidents')
      .select(`
        *,
        incident_types:incident_type_id (id, name, icon, color_code)
      `)
      .order('created_at', { ascending: false });

    // Handle submitted_by=me for citizens viewing their own reports
    if (submitted_by === 'me') {
      query = query.eq('reporter_id', req.user.id);
    } else {
      // Check if user has an agency (citizens have null agency_id)
      const hasAgency = req.user.agency_id !== null;
      const perms = PERMISSIONS[req.user.role];

      if (!hasAgency) {
        // Citizens without agency can only see their own reported incidents
        query = query.eq('reporter_id', req.user.id);
      } else if (perms?.crossAgency || req.user.role === 'dispatcher' || req.user.role === 'commander') {
        // For dispatchers/commanders, show both agency incidents AND anonymous public incidents
        query = query.or(`agency_id.eq.${req.user.agency_id},agency_id.is.null`);
      } else {
        // Regular users only see their agency's incidents
        query = query.eq('agency_id', req.user.agency_id);
      }
    }

    // Filter by status based on query parameter
    if (filter === 'active') {
      query = query.not('status', 'in', '(resolved,closed,cancelled)');
    } else if (filter === 'closed') {
      query = query.in('status', ['resolved', 'closed', 'cancelled']);
    }
    // If filter is 'all' or not specified, show all incidents

    // Apply limit if specified
    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    
    // Transform data to include incident_type info
    const incidents = data.map(incident => ({
      ...incident,
      incident_type: incident.incident_types?.name || incident.incident_type || 'unknown',
      incident_icon: incident.incident_types?.icon || '⚠️',
      incident_color: incident.incident_types?.color_code || '#666'
    }));
    
    res.json({ incidents });
  } catch (err) {
    console.error('Incidents fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

app.get('/me', authenticateToken, async (req, res) => {
  // Support both Supabase (req.user.id) and legacy (req.user.user_id) tokens
  const userId = req.user.id || req.user.user_id;
  
  const { data: user, error } = await supabaseAdmin
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
    .eq('id', userId)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ user });
});

// Set password for a user (admin only)
app.post('/users/set-password', authenticateToken, checkPermission('canUpdate'), async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { badge_number, password } = req.body;

  if (!badge_number || !password) {
    return res.status(400).json({ error: 'Badge number and password are required' });
  }

  const hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ password_hash: hash })
    .eq('badge_number', badge_number)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Password set successfully' });
});

const PORT = 3000;

// ============================================
// PUBLIC INCIDENT ROUTES — no auth required
// ============================================

// Generate unique 8-character tracking ID
const generateTrackingId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Public incident reporting (anonymous citizens)
app.post('/incidents/public', async (req, res) => {
  const { incident_type_id, severity, latitude, longitude, address, description, reporter_contact, extra_fields } = req.body;

  if (!incident_type_id || !severity) {
    return res.status(400).json({ error: 'incident_type_id and severity are required' });
  }

  try {
    // Generate unique tracking ID
    let trackingId = generateTrackingId();
    let attempts = 0;
    
    // Ensure uniqueness
    while (attempts < 10) {
      const { data: existing } = await supabaseAdmin
        .from('incidents')
        .select('tracking_id')
        .eq('tracking_id', trackingId)
        .single();
      
      if (!existing) break;
      trackingId = generateTrackingId();
      attempts++;
    }

    const { data, error } = await supabaseAdmin
      .from('incidents')
      .insert({
        agency_id: null, // Public incidents not tied to agency initially
        reporter_id: null, // Anonymous
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
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ 
      message: 'Incident reported successfully', 
      incident: data,
      tracking_id: trackingId
    });
  } catch (err) {
    console.error('Public incident error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Track public incident by tracking_id (for citizens to check status)
app.get('/incidents/public/:tracking_id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('incidents')
      .select('id, tracking_id, incident_type_id, severity, status, address, created_at, updated_at')
      .eq('tracking_id', req.params.tracking_id.toUpperCase())
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Incident not found. Check your tracking ID.' });
    }

    res.json({ incident: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

// ============================================
// INCIDENT ROUTES — protected (requires auth)
// ============================================

// Create a new incident (authenticated users)
app.post('/incidents', authenticateToken, checkPermission('canCreate'), async (req, res) => {
  const { incident_type_id, severity, latitude, longitude, address, description, extra_fields } = req.body;

  if (!incident_type_id || !severity) {
    return res.status(400).json({ error: 'incident_type_id and severity are required' });
  }

  const userId = req.user.id || req.user.user_id;
  const isCitizen = req.user.role === 'citizen';

  // Generate tracking ID for citizens
  let trackingId = null;
  if (isCitizen) {
    trackingId = generateTrackingId();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabaseAdmin
        .from('incidents')
        .select('tracking_id')
        .eq('tracking_id', trackingId)
        .single();
      
      if (!existing) break;
      trackingId = generateTrackingId();
      attempts++;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('incidents')
    .insert({
      agency_id: req.user.agency_id,
      reporter_id: userId,
      incident_type_id,
      tracking_id: trackingId,
      severity,
      latitude,
      longitude,
      address,
      description,
      extra_fields: extra_fields || {},
      status: 'pending_review' // Default status for new incidents
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ 
    message: 'Incident created!', 
    incident: data,
    tracking_id: trackingId
  });
});


// Get single incident
app.get('/incidents/:id', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('incidents')
      .select(`
        *,
        incident_types:incident_type_id (id, name, icon, color_code)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Check access: user's agency OR anonymous incident (agency_id is null)
    const perms = PERMISSIONS[req.user.role];
    const hasAccess = data.agency_id === req.user.agency_id || 
                       data.agency_id === null ||
                       perms?.crossAgency;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this incident' });
    }

    // Transform to include incident_type info
    const incident = {
      ...data,
      incident_type: data.incident_types?.name || data.incident_type || 'unknown',
      incident_icon: data.incident_types?.icon || '⚠️',
      incident_color: data.incident_types?.color_code || '#666'
    };

    res.json({ incident });
  } catch (err) {
    console.error('Get incident error:', err);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

// Update incident status
app.patch('/incidents/:id', authenticateToken, checkPermission('canUpdate'), async (req, res) => {
  const { status, description, extra_fields } = req.body;

  try {
    // First check if user has access to this incident
    const { data: incident, error: fetchError } = await supabaseAdmin
      .from('incidents')
      .select('id, agency_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Check access: user's agency OR anonymous incident (agency_id is null)
    const perms = PERMISSIONS[req.user.role];
    const hasAccess = incident.agency_id === req.user.agency_id || 
                       incident.agency_id === null ||
                       perms?.crossAgency;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this incident' });
    }

    // Update the incident
    const { data, error } = await supabaseAdmin
      .from('incidents')
      .update({ status, description, extra_fields, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Incident updated!', incident: data });
  } catch (err) {
    console.error('Update incident error:', err);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

// Delete incident
app.delete('/incidents/:id', authenticateToken, checkPermission('canDelete'), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('incidents')
    .delete()
    .eq('id', req.params.id)
    .eq('agency_id', req.user.agency_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Incident not found' });
  res.json({ message: 'Incident deleted!', incident: data });
});

// ============================================
// LIVEKIT CALL TOKEN ENDPOINT
// ============================================

// LiveKit configuration - set these in your .env
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_SERVER_URL = process.env.LIVEKIT_SERVER_URL; // e.g., wss://your-app.livekit.cloud

// In-memory store for active calls (in production, use Redis/database)
const activeCalls = new Map();

/**
 * Generate LiveKit access token
 * POST /call/token
 * Body: { incidentId, role }
 * Returns: { token, roomName, serverUrl }
 */
app.post('/call/token', authenticateToken, async (req, res) => {
  const { incidentId, role } = req.body;

  if (!incidentId) {
    return res.status(400).json({ error: 'incidentId is required' });
  }

  // Check if LiveKit credentials are configured
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_SERVER_URL) {
    // Return mock response for development
    console.warn('LiveKit credentials not configured, returning mock token');
    return res.json({
      token: 'mock_token_' + Date.now(),
      roomName: 'room_' + incidentId.slice(0, 8),
      serverUrl: null,
      warning: 'Using mock token - configure LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_SERVER_URL in .env'
    });
  }

  try {
    // Import LiveKit Server SDK
    const { AccessToken } = require('livekit-server-sdk');
    
    // Create room name from incident ID
    const roomName = `verification-${incidentId.slice(0, 8)}`;
    
    // Map app role to LiveKit role (admin = can publish, reporter = can publish)
    const isAdmin = role === 'admin';
    
    // Create access token
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: req.user.id,
      name: req.user.full_name || req.user.email,
    });
    
    // Add grants
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      // Admin can publish camera, reporter starts audio-only
      canPublishSources: isAdmin 
        ? ['camera', 'microphone', 'screen_share', 'screen_share_audio']
        : ['microphone'],
    });
    
    const token = at.toJwt();
    
    // Track active call
    activeCalls.set(incidentId, { roomName, startedAt: new Date() });
    
    res.json({
      token,
      roomName,
      serverUrl: LIVEKIT_SERVER_URL
    });
  } catch (err) {
    console.error('Call token error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate call token' });
  }
});

/**
 * Get active call status for an incident
 * GET /call/status/:incidentId
 */
app.get('/call/status/:incidentId', authenticateToken, async (req, res) => {
  const { incidentId } = req.params;
  const callInfo = activeCalls.get(incidentId);
  
  res.json({
    hasActiveCall: !!callInfo,
    roomName: callInfo?.roomName || null,
    startedAt: callInfo?.startedAt || null
  });
});

/**
 * End call and cleanup
 * DELETE /call/:incidentId
 */
app.delete('/call/:incidentId', authenticateToken, async (req, res) => {
  const { incidentId } = req.params;
  
  if (activeCalls.has(incidentId)) {
    activeCalls.delete(incidentId);
  }
  
  res.json({ message: 'Call ended' });
});

// ============================================
// NOTIFICATIONS ENDPOINT
// ============================================

/**
 * Send push notification for incoming call
 * POST /notifications/call
 * 
 * This endpoint is called when a call session is created
 * It sends a push notification to the callee
 */
app.post('/notifications/call', async (req, res) => {
  const { calleeId, callSessionId, callerName, type } = req.body;
  
  if (!calleeId || !callSessionId) {
    return res.status(400).json({ error: 'calleeId and callSessionId are required' });
  }
  
  try {
    // Get push token from user profile
    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('push_token')
      .eq('id', calleeId)
      .single();
    
    if (error || !profile?.push_token) {
      console.log('No push token found for user:', calleeId);
      return res.json({ 
        success: false, 
        message: 'User has no push token registered' 
      });
    }
    
    const pushToken = profile.push_token;
    
    // Validate it's an Expo push token
    if (!pushToken.startsWith('ExponentPushToken')) {
      return res.json({ 
        success: false, 
        message: 'Invalid push token format' 
      });
    }
    
    // Send notification via Expo Push API
    const message = {
      to: pushToken,
      sound: 'default',
      title: 'Incoming Verification Call',
      body: `${callerName || 'Admin'} is calling you`,
      data: {
        type: type || 'incoming_call',
        callSessionId,
        calleeId,
      },
      priority: 'high',
      channelId: 'calls',
    };
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    const result = await response.json();
    
    console.log('Push notification sent:', result);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Failed to send notification:', err);
    res.status(500).json({ error: err.message || 'Failed to send notification' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});