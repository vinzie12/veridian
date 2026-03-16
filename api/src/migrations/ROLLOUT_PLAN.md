# Supabase Auth Migration Rollout Plan

## Overview
Migrate from custom password storage (`public.users.password_hash`) to Supabase Auth while maintaining backward compatibility during the transition period.

---

## Prerequisites

### 1. Environment Variables
Add these to your `.env` file (and production environment):

```env
# Supabase (already have these)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# NEW: Add the anon key (for JWT verification)
SUPABASE_ANON_KEY=your-anon-key

# Keep for migration period
JWT_SECRET=your-existing-jwt-secret

# Redirect URLs
OTP_REDIRECT_URL=https://your-app.com/auth/callback
INVITE_REDIRECT_URL=https://your-app.com/accept-invite

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:19006,https://your-app.com
```

### 2. Required Packages

**API (Node.js):**
```bash
cd api
# Already installed: @supabase/supabase-js, jsonwebtoken
# No new packages needed
```

**Mobile (Expo):**
```bash
cd mobile
npx expo install @react-native-async-storage/async-storage react-native-url-polyfill
```

**Web (React):**
```bash
cd web
npm install @supabase/supabase-js react-router-dom
```

---

## Phase 1: Database Migration (Day 1)

### Step 1.1: Run Migration SQL
Execute `001_supabase_auth_migration.sql` in Supabase SQL Editor:

```sql
-- Copy and paste the contents of:
-- api/migrations/001_supabase_auth_migration.sql
```

### Step 1.2: Create Auth Trigger (requires superuser)
In Supabase SQL Editor, run as superuser:

```sql
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
```

### Step 1.3: Verify Migration
```sql
-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'users';

-- Check audit_logs table
SELECT * FROM public.audit_logs LIMIT 1;

-- Check new columns in agencies
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'agencies' AND column_name = 'logo_url';
```

---

## Phase 2: Backend Deployment (Day 2-3)

### Step 2.1: Install Dependencies
```bash
cd api
# Dependencies already in package.json
npm install
```

### Step 2.2: Update Environment Variables
Add `SUPABASE_ANON_KEY` to your `.env` and production environment.

### Step 2.3: Deploy New Backend Code
The new backend code is in `index.new.js`. To deploy:

**Option A: Gradual Rollout (Recommended)**
1. Rename `index.new.js` to `index.js` (backup old file first)
2. The `authenticateHybrid` middleware supports BOTH token types
3. Existing users with legacy JWT continue to work
4. New users get Supabase JWT

**Option B: Parallel Deployment**
1. Deploy new API on a different port (e.g., 3001)
2. Update mobile/web to use new API
3. Keep old API running for stragglers
4. Deprecate old API after 2 weeks

### Step 2.4: Test Backend
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test new login endpoint
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'

# Test legacy login (should still work)
curl -X POST http://localhost:3000/auth/login-legacy \
  -H "Content-Type: application/json" \
  -d '{"badge_number":"BADGE123","password":"testpass"}'
```

---

## Phase 3: Migrate Existing Users (Day 4-7)

### Step 3.1: Create Migration Script
For each existing user, create a Supabase Auth account:

```javascript
// scripts/migrate-users.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function migrateUsers() {
  // Get all users with password_hash but no auth_user_id
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .is('auth_user_id', null)
    .not('password_hash', 'is', null);

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  console.log(`Found ${users.length} users to migrate`);

  for (const user of users) {
    try {
      // Create Supabase Auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: 'TEMP_PASSWORD_' + Math.random().toString(36).slice(-8), // Temporary password
        email_confirm: true,
        user_metadata: {
          full_name: user.full_name,
          badge_number: user.badge_number,
          migrated: true
        }
      });

      if (authError) {
        console.error(`Failed to create auth user for ${user.email}:`, authError);
        continue;
      }

      // Link the profile to the auth user
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ auth_user_id: authUser.user.id })
        .eq('id', user.id);

      if (updateError) {
        console.error(`Failed to link profile for ${user.email}:`, updateError);
        continue;
      }

      console.log(`Migrated: ${user.email}`);
      
      // Send password reset email
      await supabaseAdmin.auth.resetPasswordForEmail(user.email);
      
    } catch (err) {
      console.error(`Error migrating ${user.email}:`, err);
    }
  }

  console.log('Migration complete!');
}

