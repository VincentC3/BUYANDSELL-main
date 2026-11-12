/* PALIT — single-page app. Routes: #/market (default) · #/sell · #/ratings · #/auth · #/item/<id> */
(function () {
  'use strict';

  const C = window.PALIT_CONFIG;
  const D = window.PalitData;

  /* ------------------------------------------------------------- categories */
  const CATS = (C.CATEGORIES && C.CATEGORIES.length) ? C.CATEGORIES : [{ id: 'other', label: 'Other', emoji: '📦' }];
  const catById = (id) => CATS.filter((c) => c.id === id)[0] || CATS[CATS.length - 1];
  const catOf = (it) => (it && it.category) || 'other';
  const catLabel = (id) => catById(id).label;
  const catEmoji = (id) => catById(id).emoji;
  const HAS_MAP = typeof window.L !== 'undefined';

  /* ------------------------------------------------------------------ helpers */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^(https?:\/\/|data:image\/|blob:)/i.test(String(u || '')) ? String(u) : '');
  const priceText = (n) => (Number(n) === 0 ? 'FREE' : C.CURRENCY + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 }));
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function timeAgo(iso) {
    const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return 'a few seconds ago';
    const m = Math.floor(s / 60); if (m < 60) return m + ' min ago';
    const h = Math.floor(m / 60); if (h < 24) return h + ' hour' + (h > 1 ? 's' : '') + ' ago';
    const d = Math.floor(h / 24); if (d < 30) return d + ' day' + (d > 1 ? 's' : '') + ' ago';
    return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function kmBetween(lat1, lng1, lat2, lng2) {
    const R = 6371, r = Math.PI / 180;
    const dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function fmtDist(d) {
    if (d < 1) return Math.max(10, Math.round(d * 100) * 10) + ' m';
    return d < 10 ? d.toFixed(1) + ' km' : Math.round(d) + ' km';
  }

  const ICONS = {
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
  };
  const ic = (n) => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
  const logoSvg = (bag, handle, dot) => '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 26h36l-4 26H18z" fill="' + bag + '"/><path d="M23 26a9 9 0 0118 0" fill="none" stroke="' + handle + '" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="39" r="4.5" fill="' + dot + '"/></svg>';
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#ebe9ff'/><text x='200' y='185' font-size='110' text-anchor='middle'>📦</text></svg>");

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, kind === 'bad' ? 5200 : 3200);
  }

  /* ------------------------------------------------------------------- state */
  const S = {
    user: null, items: [], stats: {}, loaded: false, loadError: '',
    q: '', cat: 'all', sort: 'new', pane: 'grid', rankBy: 'sold', view: '', highlight: '',
    loc: { lat: C.DEFAULT_CENTER.lat, lng: C.DEFAULT_CENTER.lng, known: false }
  };
  const maps = { main: null, mainLayer: null, mainMe: null, detail: null, pick: null, pickPin: null };
  try { const saved = JSON.parse(localStorage.getItem('palit_loc')); if (saved && isFinite(saved.lat) && isFinite(saved.lng)) S.loc = { lat: saved.lat, lng: saved.lng, known: true }; } catch (e) {}

  const distOf = (it) => kmBetween(S.loc.lat, S.loc.lng, it.lat, it.lng);
  const statOf = (id) => S.stats[id] || { buys: 0, avg: 0, count: 0 };
  const imgOf = (it) => safeUrl((it.image_urls || [])[0]) || PLACEHOLDER;

  function destroyMap(key) {
    if (maps[key]) { try { maps[key].remove(); } catch (e) {} maps[key] = null; }
  }

  /* -------------------------------------------------------------- map helpers */
  function makeMap(el, center, zoom, opts) {
    const m = L.map(el, Object.assign({ zoomControl: true, attributionControl: true }, opts || {})).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
    return m;
  }
  const pinIcon = (text, cls) => L.divIcon({ className: 'pin ' + (cls || ''), html: '<span>' + esc(text) + '</span>', iconSize: [0, 0] });
  const mapFallback = (msg) => '<div class="map-fallback"><div>' + ic('map') + '<p style="margin-top:.5rem"><b>Map unavailable</b><br>' + esc(msg) + '</p></div></div>';

  /* -------------------------------------------------------------------- data */
  function loadItems() {
    return Promise.all([D.listItems(), D.stats().catch(() => ({}))]).then(([items, stats]) => {
      S.items = items; S.stats = stats; S.loaded = true; S.loadError = '';
    }).catch((e) => { S.loaded = true; S.loadError = D.niceError(e); console.error(e); });
  }
  const refreshStats = () => D.stats().then((s) => { S.stats = s; }).catch(() => {});

  /* ------------------------------------------------------------------- shell */
  function renderShell() {
    $('#app').innerHTML = `
    <div class="shell">
      <aside class="side no-print">
        <a class="brand" href="#/market"><span class="logo">${logoSvg('#fff', '#ff7a3d', '#3a35c8')}</span>KIRVELAT</a>
        <div>
          <h2 class="label">Menu</h2>
          <nav class="nav" aria-label="Main">
            <a href="#/market" data-nav="market"><span class="ic">${ic('store')}</span><span>Market<small>Everything for sale</small></span></a>
            <a href="#/sell" data-nav="sell"><span class="ic">${ic('plus')}</span><span>Sell Item<small>Post something</small></span></a>
            <a href="#/ratings" data-nav="ratings"><span class="ic">${ic('star')}</span><span>Ratings<small>Top selling items</small></span></a>
          </nav>
        </div>
        <div class="side-foot" id="sideFoot"></div>
      </aside>
      <div class="main">
        <header class="topbar"><a class="brand" href="#/market"><span class="logo">${logoSvg('#fff', '#ff7a3d', '#3a35c8')}</span>Palit</a><div id="topAuth"></div></header>
        <main class="view" id="view" tabindex="-1"></main>
      </div>
    </div>
    <nav class="tabbar" aria-label="Main">
      <a href="#/market" data-nav="market">${ic('store')}Market</a>
      <a href="#/sell" data-nav="sell">${ic('plus')}Sell Item</a>
      <a href="#/ratings" data-nav="ratings">${ic('star')}Ratings</a>
    </nav>`;
  }
  function ensureShell() { if (!$('#view')) renderShell(); }

  function updateChrome() {
    $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.getAttribute('data-nav') === S.view));
    const foot = $('#sideFoot'), top = $('#topAuth');
    if (!foot) return;
    const u = S.user;
    const demo = D.mode === 'demo' ? '<div class="demo-note"><b>Demo mode</b>Sample data lives only in this browser. Add your Supabase keys in <code>config.js</code> to go live.</div>' : '';
    foot.innerHTML = demo + (u
      ? `<div class="me"><div class="avatar">${esc((u.name || '?').trim().charAt(0).toUpperCase())}</div><div class="me-meta"><strong>${esc(u.name)}</strong><small>${esc(u.accountType || 'member')}</small></div><button class="out" id="logoutBtn" title="Log out" aria-label="Log out">${ic('logout')}</button></div>`
      : `<div class="guest"><a class="btn btn-soft" href="#/auth?mode=login">Log in</a><a class="btn btn-primary" href="#/auth?mode=signup">Sign up</a></div>`);
    top.innerHTML = u
      ? `<button class="btn btn-ghost btn-sm" id="logoutBtn2">${ic('logout')} Log out</button>`
      : `<a class="btn btn-primary btn-sm" href="#/auth?mode=login">Log in</a>`;
  }

  /* ------------------------------------------------------------------ router */
  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/market';
    const i = raw.indexOf('?');
    const path = i < 0 ? raw : raw.slice(0, i);
    const params = {};
    new URLSearchParams(i < 0 ? '' : raw.slice(i + 1)).forEach((v, k) => { params[k] = v; });
    return { path, params };
  }
  const go = (path) => { location.hash = '#' + path; };

  function route() {
    const { path, params } = parseHash();
    const m = path.match(/^\/item\/(.+)$/);
    if (m) {
      ensureShell();
      if (S.view !== 'market') showMarket();
      openItem(decodeURIComponent(m[1]), params);
      return;
    }
    closeModal();
    if (path === '/auth') { if (S.user) { go(params.next || '/market'); return; } showAuth(params); return; }
    ensureShell();
    if (path === '/sell') showSell();
    else if (path === '/ratings') showRatings();
    else if (S.view !== 'market') showMarket();
    if (path !== '/market' || S.view !== 'market') window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------ market */
  function showMarket() {
    S.view = 'market';
    destroyMap('main'); maps.mainLayer = null; maps.mainMe = null;
    updateChrome();
    $('#view').innerHTML = `
      <div class="page-head">
        <div class="grow"><h1>Market</h1><p id="mCount">&nbsp;</p></div>
        <span class="chip" id="locChip"></span>
      </div>
      <div class="tools">
        <div class="searchbox">${ic('search')}<input class="input" id="q" type="search" placeholder="Search items, places…" value="${esc(S.q)}" aria-label="Search the market" autocomplete="off"></div>
        <select class="select" id="sort" aria-label="Sort items">
          <option value="new">Newest first</option><option value="near">Nearest first</option>
          <option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="top">Top selling</option>
        </select>
        <div class="seg" role="group" aria-label="Show">
          <button type="button" data-pane="grid" class="${S.pane === 'grid' ? 'on' : ''}">${ic('grid')} Items</button>
          <button type="button" data-pane="map" class="${S.pane === 'map' ? 'on' : ''}">${ic('map')} Map</button>
        </div>
      </div>
      <div class="cats" id="cats" role="group" aria-label="Categories">${['all'].concat(CATS.map((c) => c.id)).map((id) => `<button type="button" data-cat="${esc(id)}" class="${S.cat === id ? 'on' : ''}">${id === 'all' ? '✨ All' : esc(catEmoji(id) + ' ' + catLabel(id))}</button>`).join('')}</div>
      <div class="market" id="market" data-pane="${S.pane}">
        <div class="grid" id="grid"></div>
        <aside class="mapcol" aria-label="Map of items">
          <div class="mapbox" id="mapbox">
            <div id="mainMap" style="height:100%"></div>
            <div class="map-tools"><button type="button" class="btn btn-primary btn-sm" id="locBtn">${ic('target')} Use my location</button></div>
          </div>
        </aside>
      </div>`;
    $('#sort').value = S.sort;
    $('#q').addEventListener('input', (e) => { S.q = e.target.value; paintMarket(true); });
    $('#sort').addEventListener('change', (e) => { S.sort = e.target.value; paintMarket(false); });
    $('#cats').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      S.cat = b.getAttribute('data-cat');
      $$('#cats [data-cat]').forEach((x) => x.classList.toggle('on', x === b));
      paintMarket(true);
    });
    $('#locBtn').addEventListener('click', () => askLocation(true));
    $$('.seg button').forEach((b) => b.addEventListener('click', () => {
      S.pane = b.getAttribute('data-pane');
      $('#market').setAttribute('data-pane', S.pane);
      $$('.seg button').forEach((x) => x.classList.toggle('on', x === b));
      if (maps.main) setTimeout(() => maps.main.invalidateSize(), 50);
    }));

    if (HAS_MAP) {
      maps.main = makeMap('mainMap', [S.loc.lat, S.loc.lng], 11);
      maps.mainLayer = L.layerGroup().addTo(maps.main);
    } else {
      $('#mainMap').innerHTML = mapFallback('The map library could not load. Check your internet connection.');
    }
    paintMarket(true);
    if (!S.loc.known && !showMarket.asked) { showMarket.asked = true; askLocation(false); }
  }

  function filteredItems() {
    const q = S.q.trim().toLowerCase();
    let list = S.items.filter((i) => !q || (i.title + ' ' + (i.description || '') + ' ' + (i.location_label || '') + ' ' + (i.seller_name || '')).toLowerCase().includes(q));
    const by = {
      new: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      near: (a, b) => distOf(a) - distOf(b),
      low: (a, b) => a.price - b.price,
      high: (a, b) => b.price - a.price,
      top: (a, b) => statOf(b.id).buys - statOf(a.id).buys
    }[S.sort] || null;
    if (S.cat !== 'all') list = list.filter((i) => catOf(i) === S.cat);
    return by ? list.sort(by) : list;
  }

  function cardHtml(it) {
    const st = statOf(it.id);
    return `<button class="card" type="button" data-open="${esc(it.id)}">
      <div class="ph"><img loading="lazy" src="${esc(imgOf(it))}" alt="">${st.buys ? `<span class="tag">${ic('fire')} ${st.buys} sold</span>` : ''}</div>
      <div class="info"><div class="price ${Number(it.price) === 0 ? 'free' : ''}">${esc(priceText(it.price))}</div>
      <div class="t">${esc(it.title)}</div>
      <div class="m">${esc(it.location_label || 'Nearby')} · ${esc(fmtDist(distOf(it)))} away</div></div>
    </button>`;
  }

  function paintMarket(fit) {
    if (S.view !== 'market') return;
    const grid = $('#grid');
    if (!grid) return;
    if (!S.loaded) { grid.innerHTML = '<div class="skel"></div>'.repeat(6); return; }
    const list = filteredItems();
    $('#mCount').textContent = S.loadError ? S.loadError : list.length + ' item' + (list.length === 1 ? '' : 's') + (S.q ? ' matching “' + S.q + '”' : ' posted near you') + (S.cat !== 'all' ? ' in ' + catLabel(S.cat) : '');
    $('#locChip').innerHTML = S.loc.known ? ic('target') + ' Distances from your location' : ic('pin') + ' Distances from ' + esc(C.DEFAULT_CENTER.label);
    $('#locChip').className = 'chip ' + (S.loc.known ? 'dist' : 'warm');
    grid.innerHTML = list.length ? list.map(cardHtml).join('')
      : `<div class="empty"><b>${S.items.length ? (S.cat !== 'all' && !S.q ? 'Nothing in this category yet' : 'Nothing matches that search') : 'No items yet'}</b>${S.items.length ? (S.cat !== 'all' && !S.q ? 'Try another category or <a href="#/sell">sell something</a>.' : 'Try a different word or category.') : 'Be the first to <a href="#/sell">sell something</a>.'}</div>`;
    paintMarkers(list, fit);
  }

  function paintMarkers(list, fit) {
    if (!HAS_MAP || !maps.main || !maps.mainLayer) return;
    maps.mainLayer.clearLayers();
    const pts = [];
    list.forEach((it) => {
      const hot = S.highlight === it.id;
      const mk = L.marker([it.lat, it.lng], { icon: pinIcon(priceText(it.price), hot ? 'hot' : ''), title: it.title, riseOnHover: true }).addTo(maps.mainLayer);
      mk.bindPopup(`<div class="pop"><img src="${esc(imgOf(it))}" alt=""><b>${esc(it.title)}</b><span>${esc(priceText(it.price))} · ${esc(fmtDist(distOf(it)))} away</span><button type="button" class="btn btn-primary btn-sm" data-open="${esc(it.id)}">View details</button></div>`);
      pts.push([it.lat, it.lng]);
    });
    if (maps.mainMe) { maps.main.removeLayer(maps.mainMe); maps.mainMe = null; }
    if (S.loc.known) {
      maps.mainMe = L.marker([S.loc.lat, S.loc.lng], { icon: pinIcon('You', 'me'), zIndexOffset: 1000, interactive: false }).addTo(maps.main);
      pts.push([S.loc.lat, S.loc.lng]);
    }
    if (fit && pts.length) { try { maps.main.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); } catch (e) {} }
  }

  function askLocation(manual) {
    if (!navigator.geolocation) { if (manual) toast('Your browser cannot share location.', 'bad'); return; }
    navigator.geolocation.getCurrentPosition((p) => {
      S.loc = { lat: p.coords.latitude, lng: p.coords.longitude, known: true };
      try { localStorage.setItem('palit_loc', JSON.stringify(S.loc)); } catch (e) {}
      if (S.view === 'market') paintMarket(true);
      if (manual) toast('Location updated — distances are now from you.', 'ok');
    }, () => { if (manual) toast('Location is blocked. Allow it in your browser settings to see real distances.', 'bad'); },
    { enableHighAccuracy: false, timeout: 9000, maximumAge: 300000 });
  }

  /* -------------------------------------------------------------- item modal */
  function closeModal() {
    const root = $('#modalRoot');
    if (root && root.innerHTML) { root.innerHTML = ''; document.body.style.overflow = ''; }
    destroyMap('detail');
  }
  function dismissModal() { if (/^#\/item\//.test(location.hash)) go('/market'); else closeModal(); }

  function openItem(id, params) {
    const found = S.items.filter((i) => i.id === id)[0];
    if (found) { renderItemModal(found, params || {}); return; }
    D.getItem(id).then((it) => {
      if (!it) { toast('That listing is no longer available.', 'bad'); go('/market'); return; }
      renderItemModal(it, params || {});
    }).catch(() => { toast('Could not load that listing.', 'bad'); go('/market'); });
  }

  function renderItemModal(it, params) {
    destroyMap('detail');
    const own = !!(S.user && S.user.id === it.seller_id);
    const st = statOf(it.id);
    const imgs = (it.image_urls || []).map(safeUrl).filter(Boolean);
    if (!imgs.length) imgs.push(PLACEHOLDER);
    $('#modalRoot').innerHTML = `
    <div class="backdrop" id="bd" role="dialog" aria-modal="true" aria-label="${esc(it.title)}">
      <div class="sheet">
        <button class="close" type="button" data-close aria-label="Close">${ic('x')}</button>
        <div class="gal">
          <div class="big"><img id="galBig" src="${esc(imgs[0])}" alt="${esc(it.title)}"></div>
          ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((u, n) => `<button type="button" data-thumb="${n}" class="${n === 0 ? 'on' : ''}" aria-label="Photo ${n + 1}"><img src="${esc(u)}" alt=""></button>`).join('')}</div>` : ''}
        </div>
        <div class="det">
          <div><h2>${esc(it.title)}</h2><div class="price ${Number(it.price) === 0 ? 'free' : ''}">${esc(priceText(it.price))}</div></div>
          <div class="chips">
            <span class="chip">${esc(catEmoji(catOf(it)) + ' ' + catLabel(catOf(it)))}</span>
            <span class="chip dist">${ic('pin')} ${esc(fmtDist(distOf(it)))} away${S.loc.known ? '' : ' from ' + esc(C.DEFAULT_CENTER.label)}</span>
            <span class="chip">${esc(it.location_label || 'Nearby')}</span>
            <span class="chip">Listed ${esc(timeAgo(it.created_at))}</span>
            ${st.buys ? `<span class="chip warm">${ic('fire')} ${st.buys} sold</span>` : ''}
            ${st.count ? `<span class="chip">★ ${Number(st.avg).toFixed(1)} (${st.count})</span>` : ''}
          </div>
          <div><h4>Details</h4><p class="desc">${esc(it.description)}</p></div>
          <div><h4>Where it is</h4><div class="mini" id="detailMap"></div></div>
          <div class="seller-row"><div class="avatar">${esc((it.seller_name || '?').charAt(0).toUpperCase())}</div>
            <div><strong>${esc(it.seller_name || 'Seller')}</strong><br><small class="hint">Phone &amp; Gmail unlock after you log in</small></div></div>
          <div class="buybox" id="buybox"></div>
        </div>
      </div>
    </div>`;
    document.body.style.overflow = 'hidden';
    const bd = $('#bd');
    bd.addEventListener('click', (e) => { if (e.target === bd) dismissModal(); });
    $('.close', bd).addEventListener('click', dismissModal);
    $$('[data-thumb]', bd).forEach((b) => b.addEventListener('click', () => {
      $('#galBig').src = imgs[Number(b.getAttribute('data-thumb'))];
      $$('[data-thumb]', bd).forEach((x) => x.classList.toggle('on', x === b));
    }));
    $('.close', bd).focus();

    if (HAS_MAP) {
      maps.detail = makeMap('detailMap', [it.lat, it.lng], 14, { scrollWheelZoom: false });
      L.marker([it.lat, it.lng], { icon: pinIcon(priceText(it.price)) }).addTo(maps.detail);
      if (S.loc.known) {
        L.marker([S.loc.lat, S.loc.lng], { icon: pinIcon('You', 'me'), interactive: false }).addTo(maps.detail);
        try { maps.detail.fitBounds([[it.lat, it.lng], [S.loc.lat, S.loc.lng]], { padding: [34, 34], maxZoom: 15 }); } catch (e) {}
      }
      setTimeout(() => maps.detail && maps.detail.invalidateSize(), 80);
    } else { $('#detailMap').innerHTML = mapFallback('Map library not loaded.'); }

    renderBuybox(it, own, params.buy === '1');
  }

  function renderBuybox(it, own, autoBuy) {
    const box = $('#buybox'); if (!box) return;
    if (own) {
      box.innerHTML = '<div class="notice">' + ic('info') + '<span>This is your listing. Buyers who log in will see your contact details.</span></div>';
      return;
    }
    if (autoBuy && S.user) { doBuy(it); return; }
    box.innerHTML = `<button class="btn btn-coral btn-lg btn-block" type="button" id="buyBtn">BUY ITEM</button>
      <p class="hint" style="text-align:center">${S.user ? 'Tap to see the seller’s phone number and Gmail.' : 'You’ll log in or sign up to see the seller’s information.'}</p>`;
    $('#buyBtn').addEventListener('click', () => {
      if (!S.user) { go('/auth?mode=login&buy=1&next=' + encodeURIComponent('/item/' + it.id + '?buy=1')); return; }
      doBuy(it);
    });
  }

  function doBuy(it) {
    const box = $('#buybox'); if (!box) return;
    box.innerHTML = '<button class="btn btn-coral btn-lg btn-block" type="button" disabled>Getting seller info…</button>';
    D.recordPurchase(it.id).then(() => D.getContact(it.id)).then((c) => {
      if (!c) throw new Error('The seller has no contact details on file.');
      refreshStats().then(() => { if (S.view === 'market') paintMarket(false); });
      showSellerInfo(it, c);
    }).catch((e) => {
      toast(D.niceError(e), 'bad');
      box.innerHTML = '<button class="btn btn-coral btn-lg btn-block" type="button" id="buyBtn">BUY ITEM</button>';
      $('#buyBtn').addEventListener('click', () => doBuy(it));
    });
  }

  function showSellerInfo(it, c) {
    const box = $('#buybox'); if (!box) return;
    const tel = String(c.number || '').replace(/[^\d+]/g, '');
    const mailOk = EMAIL_RE.test(c.gmail || '');
    const osm = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(it.lat)}&mlon=${encodeURIComponent(it.lng)}#map=16/${encodeURIComponent(it.lat)}/${encodeURIComponent(it.lng)}`;
    box.innerHTML = `
    <div class="sellerinfo">
      <h3>${ic('check')} Seller information</h3>
      <div class="contact-line">${ic('user')} ${esc(it.seller_name || 'Seller')}</div>
      <div class="contact-line">${ic('phone')} ${tel ? `<a href="tel:${esc(tel)}">${esc(c.number)}</a>` : esc(c.number)}</div>
      <div class="contact-line">${ic('mail')} ${mailOk ? `<a href="mailto:${esc(c.gmail)}">${esc(c.gmail)}</a>` : esc(c.gmail)}</div>
      <div class="contact-line">${ic('pin')} <span>${esc(it.location_label || 'Pin on map')} · ${esc(fmtDist(distOf(it)))} away · <a href="${esc(osm)}" target="_blank" rel="noopener noreferrer">open map</a></span></div>
      <div id="rateBox"></div>
      <p class="hint">Message the seller, agree on payment, and meet in a safe public place.</p>
    </div>`;
    D.myRating(it.id).then((mine) => paintRate(it, mine)).catch(() => paintRate(it, 0));
  }

  function paintRate(it, mine) {
    const rb = $('#rateBox'); if (!rb) return;
    rb.innerHTML = `<strong style="font-size:.9rem">Rate this item</strong>
      <div class="stars" role="group" aria-label="Rate from 1 to 5 stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" class="${n <= mine ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>`;
    $$('[data-star]', rb).forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.getAttribute('data-star'));
      D.rate(it.id, n).then(() => { paintRate(it, n); toast('Thanks for rating!', 'ok'); return refreshStats(); }).catch((e) => toast(D.niceError(e), 'bad'));
    }));
  }

  /* ----------------------------------------------------------------- ratings */
  function showRatings() {
    S.view = 'ratings';
    destroyMap('main');
    updateChrome();
    const v = $('#view');
    let list = S.items.map((i) => ({ it: i, st: statOf(i.id) }));
    if (S.rankBy === 'sold') list = list.filter((x) => x.st.buys > 0).sort((a, b) => b.st.buys - a.st.buys || b.st.avg - a.st.avg);
    else list = list.filter((x) => x.st.count > 0).sort((a, b) => b.st.avg - a.st.avg || b.st.count - a.st.count);
    const max = Math.max(1, ...list.map((x) => (S.rankBy === 'sold' ? x.st.buys : x.st.avg)));
    const stars = (avg) => '<span class="stars ro" aria-label="' + Number(avg).toFixed(1) + ' out of 5">' + [1, 2, 3, 4, 5].map((n) => `<span class="${n <= Math.round(avg) ? 'on' : ''}">★</span>`).join('') + '</span>';
    const top = list.slice(0, 3), rest = list.slice(3);
    const podOrder = top.length === 3 ? [1, 0, 2] : top.map((_, i) => i);

    v.innerHTML = `
      <div class="page-head"><div class="grow"><h1>Ratings</h1><p>The most top selling items on Palit, ranked by buyers.</p></div>
        <div class="seg" style="display:inline-flex" role="group" aria-label="Rank by">
          <button type="button" data-rank="sold" class="${S.rankBy === 'sold' ? 'on' : ''}">${ic('fire')} Most sold</button>
          <button type="button" data-rank="rated" class="${S.rankBy === 'rated' ? 'on' : ''}">${ic('star')} Best rated</button>
        </div></div>
      ${!S.loaded ? '<div class="empty"><b>Loading…</b></div>' : list.length === 0 ? `<div class="empty"><b>No ratings yet</b>Items appear here once buyers start buying and rating them.</div>` : `
        <div class="podium" style="grid-template-columns:repeat(${top.length},1fr)">
          ${podOrder.map((i) => { const x = top[i]; return `<button type="button" class="pod p${i + 1}" data-open="${esc(x.it.id)}">
            <span class="medal">${i + 1}</span>
            <div class="ph"><img src="${esc(imgOf(x.it))}" alt=""></div>
            <div class="t">${esc(x.it.title)}</div>
            <div class="price">${esc(priceText(x.it.price))}</div>
            <div class="sold">${ic('fire')} ${x.st.buys} sold</div>
            <div>${stars(x.st.avg)} <small class="hint">${x.st.count ? Number(x.st.avg).toFixed(1) + ' (' + x.st.count + ')' : 'no ratings'}</small></div>
          </button>`; }).join('')}
        </div>
        ${rest.length ? `<h3 class="sec-title" style="margin-bottom:.6rem">Full ranking</h3>` : ''}
        <div class="rank">${rest.map((x, i) => `<button type="button" class="rank-row" data-open="${esc(x.it.id)}">
            <span class="n">${i + 4}</span>
            <span class="ph"><img loading="lazy" src="${esc(imgOf(x.it))}" alt=""></span>
            <span style="min-width:0"><span class="t" style="display:block">${esc(x.it.title)}</span>
              <span class="m"><span>${esc(priceText(x.it.price))}</span><span>${esc(x.it.location_label || '')}</span></span>
              <span class="bar" style="display:block"><i style="width:${Math.max(6, Math.round((S.rankBy === 'sold' ? x.st.buys : x.st.avg) / max * 100))}%"></i></span></span>
            <span class="right"><strong>${x.st.buys} sold</strong><br>${stars(x.st.avg)} <small class="hint">${x.st.count ? Number(x.st.avg).toFixed(1) : '–'}</small></span>
          </button>`).join('')}</div>`}`;
    $$('[data-rank]', v).forEach((b) => b.addEventListener('click', () => { S.rankBy = b.getAttribute('data-rank'); showRatings(); }));
    if (!S.loaded) loadItems().then(() => { if (S.view === 'ratings') showRatings(); });
  }

  /* -------------------------------------------------------------------- sell */
  const draft = { title: '', category: '', price: '', description: '', contact: '', gmail: '', label: '', labelTouched: false, lat: null, lng: null, photos: [] };
  const resetDraft = () => { draft.photos.forEach((p) => URL.revokeObjectURL(p.url)); Object.assign(draft, { title: '', category: '', price: '', description: '', contact: '', gmail: '', label: '', labelTouched: false, lat: null, lng: null, photos: [] }); };

  function resizeImage(file, max, q) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process photo'))), 'image/jpeg', q);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read photo')); };
      img.src = url;
    });
  }

  function sellProblems() {
    const p = {};
    if (!draft.photos.length) p.photos = 'Add at least one photo';
    if (draft.title.trim().length < 3) p.title = 'Title (3+ letters)';
    if (!draft.category) p.category = 'Category';
    if (draft.price === '' || !isFinite(Number(draft.price)) || Number(draft.price) < 0 || Number(draft.price) > 99999999) p.price = 'Price';
    if (draft.description.trim().length < 10) p.description = 'Description (10+ characters)';
    if (!D.normalizePhone(draft.contact)) p.contact = 'Contact number';
    if (!EMAIL_RE.test(draft.gmail.trim())) p.gmail = 'Gmail';
    if (draft.lat == null) p.location = 'Pin on map';
    return p;
  }

  function showSell() {
    S.view = 'sell';
    destroyMap('main');
    updateChrome();
    const u = S.user;
    if (u) { if (!draft.gmail && EMAIL_RE.test(u.email || '')) draft.gmail = u.email; if (!draft.contact && u.mobile) draft.contact = u.mobile; }
    $('#view').innerHTML = `
    <div class="page-head"><div class="grow"><h1>Sell Item</h1><p>Post what you’re selling — buyers nearby will see it in the Market.</p></div></div>
    <div class="sell">
      <section class="panel" aria-label="Item for sale form">
        <div class="panel-head"><small>Market</small><h2>Item for sale</h2></div>
        <div class="panel-body">
          <div class="who"><div class="avatar">${esc(u ? u.name.charAt(0).toUpperCase() : '?')}</div><div><strong>${esc(u ? u.name : 'Guest seller')}</strong><small>Listing to Market · Public</small></div></div>
          ${u ? '' : `<div class="notice">${ic('info')}<span>You can fill everything in now — you’ll be asked to log in or sign up when you press <b>Upload</b>.</span></div>`}
          <div>
            <div class="hint" style="margin-bottom:.4rem"><b>Photos</b> · <span id="photoCount">0</span>/${C.MAX_PHOTOS} – the first photo is the cover.</div>
            <div class="drop" id="drop" tabindex="0" role="button" aria-label="Add photos">
              <div class="ic">${ic('photo')}</div><strong>Add photos</strong><span>or drag and drop</span>
            </div>
            <input type="file" id="fFiles" accept="image/*" multiple hidden>
            <div class="thumbs-up" id="thumbsUp" style="margin-top:.6rem"></div>
          </div>
          <div><div class="sec-title">Required</div><div class="hint">Be as descriptive as possible.</div></div>
          <div class="field"><label for="fTitle">Title</label><input class="input" id="fTitle" maxlength="80" placeholder="e.g. Mountain bike 26&quot;" value="${esc(draft.title)}"></div>
          <div class="field"><label for="fCat">Category</label><select class="select" id="fCat"><option value="">Choose a category…</option>${CATS.map((c) => `<option value="${esc(c.id)}"${draft.category === c.id ? ' selected' : ''}>${esc(c.emoji + ' ' + c.label)}</option>`).join('')}</select></div>
          <div class="field"><label for="fPrice">Price</label><div class="price-wrap"><span>${esc(C.CURRENCY)}</span><input class="input" id="fPrice" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="${esc(draft.price)}"></div><div class="hint">Enter 0 to give it away for free.</div></div>
          <div class="field"><label for="fDesc">Description</label><textarea class="textarea" id="fDesc" maxlength="2000" placeholder="Condition, size, why you’re selling, meet-up details…">${esc(draft.description)}</textarea></div>
          <div><div class="sec-title">Contact</div><div class="hint">Only logged-in buyers see this after pressing BUY ITEM.</div></div>
          <div class="two">
            <div class="field"><label for="fContact">Contact Number</label><input class="input" id="fContact" type="tel" inputmode="tel" placeholder="0917 123 4567" value="${esc(draft.contact)}" autocomplete="tel"></div>
            <div class="field"><label for="fGmail">Gmail</label><input class="input" id="fGmail" type="email" placeholder="name@gmail.com" value="${esc(draft.gmail)}" autocomplete="email"></div>
          </div>
          <div><div class="sec-title">Location</div><div class="hint">Tap the map to drop a pin where the item can be picked up. Buyers will see the distance.</div></div>
          <div class="pick" id="pickBox"><div id="pickMap" style="height:100%"></div></div>
          <div class="two">
            <div class="field"><label for="fLabel">Area / town</label><input class="input" id="fLabel" maxlength="80" placeholder="e.g. Makati" value="${esc(draft.label)}"></div>
            <div class="field"><label>&nbsp;</label><button type="button" class="btn btn-soft" id="pickMe">${ic('target')} Use my location</button></div>
          </div>
        </div>
        <div class="panel-foot">
          <div class="progress" aria-hidden="true"><i id="prog"></i></div>
          <div class="checks" id="checks"></div>
          <button type="button" class="btn btn-coral btn-lg btn-block" id="uploadBtn">${ic('upload')} Upload</button>
        </div>
      </section>
      <aside class="panel preview" aria-label="Listing preview">
        <div class="panel-head"><h2 style="font-size:1.1rem">Preview</h2></div>
        <div class="panel-body"><div class="pv-grid" id="pv"></div></div>
      </aside>
    </div>
    <div class="mylist" id="mylist"></div>`;

    const bind = (id, key) => $('#' + id).addEventListener('input', (e) => { draft[key] = e.target.value; if (key === 'label') draft.labelTouched = true; syncSell(); });
    bind('fTitle', 'title'); bind('fCat', 'category'); bind('fPrice', 'price'); bind('fDesc', 'description'); bind('fContact', 'contact'); bind('fGmail', 'gmail'); bind('fLabel', 'label');

    const drop = $('#drop'), file = $('#fFiles');
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => addPhotos(e.dataTransfer.files));
    file.addEventListener('change', () => { addPhotos(file.files); file.value = ''; });
    $('#thumbsUp').addEventListener('click', (e) => {
      const b = e.target.closest('[data-rm]'); if (!b) return;
      const [gone] = draft.photos.splice(Number(b.getAttribute('data-rm')), 1);
      if (gone) URL.revokeObjectURL(gone.url);
      paintThumbs(); syncSell();
    });
    $('#pickMe').addEventListener('click', () => {
      if (!navigator.geolocation) { toast('Your browser cannot share location.', 'bad'); return; }
      navigator.geolocation.getCurrentPosition((p) => setPin(p.coords.latitude, p.coords.longitude, true),
        () => toast('Location is blocked. Tap the map to drop a pin instead.', 'bad'), { timeout: 9000 });
    });
    $('#uploadBtn').addEventListener('click', doUpload);

    destroyMap('pick'); maps.pickPin = null;
    if (HAS_MAP) {
      const c = draft.lat != null ? [draft.lat, draft.lng] : [S.loc.lat, S.loc.lng];
      maps.pick = makeMap('pickMap', c, draft.lat != null ? 15 : 12);
      maps.pick.on('click', (e) => setPin(e.latlng.lat, e.latlng.lng, false));
      if (draft.lat != null) maps.pickPin = L.marker(c, { icon: pinIcon('Item here', 'hot') }).addTo(maps.pick);
      setTimeout(() => maps.pick && maps.pick.invalidateSize(), 80);
    } else { $('#pickMap').innerHTML = mapFallback('Use the “Use my location” button instead.'); }

    paintThumbs(); syncSell(); paintMyListings();
  }

  function setPin(lat, lng, recenter) {
    draft.lat = Math.round(lat * 1e6) / 1e6; draft.lng = Math.round(lng * 1e6) / 1e6;
    if (HAS_MAP && maps.pick) {
      if (maps.pickPin) maps.pickPin.setLatLng([lat, lng]);
      else maps.pickPin = L.marker([lat, lng], { icon: pinIcon('Item here', 'hot') }).addTo(maps.pick);
      if (recenter) maps.pick.setView([lat, lng], 15);
    }
    if (!draft.labelTouched) reverseLabel(lat, lng);
    syncSell();
  }

  function reverseLabel(lat, lng) {
    fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&lat=' + lat + '&lon=' + lng, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (!d || !d.address || draft.labelTouched) return;
        const a = d.address;
        const label = [a.suburb || a.neighbourhood || a.village || a.city_district, a.city || a.town || a.municipality || a.county].filter(Boolean).join(', ');
        if (label && $('#fLabel')) { draft.label = label.slice(0, 80); $('#fLabel').value = draft.label; syncSell(); }
      }).catch(() => {});
  }

  function addPhotos(fileList) {
    const files = Array.from(fileList || []).filter((f) => /^image\//.test(f.type));
    const room = C.MAX_PHOTOS - draft.photos.length;
    if (!files.length) { toast('Please choose image files.', 'bad'); return; }
    if (files.length > room) toast('You can add up to ' + C.MAX_PHOTOS + ' photos.', 'bad');
    const demo = D.mode === 'demo';
    Promise.all(files.slice(0, Math.max(0, room)).map((f) => resizeImage(f, demo ? 720 : 1280, demo ? 0.7 : 0.82).then((blob) => ({ blob, url: URL.createObjectURL(blob) })).catch(() => null)))
      .then((res) => {
        const ok = res.filter(Boolean);
        if (ok.length < res.length) toast('Some photos could not be read.', 'bad');
        draft.photos.push(...ok);
        if (S.view === 'sell') { paintThumbs(); syncSell(); }
      });
  }
  function paintThumbs() {
    const t = $('#thumbsUp'); if (!t) return;
    t.innerHTML = draft.photos.map((p, i) => `<div class="t"><img src="${esc(p.url)}" alt="Photo ${i + 1}">${i === 0 ? '<span class="cover">Cover</span>' : ''}<button type="button" data-rm="${i}" aria-label="Remove photo ${i + 1}">×</button></div>`).join('');
    $('#photoCount').textContent = draft.photos.length;
  }

  function syncSell() {
    if (S.view !== 'sell') return;
    const p = sellProblems();
    const labels = { photos: 'Photo', title: 'Title', category: 'Category', price: 'Price', description: 'Description', contact: 'Contact number', gmail: 'Gmail', location: 'Location pin' };
    const keys = Object.keys(labels);
    $('#prog').style.width = Math.round((keys.length - Object.keys(p).length) / keys.length * 100) + '%';
    $('#checks').innerHTML = keys.map((k) => `<span class="${p[k] ? '' : 'ok'}">${labels[k]}</span>`).join('');
    const pv = $('#pv'); if (!pv) return;
    const first = draft.photos[0];
    const name = S.user ? S.user.name : 'You';
    pv.innerHTML = `
      <div class="pv-img ${first ? 'has' : ''}">${first ? `<img src="${esc(first.url)}" alt="">` : '<div><h3 style="color:#fff;font-size:1.3rem">Your listing preview</h3><p style="margin-top:.4rem">As you create your listing, you can preview how it will appear to others in the Market.</p></div>'}</div>
      <div class="pv-info">
        <div><h3 class="${draft.title ? '' : 'dim'}">${esc(draft.title || 'Title')}</h3>
          <div class="price ${draft.price === '' ? 'dim' : ''}" style="${draft.price === '' ? 'color:var(--muted)' : ''}">${draft.price === '' ? 'Price' : esc(priceText(Number(draft.price) || 0))}</div>
          <div class="hint">Listed a few seconds ago${draft.category ? ' · ' + esc(catEmoji(draft.category) + ' ' + catLabel(draft.category)) : ''}${draft.label ? ' · ' + esc(draft.label) : ''}</div></div>
        <div><h4>Details</h4><div class="d ${draft.description ? '' : 'hint'}">${esc(draft.description || 'Description will appear here')}</div></div>
        <div><h4>Seller information</h4>
          <div class="seller-row"><div class="avatar">${esc(name.charAt(0).toUpperCase())}</div><div style="min-width:0"><strong>${esc(name)}</strong>
            <div class="hint">${draft.contact ? esc(draft.contact) : 'Contact number'} · ${draft.gmail ? esc(draft.gmail) : 'Gmail'}</div></div></div>
          <div class="hint" style="margin-top:.35rem">${ic('lock')} Contact details show only after a buyer logs in.</div></div>
      </div>`;
  }

  function doUpload() {
    const p = sellProblems();
    if (Object.keys(p).length) {
      toast('Still needed: ' + Object.values(p).join(', ') + '.', 'bad');
      return;
    }
    if (!S.user) { toast('Log in or sign up to post your item — your form is saved.'); go('/auth?mode=login&next=' + encodeURIComponent('/sell')); return; }
    const btn = $('#uploadBtn');
    btn.disabled = true; btn.textContent = 'Uploading…';
    D.createItem({
      title: draft.title.trim(), category: draft.category, price: Number(draft.price), description: draft.description.trim(),
      contact: draft.contact.trim(), gmail: draft.gmail.trim(), lat: draft.lat, lng: draft.lng, label: draft.label.trim()
    }, draft.photos.map((x) => x.blob), (f) => { btn.textContent = 'Uploading… ' + Math.round(f * 100) + '%'; })
      .then((item) => { resetDraft(); return loadItems().then(() => { S.highlight = item.id; S.sort = 'new'; S.q = ''; S.cat = 'all'; S.view = ''; toast('Your item is now live in the Market!', 'ok'); go('/market'); }); })
      .catch((e) => { toast(D.niceError(e), 'bad'); btn.disabled = false; btn.innerHTML = ic('upload') + ' Upload'; });
  }

  function paintMyListings() {
    const box = $('#mylist'); if (!box || !S.user) { if (box) box.innerHTML = ''; return; }
    D.myItems().then((mine) => {
      if (S.view !== 'sell' || !$('#mylist')) return;
      $('#mylist').innerHTML = mine.length ? `<h3 class="sec-title">Your listings</h3>` + mine.map((it) => `
        <div class="row"><img src="${esc(imgOf(it))}" alt=""><div class="grow"><b>${esc(it.title)}</b><span class="hint">${esc(priceText(it.price))} · ${esc(timeAgo(it.created_at))}</span></div>
          <button class="btn btn-ghost btn-sm" type="button" data-open="${esc(it.id)}">View</button>
          <button class="btn btn-ghost btn-sm" type="button" data-del="${esc(it.id)}" aria-label="Delete ${esc(it.title)}">${ic('trash')}</button></div>`).join('') : '';
    }).catch(() => {});
  }

  /* -------------------------------------------------------------------- auth */
  function showAuth(params) {
    S.view = 'auth';
    destroyMap('main'); destroyMap('pick');
    const mode = params.mode === 'signup' ? 'signup' : 'login';
    const next = params.next || '/market';
    const phoneMode = C.AUTH_MODE !== 'email';
    const idIcon = phoneMode ? 'mobile' : 'mail';
    const idLabel = phoneMode ? 'Mobile Number' : 'E-mail';
    $('#app').innerHTML = `
    <div class="auth">
      <section class="splash" aria-hidden="true">
        <span class="shape t1"></span><span class="shape t2"></span><span class="shape t3"></span><span class="shape t4"></span>
        <span class="shape dot d1"></span><span class="shape dot d2"></span><span class="shape dot d3"></span>
        <div class="splash-inner"><div class="logo">${logoSvg('#3a35c8', '#ff7a3d', '#fff')}</div><h1>Palit</h1><p>Buy &amp; sell, right in your neighbourhood.</p></div>
      </section>
      <section class="auth-side">
        <div class="auth-card">
          <div class="auth-top"><button class="back" type="button" id="backBtn">${ic('back')} Back to Market</button></div>
          <div><h2 id="authTitle">${mode === 'signup' ? 'Signup' : 'Login'}</h2></div>
          ${params.buy === '1' ? `<div class="notice">${ic('lock')}<span>Log in or sign up to see the seller’s information for this item.</span></div>` : ''}
          <div class="form-error" id="authErr" role="alert" hidden></div>

          <form class="auth-form" id="loginForm" ${mode === 'signup' ? 'hidden' : ''} novalidate>
            <label class="uline">${ic(idIcon)}<input id="lId" name="id" type="${phoneMode ? 'tel' : 'email'}" inputmode="${phoneMode ? 'tel' : 'email'}" placeholder="${idLabel}" autocomplete="username" aria-label="${idLabel}"></label>
            <label class="uline">${ic('lock')}<input id="lPw" name="password" type="password" placeholder="Password" autocomplete="current-password" aria-label="Password"><button class="eye" type="button" data-eye aria-label="Show password">${ic('eye')}</button></label>
            <button class="forgot" type="button" id="forgot">Forgot Password?</button>
            <button class="btn btn-primary btn-lg btn-block" id="loginBtn" type="submit" style="margin-top:.6rem">Login</button>
            <p class="switch">Don’t have an account? <button type="button" data-switch="signup">Signup</button></p>
            <button class="btn btn-google btn-lg btn-block" type="button" id="googleBtn"><span class="g">G</span> Or Login With Google</button>
          </form>

          <form class="auth-form" id="signupForm" ${mode === 'login' ? 'hidden' : ''} novalidate>
            <label class="uline">${ic('user')}<input id="sName" type="text" placeholder="Username" autocomplete="username" maxlength="40" aria-label="Username"></label>
            <label class="uline">${ic('mobile')}<input id="sMobile" type="tel" inputmode="tel" placeholder="Mobile Number" autocomplete="tel" aria-label="Mobile number"></label>
            <label class="uline">${ic('mail')}<input id="sEmail" type="email" placeholder="E-mail" autocomplete="email" aria-label="E-mail"></label>
            <label class="uline">${ic('building')}<input id="sCompany" type="text" placeholder="Company / Shop Name (optional)" maxlength="60" aria-label="Company name"></label>
            <label class="uline">${ic('store')}<select id="sType" aria-label="Account type"><option value="buyer">Account Type: Buyer</option><option value="seller">Account Type: Seller</option><option value="buyer & seller">Account Type: Buyer &amp; Seller</option></select>${ic('chevron')}</label>
            <label class="uline">${ic('lock')}<input id="sPw" type="password" placeholder="Password (8+ characters)" autocomplete="new-password" aria-label="Password"><button class="eye" type="button" data-eye aria-label="Show password">${ic('eye')}</button></label>
            <label class="uline">${ic('lock')}<input id="sPw2" type="password" placeholder="Re-Password" autocomplete="new-password" aria-label="Re-enter password"></label>
            <button class="btn btn-primary btn-lg btn-block" id="signupBtn" type="submit" style="margin-top:.6rem">Signup</button>
            <p class="switch">Already have an account? <button type="button" data-switch="login">Login</button></p>
          </form>
        </div>
      </section>
    </div>`;

    const err = (msg) => { const el = $('#authErr'); el.hidden = !msg; el.textContent = msg || ''; };
    const setMode = (m) => {
      $('#loginForm').hidden = m !== 'login'; $('#signupForm').hidden = m !== 'signup';
      $('#authTitle').textContent = m === 'signup' ? 'Signup' : 'Login'; err('');
      history.replaceState(null, '', '#/auth?' + new URLSearchParams(Object.assign({}, params, { mode: m })).toString());
    };
    $$('[data-switch]').forEach((b) => b.addEventListener('click', () => setMode(b.getAttribute('data-switch'))));
    $$('[data-eye]').forEach((b) => b.addEventListener('click', () => {
      const inp = b.parentElement.querySelector('input'); inp.type = inp.type === 'password' ? 'text' : 'password';
    }));
    $('#backBtn').addEventListener('click', () => go('/market'));
    $('#forgot').addEventListener('click', () => toast('Password reset is not set up yet. Ask the site owner to reset it in Supabase.'));
    $('#googleBtn').addEventListener('click', () => {
      try { sessionStorage.setItem('palit_next', next); } catch (e) {}
      D.signInGoogle().catch((e) => err(D.niceError(e)));
    });

    $('#loginForm').addEventListener('submit', (e) => {
      e.preventDefault(); err('');
      let id = $('#lId').value.trim(); const pw = $('#lPw').value;
      if (!id || !pw) { err('Enter your ' + idLabel.toLowerCase() + ' and password.'); return; }
      if (phoneMode) { const n = D.normalizePhone(id); if (n) id = n; else if (D.mode !== 'demo') { err('Enter a valid mobile number, e.g. 0917 123 4567.'); return; } }
      const btn = $('#loginBtn'); btn.disabled = true; btn.textContent = 'Logging in…';
      D.signIn(id, pw).then(() => D.init()).then((u) => { S.user = u; toast('Welcome back, ' + (u ? u.name : '') + '!', 'ok'); go(next); })
        .catch((ex) => { err(D.niceError(ex)); btn.disabled = false; btn.textContent = 'Login'; });
    });

    $('#signupForm').addEventListener('submit', (e) => {
      e.preventDefault(); err('');
      const f = { username: $('#sName').value.trim(), mobile: $('#sMobile').value.trim(), email: $('#sEmail').value.trim(), company: $('#sCompany').value.trim(), accountType: $('#sType').value, password: $('#sPw').value };
      const e164 = D.normalizePhone(f.mobile);
      if (f.username.length < 3) return err('Username needs at least 3 characters.');
      if (!e164) return err('Enter a valid mobile number, e.g. 0917 123 4567.');
      if (!EMAIL_RE.test(f.email)) return err('Enter a valid e-mail address.');
      if (f.password.length < 8) return err('Password needs at least 8 characters.');
      if (f.password !== $('#sPw2').value) return err('Passwords do not match.');
      f.mobile = e164;
      const btn = $('#signupBtn'); btn.disabled = true; btn.textContent = 'Creating account…';
      D.signUp(f).then((res) => {
        if (res.signedIn) { return D.init().then((u) => { S.user = u; toast('Account created. Welcome to Palit!', 'ok'); go(next); }); }
        toast('Account created — please log in.', 'ok'); setMode('login'); btn.disabled = false; btn.textContent = 'Signup';
      }).catch((ex) => { err(D.niceError(ex)); btn.disabled = false; btn.textContent = 'Signup'; });
    });
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------ events */
  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    if (open) { go('/item/' + encodeURIComponent(open.getAttribute('data-open'))); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      if (!window.confirm('Delete this listing? This cannot be undone.')) return;
      D.deleteItem(del.getAttribute('data-del')).then(loadItems).then(() => { toast('Listing deleted.', 'ok'); paintMyListings(); })
        .catch((ex) => toast(D.niceError(ex), 'bad'));
      return;
    }
    if (e.target.closest('#logoutBtn, #logoutBtn2')) {
      D.signOut().then(() => { S.user = null; toast('You have been logged out.'); updateChrome(); if (S.view === 'sell') showSell(); });
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#bd')) dismissModal(); });
  window.addEventListener('hashchange', route);

  /* -------------------------------------------------------------------- boot */
  D.init().then((u) => {
    S.user = u;
    D.onAuth((nu) => { S.user = nu; updateChrome(); });
    let pending = null; try { pending = sessionStorage.getItem('palit_next'); sessionStorage.removeItem('palit_next'); } catch (e) {}
    if (u && pending) location.hash = '#' + pending;
    else if (!location.hash) history.replaceState(null, '', '#/market');
    route();
    return loadItems();
  }).then(() => {
    if (S.view === 'market') paintMarket(true);
    else if (S.view === 'ratings') showRatings();
    if ($('#bd')) route();
  }).catch((e) => { console.error(e); $('#app').innerHTML = '<p style="padding:2rem">Something went wrong while starting Palit. Please refresh.</p>'; });
})();
