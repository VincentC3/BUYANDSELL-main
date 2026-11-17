/* =====================================================================
   FILE: data.js  —  DATA LAYER (talks to Supabase, or to the browser in DEMO MODE)
   ---------------------------------------------------------------------
   Every other file only calls  PalitData.something()  — never Supabase directly.
   Both modes have the SAME function names, so the pages never care which one is on.

   MAP OF THIS FILE (search for the [TAG]):
   [HELPERS]        phone formatter + friendly error messages
   [LIVE]           real Supabase version
        [LIVE-AUTH]       init / sign up / log in / log out
        [LIVE-PROFILE]    get + update the client profile
        [LIVE-ITEMS]      list / create / UPDATE / DELETE items (seller CRUD) + views
        [LIVE-BUY]        buy request, my purchases, remove purchase, rate (buyer CRUD)
        [LIVE-ORDERS]     seller: see requests, ACCEPT / DECLINE / COMPLETE
   [DEMO]           browser-only version with sample data (no Supabase needed)
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
    if (/delivery_tracking|track_(start|position|delivered|destination|is_)/i.test(m) && /(does not exist|schema cache|could not find)/i.test(m)) return 'Delivery tracking is not set up yet. Run schema-tracking.sql in Supabase.';
    if (/transaction_status/i.test(m) && /column/i.test(m)) return 'Database is missing the transaction_status column. Run schema-orders.sql in Supabase.';
    return m;
  }

  /* ====================================================================== [LIVE] */
  function makeLive() {
    var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
    var user = null;
    var listeners = [];
    var authWatching = false;

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
        needsRole: !m.account_type,   /* true = never chose Buyer/Seller (Google login) */
        avatarUrl: m.avatar_url || '',
        createdAt: u.created_at
      };
    }
    function need(res) { if (res.error) throw res.error; return res.data; }
    function needUser() { if (!user) throw new Error('Please log in first.'); return user; }
    function fire() { listeners.forEach(function (fn) { try { fn(user); } catch (e) { console.error(e); } }); }

    /* Builds the app user from the auth user + the profiles row (profile wins). */
    function loadUser(authUser) {
      if (!authUser) { user = null; return Promise.resolve(null); }
      var base = toUser(authUser);
      return sb.from('profiles').select('username,mobile,email,company,account_type')
        .eq('id', authUser.id).maybeSingle()
        .then(function (res) {
          var p = res.data;
          if (p) {
            base.name = p.username || base.name;
            base.mobile = p.mobile || base.mobile;
            base.email = p.email || base.email;
            base.company = p.company || base.company;
            base.accountType = p.account_type || base.accountType;
          }
          user = base; return user;
        })
        .catch(function () { user = base; return user; });
    }

    function itemRow(f) {
      return {
        title: f.title, category: f.category,
        quantity: f.quantity || 1, price: f.price, description: f.description,
        meetup_notes: f.meetup || null,
        delivery_options: f.delivery || 'meetup', delivery_fee: f.fee || 0,
        location_label: f.label || null
      };
    }

    function setPurchaseStatus(purchaseId, from, to) {
      needUser();
      var q = sb.from('purchases').update({ transaction_status: to }).eq('id', purchaseId);
      if (from) q = q.eq('transaction_status', from);
      return q.select().single().then(need);
    }

    return {
      mode: 'supabase',
      normalizePhone: normalizePhone,
      niceError: niceError,
      onAuth: function (fn) { listeners.push(fn); },
      user: function () { return user; },

      /* ----------------------------------------------------------- [LIVE-AUTH] */
      init: function () {
        if (!authWatching) {
          authWatching = true;
          sb.auth.onAuthStateChange(function (event, session) {
            if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'USER_UPDATED') return;
            /* setTimeout: never call Supabase directly inside this callback (can deadlock) */
            setTimeout(function () { loadUser(session && session.user).then(fire); }, 0);
          });
        }
        return sb.auth.getSession().then(function (res) {
          var s = res.data && res.data.session;
          return loadUser(s && s.user);
        });
      },

      signIn: function (id, pw) {
        var creds = (C.AUTH_MODE === 'email' || String(id).indexOf('@') >= 0)
          ? { email: id, password: pw } : { phone: id, password: pw };
        return sb.auth.signInWithPassword(creds).then(need);
      },

      signUp: function (f) {
        var meta = { username: f.username, mobile: f.mobile, email: f.email, company: f.company || null, account_type: f.accountType || 'buyer' };
        var payload = C.AUTH_MODE === 'email'
          ? { email: f.email, password: f.password, options: { data: meta } }
          : { phone: f.mobile, password: f.password, options: { data: meta } };
        return sb.auth.signUp(payload).then(need).then(function (d) { return { signedIn: !!(d && d.session) }; });
      },

      resetPasswordForEmail: function (email, redirectTo) {
        return sb.auth.resetPasswordForEmail(email, {
          redirectTo: redirectTo
        }).then(need);
      },

      updatePassword: function (newPassword) {
        return sb.auth.updateUser({
          password: newPassword
        }).then(need);
      },

      /* Log out ALWAYS works: if Supabase cannot be reached, the saved login is
         wiped from this browser anyway, so the person is still logged out. */
      signOut: function () {
        function wipeLocal() {
          try {
            Object.keys(localStorage).forEach(function (k) {
              if (k.indexOf('sb-') === 0 || k.indexOf('supabase') >= 0) localStorage.removeItem(k);
            });
          } catch (e) {}
          try { sessionStorage.clear(); } catch (e) {}
          user = null;
        }
        return sb.auth.signOut({ scope: 'local' })
          .catch(function (e) { console.warn('signOut error (ignored):', e); })
          .then(wipeLocal, wipeLocal);
      },

      signInGoogle: function () {
        /* Google cannot send you back to a file on your computer (file:///...). */
        if (location.protocol === 'file:') {
          return Promise.reject(new Error('Google login does not work when the page is opened as a file. Run the site with "python -m http.server 8000" and open http://localhost:8000 instead.'));
        }
        return sb.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: location.origin + location.pathname }
        }).then(need);
      },

      /* Saves Buyer/Seller for accounts that never chose one (Google login). */
      setAccountType: function (type) {
        var u = needUser();
        if (type !== 'buyer' && type !== 'seller') return Promise.reject(new Error('Choose Buyer or Seller.'));
        var row = { id: u.id, username: u.name, email: u.email || null, account_type: type };
        return sb.from('profiles').upsert(row).then(need).then(function () {
          return sb.auth.updateUser({ data: { account_type: type } }).then(need);
        }).then(function () { u.accountType = type; u.needsRole = false; });
      },

      /* -------------------------------------------------------- [LIVE-PROFILE] */
      getProfile: function () {
        var u = needUser();
        return sb.from('profiles').select('*').eq('id', u.id).maybeSingle().then(need).then(function (p) {
          p = p || {};
          return {
            name: p.username || u.name, mobile: p.mobile || u.mobile, email: p.email || u.email,
            company: p.company || u.company || '', accountType: p.account_type || u.accountType,
            city: p.city || '', bio: p.bio || '', avatarUrl: u.avatarUrl || '', createdAt: p.created_at || u.createdAt
          };
        });
      },

      /* Profile picture: saved in the photo bucket under my own folder,
         and the link is kept in my account data (no new database column needed). */
      uploadAvatar: function (blob) {
        var u = needUser();
        var path = u.id + '/avatar-' + Date.now() + '.jpg';
        return sb.storage.from(C.STORAGE_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true })
          .then(need)
          .then(function () {
            var url = sb.storage.from(C.STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
            return sb.auth.updateUser({ data: { avatar_url: url } }).then(need).then(function () {
              user.avatarUrl = url;
              return url;
            });
          });
      },

      updateProfile: function (f) {
        var u = needUser();
        var row = {
          id: u.id, username: f.name, mobile: f.mobile || null, email: f.email || null,
          company: f.company || null, city: f.city || null, bio: f.bio || null
        };
        if (f.accountType) row.account_type = f.accountType;
        return sb.from('profiles').upsert(row).then(need).then(function () {
          user.name = f.name; user.mobile = f.mobile || ''; user.email = f.email || '';
          user.company = f.company || '';
          if (f.accountType) user.accountType = f.accountType;
          return sb.auth.updateUser({ data: { username: f.name, company: f.company || null } }).catch(function () {});
        });
      },

      /* ---------------------------------------------------------- [LIVE-ITEMS] */
      listItems: function () {
        return sb.from('items').select('*').eq('status', 'available')
          .order('created_at', { ascending: false }).then(need);
      },

      getItem: function (id) {
        return sb.from('items').select('*').eq('id', id).maybeSingle().then(need);
      },

      myItems: function () {
        var u = needUser();
        return sb.from('items').select('*').eq('seller_id', u.id)
          .order('created_at', { ascending: false }).then(need);
      },

      createItem: function (f, blobs, onProgress) {
        var u = needUser();
        var urls = [];
        var total = blobs.length || 1;

        /* upload photos one by one so the progress % is real */
        var chain = blobs.reduce(function (p, blob, n) {
          return p.then(function () {
            var path = u.id + '/' + uid() + '.jpg';
            return sb.storage.from(C.STORAGE_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
              .then(need)
              .then(function () {
                urls.push(sb.storage.from(C.STORAGE_BUCKET).getPublicUrl(path).data.publicUrl);
                if (onProgress) onProgress((n + 1) / total);
              });
          });
        }, Promise.resolve());

        return chain.then(function () {
          var row = itemRow(f);
          row.seller_name = u.name;
          row.image_urls = urls;
          row.lat = f.lat; row.lng = f.lng;
          return sb.from('items').insert(row).select().single().then(need);
        }).then(function (item) {
          return sb.from('item_contacts')
            .insert({ item_id: item.id, contact_number: f.contact, gmail: f.gmail })
            .then(function (res) {
              if (res.error) {
                /* contact failed -> remove the half-created item */
                return sb.from('items').delete().eq('id', item.id).then(function () { throw res.error; });
              }
              return item;
            });
        });
      },

      updateItem: function (id, f) {
        needUser();
        var row = itemRow(f);
        if (f.status) row.status = f.status;
        return sb.from('items').update(row).eq('id', id).select().single().then(need).then(function (item) {
          return sb.from('item_contacts')
            .upsert({ item_id: id, contact_number: f.contact, gmail: f.gmail }, { onConflict: 'item_id' })
            .then(need).then(function () { return item; });
        });
      },

      deleteItem: function (id) {
        needUser();
        return sb.from('items').select('image_urls').eq('id', id).maybeSingle().then(need).then(function (it) {
          return sb.from('items').delete().eq('id', id).then(need).then(function () {
            /* best effort: remove the photos from storage */
            var marker = '/' + C.STORAGE_BUCKET + '/';
            var paths = ((it && it.image_urls) || []).map(function (u) {
              var i = u.indexOf(marker); return i < 0 ? null : decodeURIComponent(u.slice(i + marker.length));
            }).filter(Boolean);
            if (paths.length) return sb.storage.from(C.STORAGE_BUCKET).remove(paths).catch(function () {});
          });
        });
      },

      /* seller phone + gmail -> { number, gmail } or null */
      getContact: function (itemId) {
        return sb.from('item_contacts').select('contact_number,gmail').eq('item_id', itemId)
          .maybeSingle().then(need).then(function (r) {
            return r ? { number: r.contact_number, gmail: r.gmail } : null;
          });
      },

      /* +1 view (needs the increment_views function from schema-orders.sql) */
      addView: function (itemId) {
        return sb.rpc('increment_views', { p_item_id: itemId }).then(need);
      },

      /* ------------------------------------------------------------ [LIVE-BUY] */

      /* BUY ITEM - Create pending transaction */
      recordPurchase: function (itemId, order) {
        var u = needUser();
        order = order || {};

        return sb.from('purchases')
          .select('id,transaction_status')
          .eq('item_id', itemId)
          .eq('buyer_id', u.id)
          .in('transaction_status', ['pending', 'accepted'])
          .maybeSingle()
          .then(need)
          .then(function (existing) {
            if (existing) {
              throw new Error('You already have an active request for this item.');
            }

            var row = {
              item_id: itemId,
              buyer_id: u.id,
              delivery_method: order.method === 'delivery' ? 'delivery' : 'meetup',
              delivery_address: order.method === 'delivery' ? (order.address || null) : null,
              buyer_note: order.note || null,
              buyer_name: u.name,
              buyer_contact: u.mobile || u.email || null,
              transaction_status: 'pending'
            };

            return sb.from('purchases').insert(row).then(need);
          });
      },

      /* BUYER - READ PURCHASES */
      myPurchases: function () {
        var u = needUser();

        return sb.from('purchases')
          .select('id,created_at,delivery_method,delivery_address,buyer_note,transaction_status,items(*)')
          .eq('buyer_id', u.id)
          .order('created_at', { ascending: false })
          .then(need)
          .then(function (rows) {
            var out = [];
            rows.forEach(function (r) {
              if (r.items) {
                out.push({
                  purchaseId: r.id,
                  item: r.items,
                  boughtAt: r.created_at,
                  method: r.delivery_method,
                  address: r.delivery_address,
                  note: r.buyer_note,
                  status: r.transaction_status
                });
              }
            });
            return out;
          });
      },

      /* DELETE PURCHASE */
      removePurchase: function (itemId) {
        var u = needUser();

        return sb.from('reviews')
          .delete()
          .eq('item_id', itemId)
          .eq('user_id', u.id)
          .then(function () {
            return sb.from('purchases')
              .delete()
              .eq('item_id', itemId)
              .eq('buyer_id', u.id)
              .then(need);
          });
      },

      /* STATISTICS */
      stats: function () {
        return sb.from('item_stats')
          .select('*')
          .then(need)
          .then(function (rows) {
            var m = {};
            rows.forEach(function (r) {
              m[r.item_id] = { buys: r.buys, avg: r.avg_stars, count: r.rating_count };
            });
            return m;
          });
      },

      /* BUYER RATINGS */
      myRatings: function () {
        var u = needUser();

        return sb.from('reviews')
          .select('item_id,stars')
          .eq('user_id', u.id)
          .then(need)
          .then(function (rows) {
            var m = {};
            rows.forEach(function (r) { m[r.item_id] = r.stars; });
            return m;
          });
      },

      rate: function (itemId, stars) {
        var u = needUser();

        return sb.from('reviews')
          .upsert({ item_id: itemId, user_id: u.id, stars: stars }, { onConflict: 'item_id,user_id' })
          .then(need);
      },

      removeRating: function (itemId) {
        var u = needUser();

        return sb.from('reviews')
          .delete()
          .eq('item_id', itemId)
          .eq('user_id', u.id)
          .then(need);
      },

      /* SELLER CONTACT (used by My Purchases once the seller accepted) */
      getSellerContact: function (itemId) {
        return this.getContact(itemId);
      },

      /* ---------------------------------------------------------- [LIVE-ORDERS] */

      /* SELLER - View incoming transactions */
      sellerOrders: function () {
        var u = needUser();

        return sb.from('items')
          .select('id')
          .eq('seller_id', u.id)
          .then(need)
          .then(function (mine) {
            var ids = mine.map(function (i) { return i.id; });
            if (!ids.length) return [];

            return sb.from('purchases')
              .select('id,item_id,buyer_id,created_at,delivery_method,delivery_address,buyer_note,buyer_name,buyer_contact,transaction_status')
              .in('item_id', ids)
              .order('created_at', { ascending: false })
              .then(need)
              .then(function (rows) {
                return rows.map(function (r) {
                  return {
                    purchaseId: r.id,
                    itemId: r.item_id,
                    buyerId: r.buyer_id,
                    boughtAt: r.created_at,
                    method: r.delivery_method,
                    address: r.delivery_address,
                    note: r.buyer_note,
                    buyerName: r.buyer_name,
                    buyerContact: r.buyer_contact,
                    status: r.transaction_status
                  };
                });
              });
          });
      },

      /* ------------------------------------------------------- [LIVE-TRACKING]
         Delivery tracking. All writes go through SQL functions (schema-tracking.sql). */
      getTracking: function (purchaseId) {
        return sb.from('delivery_tracking').select('*').eq('purchase_id', purchaseId).maybeSingle().then(need);
      },
      sellerTracking: function () {
        return sb.from('delivery_tracking').select('*').then(need).then(function (rows) {
          var m = {}; (rows || []).forEach(function (r) { m[r.purchase_id] = r; }); return m;
        });
      },
      startDelivery: function (purchaseId, o) {
        return sb.rpc('track_start', {
          p_purchase_id: purchaseId, p_mode: o.mode,
          p_courier_name: o.courierName || null, p_courier_link: o.courierLink || null, p_tracking_no: o.trackingNo || null
        }).then(need);
      },
      sendPosition: function (purchaseId, p) {
        return sb.rpc('track_position', {
          p_purchase_id: purchaseId, p_lat: p.lat, p_lng: p.lng,
          p_accuracy: p.accuracy == null ? null : p.accuracy,
          p_heading: p.heading == null ? null : p.heading,
          p_speed: p.speed == null ? null : p.speed
        }).then(need);
      },
      markDelivered: function (purchaseId) {
        return sb.rpc('track_delivered', { p_purchase_id: purchaseId }).then(need);
      },
      setDeliveryPin: function (purchaseId, lat, lng) {
        return sb.rpc('track_destination', { p_purchase_id: purchaseId, p_lat: lat, p_lng: lng }).then(need);
      },
      /* Live updates for one purchase. Returns a function that stops listening. */
      watchTracking: function (purchaseId, onRow) {
        var ch = sb.channel('trk-' + purchaseId + '-' + Date.now())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_tracking', filter: 'purchase_id=eq.' + purchaseId },
            function (payload) { if (payload && payload.new && payload.new.purchase_id) onRow(payload.new); })
          .subscribe();
        return function () { try { sb.removeChannel(ch); } catch (e) {} };
      },

      /* SELLER - ACCEPT / DECLINE / COMPLETE */
      acceptPurchase:   function (purchaseId) { return setPurchaseStatus(purchaseId, 'pending',  'accepted'); },
      rejectPurchase:   function (purchaseId) { return setPurchaseStatus(purchaseId, 'pending',  'rejected'); },
      completePurchase: function (purchaseId) { return setPurchaseStatus(purchaseId, 'accepted', 'completed'); }
    };
  }

  /* ====================================================================== [DEMO]
     Browser-only version. Data is saved in localStorage ("palit_demo_v2").
     Same function names as the LIVE version. */
  function makeDemo() {
    var KEY = 'palit_demo_v2';
    var listeners = [];
    var db;

    function now() { return new Date().toISOString(); }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
    function seed() {
      var sellerId = 'demo-seller';
      return {
        session: null,
        users: [{ id: sellerId, name: 'Demo Seller', mobile: '+639171234567', email: 'seller@example.com', company: 'Demo Shop',
                  accountType: 'seller', city: 'Manila', bio: '', password: 'password123', createdAt: now() }],
        items: [
          { id: 'demo-1', seller_id: sellerId, seller_name: 'Demo Seller', title: 'Mountain bike 26"', price: 8500,
            description: 'Well kept bike, new tires.', category: 'hobbies', image_urls: [], lat: 14.5547, lng: 121.0244,
            location_label: 'Makati', status: 'available', created_at: now(), quantity: 1,
            meetup_notes: 'Weekdays after 5pm', delivery_options: 'both', delivery_fee: 150, views: 0 },
          { id: 'demo-2', seller_id: sellerId, seller_name: 'Demo Seller', title: 'Rice cooker', price: 900,
            description: 'Works perfectly, 1.8 liter.', category: 'home', image_urls: [], lat: 14.6091, lng: 121.0223,
            location_label: 'Quezon City', status: 'available', created_at: now(), quantity: 1,
            meetup_notes: '', delivery_options: 'meetup', delivery_fee: 0, views: 0 }
        ],
        contacts: { 'demo-1': { number: '+639171234567', gmail: 'seller@example.com' },
                    'demo-2': { number: '+639171234567', gmail: 'seller@example.com' } },
        purchases: [], reviews: []
      };
    }
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !db.users) { db = seed(); save(); }

    function me() { return db.users.filter(function (u) { return u.id === db.session; })[0] || null; }
    function pub(u) {
      return u && { id: u.id, name: u.name, mobile: u.mobile, email: u.email, company: u.company, accountType: u.accountType, avatarUrl: u.avatarUrl || '', createdAt: u.createdAt };
    }
    function needUser() { var u = me(); if (!u) throw new Error('Please log in first.'); return u; }
    function ok(v) { return Promise.resolve(v); }
    function run(fn) { try { return ok(fn()); } catch (e) { return Promise.reject(e); } }
    function fire() { listeners.forEach(function (fn) { try { fn(pub(me())); } catch (e) {} }); }
    function toDataUrl(blob) {
      return new Promise(function (res, rej) {
        var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(blob);
      });
    }
    function setStatus(purchaseId, from, to) {
      var u = needUser();
      var p = db.purchases.filter(function (x) { return x.id === purchaseId; })[0];
      var item = p && db.items.filter(function (i) { return i.id === p.item_id; })[0];
      if (!p || !item || item.seller_id !== u.id) throw new Error('Permission denied.');
      if (from && p.transaction_status !== from) throw new Error('This request was already updated (0 rows).');
      p.transaction_status = to; save(); return p;
    }

    return {
      mode: 'demo',
      normalizePhone: normalizePhone,
      niceError: niceError,
      onAuth: function (fn) { listeners.push(fn); },
      user: function () { return pub(me()); },

      /* auth */
      init: function () { return ok(pub(me())); },
      signIn: function (id, pw) {
        return run(function () {
          var key = String(id).toLowerCase();
          var u = db.users.filter(function (x) { return (x.email.toLowerCase() === key || x.mobile === id) && x.password === pw; })[0];
          if (!u) throw new Error('Invalid login credentials');
          db.session = u.id; save(); fire();
        });
      },

      resetPasswordForEmail: function () {
        return Promise.reject(
          new Error('Password recovery requires Supabase mode.')
        );
      },

      updatePassword: function () {
        return Promise.reject(
          new Error('Password recovery requires Supabase mode.')
        );
      },

      signUp: function (f) {
        return run(function () {
          var dup = db.users.filter(function (x) { return x.email.toLowerCase() === f.email.toLowerCase() || x.mobile === f.mobile; })[0];
          if (dup) throw new Error('User already registered');
          var u = { id: uid(), name: f.username, mobile: f.mobile, email: f.email, company: f.company || '',
                    accountType: f.accountType || 'buyer', city: '', bio: '', password: f.password, createdAt: now() };
          db.users.push(u); db.session = u.id; save(); fire();
          return { signedIn: true };
        });
      },
      signOut: function () { return run(function () { db.session = null; save(); fire(); }); },
      setAccountType: function (type) { var u = me(); if (u) { u.accountType = type; save(); } return Promise.resolve(); },
      signInGoogle: function () { return Promise.reject(new Error('Google login needs Supabase. Use e-mail login in demo mode.')); },

      /* profile */
      getProfile: function () {
        return run(function () {
          var u = needUser();
          return { name: u.name, mobile: u.mobile, email: u.email, company: u.company, accountType: u.accountType,
                   city: u.city || '', bio: u.bio || '', avatarUrl: u.avatarUrl || '', createdAt: u.createdAt };
        });
      },
      uploadAvatar: function (blob) {
        var u = needUser();
        return toDataUrl(blob).then(function (url) { u.avatarUrl = url; save(); return url; });
      },
      updateProfile: function (f) {
        return run(function () {
          var u = needUser();
          u.name = f.name; u.mobile = f.mobile || ''; u.email = f.email || ''; u.company = f.company || '';
          u.city = f.city || ''; u.bio = f.bio || '';
          if (f.accountType) u.accountType = f.accountType;
          save();
        });
      },

      /* items */
      listItems: function () {
        return run(function () {
          return db.items.filter(function (i) { return i.status === 'available'; })
            .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        });
      },
      getItem: function (id) { return run(function () { return db.items.filter(function (i) { return i.id === id; })[0] || null; }); },
      myItems: function () {
        return run(function () {
          var u = needUser();
          return db.items.filter(function (i) { return i.seller_id === u.id; })
            .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        });
      },
      createItem: function (f, blobs, onProgress) {
        var u = needUser();
        return Promise.all(blobs.map(toDataUrl)).then(function (urls) {
          if (onProgress) onProgress(1);
          var item = {
            id: uid(), seller_id: u.id, seller_name: u.name, title: f.title, price: f.price, description: f.description,
            category: f.category, image_urls: urls, lat: f.lat, lng: f.lng, location_label: f.label || null,
            status: 'available', created_at: now(), quantity: f.quantity || 1,
            meetup_notes: f.meetup || null, delivery_options: f.delivery || 'meetup', delivery_fee: f.fee || 0, views: 0
          };
          db.items.push(item);
          db.contacts[item.id] = { number: f.contact, gmail: f.gmail };
          save(); return item;
        });
      },
      updateItem: function (id, f) {
        return run(function () {
          var u = needUser();
          var it = db.items.filter(function (i) { return i.id === id && i.seller_id === u.id; })[0];
          if (!it) throw new Error('Permission denied (row-level security).');
          it.title = f.title; it.category = f.category;
          it.quantity = f.quantity || 1; it.price = f.price; it.description = f.description;
          it.meetup_notes = f.meetup || null; it.delivery_options = f.delivery || 'meetup';
          it.delivery_fee = f.fee || 0; it.location_label = f.label || null;
          if (f.status) it.status = f.status;
          db.contacts[id] = { number: f.contact, gmail: f.gmail };
          save(); return it;
        });
      },
      deleteItem: function (id) {
        return run(function () {
          var u = needUser();
          db.items = db.items.filter(function (i) { return !(i.id === id && i.seller_id === u.id); });
          db.purchases = db.purchases.filter(function (p) { return p.item_id !== id; });
          db.reviews = db.reviews.filter(function (r) { return r.item_id !== id; });
          delete db.contacts[id]; save();
        });
      },
      getContact: function (itemId) { return run(function () { needUser(); return db.contacts[itemId] || null; }); },
      getSellerContact: function (itemId) { return this.getContact(itemId); },
      addView: function (itemId) {
        return run(function () {
          var it = db.items.filter(function (i) { return i.id === itemId; })[0];
          if (it) { it.views = (it.views || 0) + 1; save(); }
        });
      },

      /* delivery tracking needs the real Supabase database */
      getTracking: function () { return Promise.resolve(null); },
      sellerTracking: function () { return Promise.reject(new Error('Delivery tracking needs Supabase.')); },
      startDelivery: function () { return Promise.reject(new Error('Delivery tracking needs Supabase.')); },
      sendPosition: function () { return Promise.reject(new Error('Delivery tracking needs Supabase.')); },
      markDelivered: function () { return Promise.reject(new Error('Delivery tracking needs Supabase.')); },
      setDeliveryPin: function () { return Promise.reject(new Error('Delivery tracking needs Supabase.')); },
      watchTracking: function () { return function () {}; },

      /* buyer */
      recordPurchase: function (itemId, order) {
        return run(function () {
          var u = needUser(); order = order || {};
          var item = db.items.filter(function (i) { return i.id === itemId; })[0];
          if (!item) throw new Error('That listing is no longer available.');
          if (item.seller_id === u.id) throw new Error('You cannot buy your own listing.');
          var active = db.purchases.filter(function (p) {
            return p.item_id === itemId && p.buyer_id === u.id && (p.transaction_status === 'pending' || p.transaction_status === 'accepted');
          })[0];
          if (active) throw new Error('You already have an active request for this item.');
          db.purchases.push({
            id: uid(), item_id: itemId, buyer_id: u.id, created_at: now(),
            delivery_method: order.method === 'delivery' ? 'delivery' : 'meetup',
            delivery_address: order.method === 'delivery' ? (order.address || null) : null,
            buyer_note: order.note || null, buyer_name: u.name, buyer_contact: u.mobile || u.email || null,
            transaction_status: 'pending'
          });
          save();
        });
      },
      myPurchases: function () {
        return run(function () {
          var u = needUser();
          return db.purchases.filter(function (p) { return p.buyer_id === u.id; })
            .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); })
            .map(function (p) {
              var item = db.items.filter(function (i) { return i.id === p.item_id; })[0];
              return item && { item: item, boughtAt: p.created_at, method: p.delivery_method, address: p.delivery_address,
                               note: p.buyer_note, status: p.transaction_status };
            }).filter(Boolean);
        });
      },
      removePurchase: function (itemId) {
        return run(function () {
          var u = needUser();
          db.reviews = db.reviews.filter(function (r) { return !(r.item_id === itemId && r.user_id === u.id); });
          db.purchases = db.purchases.filter(function (p) { return !(p.item_id === itemId && p.buyer_id === u.id); });
          save();
        });
      },
      stats: function () {
        return run(function () {
          var m = {};
          db.items.forEach(function (i) {
            var buys = db.purchases.filter(function (p) {
              return p.item_id === i.id && (p.transaction_status === 'accepted' || p.transaction_status === 'completed');
            }).length;
            var rs = db.reviews.filter(function (r) { return r.item_id === i.id; });
            var sum = rs.reduce(function (a, r) { return a + r.stars; }, 0);
            m[i.id] = { buys: buys, avg: rs.length ? Math.round(sum / rs.length * 100) / 100 : 0, count: rs.length };
          });
          return m;
        });
      },
      myRatings: function () {
        return run(function () {
          var u = needUser(), m = {};
          db.reviews.forEach(function (r) { if (r.user_id === u.id) m[r.item_id] = r.stars; });
          return m;
        });
      },
      rate: function (itemId, stars) {
        return run(function () {
          var u = needUser();
          var r = db.reviews.filter(function (x) { return x.item_id === itemId && x.user_id === u.id; })[0];
          if (r) r.stars = stars; else db.reviews.push({ id: uid(), item_id: itemId, user_id: u.id, stars: stars, created_at: now() });
          save();
        });
      },
      removeRating: function (itemId) {
        return run(function () {
          var u = needUser();
          db.reviews = db.reviews.filter(function (r) { return !(r.item_id === itemId && r.user_id === u.id); });
          save();
        });
      },

      /* seller orders */
      sellerOrders: function () {
        return run(function () {
          var u = needUser();
          var mine = db.items.filter(function (i) { return i.seller_id === u.id; }).map(function (i) { return i.id; });
          return db.purchases.filter(function (p) { return mine.indexOf(p.item_id) >= 0; })
            .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); })
            .map(function (p) {
              return { purchaseId: p.id, itemId: p.item_id, buyerId: p.buyer_id, boughtAt: p.created_at,
                       method: p.delivery_method, address: p.delivery_address, note: p.buyer_note,
                       buyerName: p.buyer_name, buyerContact: p.buyer_contact, status: p.transaction_status };
            });
        });
      },
      acceptPurchase:   function (id) { return run(function () { return setStatus(id, 'pending',  'accepted'); }); },
      rejectPurchase:   function (id) { return run(function () { return setStatus(id, 'pending',  'rejected'); }); },
      completePurchase: function (id) { return run(function () { return setStatus(id, 'accepted', 'completed'); }); }
    };
  }

  /* ================================================================ [PICK-MODE] */
  var live = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient);
  if (C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !live) { console.warn('Supabase library failed to load - using demo mode.'); }
  window.PalitData = live ? makeLive() : makeDemo();
})();
