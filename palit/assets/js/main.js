/* =====================================================================
   FILE: main.js  —  APP FRAME, MENU, ROUTER, CLICKS, START-UP  (loads LAST)
   ---------------------------------------------------------------------
   [SHELL]       side menu + top bar + phone tab bar  <- add a menu link here
   [CHROME]      highlights the active menu link + shows the logged-in user box
   [ROUTER]      which page opens for which link (#/market, #/sell, ...)
   [CLICKS]      one listener for buttons used on several pages
   [BOOT]        what runs when the site opens
   PAGE FILES:  page-market.js  page-item.js  page-purchases.js
                page-ratings.js  page-sell.js (+My Listings)  page-profile.js  page-auth.js
   ===================================================================== */

/* ------------------------------------------------------------------ [SHELL]
   To add a new page: add a link in the 3 places below, then a case in [ROUTER]. */
function renderShell() {
  var logo = '<span class="logo">' + logoSvg('#fff', '#ff7a3d', '#3a35c8') + '</span>';
  $('#app').innerHTML =
    '<div class="shell">' +
      '<aside class="side no-print">' +
        '<a class="brand" href="#/market">' + logo + esc(C.STORE_NAME) + '</a>' +
        '<div><h2 class="label">Menu</h2><nav class="nav">' +
          '<a href="#/market" data-nav="market"><span class="ic">' + ic('store') + '</span><span>Market<small>Everything for sale</small></span></a>' +
          '<a href="#/sell" data-nav="sell"><span class="ic">' + ic('plus') + '</span><span>Sell Item<small>Post something</small></span></a>' +
          '<a href="#/my-listings" data-nav="my-listings"><span class="ic">' + ic('edit') + '</span><span>My Listings<small>Edit &amp; delete</small></span></a>' +
          '<a href="#/purchases" data-nav="purchases"><span class="ic">' + ic('bag') + '</span><span>My Purchases<small>Bought items &amp; rating</small></span></a>' +
          '<a href="#/ratings" data-nav="ratings"><span class="ic">' + ic('star') + '</span><span>Ratings<small>Top selling items</small></span></a>' +
          '<a href="#/profile" data-nav="profile"><span class="ic">' + ic('user') + '</span><span>Profile<small>Your account</small></span></a>' +
        '</nav></div>' +
        '<div class="side-foot" id="sideFoot"></div>' +
      '</aside>' +
      '<div class="main">' +
        '<header class="topbar"><a class="brand" href="#/market">' + logo + esc(C.STORE_NAME) + '</a><div id="topAuth"></div></header>' +
        '<main class="view" id="view" tabindex="-1"></main>' +
      '</div>' +
    '</div>' +
    '<nav class="tabbar">' +
      '<a href="#/market" data-nav="market">' + ic('store') + 'Market</a>' +
      '<a href="#/sell" data-nav="sell">' + ic('plus') + 'Sell</a>' +
      '<a href="#/my-listings" data-nav="my-listings">' + ic('edit') + 'Listings</a>' +
      '<a href="#/purchases" data-nav="purchases">' + ic('bag') + 'Bought</a>' +
      '<a href="#/profile" data-nav="profile">' + ic('user') + 'Profile</a>' +
    '</nav>';
}
function ensureShell() { if (!$('#view')) renderShell(); }

