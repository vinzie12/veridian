const express = require('express');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// JWT MIDDLEWARE — protects routes
// ============================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

// ============================================
// PUBLIC ROUTES — no login required
// ============================================
app.get('/', async (req, res) => {
  const { data, error } = await supabase.from('agencies').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Veridian API is running!', agencies: data });
});

app.post('/auth/login', async (req, res) => {
  const { badge_number } = req.body;

  if (!badge_number) {
    return res.status(400).json({ error: 'Badge number is required' });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*, agencies(*)')
    .eq('badge_number', badge_number)
    .single();

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid badge number' });
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
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      badge_number: user.badge_number,
      role: user.role,
      agency: user.agencies.name
    }
  });
});

// ============================================
// PROTECTED ROUTES — login required
// ============================================
app.get('/incidents', authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('agency_id', req.user.agency_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ incidents: data });
});

app.get('/me', authenticateToken, async (req, res) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('*, agencies(*)')
    .eq('id', req.user.user_id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ user });
});

const PORT = 3000;

// ============================================
// INCIDENT ROUTES — all protected
// ============================================

// Create a new incident
app.post('/incidents', authenticateToken, async (req, res) => {
  const { incident_type, severity, latitude, longitude, address, description, extra_fields } = req.body;

  if (!incident_type || !severity) {
    return res.status(400).json({ error: 'incident_type and severity are required' });
  }

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      agency_id: req.user.agency_id,
      reporter_id: req.user.user_id,
      incident_type,
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

// Get all incidents for your agency
app.get('/incidents', authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('agency_id', req.user.agency_id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ incidents: data });
});

// Get single incident
app.get('/incidents/:id', authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('id', req.params.id)
    .eq('agency_id', req.user.agency_id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ incident: data });
});

// Update incident status
app.patch('/incidents/:id', authenticateToken, async (req, res) => {
  const { status, description, extra_fields } = req.body;

  const { data, error } = await supabase
    .from('incidents')
    .update({ status, description, extra_fields, updated_at: new Date() })
    .eq('id', req.params.id)
    .eq('agency_id', req.user.agency_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Incident updated!', incident: data });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});