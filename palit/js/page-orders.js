/* =====================================================================
   FILE: page-orders.js  —  SELLER ORDER REQUESTS  (#/orders)
   ---------------------------------------------------------------------
   The seller sees every buyer request on his items and can:
     ACCEPT   -> status 'accepted'   (buyer can now see the seller contact)
     DECLINE  -> status 'rejected'
     COMPLETE -> status 'completed'  (buyer can now rate the item)
   [ORDERS-SCREEN]   page layout + loading
   [ORDERS-ROW]      ONE request card (with Accept / Decline buttons)
   [ORDERS-ACTIONS]  what the buttons do
   Needs in data.js: sellerOrders, acceptPurchase, rejectPurchase,
   and (optional, for the Complete button) completePurchase.
   ===================================================================== */

var sellerOrderList = [];   // all requests on my items
var sellerOrderItems = {};  // { itemId: item }

/* ------------------------------------------------------- [ORDERS-SCREEN] */
function showOrders() {
  state.page = 'orders';
  destroyMap('main');
  updateChrome();
  if (!state.user) {
    $('#view').innerHTML = '<div class="page-head"><div class="grow"><h1>Order Requests</h1></div></div>' +
      '<div class="empty"><b>Log in to see your order requests</b><a href="#/auth?mode=login&next=%2Forders">Log in</a></div>';
    return;
  }
  $('#view').innerHTML = '<div class="page-head"><div class="grow"><h1>Order Requests</h1>' +
    '<p>Buyers who want your items. Accept or decline each request.</p></div></div>' +
    '<div class="plist" id="olist"><div class="skel"></div></div>';
  refreshOrders();
}

function refreshOrders() {
  sellerTrackReady = true;
  return Promise.all([D.sellerOrders(), D.myItems(),
    D.sellerTracking().catch(function () { sellerTrackReady = false; return {}; })]).then(function (res) {
    sellerOrderList = res[0];
    sellerOrderItems = {};
    res[1].forEach(function (it) { sellerOrderItems[it.id] = it; });
    sellerTrackRows = res[2] || {};
    if (share) { var tr = sellerTrackRows[share.id]; if (!tr || tr.status !== 'out_for_delivery') stopSharing(); }
    paintOrders();
  }).catch(function (e) { toast(D.niceError(e), 'bad'); });
}

function paintOrders() {
  var box = $('#olist'); if (!box) return;
  if (!sellerOrderList.length) {
    box.innerHTML = '<div class="empty"><b>No order requests yet</b>When a buyer presses BUY ITEM on your listing, it shows up here.</div>';
    return;
  }
  /* pending first, then the rest (newest first inside each group) */
  var pending = sellerOrderList.filter(function (o) { return o.status === 'pending'; });
  var others = sellerOrderList.filter(function (o) { return o.status !== 'pending'; });
  var html = '';
  if (pending.length) {
    html += '<h3 class="sec-title">Waiting for your answer (' + pending.length + ')</h3>';
    pending.forEach(function (o) { html += orderRowHtml(o); });
  }
  if (others.length) {
    html += '<h3 class="sec-title" style="margin-top:1rem">History</h3>';
    others.forEach(function (o) { html += orderRowHtml(o); });
  }
  box.innerHTML = html;
}

/* --------------------------------------------------------- [ORDERS-ROW] */
var ORDER_BADGES = {
  pending:   '<span style="background:#fff3cd;color:#856404;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:bold;">PENDING</span>',
  accepted:  '<span style="background:#d1e7dd;color:#0f5132;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:bold;">ACCEPTED</span>',
  rejected:  '<span style="background:#f8d7da;color:#842029;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:bold;">DECLINED</span>',
  completed: '<span style="background:#d1e7dd;color:#0f5132;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:bold;">COMPLETED</span>',
  cancelled: '<span style="background:#e2e3e5;color:#41464b;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:bold;">CANCELLED</span>'
};

