import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://rlkvqkjbnwipggakxqyb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsa3Zxa2pibndpcGdnYWt4cXliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQwMTM2NSwiZXhwIjoyMDg2OTc3MzY1fQ.L57ktIls9IW9B9k1pnXlN5LmzivbTXcKg-d4Q-FuBwc';

export const db = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  // realtime is disabled — no channels used in this API,
  // and keeping it alive would block the Vercel serverless function
  realtime: {
    params: { eventsPerSecond: -1 },
  },
});

// Disconnect realtime immediately to prevent keeping the event loop open
// in serverless environments (Vercel, AWS Lambda, etc.)
db.realtime.disconnect();
