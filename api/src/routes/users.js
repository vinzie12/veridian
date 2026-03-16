const express = require('express');
const router = express.Router();
const { 
  supabaseAdmin, 
  authenticateHybrid, 
  checkPermission, 
  logAudit 
} = require('../middleware/auth');

const auth = authenticateHybrid;

// ============================================
// USER ROUTES
// ============================================

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
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
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ user });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update current user profile
router.patch('/me', auth, async (req, res) => {
  const { full_name, badge_number } = req.body;

  const updates = {};
  if (full_name) updates.full_name = full_name;
  if (badge_number) updates.badge_number = badge_number;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
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

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Log audit
    await logAudit(supabaseAdmin, {
      userId: req.user.id,
      action: 'update_profile',
      resourceType: 'user',
      resourceId: req.user.id,
      details: updates,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ user: data });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// List users (admin only, scoped by agency)
router.get('/', auth, checkPermission('canUpdate'), async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('users')
      .select('id, email, full_name, badge_number, role, status, last_active, agencies(id, name)')
      .order('created_at', { ascending: false });

    // Agency admins see only their agency
    if (req.user.role !== 'super_admin') {
      query = query.eq('agency_id', req.user.agency_id);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ users: data });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Update user role/status (admin only)
router.patch('/:id', auth, checkPermission('canUpdate'), async (req, res) => {
  const { role, status } = req.body;

  if (!role && !status) {
    return res.status(400).json({ error: 'role or status is required' });
  }

  const updates = {};
  if (role) updates.role = role;
  if (status) updates.status = status;

  try {
    // Check agency access
    let query = supabaseAdmin
      .from('users')
      .update(updates);

    // Non-super-admins can only update users in their agency
    if (req.user.role !== 'super_admin') {
      query = query.eq('agency_id', req.user.agency_id);
    }

    const { data, error } = await query
      .eq('id', req.params.id)
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

    if (error) {
      return res.status(404).json({ error: 'User not found or no access' });
    }

    // Log audit
    await logAudit(supabaseAdmin, {
      userId: req.user.id,
      action: 'update_user',
      resourceType: 'user',
      resourceId: req.params.id,
      details: updates,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ user: data });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get audit logs (admin only)
router.get('/audit-logs', auth, checkPermission('canUpdate'), async (req, res) => {
  const { limit = 100, offset = 0, user_id, action } = req.query;

  try {
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*, users(id, email, full_name, badge_number)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (action) {
      query = query.eq('action', action);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ logs: data });
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

module.exports = router;