function orderRowHtml(o) {
  var it = sellerOrderItems[o.itemId] || { id: o.itemId, title: 'Item', price: 0, image_urls: [] };
  var status = o.status || 'pending';
  var id = esc(o.purchaseId);

  var buttons = '';
  if (status === 'pending') {
    buttons =
      '<button class="btn btn-primary btn-sm" type="button" data-o-accept="' + id + '">' + ic('check') + ' Accept</button>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-o-decline="' + id + '">' + ic('x') + ' Decline</button>';
  } else if (status === 'accepted' && typeof D.completePurchase === 'function') {
    buttons = '<button class="btn btn-coral btn-sm" type="button" data-o-complete="' + id + '">' + ic('check') + ' Mark completed</button>';
  }

  return '<div class="prow">' +
    '<img src="' + esc(imgOf(it)) + '" alt="">' +
    '<div class="prow-main">' +
      '<div class="prow-top"><b>' + esc(it.title) + '</b>' + (ORDER_BADGES[status] || ORDER_BADGES.pending) + '</div>' +
      '<div class="hint">' + esc(priceText(it.price)) + ' · requested ' + esc(timeAgo(o.boughtAt)) + '</div>' +
      '<div class="hint">' + ic('user') + ' <b>' + esc(o.buyerName || 'Buyer') + '</b>' +
        (o.buyerContact ? ' · ' + ic('phone') + ' ' + esc(o.buyerContact) : '') + '</div>' +
      '<div class="hint">' +
        (o.method === 'delivery'
          ? ic('bag') + ' Delivery to: ' + esc(o.address || '')
          : ic('pin') + ' Meet up') + '</div>' +
      (o.note ? '<div class="hint">Note: ' + esc(o.note) + '</div>' : '') +
      deliveryPanelHtml(o, status) +
    '</div>' +
    '<div class="prow-btns">' + buttons + '</div>' +
  '</div>';
}

/* ------------------------------------------------------- [ORDERS-ACTIONS] */
function setOrderStatus(purchaseId, fn, okMessage) {
  fn(purchaseId).then(function () {
    toast(okMessage, 'ok');
    return refreshOrders();
  }).catch(function (e) {
    var msg = D.niceError(e);
    /* .single() fails with this when the request was already answered */
    if (/0 rows|no rows|PGRST116/i.test(msg)) msg = 'This request was already updated. Refreshing…';
    toast(msg, 'bad');
    refreshOrders();
  });
}

/* one listener for the 3 buttons (so main.js needs no change) */
document.addEventListener('click', function (e) {
  var b;
  if ((b = e.target.closest('[data-o-accept]'))) {
    setOrderStatus(b.getAttribute('data-o-accept'), D.acceptPurchase, 'Request accepted. The buyer can now see your contact.');
  } else if ((b = e.target.closest('[data-o-decline]'))) {
    if (!window.confirm('Decline this buyer request?')) return;
    setOrderStatus(b.getAttribute('data-o-decline'), D.rejectPurchase, 'Request declined.');
  } else if ((b = e.target.closest('[data-o-complete]'))) {
    if (!window.confirm('Mark this transaction as completed? The buyer will then be able to rate the item.')) return;
    setOrderStatus(b.getAttribute('data-o-complete'), D.completePurchase, 'Transaction completed.');
  }
});

/* ===================================================================== [ORDERS-DELIVERY]
   Seller delivery tracking.
     "I deliver myself"  -> this phone shares its GPS; the buyer sees a live map.
     "Courier"           -> the seller pastes the courier's tracking link / number.
   GPS rules (so the buyer sees real data):
     - a point with accuracy worse than 150 m is NOT sent
     - a point is sent every 4 s while moving (at least every 15 s even when standing still)
     - the screen is kept awake while sharing (Wake Lock) */
var sellerTrackRows = {};   // { purchaseId: delivery_tracking row }
var sellerTrackReady = true;
var share = null;           // the delivery being shared right now (one at a time)

