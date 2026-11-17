/* =====================================================================
   FILE: helpers.js  —  SHARED TOOLS used by every page
   ---------------------------------------------------------------------
   [GLOBALS]     C (settings) and D (data layer) shortcuts
   [STATE]       the one "state" object that remembers what is on screen
   [SMALL-TOOLS] $ , esc , priceText , timeAgo , distance
   [ICONS]       the little SVG icons (add new ones here)
   [TOAST]       the small pop-up messages
   [MAP-TOOLS]   Leaflet map helpers
   [LOAD-DATA]   loadItems() and loadMyBuying() refresh the lists
   ===================================================================== */

/* -------------------------------------------------------------- [GLOBALS] */
var C = window.PALIT_CONFIG;
var D = window.PalitData;
var HAS_MAP = typeof window.L !== 'undefined';
var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* ---------------------------------------------------------------- [STATE]
   Everything the app remembers lives here. */
var state = {
  user: null,            // logged-in user (or null)
  items: [],             // all available items in the Market
  stats: {},             // { itemId: { buys, avg, count } }
  loaded: false,
  loadError: '',
  search: '',            // market search text
  category: 'all',       // market category filter
  sort: 'new',           // market sort
  pane: 'grid',          // 'grid' or 'map'
  rankBy: 'sold',        // ratings page: 'sold' or 'rated'
  page: '',              // which page is open: market / sell / ...
  highlight: '',         // item id to highlight after posting
  purchases: [],         // items I bought: [{ item, boughtAt }]
  boughtIds: {},         // { itemId: true } quick lookup
  myRatings: {},         // { itemId: stars } my own ratings
  location: { lat: C.DEFAULT_CENTER.lat, lng: C.DEFAULT_CENTER.lng, known: false }
};
var maps = { main: null, mainLayer: null, mainMe: null, detail: null, pick: null, pickPin: null };

try {
  var savedLoc = JSON.parse(localStorage.getItem('palit_loc'));
  if (savedLoc && isFinite(savedLoc.lat) && isFinite(savedLoc.lng)) {
    state.location = { lat: savedLoc.lat, lng: savedLoc.lng, known: true };
  }
} catch (e) {}

/* ---------------------------------------------------------- [SMALL-TOOLS] */
function $(selector, root) { return (root || document).querySelector(selector); }
function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

/* esc() makes text safe to put inside HTML. Always use it on anything a user typed. */
function esc(text) {
  var s = String(text == null ? '' : text);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function safeUrl(u) {
  u = String(u || '');
  return /^(https?:\/\/|data:image\/|blob:)/i.test(u) ? u : '';
}

/* [PRICE-FORMAT] how prices look, e.g. ₱8,500 or FREE */
function priceText(n) {
  if (Number(n) === 0) return 'FREE';
  return C.CURRENCY + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 });
}

