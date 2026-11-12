/**
 * PALIT settings.
 * 1) Create a free project at https://supabase.com
 * 2) Run supabase/schema.sql in the SQL Editor
 * 3) Paste your Project URL and anon (public) key below
 *    (Supabase Dashboard > Project Settings > API)
 *
 * Leave both empty and the site runs in DEMO MODE (sample data saved in your browser only).
 * The anon key is safe to ship in the browser: Row Level Security in schema.sql protects the data.
 * NEVER paste the "service_role" key here.
 */
window.PALIT_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // 'phone' = people log in with their mobile number (Supabase Phone provider, confirmations OFF).
  // 'email' = people log in with their e-mail instead (no phone provider needed).
  AUTH_MODE: 'phone',

  // Item categories shown as filter chips in the Market and as a required dropdown on the Sell page.
  // Add / rename / remove lines freely. Keep each id lowercase with no spaces. Keep an 'other' entry last.
  CATEGORIES: [
    { id: 'food',        label: 'Food',              emoji: '🍔' },
    { id: 'electronics', label: 'Electronics',       emoji: '📱' },
    { id: 'vehicles',    label: 'Vehicles',          emoji: '🚗' },
    { id: 'home',        label: 'Home & Furniture',  emoji: '🛋️' },
    { id: 'fashion',     label: 'Fashion',           emoji: '👕' },
    { id: 'hobbies',     label: 'Sports & Hobbies',  emoji: '🎸' },
    { id: 'other',       label: 'Other',             emoji: '📦' }
  ],

  CURRENCY: '₱',
  DEFAULT_CENTER: { lat: 14.5995, lng: 120.9842, label: 'Manila' }, // used until the buyer shares their location
  STORAGE_BUCKET: 'item-images',
  MAX_PHOTOS: 10
};
