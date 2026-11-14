/* =====================================================================
   FILE: data.js  —  DATA LAYER (talks to Supabase, or to the browser in DEMO MODE)
   ---------------------------------------------------------------------
   Every other file only calls  PalitData.something()  — never Supabase directly.
   Both modes have the SAME function names, so the pages never care which one is on.

   MAP OF THIS FILE (search for the [TAG]):
   [HELPERS]        phone formatter + friendly error messages
   [LIVE]           real Supabase version
        [LIVE-AUTH]       sign up / log in / log out
        [LIVE-PROFILE]    get + update the client profile
        [LIVE-ITEMS]      list / create / UPDATE / DELETE items (seller CRUD)
        [LIVE-BUY]        buy, my purchases, remove purchase, rate (buyer CRUD)
   [DEMO]           browser-only version with sample data (no Supabase needed)
        [DEMO-SAMPLE-DATA] the sample sellers + items
        [DEMO-AUTH] [DEMO-PROFILE] [DEMO-ITEMS] [DEMO-BUY]
   [PICK-MODE]      chooses LIVE or DEMO at the very bottom
   ===================================================================== */
(function () {
  'use strict';
  var C = window.PALIT_CONFIG;

  /* ---------------------------------------------------------------- [HELPERS] */
  function uid() {
    if (window.crypto && crypto.randomUUID) { try { return crypto.randomUUID(); } catch (e) {} }
    return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* Turns 0917 123 4567 / 63917... / +63917... into +639171234567. Returns null if invalid. */
  function normalizePhone(raw) {
    var s = String(raw || '').replace(/[^\d+]/g, '');
    if (!s) return null;
    if (s.charAt(0) === '+') { /* keep it */ }
    else if (s.indexOf('00') === 0) s = '+' + s.slice(2);
    else if (s.charAt(0) === '0') s = '+63' + s.slice(1);
    else if (s.indexOf('63') === 0) s = '+' + s;
    else if (s.length === 10 && s.charAt(0) === '9') s = '+63' + s;
    else s = '+' + s;
    return /^\+\d{8,15}$/.test(s) ? s : null;
  }

  /* Turns scary technical errors into plain sentences. Add your own messages here. */
  function niceError(err) {
    var m = (err && (err.message || err.error_description)) || String(err || 'Something went wrong');
    if (/invalid login credentials/i.test(m)) return 'Wrong mobile number / e-mail or password.';
    if (/already registered|already been registered|user already exists/i.test(m)) return 'That mobile number or e-mail is already registered. Try logging in.';
    if (/phone.*(provider|disabled|not enabled)|unsupported phone provider/i.test(m)) return 'Phone sign-in is not enabled in Supabase yet. Turn it on, or set AUTH_MODE to "email" in config.js.';
    if (/row-level security/i.test(m)) return 'Permission denied. Make sure you are logged in and schema.sql was run.';
    return m;
  }

  /* ====================================================================== [LIVE] */
  function makeLive() {
    var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
    var user = null;
    var listeners = [];

    function toUser(u) {
      if (!u) return null;
      var m = u.user_metadata || {};
      return {
        id: u.id,
        name: m.username || m.full_name || m.name || u.email || u.phone || 'User',
        mobile: u.phone ? '+' + String(u.phone).replace(/^\+/, '') : (m.mobile || ''),
        email: m.email || u.email || '',
        company: m.company || '',
        accountType: m.account_type || 'buyer',
        createdAt: u.created_at
      };
    }
    function need(res) { if (res.error) throw res.error; return res.data; }
    function needUser() { if (!user) throw new Error('Please log in first.'); return user; }

    return {
      mode: 'supabase',
      normalizePhone: normalizePhone,
      niceError: niceError,
      onAuth: function (fn) { listeners.push(fn); },
      user: function () { return user; },

      /* ------------------------------------------------------------ [LIVE-AUTH] */
      init: function () {
        return sb.auth.getSession().then(function (r) {
          user = toUser(r.data && r.data.session && r.data.session.user);
          sb.auth.onAuthStateChange(function (_e, session) {
            user = toUser(session && session.user);
            setTimeout(function () { listeners.forEach(function (f) { f(user); }); }, 0);
          });
          return user;
        });
      },
      signUp: function (f) {
        var meta = { username: f.username, email: f.email, company: f.company, account_type: f.accountType, mobile: f.mobile };
        var req = C.AUTH_MODE === 'email'
          ? sb.auth.signUp({ email: f.email, password: f.password, options: { data: meta } })
          : sb.auth.signUp({ phone: f.mobile, password: f.password, options: { data: meta } });
        return req.then(function (res) {
          if (res.error) throw res.error;
          return { signedIn: !!res.data.session };
        });
      },
      signIn: function (id, password) {
        var creds = C.AUTH_MODE === 'email' ? { email: id, password: password } : { phone: id, password: password };
        return sb.auth.signInWithPassword(creds).then(need);
      },
      signInGoogle: function () {
        return sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }).then(need);
      },
      signOut: function () { return sb.auth.signOut(); },

      /* --------------------------------------------------------- [LIVE-PROFILE] */
      getProfile: function () {
        var u = needUser();
        return sb.from('profiles').select('*').eq('id', u.id).maybeSingle().then(need).then(function (p) {
          p = p || {};
          return {
            id: u.id, name: p.username || u.name, mobile: p.mobile || u.mobile, email: p.email || u.email,
            company: p.company || u.company, accountType: p.account_type || u.accountType,
            bio: p.bio || '', city: p.city || '', createdAt: p.created_at || u.createdAt
          };
        });
      },
      updateProfile: function (f) {
        var u = needUser();
        var row = { id: u.id, username: f.name, mobile: f.mobile, email: f.email, company: f.company, account_type: f.accountType, bio: f.bio, city: f.city };
        return sb.from('profiles').upsert(row).then(need).then(function () {
          user.name = f.name; user.accountType = f.accountType; user.company = f.company;
          /* old listings keep showing the new name */
          return sb.from('items').update({ seller_name: f.name }).eq('seller_id', u.id);
        }).then(function () {
          return sb.auth.updateUser({ data: { username: f.name, company: f.company, account_type: f.accountType } });
        }).then(function () { return true; });
      },

      /* ----------------------------------------------------------- [LIVE-ITEMS] */
      listItems: function () {
        return sb.from('items').select('*').eq('status', 'available').order('created_at', { ascending: false }).limit(500).then(need);
      },
      getItem: function (id) {
        return sb.from('items').select('*').eq('id', id).maybeSingle().then(need);
      },
      myItems: function () {
        var u = needUser();
        return sb.from('items').select('*').eq('seller_id', u.id).order('created_at', { ascending: false }).then(need);
      },
      /* seller's own contact row (used to fill the Edit form) */
      getContact: function (itemId) {
        needUser();
        return sb.from('item_contacts').select('contact_number,gmail').eq('item_id', itemId).maybeSingle().then(function (r) {
          var d = need(r);
          return d ? { number: d.contact_number, gmail: d.gmail } : null;
        });
      },
      /* CREATE */
      createItem: function (f, blobs, onProgress) {
        var u = needUser();
        var urls = [];
        var chain = Promise.resolve();
        blobs.forEach(function (blob, i) {
          chain = chain.then(function () {
            var path = u.id + '/' + uid() + '.jpg';
            return sb.storage.from(C.STORAGE_BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }).then(function (r) {
              if (r.error) throw r.error;
              urls.push(sb.storage.from(C.STORAGE_BUCKET).getPublicUrl(path).data.publicUrl);
              if (onProgress) onProgress((i + 1) / (blobs.length + 1));
            });
          });
        });
        return chain.then(function () {
          return sb.from('items').insert({
            seller_id: u.id, seller_name: u.name, title: f.title, price: f.price, description: f.description,
            category: f.category || 'other', condition: f.condition || 'used', quantity: f.quantity || 1, meetup_notes: f.meetup || null,
            image_urls: urls, lat: f.lat, lng: f.lng, location_label: f.label || null
          }).select().single().then(need);
        }).then(function (item) {
          return sb.from('item_contacts').insert({ item_id: item.id, contact_number: f.contact, gmail: f.gmail }).then(function (r) {
            if (r.error) { sb.from('items').delete().eq('id', item.id); throw r.error; }
            if (onProgress) onProgress(1);
            return item;
          });
        });
      },
      /* UPDATE (edit a listing) */
      updateItem: function (id, f) {
        var u = needUser();
        return sb.from('items').update({
          title: f.title, price: f.price, description: f.description, category: f.category,
          condition: f.condition, quantity: f.quantity, meetup_notes: f.meetup || null,
          location_label: f.label || null, status: f.status
        }).eq('id', id).eq('seller_id', u.id).select().single().then(need).then(function (item) {
          return sb.from('item_contacts').upsert({ item_id: id, contact_number: f.contact, gmail: f.gmail }).then(need).then(function () { return item; });
        });
      },
      /* DELETE */
      deleteItem: function (id) { return sb.from('items').delete().eq('id', id).then(need); },

      /* ------------------------------------------------------------ [LIVE-BUY] */
      recordPurchase: function (itemId) {
        var u = needUser();
        return sb.from('purchases').upsert({ item_id: itemId, buyer_id: u.id }, { onConflict: 'item_id,buyer_id', ignoreDuplicates: true }).then(need);
      },
      /* READ — everything this buyer bought: [{ item, boughtAt }] */
      myPurchases: function () {
        var u = needUser();
        return sb.from('purchases').select('created_at, items(*)').eq('buyer_id', u.id).order('created_at', { ascending: false }).then(need).then(function (rows) {
          var out = [];
          rows.forEach(function (r) { if (r.items) out.push({ item: r.items, boughtAt: r.created_at }); });
          return out;
        });
      },
      /* DELETE — remove a purchase (and the buyer's rating for it) */
      removePurchase: function (itemId) {
        var u = needUser();
        return sb.from('reviews').delete().eq('item_id', itemId).eq('user_id', u.id).then(function () {
          return sb.from('purchases').delete().eq('item_id', itemId).eq('buyer_id', u.id).then(need);
        });
      },
      stats: function () {
        return sb.from('item_stats').select('*').then(need).then(function (rows) {
          var m = {};
          rows.forEach(function (r) { m[r.item_id] = { buys: r.buys, avg: r.avg_stars, count: r.rating_count }; });
          return m;
        });
      },
      /* all my ratings as { itemId: stars } */
      myRatings: function () {
        var u = needUser();
        return sb.from('reviews').select('item_id,stars').eq('user_id', u.id).then(need).then(function (rows) {
          var m = {};
          rows.forEach(function (r) { m[r.item_id] = r.stars; });
          return m;
        });
      },
      /* CREATE / UPDATE a rating */
      rate: function (itemId, stars) {
        var u = needUser();
        return sb.from('reviews').upsert({ item_id: itemId, user_id: u.id, stars: stars }, { onConflict: 'item_id,user_id' }).then(need);
      },
      /* DELETE a rating */
      removeRating: function (itemId) {
        var u = needUser();
        return sb.from('reviews').delete().eq('item_id', itemId).eq('user_id', u.id).then(need);
      },
      /* buyer-only: the seller phone + Gmail (same function name as above) */
      getSellerContact: function (itemId) { return this.getContact(itemId); }
    };
  }

  /* ====================================================================== [DEMO] */
  function makeDemo() {
    var KEY = 'palit_demo_v3', SKEY = 'palit_demo_session_v1';

    /* ------------------------------------------------------ [DEMO-SAMPLE-DATA] */
    function art(emoji, c1, c2) {
      var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
        "<stop offset='0' stop-color='" + c1 + "'/><stop offset='1' stop-color='" + c2 + "'/></linearGradient></defs>" +
        "<rect width='400' height='300' fill='url(#g)'/><circle cx='330' cy='60' r='70' fill='rgba(255,255,255,.14)'/>" +
        "<text x='200' y='188' font-size='120' text-anchor='middle'>" + emoji + "</text></svg>";
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    var SELLERS = [
      { id: 's1', name: 'Ana Cruz',     number: '0917 555 0101', gmail: 'ana.cruz.demo@example.com' },
      { id: 's2', name: 'Miguel Reyes', number: '0918 555 0102', gmail: 'miguel.reyes.demo@example.com' },
      { id: 's3', name: 'Joy Santos',   number: '0927 555 0103', gmail: 'joy.santos.demo@example.com' },
      { id: 's4', name: 'Paolo Lim',    number: '0998 555 0104', gmail: 'paolo.lim.demo@example.com' }
    ];

    // [title, price, emoji, c1, c2, description, lat, lng, label, sellerIdx, hoursAgo, buys, avg, ratingCount]
    var SEED = [
      ['Mountain bike 26"', 8500, '🚲', '#ff9a5a', '#e5239d', 'Lightly used 21-speed mountain bike. New tires, brakes just serviced. Perfect for commuting or weekend trails. Meet-up in Quezon City.', 14.6760, 121.0437, 'Quezon City', 0, 3, 11, 4.6, 8, 'vehicles'],
      ['Yamaha acoustic guitar', 3200, '🎸', '#3a35c8', '#7b6cff', 'Great beginner guitar with soft case, extra strings and a clip-on tuner. Small scratch at the back, sounds beautiful.', 14.5547, 121.0244, 'Makati', 1, 8, 9, 4.8, 6, 'hobbies'],
      ['Canon DSLR + 18-55mm lens', 14000, '📷', '#1f2a5c', '#3a35c8', 'Canon DSLR with kit lens, battery, charger and bag. ~8,000 shutter count. Great for students and vloggers.', 14.5764, 121.0851, 'Pasig', 2, 20, 6, 4.9, 5, 'electronics'],
      ['Rice cooker 1.8L', 450, '🍚', '#1fbf9f', '#0d8b78', 'Works perfectly. Keep-warm function, includes steamer tray and paddle. Selling because I moved to a dorm.', 14.6042, 120.9822, 'Sampaloc, Manila', 3, 30, 4, 4.2, 3, 'home'],
      ['Wooden study desk', 1800, '🪑', '#ffc83d', '#ff7a3d', 'Solid wood study desk with drawer. 120 x 60 cm. Pick-up only. Can help load into a van.', 14.6507, 121.1029, 'Marikina', 0, 41, 3, 4.0, 2, 'home'],
      ['PS4 console + 2 controllers', 12500, '🎮', '#171644', '#e5239d', 'PS4 Slim 1TB with two controllers, HDMI cable and 3 games. Tested before meet-up. Reason for selling: upgrading.', 14.5176, 121.0509, 'Taguig', 1, 5, 14, 4.7, 10, 'electronics'],
      ['Standing fan 16"', 600, '🌀', '#7fd6ff', '#3a35c8', 'Quiet 3-speed standing fan, adjustable height, oscillating. Used for one year only.', 14.6488, 120.9830, 'Caloocan', 2, 55, 2, 4.5, 2, 'home'],
      ['Leather sling bag', 950, '👜', '#a05a2c', '#d99a5b', 'Genuine leather sling bag, fits 11" tablet. Barely used, no stains.', 14.5794, 121.0359, 'Mandaluyong', 3, 12, 5, 4.4, 4, 'fashion'],
      ['Electric kettle 1.7L', 350, '☕', '#e5239d', '#ff7a3d', 'Stainless electric kettle with auto shut-off. Boils fast. Free delivery within Parañaque for 2 items.', 14.4793, 121.0198, 'Parañaque', 0, 70, 1, 5.0, 1, 'home'],
      ['Skateboard complete set', 2200, '🛹', '#22c3a6', '#3a35c8', 'Complete 8.0" skateboard, fresh grip tape, smooth bearings. Helmet included.', 14.5378, 121.0014, 'Pasay', 1, 26, 7, 4.3, 5, 'hobbies'],
      ['Homemade leche flan (llanera)', 350, '🍮', '#ffc83d', '#ff7a3d', 'Creamy homemade leche flan in an 8 x 5 inch llanera. Made fresh to order, message me a day before pick-up.', 14.6091, 121.0223, 'San Juan', 2, 6, 3, 4.8, 3, 'food'],
      ['Dried mangoes (5 packs)', 400, '🥭', '#ffc83d', '#1fbf9f', 'Sweet dried mangoes, 100g x 5 packs. Sealed and fresh, great as pasalubong.', 14.5860, 121.1761, 'Cainta', 3, 18, 5, 4.6, 4, 'food'],
      ['Honda Click 125i (2019)', 52000, '🛵', '#171644', '#3a35c8', 'Well-maintained scooter, 18,000 km, complete papers, first owner. New battery and tires. Test ride welcome.', 14.6349, 121.0437, 'Quezon City', 1, 10, 2, 4.5, 2, 'vehicles'],
      ['Toyota Vios 1.3 E (2015)', 285000, '🚗', '#7fd6ff', '#1f2a5c', 'Manual transmission, 62,000 km, casa-maintained, complete papers. Cold aircon, no accidents.', 14.4445, 120.9939, 'Las Piñas', 0, 30, 1, 4.7, 1, 'vehicles']
    ];

    function seedDb() {
      var now = Date.now();
      var db = { users: [], items: [], contacts: {}, purchases: [], reviews: [], baseStats: {} };
      SELLERS.forEach(function (s) { db.users.push({ id: s.id, name: s.name, mobile: s.number, email: s.gmail, password: null, accountType: 'seller' }); });
      SEED.forEach(function (r, i) {
        var seller = SELLERS[r[9]], id = 'demo-' + (i + 1);
        db.items.push({
          id: id, seller_id: seller.id, seller_name: seller.name, title: r[0], price: r[1], description: r[5],
          image_urls: [art(r[2], r[3], r[4])], lat: r[6], lng: r[7], location_label: r[8], category: r[14] || 'other',
          condition: 'used', quantity: 1, meetup_notes: '', status: 'available',
          created_at: new Date(now - r[10] * 3600 * 1000).toISOString()
        });
        db.contacts[id] = { number: seller.number, gmail: seller.gmail };
        db.baseStats[id] = { buys: r[11], avg: r[12], count: r[13] };
      });
      return db;
    }
    function load() {
      try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && d.items) return d; } catch (e) {}
      var fresh = seedDb(); save(fresh); return fresh;
    }
    function save(d) {
      try { localStorage.setItem(KEY, JSON.stringify(d)); }
      catch (e) { throw new Error('Browser storage is full. Delete a demo listing or use fewer/smaller photos.'); }
    }

    var db = load();
    var user = null;
    var listeners = [];
    function findItem(id) { return db.items.filter(function (i) { return i.id === id; })[0]; }
    function publicUser(u) {
      return u ? { id: u.id, name: u.name, mobile: u.mobile, email: u.email, company: u.company || '', accountType: u.accountType, bio: u.bio || '', city: u.city || '', createdAt: u.createdAt || '' } : null;
    }
    function emit() { listeners.forEach(function (f) { f(user); }); }
    function wait(v) { return new Promise(function (res) { setTimeout(function () { res(v); }, 120); }); }
    function fail(msg) { return Promise.reject(new Error(msg)); }
    function didBuy(itemId) { return db.purchases.some(function (p) { return p.item_id === itemId && p.buyer_id === user.id; }); }

    return {
      mode: 'demo',
      normalizePhone: normalizePhone,
      niceError: niceError,
      onAuth: function (fn) { listeners.push(fn); },
      user: function () { return user; },

      /* ------------------------------------------------------------ [DEMO-AUTH] */
      init: function () {
        var sid = null; try { sid = localStorage.getItem(SKEY); } catch (e) {}
        var u = sid && db.users.filter(function (x) { return x.id === sid && x.password; })[0];
        user = publicUser(u);
        return Promise.resolve(user);
      },
      signUp: function (f) {
        var phone = normalizePhone(f.mobile);
        var dupe = db.users.some(function (u) { return u.password && ((phone && normalizePhone(u.mobile) === phone) || (u.email || '').toLowerCase() === f.email.toLowerCase()); });
        if (dupe) return fail('That mobile number or e-mail is already registered. Try logging in.');
        var u = { id: uid(), name: f.username, mobile: f.mobile, email: f.email, company: f.company, accountType: f.accountType, password: f.password, createdAt: new Date().toISOString() };
        db.users.push(u); save(db);
        user = publicUser(u);
        try { localStorage.setItem(SKEY, u.id); } catch (e) {}
        emit();
        return wait({ signedIn: true });
      },
      signIn: function (id, password) {
        var phone = normalizePhone(id), low = String(id || '').toLowerCase();
        var u = db.users.filter(function (x) {
          return x.password && ((phone && normalizePhone(x.mobile) === phone) || (x.email || '').toLowerCase() === low);
        })[0];
        if (!u || u.password !== password) return fail('Wrong mobile number / e-mail or password.');
        user = publicUser(u);
        try { localStorage.setItem(SKEY, u.id); } catch (e) {}
        emit();
        return wait(true);
      },
      signInGoogle: function () { return fail('Google login needs Supabase. Add your keys in config.js first.'); },
      signOut: function () {
        user = null; try { localStorage.removeItem(SKEY); } catch (e) {}
        emit(); return wait(true);
      },

      /* --------------------------------------------------------- [DEMO-PROFILE] */
      getProfile: function () {
        if (!user) return fail('Please log in first.');
        var u = db.users.filter(function (x) { return x.id === user.id; })[0];
        return wait(publicUser(u));
      },
      updateProfile: function (f) {
        if (!user) return fail('Please log in first.');
        var u = db.users.filter(function (x) { return x.id === user.id; })[0];
        u.name = f.name; u.mobile = f.mobile; u.email = f.email; u.company = f.company; u.accountType = f.accountType; u.bio = f.bio; u.city = f.city;
        db.items.forEach(function (i) { if (i.seller_id === u.id) i.seller_name = f.name; });
        save(db);
        user = publicUser(u);
        return wait(true);
      },

      /* ----------------------------------------------------------- [DEMO-ITEMS] */
      listItems: function () {
        var list = db.items.filter(function (i) { return i.status === 'available'; })
          .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        return wait(list);
      },
      getItem: function (id) { return wait(findItem(id) || null); },
      myItems: function () {
        if (!user) return fail('Please log in first.');
        return wait(db.items.filter(function (i) { return i.seller_id === user.id; }));
      },
      getContact: function (itemId) {
        if (!user) return fail('Please log in first.');
        return wait(db.contacts[itemId] || null);
      },
      createItem: function (f, blobs, onProgress) {
        if (!user) return fail('Please log in first.');
        return Promise.all(blobs.map(function (b) {
          return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(b); });
        })).then(function (urls) {
          var item = {
            id: uid(), seller_id: user.id, seller_name: user.name, title: f.title, price: f.price, description: f.description,
            category: f.category || 'other', condition: f.condition || 'used', quantity: f.quantity || 1, meetup_notes: f.meetup || '',
            image_urls: urls, lat: f.lat, lng: f.lng, location_label: f.label || null, status: 'available', created_at: new Date().toISOString()
          };
          db.items.push(item); db.contacts[item.id] = { number: f.contact, gmail: f.gmail };
          save(db);
          if (onProgress) onProgress(1);
          return wait(item);
        });
      },
      updateItem: function (id, f) {
        var it = findItem(id);
        if (!user || !it || it.seller_id !== user.id) return fail('You can only edit your own listing.');
        it.title = f.title; it.price = f.price; it.description = f.description; it.category = f.category;
        it.condition = f.condition; it.quantity = f.quantity; it.meetup_notes = f.meetup || ''; it.location_label = f.label || null; it.status = f.status;
        db.contacts[id] = { number: f.contact, gmail: f.gmail };
        save(db); return wait(it);
      },
      deleteItem: function (id) {
        db.items = db.items.filter(function (i) { return i.id !== id || i.seller_id !== (user && user.id); });
        delete db.contacts[id]; save(db); return wait(true);
      },

      /* ------------------------------------------------------------ [DEMO-BUY] */
      recordPurchase: function (itemId) {
        if (!user) return fail('Please log in first.');
        var it = findItem(itemId);
        if (it && it.seller_id === user.id) return fail('You cannot buy your own listing.');
        if (!didBuy(itemId)) { db.purchases.push({ item_id: itemId, buyer_id: user.id, at: new Date().toISOString() }); save(db); }
        return wait(true);
      },
      myPurchases: function () {
        if (!user) return fail('Please log in first.');
        var out = [];
        db.purchases.forEach(function (p) {
          var it = findItem(p.item_id);
          if (p.buyer_id === user.id && it) out.push({ item: it, boughtAt: p.at });
        });
        out.sort(function (a, b) { return new Date(b.boughtAt) - new Date(a.boughtAt); });
        return wait(out);
      },
      removePurchase: function (itemId) {
        if (!user) return fail('Please log in first.');
        db.purchases = db.purchases.filter(function (p) { return !(p.item_id === itemId && p.buyer_id === user.id); });
        db.reviews = db.reviews.filter(function (r) { return !(r.item_id === itemId && r.user_id === user.id); });
        save(db); return wait(true);
      },
      stats: function () {
        var m = {};
        db.items.forEach(function (i) {
          var base = db.baseStats[i.id] || { buys: 0, avg: 0, count: 0 };
          var buys = base.buys + db.purchases.filter(function (p) { return p.item_id === i.id; }).length;
          var rs = db.reviews.filter(function (r) { return r.item_id === i.id; });
          var sum = base.avg * base.count + rs.reduce(function (a, r) { return a + r.stars; }, 0);
          var cnt = base.count + rs.length;
          m[i.id] = { buys: buys, avg: cnt ? Math.round(sum / cnt * 100) / 100 : 0, count: cnt };
        });
        return wait(m);
      },
      myRatings: function () {
        if (!user) return Promise.resolve({});
        var m = {};
        db.reviews.forEach(function (r) { if (r.user_id === user.id) m[r.item_id] = r.stars; });
        return wait(m);
      },
      rate: function (itemId, stars) {
        if (!user) return fail('Please log in first.');
        if (!didBuy(itemId)) return fail('Only buyers can rate an item.');
        var r = db.reviews.filter(function (x) { return x.item_id === itemId && x.user_id === user.id; })[0];
        if (r) r.stars = stars; else db.reviews.push({ item_id: itemId, user_id: user.id, stars: stars });
        save(db); return wait(true);
      },
      removeRating: function (itemId) {
        if (!user) return fail('Please log in first.');
        db.reviews = db.reviews.filter(function (r) { return !(r.item_id === itemId && r.user_id === user.id); });
        save(db); return wait(true);
      },
      getSellerContact: function (itemId) { return this.getContact(itemId); }
    };
  }

  /* ================================================================ [PICK-MODE] */
  var live = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient);
  if (C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !live) { console.warn('Supabase library failed to load - using demo mode.'); }
  window.PalitData = live ? makeLive() : makeDemo();
})();