/* [TIME-FORMAT] "5 min ago" */
function timeAgo(iso) {
  var s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'a few seconds ago';
  var m = Math.floor(s / 60);
  if (m < 60) return m + ' min ago';
  var h = Math.floor(m / 60);
  if (h < 24) return h + (h > 1 ? ' hours ago' : ' hour ago');
  var d = Math.floor(h / 24);
  if (d < 30) return d + (d > 1 ? ' days ago' : ' day ago');
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}
function dateText(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* [DISTANCE] km between two map points (haversine formula) */
function kmBetween(lat1, lng1, lat2, lng2) {
  var R = 6371, r = Math.PI / 180;
  var dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  var a = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.pow(Math.sin(dLng / 2), 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}
function fmtDist(d) {
  if (d < 1) return Math.max(10, Math.round(d * 100) * 10) + ' m';
  return d < 10 ? d.toFixed(1) + ' km' : Math.round(d) + ' km';
}
function distOf(item) { return kmBetween(state.location.lat, state.location.lng, item.lat, item.lng); }
function statOf(id) { return state.stats[id] || { buys: 0, avg: 0, count: 0 }; }

/* [CATEGORY-HELPERS] */
var CATS = (C.CATEGORIES && C.CATEGORIES.length) ? C.CATEGORIES : [{ id: 'other', label: 'Other', emoji: '📦' }];
function catById(id) { return CATS.filter(function (c) { return c.id === id; })[0] || CATS[CATS.length - 1]; }
function catOf(item) { return (item && item.category) || 'other'; }
function catLabel(id) { return catById(id).label; }
function catEmoji(id) { return catById(id).emoji; }

/* [DELIVERY-HELPERS] what the seller offers: 'meetup', 'delivery' or 'both' */
function deliveryLabel(opt) {
  if (opt === 'both') return 'Meet up or delivery';
  if (opt === 'delivery') return 'Delivery only';
  return 'Meet up only';
}
function deliveryChipHtml(it) {
  var opt = it.delivery_options || 'meetup';
  var fee = Number(it.delivery_fee || 0);
  var extra = (opt !== 'meetup' && fee > 0) ? ' · fee ' + priceText(fee) : (opt !== 'meetup' ? ' · free delivery' : '');
  return '<span class="chip warm">' + ic('bag') + ' ' + esc(deliveryLabel(opt) + extra) + '</span>';
}

/* [DESTROY-MAP] always remove a map before drawing a new one */
function destroyMap(key) {
  if (maps[key]) { try { maps[key].remove(); } catch (e) {} maps[key] = null; }
}

/* ------------------------------------------------------------------ [ICONS] */
var ICONS = {
  store: '<path d="M4 9l1.6-5h12.8L20 9"/><path d="M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9"/><path d="M5 12v8h14v-8"/><path d="M10 20v-4h4v4"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  pin: '<path d="M12 21s7-6.2 7-11.2A7 7 0 005 9.8C5 14.8 12 21 12 21z"/><circle cx="12" cy="10" r="2.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"/>',
  mobile: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4"/>',
  logout: '<path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M16 8l4 4-4 4M20 12H9"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  fire: '<path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>'
  ,
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 016 0"/>'
};
function ic(name) {
  return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
}
function logoSvg(bag, handle, dot) {
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 26h36l-4 26H18z" fill="' + bag + '"/><path d="M23 26a9 9 0 0118 0" fill="none" stroke="' + handle + '" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="39" r="4.5" fill="' + dot + '"/></svg>';
}
var PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#ebe9ff'/><text x='200' y='185' font-size='110' text-anchor='middle'>📦</text></svg>");
function imgOf(item) { return safeUrl((item.image_urls || [])[0]) || PLACEHOLDER; }

/* [AVATAR-INNER] what goes inside an avatar circle: the photo if there is one, else the first letter */
function avatarInner(name, url) {
  var safe = safeUrl(url);
  if (safe) return '<img src="' + esc(safe) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block">';
  return esc(String(name || '?').trim().charAt(0).toUpperCase());
}

/* [STARS-HTML] read-only stars, e.g. starsHtml(4.5) */
function starsHtml(avg) {
  var out = '<span class="stars ro" aria-label="' + Number(avg).toFixed(1) + ' out of 5">';
  for (var n = 1; n <= 5; n++) { out += '<span class="' + (n <= Math.round(avg) ? 'on' : '') + '">★</span>'; }
  return out + '</span>';
}

/* ------------------------------------------------------------------ [TOAST] */
function toast(message, kind) {
  var el = document.createElement('div');
  el.className = 'toast ' + (kind || '');          // kind: 'ok' (green) or 'bad' (red)
  el.textContent = message;
  $('#toasts').appendChild(el);
  setTimeout(function () {
    el.style.transition = 'opacity .3s'; el.style.opacity = '0';
    setTimeout(function () { el.remove(); }, 320);
  }, kind === 'bad' ? 5200 : 3200);
}

/* -------------------------------------------------------------- [MAP-TOOLS] */
function makeMap(elementId, center, zoom, options) {
  var opts = { zoomControl: true, attributionControl: true };
  for (var k in (options || {})) { opts[k] = options[k]; }
  var map = L.map(elementId, opts).setView(center, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  return map;
}
function pinIcon(text, cssClass) {
  return L.divIcon({ className: 'pin ' + (cssClass || ''), html: '<span>' + esc(text) + '</span>', iconSize: [0, 0] });
}
function mapFallback(message) {
  return '<div class="map-fallback"><div>' + ic('map') + '<p style="margin-top:.5rem"><b>Map unavailable</b><br>' + esc(message) + '</p></div></div>';
}

/* -------------------------------------------------------------- [LOAD-DATA] */
/* Reload market items + counters. */
function loadItems() {
  return Promise.all([D.listItems(), D.stats().catch(function () { return {}; })]).then(function (res) {
    state.items = res[0]; state.stats = res[1]; state.loaded = true; state.loadError = '';
  }).catch(function (e) {
    state.loaded = true; state.loadError = D.niceError(e); console.error(e);
  });
}
function refreshStats() {
  return D.stats().then(function (s) { state.stats = s; }).catch(function () {});
}
/* Reload "what I bought" + "my ratings". Safe to call when logged out. */
function loadMyBuying() {
  state.purchases = []; state.boughtIds = {}; state.myRatings = {};
  if (!state.user) return Promise.resolve();
  return Promise.all([D.myPurchases(), D.myRatings()]).then(function (res) {
    state.purchases = res[0];
    state.purchases.forEach(function (p) {
      var st = p.status || 'pending';
      if (st !== 'rejected' && st !== 'cancelled') state.boughtIds[p.item.id] = true;
    });
    state.myRatings = res[1];
  }).catch(function (e) { console.error(e); });
}

/* ------------------------------------------------------------ [TRACK-HELPERS]
   Small tools shared by the delivery tracking on Orders (seller) and My Purchases (buyer). */
function safeLink(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
function secsSince(iso) { return iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000)) : null; }
function agoShort(s) {
  if (s == null) return '—';
  if (s < 60) return s + ' s ago';
  var m = Math.floor(s / 60);
  if (m < 60) return m + ' min ago';
  return Math.floor(m / 60) + ' h ago';
}
function fmtEta(sec) {
  var m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return m + ' min';
  return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
}
var TRACK_STEPS = [
  { id: 'preparing', label: 'Preparing' },
  { id: 'out_for_delivery', label: 'Out for delivery' },
  { id: 'delivered', label: 'Delivered' }
];
function trackStepsHtml(status) {
  var idx = 0;
  TRACK_STEPS.forEach(function (s, i) { if (s.id === status) idx = i; });
  return '<div style="display:flex;gap:.35rem;flex-wrap:wrap;margin:.2rem 0 .5rem">' + TRACK_STEPS.map(function (s, i) {
    var done = i < idx || (i === idx && status === 'delivered'), cur = i === idx && status !== 'delivered';
    var bg = cur ? '#3a35c8' : done ? '#d1e7dd' : '#ececf4';
    var fg = cur ? '#fff' : done ? '#0f5132' : '#6b6b80';
    return '<span style="padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;background:' + bg + ';color:' + fg + '">' +
      (done ? '✓ ' : '') + esc(s.label) + '</span>';
  }).join('') + '</div>';
}
