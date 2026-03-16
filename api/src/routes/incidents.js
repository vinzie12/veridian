const express = require('express');
const router = express.Router();
const { 
  supabaseAdmin, 
  authenticateSupabaseToken, 
  authenticateHybrid,
  checkPermission, 
  scopeByAgency, 
  logAudit,
  PERMISSIONS 
} = require('../middleware/auth');

// Use hybrid auth during migration, then switch to authenticateSupabaseToken
const auth = authenticateHybrid;

// ============================================
// INCIDENT ROUTES
// ============================================

// Get all incidents for user's agency
router.get('/', auth, async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply agency scoping
    query = scopeByAgency(req, query);

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ incidents: data });
  } catch (err) {
    console.error('Fetch incidents error:', err);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// Get single incident
router.get('/:id', auth, async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('incidents')
      .select('*, reporter:users(id, full_name, badge_number)')
      .eq('id', req.params.id);

    // Apply agency scoping
    query = scopeByAgency(req, query);

    const { data, error } = await query.single();

    if (error) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    res.json({ incident: data });
  } catch (err) {
    console.error('Fetch incident error:', err);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

// Create a new incident
router.post('/', auth, checkPermission('canCreate'), async (req, res) => {
  const { incident_type, severity, latitude, longitude, address, description, extra_fields } = req.body;

  if (!incident_type || !severity) {
    return res.status(400).json({ error: 'incident_type and severity are required' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('incidents')
      .insert({
        agency_id: req.user.agency_id,
        reporter_id: req.user.id,
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

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Log audit
    await logAudit(supabaseAdmin, {
      userId: req.user.id,
      action: 'create_incident',
      resourceType: 'incident',
      resourceId: data.id,
      details: { incident_type, severity },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({ message: 'Incident created!', incident: data });
  } catch (err) {
    console.error('Create incident error:', err);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

// Update incident
router.patch('/:id', auth, checkPermission('canUpdate'), async (req, res) => {
  const { status, description, extra_fields } = req.body;

  try {
    let query = supabaseAdmin
      .from('incidents')
      .update({ 
        status, 
        description, 
        extra_fields, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', req.params.id);

    // Apply agency scoping
    query = scopeByAgency(req, query);

    const { data, error } = await query.select().single();

    if (error) {
      return res.status(404).json({ error: 'Incident not found or no access' });
    }

    // Log audit
    await logAudit(supabaseAdmin, {
      userId: req.user.id,
      action: 'update_incident',
      resourceType: 'incident',
      resourceId: data.id,
      details: { status, updates: Object.keys(req.body) },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'Incident updated!', incident: data });
  } catch (err) {
    console.error('Update incident error:', err);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

// Delete incident
router.delete('/:id', auth, checkPermission('canDelete'), async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('incidents')
      .delete()
      .eq('id', req.params.id);

    // Apply agency scoping
    query = scopeByAgency(req, query);

    const { data, error } = await query.select().single();

    if (error || !data) {
      return res.status(404).json({ error: 'Incident not found or no access' });
    }

    // Log audit
    await logAudit(supabaseAdmin, {
      userId: req.user.id,
      action: 'delete_incident',
      resourceType: 'incident',
      resourceId: req.params.id,
      details: { incident_type: data.incident_type },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'Incident deleted!', incident: data });
  } catch (err) {
    console.error('Delete incident error:', err);
    res.status(500).json({ error: 'Failed to delete incident' });
  }
});

module.exports = router;
