/**
 * Data layer. Exposes window.PalitData with the same API in two flavours:
 *   - Supabase (when keys are set in config.js)
 *   - Demo mode (sample data in localStorage) so the site works before Supabase is connected
 */
(function () {
  'use strict';
  var C = window.PALIT_CONFIG;

  /* ------------------------------ shared helpers ------------------------------ */
  function uid() {
    if (window.crypto && crypto.randomUUID) { try { return crypto.randomUUID(); } catch (e) {} }
    return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /** Turns 0917 123 4567 / 63917... / +63917... into +639171234567 (E.164). Returns null if invalid. */
  function normalizePhone(raw) {
    var s = String(raw || '').replace(/[^\d+]/g, '');
    if (!s) return null;
    if (s.charAt(0) === '+') { /* keep */ }
    else if (s.indexOf('00') === 0) s = '+' + s.slice(2);
    else if (s.charAt(0) === '0') s = '+63' + s.slice(1);
    else if (s.indexOf('63') === 0) s = '+' + s;
    else if (s.length === 10 && s.charAt(0) === '9') s = '+63' + s;
    else s = '+' + s;
    return /^\+\d{8,15}$/.test(s) ? s : null;
  }

  function niceError(err) {
    var m = (err && (err.message || err.error_description)) || String(err || 'Something went wrong');
    if (/invalid login credentials/i.test(m)) return 'Wrong mobile number / e-mail or password.';
    if (/already registered|already been registered|user already exists/i.test(m)) return 'That mobile number or e-mail is already registered. Try logging in.';
    if (/phone.*(provider|disabled|not enabled)|unsupported phone provider/i.test(m)) return 'Phone sign-in is not enabled in Supabase yet. See README step 4 (or set AUTH_MODE to "email").';
    if (/row-level security/i.test(m)) return 'Permission denied. Make sure you are logged in and schema.sql was run.';
    return m;
  }

  /* ================================ SUPABASE ================================== */
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
        accountType: m.account_type || 'buyer'
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

      deleteItem: function (id) { return sb.from('items').delete().eq('id', id).then(need); },

      getContact: function (itemId) {
        needUser();
        return sb.from('item_contacts').select('contact_number,gmail').eq('item_id', itemId).maybeSingle().then(function (r) {
          var d = need(r);
          return d ? { number: d.contact_number, gmail: d.gmail } : null;
        });
      },

      recordPurchase: function (itemId) {
        var u = needUser();
        return sb.from('purchases').upsert({ item_id: itemId, buyer_id: u.id }, { onConflict: 'item_id,buyer_id', ignoreDuplicates: true }).then(need);
      },

      stats: function () {
        return sb.from('item_stats').select('*').then(need).then(function (rows) {
          var m = {};
          rows.forEach(function (r) { m[r.item_id] = { buys: r.buys, avg: r.avg_stars, count: r.rating_count }; });
          return m;
        });
      },

      myRating: function (itemId) {
        var u = needUser();
        return sb.from('reviews').select('stars').eq('item_id', itemId).eq('user_id', u.id).maybeSingle().then(need).then(function (d) { return d ? d.stars : 0; });
      },

      rate: function (itemId, stars) {
        var u = needUser();
        return sb.from('reviews').upsert({ item_id: itemId, user_id: u.id, stars: stars }, { onConflict: 'item_id,user_id' }).then(need);
      }
    };
  }

  /* ================================== DEMO ==================================== */
  function makeDemo() {
    var KEY = 'palit_demo_v1', SKEY = 'palit_demo_session_v1';

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
      ['Mountain bike 26"', 8500, '🚲', '#ff9a5a', '#e5239d', 'Lightly used 21-speed mountain bike. New tires, brakes just serviced. Perfect for commuting or weekend trails. Meet-up in Quezon City.', 14.6760, 121.0437, 'Quezon City', 0, 3, 11, 4.6, 8],
      ['Yamaha acoustic guitar', 3200, '🎸', '#3a35c8', '#7b6cff', 'Great beginner guitar with soft case, extra strings and a clip-on tuner. Small scratch at the back, sounds beautiful.', 14.5547, 121.0244, 'Makati', 1, 8, 9, 4.8, 6],
      ['Canon DSLR + 18-55mm lens', 14000, '📷', '#1f2a5c', '#3a35c8', 'Canon DSLR with kit lens, battery, charger and bag. ~8,000 shutter count. Great for students and vloggers.', 14.5764, 121.0851, 'Pasig', 2, 20, 6, 4.9, 5],
      ['Rice cooker 1.8L', 450, '🍚', '#1fbf9f', '#0d8b78', 'Works perfectly. Keep-warm function, includes steamer tray and paddle. Selling because I moved to a dorm.', 14.6042, 120.9822, 'Sampaloc, Manila', 3, 30, 4, 4.2, 3],
      ['Wooden study desk', 1800, '🪑', '#ffc83d', '#ff7a3d', 'Solid wood study desk with drawer. 120 x 60 cm. Pick-up only. Can help load into a van.', 14.6507, 121.1029, 'Marikina', 0, 41, 3, 4.0, 2],
      ['PS4 console + 2 controllers', 12500, '🎮', '#171644', '#e5239d', 'PS4 Slim 1TB with two controllers, HDMI cable and 3 games. Tested before meet-up. Reason for selling: upgrading.', 14.5176, 121.0509, 'Taguig', 1, 5, 14, 4.7, 10],
      ['Standing fan 16"', 600, '🌀', '#7fd6ff', '#3a35c8', 'Quiet 3-speed standing fan, adjustable height, oscillating. Used for one year only.', 14.6488, 120.9830, 'Caloocan', 2, 55, 2, 4.5, 2],
      ['Leather sling bag', 950, '👜', '#a05a2c', '#d99a5b', 'Genuine leather sling bag, fits 11" tablet. Barely used, no stains.', 14.5794, 121.0359, 'Mandaluyong', 3, 12, 5, 4.4, 4],
      ['Electric kettle 1.7L', 350, '☕', '#e5239d', '#ff7a3d', 'Stainless electric kettle with auto shut-off. Boils fast. Free delivery within Parañaque for 2 items.', 14.4793, 121.0198, 'Parañaque', 0, 70, 1, 5.0, 1],
      ['Skateboard complete set', 2200, '🛹', '#22c3a6', '#3a35c8', 'Complete 8.0" skateboard, fresh grip tape, smooth bearings. Helmet included.', 14.5378, 121.0014, 'Pasay', 1, 26, 7, 4.3, 5]
    ];

    function seedDb() {
      var now = Date.now();
      var db = { users: [], items: [], contacts: {}, purchases: [], reviews: [], baseStats: {} };
      SELLERS.forEach(function (s) { db.users.push({ id: s.id, name: s.name, mobile: s.number, email: s.gmail, password: null, accountType: 'seller' }); });
      SEED.forEach(function (r, i) {
        var seller = SELLERS[r[9]], id = 'demo-' + (i + 1);
        db.items.push({
          id: id, seller_id: seller.id, seller_name: seller.name, title: r[0], price: r[1], description: r[5],
          image_urls: [art(r[2], r[3], r[4])], lat: r[6], lng: r[7], location_label: r[8], status: 'available',
          created_at: new Date(now - r[10] * 3600 * 1000).toISOString()
        });
        db.contacts[id] = { number: seller.number, gmail: seller.gmail };
        db.baseStats[id] = { buys: r[11], avg: r[12], count: r[13] };
      });
      return db;
    }

    function load() {
      try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && d.items) return d; } catch (e) {}
      var db = seedDb(); save(db); return db;
    }
    function save(db) {
      try { localStorage.setItem(KEY, JSON.stringify(db)); }
      catch (e) { throw new Error('Browser storage is full. Delete a demo listing or use fewer/smaller photos.'); }
    }

    var db = load();
    var user = null;
    var listeners = [];
    function publicUser(u) { return u ? { id: u.id, name: u.name, mobile: u.mobile, email: u.email, accountType: u.accountType } : null; }
    function emit() { listeners.forEach(function (f) { f(user); }); }
    function wait(v) { return new Promise(function (res) { setTimeout(function () { res(v); }, 120); }); }
    function fail(msg) { return Promise.reject(new Error(msg)); }

    return {
      mode: 'demo',
      normalizePhone: normalizePhone,
      niceError: niceError,
      onAuth: function (fn) { listeners.push(fn); },
      user: function () { return user; },

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
        var u = { id: uid(), name: f.username, mobile: f.mobile, email: f.email, company: f.company, accountType: f.accountType, password: f.password };
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

      signInGoogle: function () { return fail('Google login needs Supabase. Add your keys in config.js and enable the Google provider (README step 5).'); },

      signOut: function () {
        user = null; try { localStorage.removeItem(SKEY); } catch (e) {}
        emit(); return wait(true);
      },

      listItems: function () {
        var list = db.items.filter(function (i) { return i.status === 'available'; })
          .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        return wait(list);
      },

      getItem: function (id) { return wait(db.items.filter(function (i) { return i.id === id; })[0] || null); },

      myItems: function () {
        if (!user) return fail('Please log in first.');
        return wait(db.items.filter(function (i) { return i.seller_id === user.id; }));
      },

      createItem: function (f, blobs, onProgress) {
        if (!user) return fail('Please log in first.');
        return Promise.all(blobs.map(function (b) {
          return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(b); });
        })).then(function (urls) {
          var item = {
            id: uid(), seller_id: user.id, seller_name: user.name, title: f.title, price: f.price, description: f.description,
            image_urls: urls, lat: f.lat, lng: f.lng, location_label: f.label || null, status: 'available', created_at: new Date().toISOString()
          };
          db.items.push(item); db.contacts[item.id] = { number: f.contact, gmail: f.gmail };
          save(db);
          if (onProgress) onProgress(1);
          return wait(item);
        });
      },

      deleteItem: function (id) {
        db.items = db.items.filter(function (i) { return i.id !== id || i.seller_id !== (user && user.id); });
        delete db.contacts[id]; save(db); return wait(true);
      },

      getContact: function (itemId) {
        if (!user) return fail('Please log in first.');
        return wait(db.contacts[itemId] || null);
      },

      recordPurchase: function (itemId) {
        if (!user) return fail('Please log in first.');
        var it = db.items.filter(function (i) { return i.id === itemId; })[0];
        if (it && it.seller_id === user.id) return fail('You cannot buy your own listing.');
        var exists = db.purchases.some(function (p) { return p.item_id === itemId && p.buyer_id === user.id; });
        if (!exists) { db.purchases.push({ item_id: itemId, buyer_id: user.id, at: Date.now() }); save(db); }
        return wait(true);
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

      myRating: function (itemId) {
        if (!user) return Promise.resolve(0);
        var r = db.reviews.filter(function (x) { return x.item_id === itemId && x.user_id === user.id; })[0];
        return wait(r ? r.stars : 0);
      },

      rate: function (itemId, stars) {
        if (!user) return fail('Please log in first.');
        if (!db.purchases.some(function (p) { return p.item_id === itemId && p.buyer_id === user.id; })) return fail('Only buyers can rate an item.');
        var r = db.reviews.filter(function (x) { return x.item_id === itemId && x.user_id === user.id; })[0];
        if (r) r.stars = stars; else db.reviews.push({ item_id: itemId, user_id: user.id, stars: stars });
        save(db); return wait(true);
      }
    };
  }

  var live = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient);
  if (C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !live) { console.warn('[Palit] Supabase library failed to load - falling back to demo mode.'); }
  window.PalitData = live ? makeLive() : makeDemo();
})();
