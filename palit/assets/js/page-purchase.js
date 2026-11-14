/* =====================================================================
   FILE: page-purchases.js  —  MY PURCHASES PAGE  (#/purchases)
   ---------------------------------------------------------------------
   This is the "different page" for items the buyer already bought.
   Buyer CRUD lives here:
     CREATE  = pressing BUY ITEM (page-item.js)
     READ    = this page lists everything I bought
     UPDATE  = give / change a star rating
     DELETE  = remove the purchase (and my rating)
   [PURCHASES-SCREEN]  the page layout
   [PURCHASES-ROW]     ONE bought item card  <- change the look here
   [PURCHASES-ACTIONS] rate, show seller contact, remove
   ===================================================================== */

/* ------------------------------------------------------- [PURCHASES-SCREEN] */
function showPurchases() {
  state.page = 'purchases';
  destroyMap('main');
  updateChrome();
  if (!state.user) {
    $('#view').innerHTML = '<div class="page-head"><div class="grow"><h1>My Purchases</h1></div></div>' +
      '<div class="empty"><b>Log in to see what you bought</b><a href="#/auth?mode=login&next=%2Fpurchases">Log in</a></div>';
    return;
  }
  $('#view').innerHTML = '<div class="page-head"><div class="grow"><h1>My Purchases</h1>' +
    '<p>Items you already bought. Rate them so other buyers know what is good.</p></div></div>' +
    '<div class="plist" id="plist"><div class="skel"></div></div>';
  loadMyBuying().then(paintPurchases);
}

function paintPurchases() {
  var box = $('#plist'); if (!box) return;
  if (state.purchases.length === 0) {
    box.innerHTML = '<div class="empty"><b>No purchases yet</b>Press BUY ITEM on something in the <a href="#/market">Market</a> and it will show up here.</div>';
    return;
  }
  var html = '';
  state.purchases.forEach(function (p) { html += purchaseRowHtml(p); });
  box.innerHTML = html;
}

/* --------------------------------------------------------- [PURCHASES-ROW] */
function purchaseRowHtml(p) {
  var it = p.item;
  var mine = state.myRatings[it.id] || 0;
  var stars = '';
  for (var n = 1; n <= 5; n++) {
    stars += '<button type="button" data-star="' + n + '" data-item="' + esc(it.id) + '" class="' + (n <= mine ? 'on' : '') + '" aria-label="' + n + ' star">★</button>';
  }
  var soldNote = it.status === 'sold' ? '<span class="chip">Seller marked it sold out</span>' : '';
  return '<div class="prow" data-row="' + esc(it.id) + '">' +
    '<img src="' + esc(imgOf(it)) + '" alt="">' +
    '<div class="prow-main">' +
      '<div class="prow-top"><b>' + esc(it.title) + '</b><span class="badge-bought">' + ic('check') + ' Already bought</span></div>' +
      '<div class="hint">' + esc(priceText(it.price)) + ' · from ' + esc(it.seller_name || 'Seller') + ' · bought ' + esc(timeAgo(p.boughtAt)) + '</div>' +
      soldNote +
      '<div class="prow-rate"><strong>' + (mine ? 'Your rating' : 'Rate this item') + '</strong><div class="stars">' + stars + '</div>' +
        (mine ? '<button class="btn btn-ghost btn-sm" type="button" data-unrate="' + esc(it.id) + '">Clear rating</button>' : '') + '</div>' +
      '<div class="contact-slot" id="contact-' + esc(it.id) + '"></div>' +
    '</div>' +
    '<div class="prow-btns">' +
      '<button class="btn btn-soft btn-sm" type="button" data-contact="' + esc(it.id) + '">' + ic('phone') + ' Seller contact</button>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-open="' + esc(it.id) + '">View</button>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-unbuy="' + esc(it.id) + '">' + ic('trash') + ' Remove</button>' +
    '</div></div>';
}

/* ------------------------------------------------------- [PURCHASES-ACTIONS]
   Called from the one click listener in main.js */
function findBought(id) {
  return state.purchases.filter(function (p) { return p.item.id === id; })[0];
}
function rateItem(itemId, stars) {
  D.rate(itemId, stars).then(function () {
    state.myRatings[itemId] = stars;
    toast('Thanks for rating!', 'ok');
    paintPurchases();
    return refreshStats();
  }).catch(function (e) { toast(D.niceError(e), 'bad'); });
}
function clearRating(itemId) {
  D.removeRating(itemId).then(function () { delete state.myRatings[itemId]; paintPurchases(); return refreshStats(); })
    .catch(function (e) { toast(D.niceError(e), 'bad'); });
}
function showContactInRow(itemId) {
  var p = findBought(itemId); var slot = $('#contact-' + itemId);
  if (!p || !slot) return;
  D.getSellerContact(itemId).then(function (c) {
    slot.innerHTML = c ? '<div class="sellerinfo">' + sellerInfoHtml(p.item, c) + '</div>' : '<p class="hint">No contact on file.</p>';
  }).catch(function (e) { toast(D.niceError(e), 'bad'); });
}
function removePurchase(itemId) {
  if (!window.confirm('Remove this from My Purchases? Your rating for it will be removed too.')) return;
  D.removePurchase(itemId).then(function () { return Promise.all([loadMyBuying(), refreshStats()]); })
    .then(function () { toast('Removed from My Purchases.', 'ok'); paintPurchases(); })
    .catch(function (e) { toast(D.niceError(e), 'bad'); });
}
