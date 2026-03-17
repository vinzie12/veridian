# Single-ID Model Migration Rollout Plan

## Overview
Migrate to Supabase Auth using the **single-ID model**: `public.users.id` MUST equal `auth.users.id`. No `auth_user_id` column needed.

---

## Prerequisites

### Environment Variables
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Legacy (keep during migration)
JWT_SECRET=your-existing-jwt-secret

# Redirect URLs
INVITE_REDIRECT_URL=https://your-app.com/accept-invite
PASSWORD_RESET_URL=https://your-app.com/reset-password

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:19006
```

---

## Phase 1: Database Migration

### Step 1.1: Run Migration SQL
Execute `002_single_id_model_migration.sql` in Supabase SQL Editor:
- Adds `status`, `last_active` columns to `users`
- Adds `logo_url` to `agencies`
- Creates `audit_logs` table with indexes
- Adds foreign keys
- Enables RLS with basic policies
- Removes `auth_user_id` column if exists

### Step 1.2: Verify Migration
```sql
-- Check new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('status', 'last_active');

-- Check audit_logs exists
SELECT * FROM audit_logs LIMIT 1;

-- Verify no auth_user_id column
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'auth_user_id';
-- Should return 0 rows
```

---

## Phase 2: Backend Deployment

### Step 2.1: Deploy Updated Code
The updated `index.js` and `src/middleware/auth.js`:
- Uses `id` directly (no `auth_user_id`)
- Returns 403 if profile not provisioned
- Supports hybrid tokens during migration

### Step 2.2: Test Endpoints
```bash
# Start server
cd api && node index.js

# Test login (should fail without provisioned profile)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'
# Expected: 403 "Profile not provisioned"

# Test legacy login (should still work)
curl -X POST http://localhost:3000/auth/login-legacy \
  -H "Content-Type: application/json" \
  -d '{"badge_number":"BADGE123","password":"testpass"}'
```

---

## Phase 3: User Provisioning

### Option A: New Users (Admin Provisioning)
Use the `/admin/users` endpoint:

```bash
# Create user with password
curl -X POST http://localhost:3000/admin/users \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "TempPass123!",
    "full_name": "John Doe",
    "badge_number": "BADGE456",
    "agency_id": "uuid-of-agency",
    "role": "field_responder"
  }'

# Or send invite (user sets password)
curl -X POST http://localhost:3000/admin/users \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "send_invite": true,
    "full_name": "Jane Doe",
    "agency_id": "uuid-of-agency"
  }'
```

### Option B: Migrate Existing Users

**Important**: Migration requires updating the primary key. Two approaches:

#### Approach 1: Create New Profiles (Recommended)
1. Create new auth user via admin API
2. Create profile with `id = authUser.id`
3. Migrate data (incidents, etc.) to new user ID
4. Delete old profile

#### Approach 2: In-Place Migration
Use the `/admin/users/:id/migrate` endpoint:
```bash
curl -X POST http://localhost:3000/admin/users/<old_user_id>/migrate \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"password": "NewPassword123!"}'
```

**Note**: This updates FK references and changes the profile ID.

---

## Phase 4: Frontend Updates

### Mobile (Expo)
Update `LoginScreen.js` to use email/password:
- Calls `/auth/login` with `{ email, password }`
- Receives `access_token` in response
- Sends `Authorization: Bearer <access_token>` with API requests

### Web (React)
Same pattern as mobile - use email login with Supabase tokens.

---

## Phase 5: Deprecation

### After Migration Complete
1. Remove `/auth/login-legacy` endpoint
2. Remove `password_hash` column:
   ```sql
   ALTER TABLE public.users DROP COLUMN password_hash;
   ```
3. Remove `JWT_SECRET` from environment
4. Change `authenticateHybrid` to `authenticateSupabaseToken` in routes

---

## Rollback Plan

### Database Rollback
```sql
-- Run rollback section from migration file
ALTER TABLE public.users DROP COLUMN IF EXISTS status;
ALTER TABLE public.users DROP COLUMN IF EXISTS last_active;
ALTER TABLE public.agencies DROP COLUMN IF EXISTS logo_url;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
-- ... see full rollback in migration SQL
```

### Code Rollback
Revert to previous `index.js` and `auth.js` versions.

---

## Monitoring Checklist

- [ ] All users have matching `auth.users` and `public.users` IDs
- [ ] Login returns 403 for unprovisioned users
- [ ] Legacy login still works for old users
- [ ] Audit logs are being created
- [ ] Agency scoping enforced on incidents

---

## Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| 1. Database | Day 1 | Run migration SQL |
| 2. Backend | Day 2 | Deploy updated API |
| 3. Provisioning | Day 3-5 | Migrate/create users |
| 4. Frontend | Day 3-7 | Update login screens |
| 5. Deprecation | Day 14+ | Remove legacy auth |

**Total: ~2 weeks**
