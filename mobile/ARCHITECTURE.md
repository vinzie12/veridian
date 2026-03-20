# Veridian Mobile App Architecture

## Recommended Folder Structure

```
mobile/
├── App.js                    # Main entry point (use App.new.js)
├── index.js                  # React Native entry
├── app.json                  # Expo config
├── eas.json                  # EAS build config
├── package.json
│
├── src/
│   ├── config/
│   │   ├── index.js          # Config exports
│   │   └── environment.js    # Environment config
│   │
│   ├── context/
│   │   ├── index.js          # Context exports
│   │   └── AuthContext.js    # Auth state management
│   │
│   ├── services/
│   │   ├── index.js          # Service exports
│   │   ├── api.js            # HTTP client with interceptors
│   │   ├── auth.js           # Auth API calls
│   │   ├── authStorage.js    # Token storage
│   │   └── incidents.js      # Incident API calls
│   │
│   ├── hooks/
│   │   ├── index.js          # Hook exports
│   │   └── useApi.js         # API hooks with loading/error
│   │
│   ├── navigation/
│   │   └── index.js          # Navigation with auth guards
│   │
│   ├── components/
│   │   ├── common/
│   │   │   └── index.js      # Reusable UI components
│   │   ├── incidents/
│   │   │   └── IncidentCard.js
│   │   └── calls/
│   │       └── CallButton.js
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.js
│   │   │   └── SignupScreen.js
│   │   ├── incidents/
│   │   │   ├── HomeScreen.js
│   │   │   ├── IncidentDetailScreen.js
│   │   │   └── QuickReportScreen.js
│   │   └── settings/
│   │       └── SettingsScreen.js
│   │
│   └── utils/
│       ├── validation.js
│       ├── formatting.js
│       └── constants.js
│
├── lib/                       # Existing services (keep for compatibility)
│   ├── supabase.js
│   ├── callService.js
│   ├── callSessionService.js
│   └── notificationService.js
│
├── constants/
│   └── index.js              # Shared constants
│
└── assets/
    ├── images/
    └── fonts/
```

## Architecture Overview

### 1. App Startup Flow

```
index.js
   └── App.js
        ├── initializeApp()
        │    ├── loadSupabaseConfig()     # Load config from backend
        │    ├── setupDefaultInterceptors() # Setup API interceptors
        │    └── setIsReady(true)
        │
        └── <AuthProvider>
             └── <RootNavigator>
                  ├── isLoading? → AuthLoadingScreen
                  ├── isLoggedIn? → MainStack
                  └── !isLoggedIn? → AuthStack
```

### 2. Navigation Flow

```
RootNavigator
├── AuthStack (unauthenticated)
│   ├── Login
│   ├── Signup
│   ├── QuickReport (anonymous)
│   └── TrackReport
│
└── MainStack (authenticated)
    ├── HomeTabs
    │   ├── Responder: Incidents | QuickReport | Settings
    │   └── Citizen: Home | QuickReport | Track | Settings
    ├── IncidentDetail
    ├── Confirmation
    ├── VerificationCall
    ├── IncomingCall
    └── InAppCall
```

### 3. API Calls Pattern

```javascript
// Before (scattered in screens)
const response = await axios.get(`${API_URL}/incidents`, {
  headers: { Authorization: `Bearer ${token}` }
});

// After (centralized)
import { useApi } from '../hooks';
import { getIncidents } from '../services';

const { data, loading, error, execute } = useApi(getIncidents, {
  immediate: true,
  onSuccess: (data) => console.log('Loaded'),
  onError: (err) => Alert.alert('Error', err.message),
});
```

### 4. State Management

```javascript
// Auth State (React Context)
const { user, token, isLoading, isLoggedIn, login, logout } = useAuth();

// API State (useApi hook)
const { data, loading, error, retry } = useApi(fetchFunction);

// Local State (useState)
const [formValue, setFormValue] = useState('');
```

### 5. Authentication Flow

```
LoginScreen
   └── login(email, password)
        ├── authService.login()
        ├── setSession(accessToken, refreshToken, user)
        ├── setUserState(user)
        └── Navigation → HomeTabs

Logout
   └── logout()
        ├── authService.logout()
        ├── clearAuth()
        └── Navigation → AuthStack
```

## Key Improvements

### 1. Environment Configuration
- Centralized config for dev/staging/prod
- Runtime config loading from backend
- Debug/logging toggles per environment

### 2. API Service Layer
- Unified HTTP client with interceptors
- Automatic token injection
- Standardized error handling
- Request/response normalization

### 3. Auth Context
- Single source of truth for auth state
- Persistent storage with AsyncStorage
- Auto token refresh on 401
- Auth guard hooks for protected screens

### 4. Reusable Components
- Button (primary/secondary/danger/ghost)
- LoadingSpinner / FullScreenLoading
- ErrorDisplay / NetworkError
- EmptyState
- Card / Badge
- Input with validation
- ModalContainer
- ScreenHeader

### 5. Loading/Error UX
- Full-screen loading during app init
- useApi hook with automatic loading/error states
- ErrorDisplay component with retry
- NetworkError component for offline
- EmptyState for empty data

### 6. Navigation Improvements
- Auth-based routing (logged in vs out)
- Role-based tabs (responder vs citizen)
- Auth guards on protected screens
- Imperative navigation helpers

## Usage Examples

### Using Auth Context
```javascript
import { useAuth } from '../context';

function ProfileScreen() {
  const { user, updateProfile, logout } = useAuth();
  
  return (
    <View>
      <Text>{user.full_name}</Text>
      <Button title="Logout" onPress={logout} />
    </View>
  );
}
```

### Using API Hook
```javascript
import { useApi } from '../hooks';
import { getIncidents } from '../services';

function IncidentsScreen() {
  const { data, loading, error, retry } = useApi(getIncidents, {
    immediate: true,
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} onRetry={retry} />;
  if (!data.length) return <EmptyState title="No incidents" />;

  return <IncidentList data={data} />;
}
```

### Using Paginated API
```javascript
import { usePaginatedApi } from '../hooks';
import { getIncidents } from '../services';

function IncidentsScreen() {
  const { data, loading, hasMore, loadMore, refresh } = usePaginatedApi(
    getIncidents,
    { pageSize: 20 }
  );

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      onEndReached={loadMore}
      onRefresh={refresh}
      refreshing={loading}
    />
  );
}
```

## Migration Steps

1. **Replace App.js** with `App.new.js` content
2. **Update screens** to use new hooks and services
3. **Replace direct API calls** with service functions
4. **Replace local auth state** with `useAuth()`
5. **Use common components** for consistent UX

## Benefits

| Before | After |
|--------|-------|
| Config hardcoded | Environment-based config |
| API calls scattered | Centralized service layer |
| Auth state in App.js | React Context with hooks |
| Manual loading states | Automatic with useApi |
| Inconsistent error handling | Standardized ApiError |
| No retry mechanism | Built-in retry support |
| Role navigation in screens | Navigation-level routing |
| Duplicate UI code | Reusable components |
