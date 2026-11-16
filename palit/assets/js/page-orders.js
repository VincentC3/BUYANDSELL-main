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
  return Promise.all([D.sellerOrders(), D.myItems()]).then(function (res) {
    sellerOrderList = res[0];
    sellerOrderItems = {};
    res[1].forEach(function (it) { sellerOrderItems[it.id] = it; });
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
