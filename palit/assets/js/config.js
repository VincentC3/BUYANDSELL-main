/* =====================================================================
   FILE: config.js  —  SETTINGS (the easiest file to change)
   ---------------------------------------------------------------------
   [SUPABASE-KEYS]  paste your Supabase URL + anon key (leave empty = DEMO MODE)
   [STORE-NAME]     the name shown on the site
   [AUTH-MODE]      login with phone number or e-mail
   [CATEGORIES]     the category list (filter chips + Sell form dropdown)
   [CONDITIONS]     the "condition" dropdown on the Sell / Edit form
   [OTHER-SETTINGS] currency, default map center, photo limit
   NEVER paste the "service_role" key here. The anon key is safe.
   ===================================================================== */
window.PALIT_CONFIG = {

  /* [SUPABASE-KEYS] */
  SUPABASE_URL: 'https://ygawskrnbudzwbgixmoj.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_LF8WbdJNxzoohCunsbW1uw_YBshkaA4',

  /* [STORE-NAME] */
  STORE_NAME: 'Jomar Sangil Store',

  /* [AUTH-MODE]  'phone' or 'email' */
  AUTH_MODE: 'email',

  /* [CATEGORIES]  keep every id lowercase, no spaces, and keep 'other' last */
  CATEGORIES: [
    { id: 'food',        label: 'Food',              emoji: '🍔' },
    { id: 'electronics', label: 'Electronics',       emoji: '📱' },
    { id: 'vehicles',    label: 'Vehicles',          emoji: '🚗' },
    { id: 'home',        label: 'Home & Furniture',  emoji: '🛋️' },
    { id: 'fashion',     label: 'Fashion',           emoji: '👕' },
    { id: 'hobbies',     label: 'Sports & Hobbies',  emoji: '🎸' },
    { id: 'other',       label: 'Other',             emoji: '📦' }
  ],

  /* [CONDITIONS] */
  CONDITIONS: [
    { id: 'new',      label: 'Brand new' },
    { id: 'like-new', label: 'Like new' },
    { id: 'used',     label: 'Used' },
    { id: 'for-parts', label: 'For parts / repair' }
  ],

  /* [OTHER-SETTINGS] */
  CURRENCY: '₱',
  DEFAULT_CENTER: { lat: 14.5995, lng: 120.9842, label: 'Manila' },
  STORAGE_BUCKET: 'item-images',
  MAX_PHOTOS: 10
};
