const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin, logAudit } = require('../middleware/auth');

// ============================================
// SUPABASE AUTH ROUTES
// ============================================

// Sign in with email/password (Supabase Auth)
router.post('/login', async (req, res) => {
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

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Profile not provisioned. Contact your administrator.' });
    }

    // Log audit
    await logAudit(supabaseAdmin, {
      userId: profile.id,
      action: 'login',
      resourceType: 'session',
      details: { method: 'password' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

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

// Sign in with OTP (magic link)
router.post('/login/otp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Check if user has a profile (must be provisioned first)
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (!profile) {
      return res.status(403).json({ error: 'Profile not provisioned. Contact your administrator.' });
    }

    // Use anon client to send OTP - this triggers Supabase email
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,  // Don't create new users
        emailRedirectTo: process.env.OTP_REDIRECT_URL || process.env.INVITE_REDIRECT_URL
      }
    });

    if (error) {
      console.error('OTP send error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'OTP sent to your email',
      email
    });
  } catch (err) {
    console.error('OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP
router.post('/login/verify-otp', async (req, res) => {
  const { email, token, type = 'magiclink' } = req.body;

  if (!email || !token) {
    return res.status(400).json({ error: 'Email and token are required' });
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Get user profile by id (single-ID model)
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

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Profile not provisioned. Contact your administrator.' });
    }

    // Log audit
    await logAudit(supabaseAdmin, {
      userId: profile.id,
      action: 'login_otp',
      resourceType: 'session',
      details: { method: type },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      message: 'Login successful',
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      expires_at: data.session?.expires_at,
      user: {
        id: profile.id,
        email: data.user.email,
        full_name: profile.full_name,
        badge_number: profile.badge_number,
        role: profile.role,
        agency: profile.agencies?.name,
        status: profile.status
      }
    });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ error: 'OTP verification failed' });
  }
});

// Sign up new user (creates auth user + profile)
router.post('/signup', async (req, res) => {
  const { email, password, full_name, badge_number, agency_id, role } = req.body;

  if (!email || !password || !full_name || !agency_id) {
    return res.status(400).json({ 
      error: 'Email, password, full name, and agency are required' 
    });
  }

  try {
    // Check for existing email first
    const { data: existingEmail } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Check for existing badge number BEFORE creating auth user
    if (badge_number) {
      const { data: existingBadge } = await supabaseAdmin
        .from('users')
        .select('badge_number')
        .eq('badge_number', badge_number)
        .single();

      if (existingBadge) {
        return res.status(400).json({ error: 'Badge number already registered' });
      }
    }

    // Create auth user with Supabase
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Set to false if you want email verification
      user_metadata: {
        full_name,
        badge_number
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Create profile in public.users with id = auth.users.id (single-ID model)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: data.user.id,  // CRITICAL: Use auth user's ID
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
      // Rollback auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      return res.status(500).json({ error: profileError.message });
    }

    // Log audit
    await logAudit(supabaseAdmin, {
      userId: profile.id,
      action: 'signup',
      resourceType: 'user',
      resourceId: profile.id,
      details: { role: profile.role, agency_id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: profile.id,
        email: data.user.email,
        full_name: profile.full_name,
        badge_number: profile.badge_number,
        role: profile.role,
        agency: profile.agencies?.name,
        status: profile.status
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      await supabase.auth.admin.signOut(token);
    } catch (err) {
      // Ignore logout errors
    }
  }

  res.json({ message: 'Logged out successfully' });
});

// Invite user (admin only - creates user without password)
router.post('/invite', async (req, res) => {
  const { email, full_name, badge_number, agency_id, role } = req.body;

  if (!email || !full_name || !agency_id) {
    return res.status(400).json({ 
      error: 'Email, full name, and agency are required' 
    });
  }

  try {
    // Invite user via Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: process.env.INVITE_REDIRECT_URL,
      data: {
        full_name,
        badge_number
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Create profile with id = auth.users.id (single-ID model)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: data.user.id,  // CRITICAL: Use auth user's ID
        email,
        full_name,
        badge_number,
        agency_id,
        role: role || 'field_responder',
        status: 'pending'
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
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      return res.status(500).json({ error: profileError.message });
    }

    res.status(201).json({
      message: 'Invitation sent successfully',
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        agency: profile.agencies?.name,
        status: profile.status
      }
    });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

module.exports = router;
