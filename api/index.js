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

  if (!email || !password || !full_name || !agency_id) {
    return res.status(400).json({ error: 'Email, password, full name, and agency are required' });
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
        agency_id,
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
  const { data, error } = await supabaseAdmin
    .from('incidents')
    .select('*')
    .eq('agency_id', req.user.agency_id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ incidents: data });
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

  const { data, error } = await supabaseAdmin
    .from('incidents')
    .insert({
      agency_id: req.user.agency_id,
      reporter_id: userId,
      incident_type_id,
      severity,
      latitude,
      longitude,
      address,
      description,
      extra_fields: extra_fields || {}
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ message: 'Incident created!', incident: data });
});


// Get single incident
app.get('/incidents/:id', authenticateToken, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('incidents')
    .select('*')
    .eq('id', req.params.id)
    .eq('agency_id', req.user.agency_id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ incident: data });
});

// Update incident status
app.patch('/incidents/:id', authenticateToken, checkPermission('canUpdate'), async (req, res) => {
  const { status, description, extra_fields } = req.body;

  const { data, error } = await supabaseAdmin
    .from('incidents')
    .update({ status, description, extra_fields, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('agency_id', req.user.agency_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Incident updated!', incident: data });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});