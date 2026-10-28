import { createClient } from '@supabase/supabase-js';

const isRealValue = (v?: string) =>
  Boolean(v && !v.includes('placeholder') && !v.includes('your_') && !v.includes('your-') && !v.startsWith('MY_'));

const supabaseUrl =
  [
    process.env.VITE_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ].find((v) => isRealValue(v) && v!.startsWith('http')) || '';

const supabaseKey =
  [
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ].find(isRealValue) || '';

if (!supabaseUrl || !supabaseKey) {
  console.log('Skipping admin setup. Please set VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY / VITE_SUPABASE_PUBLISHABLE_KEY first.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAdmin() {
  console.log('Setting up admin account...');
  
  const { data, error } = await supabase.auth.signUp({
    email: 'wolter@admin.com',
    password: 'wolNyuon09.',
    options: {
      data: {
        full_name: 'Admin Wolter',
        role: 'admin',
        education_level: 'University',
        country: 'Global',
      }
    }
  });

  if (error) {
    if (error.message.includes('User already registered') || error.message.includes('already exists')) {
      console.log('Admin account already exists! You can log in with your credentials.');
    } else {
      console.error('Error creating admin account:', error.message);
    }
  } else {
    console.log('Successfully created admin account or sent confirmation email.');
  }
}

setupAdmin();