migrateUsers();
```

### Step 3.2: Run Migration
```bash
cd api
node scripts/migrate-users.js
```

### Step 3.3: Notify Users
Send email to all migrated users:
- Explain the new login method (email + password)
- Include link to reset password
- Set deadline for transition (e.g., 2 weeks)

---

## Phase 4: Frontend Updates (Day 5-10)

### Step 4.1: Mobile App (Expo)

1. **Install dependencies:**
   ```bash
   cd mobile
   npx expo install @react-native-async-storage/async-storage react-native-url-polyfill
   ```

2. **Add environment variables:**
   Create `mobile/.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   EXPO_PUBLIC_API_URL=http://192.168.254.100:3000
   ```

3. **Update screens:**
   - Replace `LoginScreen.js` with `LoginScreen.new.js`
   - Replace `SignupScreen.js` with `SignupScreen.new.js`
   - Update `HomeScreen.js` to use `apiCall()` helper

4. **Update App.js** to use the new auth flow:
   ```javascript
   import { supabase } from './lib/supabase';
   
   // In your root component, check session on mount
   useEffect(() => {
     supabase.auth.getSession().then(({ data: { session } }) => {
       if (session) {
         // Navigate to Home
       } else {
         // Navigate to Login
       }
     });
   }, []);
   ```

### Step 4.2: Web App (React)

1. **Install dependencies:**
   ```bash
   cd web
   npm install @supabase/supabase-js react-router-dom
   ```

2. **Add environment variables:**
   Create `web/.env`:
   ```
   REACT_APP_SUPABASE_URL=https://your-project.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key
   REACT_APP_API_URL=http://localhost:3000
   ```

3. **Wrap app with AuthProvider:**
   ```javascript
   // src/index.js
   import { AuthProvider } from './contexts/AuthContext';
   
   root.render(
     <AuthProvider>
       <App />
     </AuthProvider>
   );
   ```

4. **Update routes:**
   ```javascript
   // src/App.js
   import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
   import { useAuth } from './contexts/AuthContext';
   import Login from './components/Auth/Login';
   import Dashboard from './components/Dashboard';
   
   function PrivateRoute({ children }) {
     const { isAuthenticated, loading } = useAuth();
     if (loading) return <div>Loading...</div>;
     return isAuthenticated ? children : <Navigate to="/login" />;
   }
   
   function App() {
     return (
       <BrowserRouter>
         <Routes>
           <Route path="/login" element={<Login />} />
           <Route path="/dashboard" element={
             <PrivateRoute><Dashboard /></PrivateRoute>
           } />
           <Route path="/" element={<Navigate to="/dashboard" />} />
         </Routes>
       </BrowserRouter>
     );
   }
   ```

---

## Phase 5: Deprecation (Day 14+)

### Step 5.1: Remove Legacy Support

1. **Update API middleware:**
   Change `authenticateHybrid` to `authenticateSupabaseToken` in all routes.

2. **Remove legacy endpoints:**
   Delete `/auth/login-legacy` endpoint.

3. **Remove password_hash column:**
   ```sql
   -- After confirming all users migrated
   ALTER TABLE public.users DROP COLUMN password_hash;
   ```

4. **Remove JWT_SECRET from environment:**
   No longer needed after migration complete.

### Step 5.2: Update Documentation
- Update API docs
- Update user guides
- Update admin training materials

---

## Rollback Plan

If issues arise during migration:

### Immediate Rollback (Phase 1-2)
1. Revert to original `api/index.js`
2. No database changes needed (columns added, not removed)

### Partial Rollback (Phase 3-4)
1. Users with `auth_user_id` can use Supabase login
2. Users without can still use legacy login
3. Hybrid middleware handles both

### Database Rollback
```sql
-- Run this ONLY if you need to completely revert
ALTER TABLE public.users DROP COLUMN IF EXISTS status;
ALTER TABLE public.users DROP COLUMN IF EXISTS last_active;
ALTER TABLE public.users DROP COLUMN IF EXISTS auth_user_id;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
-- See full rollback in migration file
```

---

## Monitoring Checklist

### During Migration
- [ ] Check error logs for auth failures
- [ ] Monitor API response times
- [ ] Track user migration progress
- [ ] Watch for duplicate auth users

### Post-Migration
- [ ] Verify all users have `auth_user_id`
- [ ] Confirm audit logs are being created
- [ ] Test password reset flow
- [ ] Test token refresh flow
- [ ] Verify RLS policies working

---

## Support Contacts

- **Supabase Dashboard:** https://supabase.com/dashboard
- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **Internal Issues:** [Your issue tracker URL]

---

## Timeline Summary

| Phase | Duration | Key Milestones |
|-------|----------|----------------|
| 1. Database | Day 1 | Migration SQL executed |
| 2. Backend | Day 2-3 | New API deployed, hybrid auth active |
| 3. User Migration | Day 4-7 | All users have Supabase Auth accounts |
| 4. Frontend | Day 5-10 | Mobile & web updated |
| 5. Deprecation | Day 14+ | Legacy auth removed |

**Total Duration: ~2 weeks**
