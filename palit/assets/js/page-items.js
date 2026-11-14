/* =====================================================================
   FILE: page-item.js  —  ITEM DETAILS POP-UP + BUY BUTTON  (#/item/<id>)
   ---------------------------------------------------------------------
   [ITEM-MODAL-CLOSE]   closing the pop-up
   [ITEM-OPEN]          finds the item, then draws it
   [ITEM-SCREEN]        the pop-up layout (photos, price, details, map)  <- edit look here
   [ITEM-BUYBOX]        the BUY ITEM button area (own item / already bought / buy)
   [ITEM-BUY]           what happens when BUY ITEM is pressed (CREATE a purchase)
   [ITEM-SELLER-INFO]   shows seller phone + Gmail after buying
   After buying, the item moves to the My Purchases page (#/purchases).
   ===================================================================== */

/* -------------------------------------------------------- [ITEM-MODAL-CLOSE] */
function closeModal() {
  var root = $('#modalRoot');
  if (root && root.innerHTML) { root.innerHTML = ''; document.body.style.overflow = ''; }
  destroyMap('detail');
}
function dismissModal() {
  if (/^#\/item\//.test(location.hash)) { go('/market'); } else { closeModal(); }
}

/* --------------------------------------------------------------- [ITEM-OPEN] */
function openItem(id, params) {
  var found = state.items.filter(function (i) { return i.id === id; })[0];
  if (!found) {
    /* maybe it is one I bought / sold and so not in the Market list */
    found = state.purchases.map(function (p) { return p.item; }).filter(function (i) { return i.id === id; })[0];
  }
  if (found) { renderItemModal(found, params || {}); return; }
  D.getItem(id).then(function (it) {
    if (!it) { toast('That listing is no longer available.', 'bad'); go('/market'); return; }
    renderItemModal(it, params || {});
  }).catch(function () { toast('Could not load that listing.', 'bad'); go('/market'); });
}

/* ------------------------------------------------------------- [ITEM-SCREEN] */
function renderItemModal(it, params) {
  destroyMap('detail');
  var own = !!(state.user && state.user.id === it.seller_id);
  var st = statOf(it.id);
  var imgs = (it.image_urls || []).map(safeUrl).filter(Boolean);
  if (!imgs.length) imgs.push(PLACEHOLDER);

  var thumbs = '';
  if (imgs.length > 1) {
    thumbs = '<div class="thumbs">';
    imgs.forEach(function (u, n) { thumbs += '<button type="button" data-thumb="' + n + '" class="' + (n === 0 ? 'on' : '') + '"><img src="' + esc(u) + '" alt=""></button>'; });
    thumbs += '</div>';
  }
  var soldChip = st.buys ? '<span class="chip warm">' + ic('fire') + ' ' + st.buys + ' sold</span>' : '';
  var starChip = st.count ? '<span class="chip">★ ' + Number(st.avg).toFixed(1) + ' (' + st.count + ')</span>' : '';
  var meetup = it.meetup_notes ? '<div><h4>Meet-up notes</h4><p class="desc">' + esc(it.meetup_notes) + '</p></div>' : '';

  $('#modalRoot').innerHTML =
    '<div class="backdrop" id="bd" role="dialog" aria-modal="true">' +
      '<div class="sheet">' +
        '<button class="close" type="button" aria-label="Close">' + ic('x') + '</button>' +
        '<div class="gal"><div class="big"><img id="galBig" src="' + esc(imgs[0]) + '" alt=""></div>' + thumbs + '</div>' +
        '<div class="det">' +
          '<div><h2>' + esc(it.title) + '</h2><div class="price ' + (Number(it.price) === 0 ? 'free' : '') + '">' + esc(priceText(it.price)) + '</div></div>' +
          '<div class="chips">' +
            '<span class="chip">' + esc(catEmoji(catOf(it)) + ' ' + catLabel(catOf(it))) + '</span>' +
            '<span class="chip">' + esc(conditionLabel(it.condition)) + '</span>' +
            '<span class="chip">Qty ' + esc(it.quantity || 1) + '</span>' +
            '<span class="chip dist">' + ic('pin') + ' ' + esc(fmtDist(distOf(it))) + ' away</span>' +
            '<span class="chip">' + esc(it.location_label || 'Nearby') + '</span>' +
            '<span class="chip">Listed ' + esc(timeAgo(it.created_at)) + '</span>' +
            soldChip + starChip +
          '</div>' +
          '<div><h4>Details</h4><p class="desc">' + esc(it.description) + '</p></div>' +
          meetup +
          '<div><h4>Where it is</h4><div class="mini" id="detailMap"></div></div>' +
          '<div class="seller-row"><div class="avatar">' + esc((it.seller_name || '?').charAt(0).toUpperCase()) + '</div>' +
            '<div><strong>' + esc(it.seller_name || 'Seller') + '</strong><br><small class="hint">Phone &amp; Gmail unlock after you log in</small></div></div>' +
          '<div class="buybox" id="buybox"></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.style.overflow = 'hidden';
  var bd = $('#bd');
  bd.addEventListener('click', function (e) { if (e.target === bd) dismissModal(); });
  $('.close', bd).addEventListener('click', dismissModal);
  $$('[data-thumb]', bd).forEach(function (b) {
    b.addEventListener('click', function () {
      $('#galBig').src = imgs[Number(b.getAttribute('data-thumb'))];
      $$('[data-thumb]', bd).forEach(function (x) { x.classList.toggle('on', x === b); });
    });
  });

  if (HAS_MAP) {
    maps.detail = makeMap('detailMap', [it.lat, it.lng], 14, { scrollWheelZoom: false });
    L.marker([it.lat, it.lng], { icon: pinIcon(priceText(it.price)) }).addTo(maps.detail);
    setTimeout(function () { if (maps.detail) maps.detail.invalidateSize(); }, 80);
  } else {
    $('#detailMap').innerHTML = mapFallback('Map library not loaded.');
  }
  renderBuybox(it, own, params.buy === '1');
}

/* ------------------------------------------------------------- [ITEM-BUYBOX] */
function renderBuybox(it, own, autoBuy) {
  var box = $('#buybox'); if (!box) return;

  /* 1) my own listing -> link to edit */
  if (own) {
    box.innerHTML = '<div class="notice">' + ic('info') + '<span>This is your listing.</span></div>' +
      '<a class="btn btn-soft btn-block" href="#/my-listings">' + ic('edit') + ' Edit in My Listings</a>';
    return;
  }
  /* 2) I already bought it -> link to My Purchases */
  if (state.boughtIds[it.id]) {
    box.innerHTML = '<div class="notice ok">' + ic('check') + '<span>You already bought this item.</span></div>' +
      '<a class="btn btn-primary btn-block" href="#/purchases">Open My Purchases &amp; rate it</a>';
    return;
  }
  /* 3) came back from login with ?buy=1 */
  if (autoBuy && state.user) { doBuy(it); return; }

  /* 4) normal BUY ITEM button */
  box.innerHTML = '<button class="btn btn-coral btn-lg btn-block" type="button" id="buyBtn">BUY ITEM</button>' +
    '<p class="hint" style="text-align:center">' + (state.user ? 'Tap to see the seller’s phone number and Gmail.' : 'You’ll log in or sign up to see the seller’s information.') + '</p>';
  $('#buyBtn').addEventListener('click', function () {
    if (!state.user) { go('/auth?mode=login&buy=1&next=' + encodeURIComponent('/item/' + it.id + '?buy=1')); return; }
    doBuy(it);
  });
}

/* ----------------------------------------------------------------- [ITEM-BUY] */
function doBuy(it) {
  var box = $('#buybox'); if (!box) return;
  box.innerHTML = '<button class="btn btn-coral btn-lg btn-block" type="button" disabled>Getting seller info…</button>';
  D.recordPurchase(it.id)                       // CREATE the purchase
    .then(function () { return D.getSellerContact(it.id); })
    .then(function (contact) {
      if (!contact) throw new Error('The seller has no contact details on file.');
      showSellerInfo(it, contact);
      return Promise.all([loadMyBuying(), refreshStats()]);
    })
    .then(function () { if (state.page === 'market') paintMarket(false); })
    .catch(function (e) {
      toast(D.niceError(e), 'bad');
      box.innerHTML = '<button class="btn btn-coral btn-lg btn-block" type="button" id="buyBtn">BUY ITEM</button>';
      $('#buyBtn').addEventListener('click', function () { doBuy(it); });
    });
}

/* ------------------------------------------------------- [ITEM-SELLER-INFO] */
function sellerInfoHtml(it, c) {
  var tel = String(c.number || '').replace(/[^\d+]/g, '');
  var mailOk = EMAIL_RE.test(c.gmail || '');
  return '<div class="contact-line">' + ic('user') + ' ' + esc(it.seller_name || 'Seller') + '</div>' +
    '<div class="contact-line">' + ic('phone') + ' ' + (tel ? '<a href="tel:' + esc(tel) + '">' + esc(c.number) + '</a>' : esc(c.number)) + '</div>' +
    '<div class="contact-line">' + ic('mail') + ' ' + (mailOk ? '<a href="mailto:' + esc(c.gmail) + '">' + esc(c.gmail) + '</a>' : esc(c.gmail)) + '</div>';
}
function showSellerInfo(it, c) {
  var box = $('#buybox'); if (!box) return;
  box.innerHTML = '<div class="sellerinfo"><h3>' + ic('check') + ' Item bought!</h3>' +
    sellerInfoHtml(it, c) +
    '<p class="hint">Message the seller, agree on payment, and meet in a safe public place.</p>' +
    '<a class="btn btn-primary btn-block" href="#/purchases">Go to My Purchases to rate it</a></div>';
}