/* ----------------------------------------------------------------- [CHROME] */
function updateChrome() {
  $$('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === state.page); });
  var foot = $('#sideFoot'), top = $('#topAuth');
  if (!foot) return;
  var u = state.user;
  var demo = D.mode === 'demo' ? '<div class="demo-note"><b>Demo mode</b>Sample data lives only in this browser. Add your Supabase keys in <code>config.js</code> to go live.</div>' : '';
  if (u) {
    foot.innerHTML = demo + '<div class="me"><a class="avatar" href="#/profile">' + esc((u.name || '?').trim().charAt(0).toUpperCase()) + '</a>' +
      '<div class="me-meta"><strong>' + esc(u.name) + '</strong><small>' + esc(u.accountType || 'member') + '</small></div>' +
      '<button class="out" id="logoutBtn" title="Log out" aria-label="Log out">' + ic('logout') + '</button></div>';
    top.innerHTML = '<button class="btn btn-ghost btn-sm" id="logoutBtn2">' + ic('logout') + ' Log out</button>';
  } else {
    foot.innerHTML = demo + '<div class="guest"><a class="btn btn-soft" href="#/auth?mode=login">Log in</a><a class="btn btn-primary" href="#/auth?mode=signup">Sign up</a></div>';
    top.innerHTML = '<a class="btn btn-primary btn-sm" href="#/auth?mode=login">Log in</a>';
  }
}

/* ----------------------------------------------------------------- [ROUTER] */
function parseHash() {
  var raw = location.hash.replace(/^#/, '') || '/market';
  var i = raw.indexOf('?');
  var path = i < 0 ? raw : raw.slice(0, i);
  var params = {};
  new URLSearchParams(i < 0 ? '' : raw.slice(i + 1)).forEach(function (v, k) { params[k] = v; });
  return { path: path, params: params };
}
function go(path) { location.hash = '#' + path; }

function route() {
  var r = parseHash(), path = r.path, params = r.params;

  /* item pop-up opens on top of the Market */
  var m = path.match(/^\/item\/(.+)$/);
  if (m) {
    ensureShell();
    if (state.page !== 'market') showMarket();
    openItem(decodeURIComponent(m[1]), params);
    return;
  }
  closeModal();

  if (path === '/auth') {
    if (state.user) { go(params.next || '/market'); return; }
    showAuth(params); return;
  }
  ensureShell();
  if (path === '/sell') showSell();
  else if (path === '/my-listings') showMyListings();
  else if (path === '/purchases') showPurchases();
  else if (path === '/ratings') showRatings();
  else if (path === '/profile') showProfile();
  else if (state.page !== 'market') showMarket();
  if (path !== '/market' || state.page !== 'market') window.scrollTo(0, 0);
}

/* ----------------------------------------------------------------- [CLICKS]
   data-xxx attributes on buttons decide what happens. */
document.addEventListener('click', function (e) {
  var t = e.target;
  var b;
  if ((b = t.closest('[data-open]')))    { go('/item/' + encodeURIComponent(b.getAttribute('data-open'))); return; }
  if ((b = t.closest('[data-edit]')))    { openEditModal(b.getAttribute('data-edit')); return; }
  if ((b = t.closest('[data-toggle]')))  { toggleSold(b.getAttribute('data-toggle')); return; }
  if ((b = t.closest('[data-del]')))     { deleteListing(b.getAttribute('data-del')); return; }
  if ((b = t.closest('[data-star]')))    { rateItem(b.getAttribute('data-item'), Number(b.getAttribute('data-star'))); return; }
  if ((b = t.closest('[data-unrate]')))  { clearRating(b.getAttribute('data-unrate')); return; }
  if ((b = t.closest('[data-contact]'))) { showContactInRow(b.getAttribute('data-contact')); return; }
  if ((b = t.closest('[data-unbuy]')))   { removePurchase(b.getAttribute('data-unbuy')); return; }
  if (t.closest('#logoutBtn, #logoutBtn2')) {
    D.signOut().then(function () {
      state.user = null; state.purchases = []; state.boughtIds = {}; state.myRatings = {};
      toast('You have been logged out.'); updateChrome();
      if (state.page === 'market') paintMarket(false); else go('/market');
    });
  }
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('#bd')) dismissModal(); });
window.addEventListener('hashchange', route);

/* ------------------------------------------------------------------- [BOOT] */
document.title = C.STORE_NAME + ' · Buy and sell near you';
D.init().then(function (u) {
  state.user = u;
  D.onAuth(function (nu) { state.user = nu; updateChrome(); });
  var pending = null;
  try { pending = sessionStorage.getItem('palit_next'); sessionStorage.removeItem('palit_next'); } catch (e) {}
  if (u && pending) location.hash = '#' + pending;
  else if (!location.hash) history.replaceState(null, '', '#/market');
  return loadMyBuying();
}).then(function () {
  route();
  return loadItems();
}).then(function () {
  if (state.page === 'market') paintMarket(true);
  else if (state.page === 'ratings') showRatings();
  else if (state.page === 'profile') showProfile();
  if ($('#bd')) route();
}).catch(function (e) {
  console.error(e);
  $('#app').innerHTML = '<p style="padding:2rem">Something went wrong while starting the store. Please refresh.</p>';
});
