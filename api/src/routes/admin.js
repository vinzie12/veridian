const express = require('express');
const router = express.Router();
const { supabaseAdmin, authenticateSupabaseToken, checkPermission, logAudit } = require('../middleware/auth');

// ============================================
// ADMIN USER PROVISIONING ROUTES
// Single-ID Model: public.users.id = auth.users.id
// ============================================

/**
 * Provision a new user (admin only)
 * Step 1: Create auth user via Supabase Admin API
 * Step 2: Insert profile with matching id
 */
router.post('/users', authenticateSupabaseToken, checkPermission('canUpdate'), async (req, res) => {
  const { email, password, full_name, badge_number, agency_id, role, send_invite } = req.body;

  if (!email || !full_name || !agency_id) {
    return res.status(400).json({ error: 'Email, full name, and agency_id are required' });
  }

  try {
    let authUser;
    let isNewUser = true;

    // Check if auth user already exists
    const { data: existingAuthUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      filters: { email }
    });

    if (listError) {
      console.error('Error checking existing users:', listError);
    }

    const existingAuthUser = existingAuthUsers?.users?.[0];

    if (existingAuthUser) {
      // Auth user exists - check if profile exists
      const { data: existingProfile } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', existingAuthUser.id)
        .single();

      if (existingProfile) {
        return res.status(400).json({ error: 'User already provisioned' });
      }

      // Use existing auth user, just create profile
      authUser = existingAuthUser;
      isNewUser = false;
    } else {
      // Create new auth user
      if (send_invite) {
        // Send invite email (user sets their own password)
        const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          redirectTo: process.env.INVITE_REDIRECT_URL,
          data: {
            full_name,
            badge_number
          }
        });

        if (inviteError) {
          return res.status(400).json({ error: inviteError.message });
        }
        authUser = data.user;
      } else {
        // Create with password (admin sets temporary password)
        if (!password) {
          return res.status(400).json({ error: 'Password is required when not sending invite' });
        }

        const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name,
            badge_number
          }
        });

        if (createError) {
          return res.status(400).json({ error: createError.message });
        }
        authUser = data.user;
      }
    }

    // Create profile with id = auth.users.id (single-ID model)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.id,  // CRITICAL: Use auth user's ID
        email,
        full_name,
        badge_number,
        agency_id,
        role: role || 'field_responder',
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
      // Rollback: Delete auth user if we created it
      if (isNewUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      }
      return res.status(500).json({ error: profileError.message });
    }

    // Log audit
    await logAudit(supabaseAdmin, {
      userId: req.user.id,
      action: isNewUser ? 'provision_user' : 'link_user_profile',
      resourceType: 'user',
      resourceId: profile.id,
      details: { 
        email, 
        role: profile.role, 
        agency_id,
        method: send_invite ? 'invite' : 'password'
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      message: isNewUser 
        ? (send_invite ? 'Invitation sent and profile created' : 'User created successfully')
        : 'Profile linked to existing auth user',
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        badge_number: profile.badge_number,
        role: profile.role,
        agency: profile.agencies?.name,
        status: profile.status
      }
    });
  } catch (err) {
    console.error('Provision user error:', err);
    res.status(500).json({ error: 'Failed to provision user' });
  }
});

/**
 * Migrate existing legacy user to Supabase Auth
 * Creates auth user with same ID as existing profile
 */