function deliveryPanelHtml(o, status) {
  if (!sellerTrackReady || o.method !== 'delivery') return '';
  if (status !== 'accepted' && status !== 'completed') return '';
  var t = sellerTrackRows[o.purchaseId] || null;
  var started = !!(t && t.mode);
  var st = started ? t.status : 'preparing';
  if (status === 'completed' && !started) return '';
  var id = esc(o.purchaseId);
  var box = 'margin-top:.7rem;padding:.75rem;border:1px solid #d9d7f5;border-radius:12px;background:#f7f6ff';
  var inp = 'width:100%;margin:.2rem 0;padding:.5rem;border:1px solid #ccc;border-radius:8px;font:inherit';
  var html = '<div style="' + box + '"><div style="font-weight:700">' + ic('bag') + ' Delivery</div>' + trackStepsHtml(st);
  var pin = (t && t.dest_lat != null && t.dest_lng != null)
    ? '<div class="hint"><a href="https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(t.dest_lat + ',' + t.dest_lng) +
      '" target="_blank" rel="noopener noreferrer">Open the buyer’s map pin in Google Maps</a></div>'
    : '<div class="hint">The buyer has not dropped a map pin yet. Use the written address.</div>';

  if (st === 'delivered') {
    return html + '<div class="hint">Delivered ' + esc(timeAgo(t.delivered_at)) + '.</div></div>';
  }
  if (!started) {
    return html + pin +
      '<div class="hint" style="margin-top:.4rem"><b>How will you deliver this?</b></div>' +
      '<label style="display:block;margin:.25rem 0"><input type="radio" name="trkm-' + id + '" value="self" checked data-trk-mode="' + id + '"> I deliver it myself — the buyer sees my live location on a map</label>' +
      '<label style="display:block;margin:.25rem 0"><input type="radio" name="trkm-' + id + '" value="courier" data-trk-mode="' + id + '"> A courier delivers it (Lalamove, J&amp;T, LBC…) — the buyer gets the courier’s tracking link</label>' +
      '<div id="trk-cf-' + id + '" hidden style="margin:.4rem 0">' +
        '<input id="trk-cn-' + id + '" style="' + inp + '" maxlength="60" placeholder="Courier name, e.g. Lalamove">' +
        '<input id="trk-cl-' + id + '" style="' + inp + '" maxlength="500" placeholder="Tracking link (https://…)">' +
        '<input id="trk-tn-' + id + '" style="' + inp + '" maxlength="60" placeholder="Booking / tracking number (optional if you pasted a link)">' +
      '</div>' +
      '<div class="hint">If you deliver yourself, your phone will ask to share its location. Keep this page open with the screen on while you ride.</div>' +
      '<button class="btn btn-primary btn-sm" type="button" data-trk-start="' + id + '" style="margin-top:.4rem">Start delivery</button></div>';
  }
  if (t.mode === 'courier') {
    var lk = safeLink(t.courier_link);
    return html + '<div class="hint"><b>' + esc(t.courier_name || 'Courier') + '</b>' +
      (t.tracking_no ? ' · No. ' + esc(t.tracking_no) : '') + '</div>' +
      (lk ? '<div class="hint"><a href="' + esc(lk) + '" target="_blank" rel="noopener noreferrer">Open courier tracking page</a></div>' : '') +
      '<div class="hint">The buyer sees this on My Purchases. Press the button when the courier has delivered it.</div>' +
      '<button class="btn btn-coral btn-sm" type="button" data-trk-done="' + id + '" style="margin-top:.4rem">Mark delivered</button></div>';
  }
  var sharing = share && share.id === o.purchaseId;
  return html +
    '<div class="hint" id="trk-share-' + id + '">' + esc(sharing ? share.stat : 'Not sharing your location right now, so the buyer cannot see you moving.') + '</div>' + pin +
    '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.4rem">' +
      (sharing
        ? '<button class="btn btn-ghost btn-sm" type="button" data-trk-stop="' + id + '">Stop sharing</button>'
        : '<button class="btn btn-primary btn-sm" type="button" data-trk-share="' + id + '">' + ic('target') + ' Share my location</button>') +
      '<button class="btn btn-coral btn-sm" type="button" data-trk-done="' + id + '">Mark delivered</button>' +
    '</div>' +
    '<div class="hint">Keep this page open and the screen on. If your phone loses signal, the buyer will see how old the last point is.</div></div>';
}

