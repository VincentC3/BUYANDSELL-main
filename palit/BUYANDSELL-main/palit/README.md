# Palit — local marketplace (HTML + CSS + JS + Supabase)

Pages: **Market** (opens first, all posted items + interactive map + distance) · **Sell Item** (upload form with live preview) · **Ratings** (top selling items) · **Login / Signup** (opened by BUY ITEM).

## Try it right now (demo mode)
Double-click `index.html`. With no Supabase keys it runs on sample data saved in your browser.
(Needs internet for the map tiles, fonts and the Leaflet library.)

## Go live with Supabase
1. Create a free project at https://supabase.com.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
   This creates the tables, security rules (RLS) and the `item-images` storage bucket.
3. **Project Settings → API** → copy **Project URL** and the **anon public** key into `assets/js/config.js`.
   Never use the `service_role` key in the browser.
4. Login by mobile number: **Authentication → Providers → Phone** → enable it and turn
   **"Enable phone confirmations" OFF** (so no SMS is needed). Supabase may ask you to pick an SMS provider
   to save the form; any placeholder is fine while confirmations are off.
   *Prefer e-mail login?* set `AUTH_MODE: 'email'` in `config.js` and skip this step.
5. Optional "Login with Google": **Authentication → Providers → Google** (add your Google OAuth client ID/secret) and add your site URL under
   **Authentication → URL Configuration**.
6. Deploy the folder to any static host (Netlify, Vercel, GitHub Pages) or serve locally: `python3 -m http.server`.

## How BUY ITEM works
- Logged out: BUY ITEM → login/signup page → back to the item with the seller's name, phone and Gmail shown.
- Seller phone/Gmail live in a separate table (`item_contacts`) that only signed-in users can read.
- Each BUY ITEM press by a logged-in buyer records a purchase; the Ratings page ranks items by these. Buyers can then rate 1–5 stars.

## Files
- `index.html` · `assets/css/style.css` · `assets/js/{config,data,app}.js` · `supabase/schema.sql`