router.post('/users/:id/migrate', authenticateSupabaseToken, checkPermission('canUpdate'), async (req, res) => {
  const { id } = req.params;
  const { password, send_invite } = req.body;

  try {
    // Get existing profile
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
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Check if auth user already exists
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers({
      filters: { email: profile.email }
    });

    if (existingAuthUsers?.users?.length > 0) {
      return res.status(400).json({ error: 'Auth user already exists for this email' });
    }

    // Create auth user with specific ID (matching profile)
    if (send_invite) {
      // Send invite - user sets password
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(profile.email, {
        redirectTo: process.env.INVITE_REDIRECT_URL,
        data: {
          full_name: profile.full_name,
          badge_number: profile.badge_number
        }
      });

      if (inviteError) {
        return res.status(400).json({ error: inviteError.message });
      }

      // Note: Invite creates auth user with NEW ID, not matching profile
      // For migration, we need to use createUser with specific ID
      // Supabase doesn't support setting custom ID on invite
      return res.status(400).json({ 
        error: 'Invite method not supported for migration. Use password method.' 
      });
    }

    // Create auth user with password and matching ID
    if (!password) {
      return res.status(400).json({ error: 'Password is required for migration' });
    }

    const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: profile.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: profile.full_name,
        badge_number: profile.badge_number,
        migrated: true
      }
    });

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    // Update profile to use auth user's ID
    // Note: This requires updating the primary key
    // For single-ID model, we need to:
    // 1. Update all FK references to old ID
    // 2. Update profile ID to match auth user ID
    
    // Alternative approach: Create auth user first, then create profile with that ID
    // For migration, we'll update the profile's ID column
    
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ id: authUser.user.id })
      .eq('id', profile.id);

    if (updateError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return res.status(500).json({ error: 'Failed to update profile ID' });
    }

    // Log audit
    await logAudit(supabaseAdmin, {
      userId: req.user.id,
      action: 'migrate_user',
      resourceType: 'user',
      resourceId: authUser.user.id,
      details: { email: profile.email, old_id: profile.id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      message: 'User migrated successfully',
      user: {
        id: authUser.user.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        agency: profile.agencies?.name
      }
    });
  } catch (err) {
    console.error('Migrate user error:', err);
    res.status(500).json({ error: 'Failed to migrate user' });
  }
});

/**
 * List all users (admin only, agency-scoped)
 */
router.get('/users', authenticateSupabaseToken, checkPermission('canUpdate'), async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('users')
      .select('id, email, full_name, badge_number, role, status, last_active, agencies(id, name)')
      .order('created_at', { ascending: false });

    // Non-super-admins see only their agency
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

/**
 * Update user role/status (admin only)
 */
router.patch('/users/:id', authenticateSupabaseToken, checkPermission('canUpdate'), async (req, res) => {
  const { id } = req.params;
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
      .eq('id', id)
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
      resourceId: id,
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

/**
 * Delete user (admin only) - removes both auth and profile
 */
router.delete('/users/:id', authenticateSupabaseToken, checkPermission('canDelete'), async (req, res) => {
  const { id } = req.params;

  try {
    // Check agency access and get user
    let query = supabaseAdmin
      .from('users')
      .select('*, agencies(name)');

    if (req.user.role !== 'super_admin') {
      query = query.eq('agency_id', req.user.agency_id);
    }

    const { data: user, error: findError } = await query
      .eq('id', id)
      .single();

    if (findError || !user) {
      return res.status(404).json({ error: 'User not found or no access' });
    }

    // Delete from auth (cascades to profile if FK set up, or delete manually)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (authDeleteError) {
      console.error('Auth delete error:', authDeleteError);
      // Continue to try profile deletion
    }

    // Delete profile
    const { error: profileDeleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);

    if (profileDeleteError) {
      return res.status(500).json({ error: 'Failed to delete user profile' });
    }

    // Log audit
    await logAudit(supabaseAdmin, {
      userId: req.user.id,
      action: 'delete_user',
      resourceType: 'user',
      resourceId: id,
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * Send password reset email
 */
router.post('/users/:id/reset-password', authenticateSupabaseToken, checkPermission('canUpdate'), async (req, res) => {
  const { id } = req.params;

  try {
    // Get user
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Send reset email
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(user.email, {
      redirectTo: process.env.PASSWORD_RESET_URL
    });

    if (resetError) {
      return res.status(400).json({ error: resetError.message });
    }

    res.json({ message: 'Password reset email sent' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

module.exports = router;
