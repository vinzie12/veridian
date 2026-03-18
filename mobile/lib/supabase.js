import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Config loaded from backend
let supabaseUrl = null;
let supabaseAnonKey = null;
let supabaseClient = null;

// API base URL (fallback, will be overridden by config)
const DEFAULT_API_URL = 'http://192.168.254.104:3000';

// Load Supabase config from backend
export const loadSupabaseConfig = async () => {
  try {
    const response = await fetch(`${DEFAULT_API_URL}/config`);
    const config = await response.json();

    if (response.ok && config.supabaseUrl && config.supabaseAnonKey) {
      supabaseUrl = config.supabaseUrl;
      supabaseAnonKey = config.supabaseAnonKey;
      API_URL = config.apiUrl || DEFAULT_API_URL;

      // Create Supabase client
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });

      return true;
    }
  } catch (error) {
    console.error('Failed to load Supabase config:', error);
  }
  return false;
};

// Export Supabase client (lazy initialization)
export const supabase = new Proxy({}, {
  get(target, prop) {
    if (!supabaseClient) {
      throw new Error('Supabase not initialized. Call loadSupabaseConfig() first.');
    }
    return supabaseClient[prop];
  }
});

// API base URL (your Express backend)
export let API_URL = DEFAULT_API_URL;

// Helper to get the current session from Supabase
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
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
export const apiCall = async (endpoint, options = {}) => {
  const token = await getAccessToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
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
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  
  if (error) {
    console.error('Failed to set session:', error);
    return false;
  }
  
  console.log('Supabase session set successfully');
  return true;
};

// Listen to auth state changes
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback);
};