/* ---- GPS sharing ---- */
function shareStat(text) {
  if (!share) return;
  share.stat = text;
  var el = document.getElementById('trk-share-' + share.id);
  if (el) el.textContent = text;
}
function requestWake() {
  try {
    if (navigator.wakeLock && share) {
      navigator.wakeLock.request('screen').then(function (w) { if (share) share.wake = w; else w.release(); }).catch(function () {});
    }
  } catch (e) {}
}
function updateShareBadge() {
  var el = document.getElementById('shareBadge');
  if (!share) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('a');
    el.id = 'shareBadge'; el.href = '#/orders';
    el.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:9000;background:#3a35c8;color:#fff;padding:.5rem .9rem;border-radius:999px;font-weight:700;font-size:.85rem;box-shadow:0 6px 20px rgba(0,0,0,.3);text-decoration:none';
    el.textContent = '📍 Sharing delivery location · tap to manage';
    document.body.appendChild(el);
  }
}
function stopSharing() {
  if (!share) return;
  try { if (share.watch != null) navigator.geolocation.clearWatch(share.watch); } catch (e) {}
  try { if (share.wake) share.wake.release(); } catch (e) {}
  share = null;
  updateShareBadge();
}
function startSharing(id) {
  if (!navigator.geolocation) { toast('This browser cannot share location.', 'bad'); return false; }
  var secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!secure) { toast('Location sharing needs a secure (https) address.', 'bad'); return false; }
  stopSharing();
  var s = share = { id: id, watch: null, wake: null, last: null, lastAt: 0, fails: 0, stat: 'Looking for a GPS signal…' };
  s.watch = navigator.geolocation.watchPosition(function (pos) { onGpsFix(s, pos); }, function (err) { onGpsError(s, err); },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  requestWake();
  updateShareBadge();
  return true;
}
function onGpsFix(s, pos) {
  if (share !== s) return;
  var c = pos.coords, acc = c.accuracy || 9999, now = Date.now();
  if (acc > 150) { shareStat('Weak GPS (±' + Math.round(acc) + ' m). Move to an open area. Not sent yet.'); return; }
  var movedM = s.last ? kmBetween(s.last.lat, s.last.lng, c.latitude, c.longitude) * 1000 : 99999;
  if (now - s.lastAt < 4000) return;
  if (movedM < 5 && now - s.lastAt < 15000) return;
  s.lastAt = now; s.last = { lat: c.latitude, lng: c.longitude };
  D.sendPosition(s.id, {
    lat: c.latitude, lng: c.longitude, accuracy: acc,
    heading: (typeof c.heading === 'number' && isFinite(c.heading)) ? c.heading : null,
    speed: (typeof c.speed === 'number' && isFinite(c.speed)) ? c.speed : null
  }).then(function () {
    if (share !== s) return;
    s.fails = 0;
    shareStat('Sharing live location ✓ · ±' + Math.round(acc) + ' m · sent ' + new Date().toLocaleTimeString());
  }).catch(function (e) {
    if (share !== s) return;
    var msg = D.niceError(e);
    s.fails++;
    if (/not allowed|not out for delivery|already marked|jwt|not authenticated|log in/i.test(msg) || s.fails >= 8) {
      stopSharing(); toast('Stopped sharing: ' + msg, 'bad'); paintOrders();
    } else {
      shareStat('Could not send (' + msg + '). Retrying…');
    }
  });
}
function onGpsError(s, err) {
  if (share !== s) return;
  if (err && err.code === 1) {
    stopSharing(); paintOrders();
    toast('Location is blocked. Allow location for this site in your browser settings, then tap Share my location.', 'bad');
  } else {
    shareStat('GPS signal lost. Waiting for it to come back…');
  }
}
document.addEventListener('visibilitychange', function () { if (!document.hidden && share) requestWake(); });
window.addEventListener('beforeunload', function (e) { if (share) { e.preventDefault(); e.returnValue = ''; } });

/* ---- buttons ---- */
function startDeliveryFor(id) {
  var checked = document.querySelector('input[name="trkm-' + id + '"]:checked');
  var mode = checked ? checked.value : 'self';
  var val = function (k) { var el = document.getElementById('trk-' + k + '-' + id); return el ? el.value.trim() : ''; };
  var o = { mode: mode, courierName: val('cn'), courierLink: val('cl'), trackingNo: val('tn') };
  if (mode === 'courier') {
    if (!o.courierName) { toast('Enter the courier name.', 'bad'); return; }
    if (!o.courierLink && !o.trackingNo) { toast('Paste the tracking link or number.', 'bad'); return; }
    if (o.courierLink && !safeLink(o.courierLink)) { toast('The tracking link must start with http:// or https://', 'bad'); return; }
  }
  D.startDelivery(id, o).then(function () {
    if (mode === 'self') {
      toast('Delivery started. Allow location when your phone asks.', 'ok');
      startSharing(id);
    } else {
      toast('Delivery started. The buyer can now open your courier link.', 'ok');
    }
    return refreshOrders();
  }).catch(function (e) { toast(D.niceError(e), 'bad'); });
}
document.addEventListener('change', function (e) {
  var r = e.target && e.target.closest ? e.target.closest('[data-trk-mode]') : null;
  if (!r) return;
  var box = document.getElementById('trk-cf-' + r.getAttribute('data-trk-mode'));
  if (box) box.hidden = r.value !== 'courier';
});
document.addEventListener('click', function (e) {
  var b;
  if ((b = e.target.closest('[data-trk-start]'))) { startDeliveryFor(b.getAttribute('data-trk-start')); }
  else if ((b = e.target.closest('[data-trk-share]'))) { if (startSharing(b.getAttribute('data-trk-share'))) paintOrders(); }
  else if ((b = e.target.closest('[data-trk-stop]'))) { stopSharing(); paintOrders(); toast('Stopped sharing your location.'); }
  else if ((b = e.target.closest('[data-trk-done]'))) {
    var id = b.getAttribute('data-trk-done');
    if (!window.confirm('Mark this order as delivered? The buyer will see it right away and your location will stop being shared.')) return;
    if (share && share.id === id) stopSharing();
    D.markDelivered(id).then(function () { toast('Marked as delivered.', 'ok'); return refreshOrders(); })
      .catch(function (err) { toast(D.niceError(err), 'bad'); refreshOrders(); });
  }
});
