import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Load backend/.env so Supabase + JWT creds are available in the Vercel serverless runtime
const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(__dirname, '../backend/.env') });

import { app } from '../backend/src/index.js';

// Vercel serverless function handler
export default app.fetch.bind(app);
