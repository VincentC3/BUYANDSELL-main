/* =====================================================================
   FILE: page-item.js  —  ITEM DETAILS POP-UP + BUY BUTTON  (#/item/<id>)
   ---------------------------------------------------------------------
   [ITEM-MODAL-CLOSE]   closing the pop-up
   [ITEM-OPEN]          finds the item, then draws it
   [ITEM-SCREEN]        the pop-up layout (photos, price, details, map)  <- edit look here
   [ITEM-BUYBOX]        the BUY ITEM button area (own item / already bought / buy)
   [ITEM-DELIVERY-CHOICE] the Meet up / Delivery choice shown after pressing BUY ITEM
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
/*  [ITEM-OPEN] */
function openItem(id, params) {
  params = params || {};
  var found = state.items.filter(function (i) { return i.id === id; })[0];
  if (!found) {
    found = state.purchases.map(function (p) { return p.item; }).filter(function (i) { return i.id === id; })[0];
  }
  if (found) { countView(found, params); renderItemModal(found, params); return; }
  D.getItem(id).then(function (it) {
    if (!it) { toast('That listing is no longer available.', 'bad'); go('/market'); return; }
    countView(it, params);
    renderItemModal(it, params);
  }).catch(function () { toast('Could not load that listing.', 'bad'); go('/market'); });
}

/* --------------------------------------------------------------- [ITEM-VIEWS]
   Dagdag 1 view kapag binuksan ng buyer ang item.
   Hindi binibilang kung seller mismo, o kung bumalik lang galing login (?buy=1). */
function countView(it, params) {
  if (params.buy === '1') return;
  if (state.user && state.user.id === it.seller_id) return;
  it.views = (it.views || 0) + 1;              // update agad sa screen
    D.addView(it.id).catch(function (e) { console.error('VIEWS ERROR:', e); });      // i-save sa database
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
    var viewChip = '<span class="chip">👁 ' + (it.views || 0) + ' views</span>';
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
            '<span class="chip">Qty ' + esc(it.quantity || 1) + '</span>' +
            deliveryChipHtml(it) +
            '<span class="chip dist">' + ic('pin') + ' ' + esc(fmtDist(distOf(it))) + ' away</span>' +
            '<span class="chip">' + esc(it.location_label || 'Nearby') + '</span>' +
            '<span class="chip">Listed ' + esc(timeAgo(it.created_at)) + '</span>' +
            soldChip + starChip + viewChip +
          '</div>' +
          '<div><h4>Details</h4><p class="desc">' + esc(it.description) + '</p></div>' +
          meetup +
          '<div><h4>Where it is</h4><div class="mini" id="detailMap"></div></div>' +
          '<div class="seller-row"><div class="avatar">' + esc((it.seller_name || '?').charAt(0).toUpperCase()) + '</div>' +
            '<div><strong>' + esc(it.seller_name || 'Seller') + '</strong><br><small class="hint">Phone &amp; Gmail unlock after the seller accepts your request</small></div></div>' +
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
    box.innerHTML = '<div class="notice ok">' + ic('check') + '<span>You already requested this item.</span></div>' +
      '<a class="btn btn-primary btn-block" href="#/purchases">Open My Purchases</a>';
    return;
  }
  /* 3) came back from login with ?buy=1 -> show the delivery / meet-up choice */
  if (autoBuy && state.user) { showBuyOptions(it); return; }

  /* 4) normal BUY ITEM button */
  box.innerHTML = '<button class="btn btn-coral btn-lg btn-block" type="button" id="buyBtn">BUY ITEM</button>' +
    '<p class="hint" style="text-align:center">' + (state.user ? 'Next you choose meet up or delivery.' : 'You’ll log in or sign up first.') + '</p>';
  $('#buyBtn').addEventListener('click', function () {
    if (!state.user) { go('/auth?mode=login&buy=1&next=' + encodeURIComponent('/item/' + it.id + '?buy=1')); return; }
    showBuyOptions(it);
  });
}

/* --------------------------------------------------- [ITEM-DELIVERY-CHOICE]
   The buyer picks MEET UP or DELIVERY here (only the options the seller offers).
   To change the wording or add an option (e.g. "Courier"), edit this function. */
