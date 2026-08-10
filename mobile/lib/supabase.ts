import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy mobile/.env.example to mobile/.env and fill it in.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native — deep links are handled explicitly.
    detectSessionInUrl: false,
  },
});

// Realtime subscriptions go stale after the app is backgrounded (spec §10).
AppState.addEventListener('change', (state) => {
  if (state === 'active' && !supabase.realtime.isConnected()) {
    supabase.realtime.connect();
  }
});
