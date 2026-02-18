import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://rlkvqkjbnwipggakxqyb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsa3Zxa2pibndpcGdnYWt4cXliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQwMTM2NSwiZXhwIjoyMDg2OTc3MzY1fQ.L57ktIls9IW9B9k1pnXlN5LmzivbTXcKg-d4Q-FuBwc';

export const db = createClient(supabaseUrl, supabaseKey);
