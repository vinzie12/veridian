import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { configService, setApiBaseUrl, getApiBaseUrl, clearAuth } from '../src/services/apiClient';

// Config loaded from backend
let supabaseUrl = null;
let supabaseAnonKey = null;
let supabaseClient = null;

// Clear stale Supabase session tokens (but preserve app auth tokens)
export const clearStaleTokens = async () => {
  try {
    // Only clear Supabase-specific session keys, NOT our auth tokens
    const allKeys = await AsyncStorage.getAllKeys();
    const supabaseSessionKeys = allKeys.filter(key => 
      key.startsWith('sb-') ||  // Supabase session keys
      key.includes('supabase.auth') 
    );
    
    // Don't clear @veridian: tokens - those are our app's auth tokens
    await AsyncStorage.multiRemove(supabaseSessionKeys);
    console.log('[Supabase] Cleared stale Supabase session tokens');
  } catch (error) {
    console.error('[Supabase] Failed to clear stale tokens:', error);
  }
};

// Load Supabase config from backend
export const loadSupabaseConfig = async () => {
  try {
    // Clear stale tokens BEFORE creating client to prevent corrupted session restore
    await clearStaleTokens();
    
    const response = await configService.load();
    
    if (response.success && response.data?.supabaseUrl && response.data?.supabaseAnonKey) {
      supabaseUrl = response.data.supabaseUrl;
      supabaseAnonKey = response.data.supabaseAnonKey;
      
      // API URL is now managed by apiClient
      if (response.data.apiUrl) {
        setApiBaseUrl(response.data.apiUrl);
      }

      // Create Supabase client with explicit custom storage
      // This ensures all required methods are available
      const customStorage = {
        getItem: async (key) => {
          try {
            return await AsyncStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: async (key, value) => {
          try {
            await AsyncStorage.setItem(key, value);
          } catch {
            // ignore
          }
        },
        removeItem: async (key) => {
          try {
            await AsyncStorage.removeItem(key);
          } catch {
            // ignore
          }
        },
      };
      
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: customStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });
      
      // Update the exported supabase reference
      supabase = supabaseClient;

      console.log('[Supabase] Config loaded successfully');
      return true;
    }
  } catch (error) {
    console.error('[Supabase] Failed to load config:', error);
  }
  return false;
};

// Export Supabase client - will be null until initialized
// Components should check if client exists before using
export let supabase = null;

// Update the export after initialization
const setSupabaseExport = (client) => {
  supabase = client;
};

// API base URL - delegated to apiClient
export const API_URL = new Proxy({}, {
  get() {
    return getApiBaseUrl();
  }
});

// Helper to get the current session from Supabase
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[Supabase] Error getting session:', error);
    return null;
  }
  return session;
};

// Helper to get the access token
export const getAccessToken = async () => {
  const session = await getSession();
  return session?.access_token || null;
};

// Helper to make authenticated API calls to Express backend
// @deprecated Use apiClient.apiRequest() instead
export const apiCall = async (endpoint, options = {}) => {
  const token = await getAccessToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
};

// Sign out - clears Supabase session
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Get current Supabase auth user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

// Set session from access token (called after backend login)
export const setSession = async (accessToken, refreshToken = null) => {
  try {
    // First, clear any existing Supabase session to avoid conflicts
    if (supabaseClient) {
      try {
        await supabaseClient.auth.signOut();
      } catch (e) {
        // Ignore errors - session may already be invalid
      }
    }
    
    // Clear Supabase-specific storage keys
    const allKeys = await AsyncStorage.getAllKeys();
    const sbKeys = allKeys.filter(k => k.startsWith('sb-') || k.includes('supabase'));
    if (sbKeys.length > 0) {
      await AsyncStorage.multiRemove(sbKeys);
    }
    
    // Now set the new session
    const { data, error } = await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    });
    
    if (error) {
      console.error('[Supabase] Failed to set session:', error);
      return false;
    }
    
    console.log('[Supabase] Session set successfully');
    return true;
  } catch (err) {
    console.error('[Supabase] setSession error:', err);
    return false;
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback);
};
