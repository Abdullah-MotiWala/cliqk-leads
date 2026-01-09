import { createClient } from '@supabase/supabase-js';

// Ensure keys are strings and exist
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
console.log(supabaseAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase Error: API Keys missing. Check your .env.local file.'
  );
}

export const supabase = createClient(supabaseUrl,supabaseAnonKey);