function showBuyOptions(it) {
  var box = $('#buybox'); if (!box) return;
  var offer = it.delivery_options || 'meetup';           // 'meetup' | 'delivery' | 'both'
  var fee = Number(it.delivery_fee || 0);
  var canMeet = offer !== 'delivery';
  var canDeliver = offer !== 'meetup';
  var first = canMeet ? 'meetup' : 'delivery';

  var html = '<div class="deliv"><h4>How do you want to get it?</h4>';
  if (canMeet) {
    html += '<label class="opt"><input type="radio" name="dm" value="meetup"' + (first === 'meetup' ? ' checked' : '') + '>' +
      '<span class="opt-body"><b>' + ic('pin') + ' Meet up</b><small>Meet the seller at ' + esc(it.location_label || 'the pickup spot') + '. No delivery fee.</small></span></label>';
  }
  if (canDeliver) {
    html += '<label class="opt"><input type="radio" name="dm" value="delivery"' + (first === 'delivery' ? ' checked' : '') + '>' +
      '<span class="opt-body"><b>' + ic('bag') + ' Delivery</b><small>The seller brings it to you. ' + (fee > 0 ? 'Delivery fee: ' + esc(priceText(fee)) : 'Free delivery') + '.</small></span></label>';
  }
  html += '<div id="dFields"' + (first === 'delivery' ? '' : ' hidden') + '><div class="field"><label for="dAddr">Delivery address</label>' +
    '<textarea class="textarea" id="dAddr" maxlength="300" placeholder="House no., street, barangay, city, landmark"></textarea></div></div>' +
    '<div class="field"><label for="dNote">Note to seller (optional)</label><input class="input" id="dNote" maxlength="200" placeholder="e.g. Available after 5pm"></div>' +
    '<div class="deliv-total" id="dTotal"></div>' +
    '<div class="form-error" id="dErr" hidden></div>' +
    '<button class="btn btn-coral btn-lg btn-block" type="button" id="confirmBuy">SEND BUY REQUEST</button>' +
    '<button class="btn btn-ghost btn-block" type="button" id="cancelBuy">Cancel</button>' +
    '<p class="hint" style="text-align:center">The seller must accept your request first. You pay the seller directly when you receive the item.</p></div>';
  box.innerHTML = html;

  function chosen() { var r = $('input[name="dm"]:checked', box); return r ? r.value : first; }
  function refresh() {
    var delivery = chosen() === 'delivery';
    $('#dFields').hidden = !delivery;
    var total = Number(it.price) + (delivery ? fee : 0);
    $('#dTotal').innerHTML = 'Total: <strong>' + esc(priceText(total)) + '</strong>' +
      (delivery && fee > 0 ? ' <small>(item ' + esc(priceText(it.price)) + ' + delivery ' + esc(priceText(fee)) + ')</small>' : '');
  }
  $$('input[name="dm"]', box).forEach(function (r) { r.addEventListener('change', refresh); });
  refresh();

  $('#cancelBuy').addEventListener('click', function () { renderBuybox(it, false, false); });
  $('#confirmBuy').addEventListener('click', function () {
    var method = chosen();
    var address = $('#dAddr').value.trim();
    var err = $('#dErr');
    if (method === 'delivery' && address.length < 10) {
      err.hidden = false; err.textContent = 'Please enter your full delivery address.'; return;
    }
    doBuy(it, { method: method, address: address, note: $('#dNote').value.trim() });
  });
}

/* ----------------------------------------------------------------- [ITEM-BUY] */
function doBuy(it, order) {
  var box = $('#buybox'); if (!box) return;
  box.innerHTML = '<button class="btn btn-coral btn-lg btn-block" type="button" disabled>Sending your request…</button>';
  D.recordPurchase(it.id, order)                // CREATE the request (status: pending)
    .then(function () { return Promise.all([loadMyBuying(), refreshStats()]); })
    .then(function () {
      box.innerHTML = '<div class="sellerinfo"><h3>' + ic('check') + ' Request sent!</h3>' +
        '<div class="contact-line">' + (order.method === 'delivery' ? ic('bag') + ' Delivery to: ' + esc(order.address) : ic('pin') + ' Meet up') + '</div>' +
        '<p class="hint">Now wait for the seller to accept. Once accepted, their phone and Gmail appear in My Purchases.</p>' +
        '<a class="btn btn-primary btn-block" href="#/purchases">Go to My Purchases</a></div>';
      if (state.page === 'market') paintMarket(false);
    })
    .catch(function (e) {
      toast(D.niceError(e), 'bad');
      showBuyOptions(it);
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
