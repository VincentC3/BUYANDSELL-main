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
  var reopen = (typeof trackCloseAll === 'function') ? trackCloseAll() : [];   // keep open tracking maps open after a redraw
  var box = $('#plist'); if (!box) return;
  if (state.purchases.length === 0) {
    box.innerHTML = '<div class="empty"><b>No purchases yet</b>Press BUY ITEM on something in the <a href="#/market">Market</a> and it will show up here.</div>';
    return;
  }
  var html = '';
  state.purchases.forEach(function (p) { html += purchaseRowHtml(p); });
  box.innerHTML = html;
  reopen.forEach(function (id) { trackOpen(id); });
}

/* --------------------------------------------------------- [PURCHASES-ROW] */

function purchaseRowHtml(p) {
  var it = p.item;
  var status = p.status || 'pending';

  var statusLabel = {
    pending: '<span style="background:#fff3cd;color:#856404;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:bold;">PENDING APPROVAL</span>',
    accepted: '<span style="background:#d1e7dd;color:#0f5132;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:bold;">ACCEPTED</span>',
    rejected: '<span style="background:#f8d7da;color:#842029;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:bold;">REJECTED</span>',
    completed: '<span style="background:#d1e7dd;color:#0f5132;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:bold;">COMPLETED</span>',
    cancelled: '<span style="background:#e2e3e5;color:#41464b;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:bold;">CANCELLED</span>'
  };

  var mine = state.myRatings[it.id] || 0;
  var canRate = status === 'completed';
  var canContact = status === 'accepted' || status === 'completed';

  var stars = '';
  if (canRate) {
    for (var n = 1; n <= 5; n++) {
      stars += '<button type="button" data-star="' + n +
        '" data-item="' + esc(it.id) + '" class="' +
        (n <= mine ? 'on' : '') + '">' + '★</button>';
    }
  }

  var message = '';
  if (status === 'pending') {
    message = '<p class="hint">Your request has been sent. Please wait for the seller to accept your transaction.</p>';
  } else if (status === 'accepted') {
    message = '<p class="hint">The seller accepted your request! You can now contact the seller to arrange delivery or meet-up.</p>';
  } else if (status === 'rejected') {
    message = '<p class="hint">Sorry, the seller rejected this transaction request.</p>';
  } else if (status === 'completed') {
    message = '<p class="hint">Your transaction is completed. You can now rate this item.</p>';
  }

  return '<div class="prow" data-row="' + esc(it.id) + '">' +
    '<img src="' + esc(imgOf(it)) + '" alt="">' +
    '<div class="prow-main">' +

      '<div class="prow-top">' +
        '<b>' + esc(it.title) + '</b>' +
        (statusLabel[status] || statusLabel.pending) +
      '</div>' +

      '<div class="hint">' +
        esc(priceText(it.price)) + ' · from ' +
        esc(it.seller_name || 'Seller') +
      '</div>' +

      '<div class="hint">' +
        (p.method === 'delivery'
          ? ic('bag') + ' Delivery to: ' + esc(p.address || '')
          : ic('pin') + ' Meet up') +
      '</div>' +

      message +

      (canRate
        ? '<div class="prow-rate"><strong>' +
          (mine ? 'Your rating' : 'Rate this item') +
          '</strong><div class="stars">' + stars + '</div>' +
          (mine
            ? '<button class="btn btn-ghost btn-sm" type="button" data-unrate="' + esc(it.id) + '">Clear rating</button>'
            : '') +
          '</div>'
        : '') +

      trackSlotHtml(p, status) +

      '<div class="contact-slot" id="contact-' + esc(it.id) + '"></div>' +

    '</div>' +

    '<div class="prow-btns">' +

      (canContact
        ? '<button class="btn btn-soft btn-sm" type="button" data-contact="' +
          esc(it.id) + '">' + ic('phone') + ' Seller contact</button>'
        : '') +

      '<button class="btn btn-ghost btn-sm" type="button" data-open="' +
        esc(it.id) + '">View</button>' +

      '<button class="btn btn-ghost btn-sm" type="button" data-unbuy="' +
        esc(it.id) + '">' + ic('trash') + (status === 'pending' ? ' Cancel request' : ' Remove') + '</button>' +

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
  if (!window.confirm('Remove this from My Purchases? (A pending request will be cancelled and any rating removed.)')) return;
  D.removePurchase(itemId).then(function () { return Promise.all([loadMyBuying(), refreshStats()]); })
    .then(function () { toast('Removed from My Purchases.', 'ok'); paintPurchases(); })
    .catch(function (e) { toast(D.niceError(e), 'bad'); });
}

/* ================================================================ [PURCHASES-TRACKING]
   Buyer delivery tracking (live map for "seller delivers", courier link for "courier").
   - Live points arrive by Supabase Realtime, with a 10 s refresh as a safety net.
   - Distance / arrival time use free OpenStreetMap road routing (OSRM). It has no live
     traffic, so the time is an estimate. If routing is down, a straight-line estimate is used. */
var buyerTracks = {};   // { purchaseId: controller }

function trackSlotHtml(p, status) {
  if (p.method !== 'delivery' || !p.purchaseId) return '';
  if (status !== 'accepted' && status !== 'completed') return '';
  var id = esc(p.purchaseId);
  return '<div id="trk-' + id + '"><button class="btn btn-soft btn-sm" type="button" data-trk-open="' + id + '" style="margin-top:.5rem">' +
    ic('map') + ' Track delivery</button></div>';
}
function tById(id) { return document.getElementById(id); }
function trkIcon(emoji, bg) {
  return L.divIcon({ className: 'trk-ico', iconSize: [34, 34], iconAnchor: [17, 17],
    html: '<div style="width:34px;height:34px;border-radius:50%;background:' + bg + ';border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:18px">' + emoji + '</div>' });
}

function trackCloseAll() {
  var ids = Object.keys(buyerTracks);
  ids.forEach(function (id) { trackClose(id, true); });
  return ids;
}
function trackClose(id, keepDom) {
  var ctl = buyerTracks[id];
  if (ctl) {
    clearInterval(ctl.timer);
    try { if (ctl.unsub) ctl.unsub(); } catch (e) {}
    try { if (ctl.map) ctl.map.remove(); } catch (e) {}
    delete buyerTracks[id];
  }
  if (!keepDom) {
    var slot = tById('trk-' + id);
    if (slot) slot.innerHTML = '<button class="btn btn-soft btn-sm" type="button" data-trk-open="' + esc(id) + '" style="margin-top:.5rem">' + ic('map') + ' Track delivery</button>';
  }
}

function trackOpen(id) {
  var slot = tById('trk-' + id); if (!slot) return;
  trackClose(id, true);
  slot.innerHTML =
    '<div style="margin-top:.6rem;padding:.75rem;border:1px solid #d9d7f5;border-radius:12px;background:#f7f6ff">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem"><b>' + ic('bag') + ' Delivery tracking</b>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-trk-close="' + esc(id) + '">Hide</button></div>' +
      '<div id="trk-steps-' + id + '"></div>' +
      '<div id="trk-info-' + id + '" class="hint">Loading…</div>' +
      '<div id="trk-wrap-' + id + '"><div id="trk-map-' + id + '" style="height:280px;border-radius:12px;margin:.5rem 0;position:relative;z-index:0"></div></div>' +
      '<div id="trk-act-' + id + '"></div>' +
    '</div>';
  var ctl = { id: id, row: null, map: null, rider: null, circle: null, dest: null, pend: null, pendLL: null,
              route: null, routeLine: null, routeAt: 0, routeFrom: null, routeDest: null, routeBusy: false,
              fitRider: false, fitDest: false, pinning: false, timer: null, unsub: null, n: 0, lastInfo: '', lastAct: '' };
  buyerTracks[id] = ctl;
  if (HAS_MAP) {
    try {
      ctl.map = makeMap('trk-map-' + id, [state.location.lat, state.location.lng], 15);
      ctl.map.on('click', function (ev) { trackMapClick(ctl, ev.latlng); });
    } catch (e) { ctl.map = null; }
  }
  D.getTracking(id).then(function (r) {
    if (buyerTracks[id] !== ctl) return;
    ctl.row = r; trackRender(ctl);
  }).catch(function (e) {
    if (buyerTracks[id] !== ctl) return;
    var el = tById('trk-info-' + id); if (el) el.textContent = 'Could not load tracking: ' + D.niceError(e);
  });
  ctl.unsub = D.watchTracking(id, function (r) { if (buyerTracks[id] === ctl) { ctl.row = r; trackRender(ctl); } });
  ctl.timer = setInterval(function () { trackTick(ctl); }, 1000);
  setTimeout(function () { try { if (ctl.map) ctl.map.invalidateSize(); } catch (e) {} }, 200);
}

function trackTick(ctl) {
  if (buyerTracks[ctl.id] !== ctl) return;
  if (!tById('trk-map-' + ctl.id)) { trackClose(ctl.id, true); return; }   // page was redrawn / left
  ctl.n++;
  if (ctl.n % 10 === 0) {
    D.getTracking(ctl.id).then(function (r) {
      if (buyerTracks[ctl.id] !== ctl || !r) return;
      if (!ctl.row || r.updated_at !== ctl.row.updated_at) { ctl.row = r; trackRender(ctl); }
    }).catch(function () {});
  } else {
    trackInfo(ctl);
  }
}

function trackRender(ctl) {
  var r = ctl.row, id = ctl.id;
  var started = !!(r && r.mode);
  var st = started ? r.status : 'preparing';
  var stepsEl = tById('trk-steps-' + id); if (stepsEl) stepsEl.innerHTML = trackStepsHtml(st);
  var wrap = tById('trk-wrap-' + id);
  var showMap = !(r && r.mode === 'courier');
  if (wrap) {
    var was = wrap.style.display;
    wrap.style.display = showMap ? '' : 'none';
    if (showMap && was === 'none' && ctl.map) setTimeout(function () { try { ctl.map.invalidateSize(); } catch (e) {} }, 50);
  }
  trackDraw(ctl);
  trackRoute(ctl);
  trackInfo(ctl);
  trackActions(ctl);
}

function trackDraw(ctl) {
  var r = ctl.row, map = ctl.map; if (!map) return;
  var rider = (r && r.mode === 'self' && r.status === 'out_for_delivery' && r.lat != null && r.lng != null) ? [r.lat, r.lng] : null;
  var dest = (r && r.dest_lat != null && r.dest_lng != null) ? [r.dest_lat, r.dest_lng] : null;

  if (dest) {
    if (ctl.dest) ctl.dest.setLatLng(dest); else ctl.dest = L.marker(dest, { icon: trkIcon('🏠', '#3a35c8') }).addTo(map);
  } else if (ctl.dest) { map.removeLayer(ctl.dest); ctl.dest = null; }

  if (rider) {
    if (ctl.rider) ctl.rider.setLatLng(rider); else ctl.rider = L.marker(rider, { icon: trkIcon('🛵', '#ff7a3d'), zIndexOffset: 500 }).addTo(map);
    var acc = r.accuracy || 0;
    if (acc > 0) {
      if (ctl.circle) { ctl.circle.setLatLng(rider); ctl.circle.setRadius(acc); }
      else ctl.circle = L.circle(rider, { radius: acc, color: '#ff7a3d', weight: 1, fillOpacity: .12 }).addTo(map);
    } else if (ctl.circle) { map.removeLayer(ctl.circle); ctl.circle = null; }
  } else {
    if (ctl.rider) { map.removeLayer(ctl.rider); ctl.rider = null; }
    if (ctl.circle) { map.removeLayer(ctl.circle); ctl.circle = null; }
  }
  if (!(r && r.status === 'out_for_delivery') && ctl.routeLine) { map.removeLayer(ctl.routeLine); ctl.routeLine = null; ctl.route = null; }

  try {
    if (rider && !ctl.fitRider) {
      ctl.fitRider = true;
      map.fitBounds(dest ? [rider, dest] : [rider, rider], { padding: [40, 40], maxZoom: 17 });
    } else if (rider && !map.getBounds().contains(rider)) {
      map.fitBounds(dest ? [rider, dest] : [rider, rider], { padding: [40, 40], maxZoom: 17 });
    } else if (!rider && dest && !ctl.fitDest) {
      ctl.fitDest = true; map.setView(dest, 16);
    }
  } catch (e) {}
}

function trackRoute(ctl) {
  var r = ctl.row;
  if (!r || r.mode !== 'self' || r.status !== 'out_for_delivery' || r.lat == null || r.dest_lat == null) return;
  if (ctl.routeBusy) return;
  var now = Date.now();
  var destChanged = !!ctl.routeDest && (ctl.routeDest.lat !== r.dest_lat || ctl.routeDest.lng !== r.dest_lng);
  var movedFar = !ctl.routeFrom || kmBetween(ctl.routeFrom.lat, ctl.routeFrom.lng, r.lat, r.lng) * 1000 > 150;
  if (!destChanged) {
    if (now - ctl.routeAt < 30000) return;
    if (ctl.route && !movedFar) return;
  }
  ctl.routeBusy = true;
  var url = 'https://router.project-osrm.org/route/v1/driving/' + r.lng + ',' + r.lat + ';' + r.dest_lng + ',' + r.dest_lat +
            '?overview=full&geometries=geojson';
  var ac = window.AbortController ? new AbortController() : null;
  var to = setTimeout(function () { if (ac) ac.abort(); }, 8000);
  fetch(url, ac ? { signal: ac.signal } : {}).then(function (res) { return res.json(); }).then(function (j) {
    clearTimeout(to); ctl.routeBusy = false; ctl.routeAt = Date.now();
    if (buyerTracks[ctl.id] !== ctl) return;
    var rt = j && j.routes && j.routes[0];
    if (!rt) return;
    ctl.route = { dist: rt.distance, dur: rt.duration, straight: kmBetween(r.lat, r.lng, r.dest_lat, r.dest_lng) };
    ctl.routeFrom = { lat: r.lat, lng: r.lng }; ctl.routeDest = { lat: r.dest_lat, lng: r.dest_lng };
    if (ctl.map) {
      var pts = rt.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
      if (ctl.routeLine) ctl.routeLine.setLatLngs(pts);
      else ctl.routeLine = L.polyline(pts, { color: '#3a35c8', weight: 4, opacity: .6 }).addTo(ctl.map);
    }
    trackInfo(ctl);
  }).catch(function () { clearTimeout(to); ctl.routeBusy = false; ctl.routeAt = Date.now(); });
}

function trackInfo(ctl) {
  var r = ctl.row, el = tById('trk-info-' + ctl.id); if (!el) return;
  var html = '';
  if (!r || !r.mode) {
    html = 'The seller is preparing your order. Live tracking starts when the seller starts the delivery.';
  } else if (r.status === 'delivered') {
    html = '<b>Delivered ✓</b> ' + esc(timeAgo(r.delivered_at)) + '. Please check your item.';
  } else if (r.mode === 'courier') {
    var lk = safeLink(r.courier_link);
    html = '<div><b>' + esc(r.courier_name || 'A courier') + '</b> is delivering your order.</div>' +
      (r.tracking_no ? '<div class="hint">Tracking / booking no.: <b>' + esc(r.tracking_no) + '</b> ' +
        '<button class="btn btn-ghost btn-sm" type="button" data-trk-copy="' + esc(r.tracking_no) + '">Copy</button></div>' : '') +
      (lk ? '<div style="margin:.4rem 0"><a class="btn btn-primary btn-sm" href="' + esc(lk) + '" target="_blank" rel="noopener noreferrer">Track with courier</a></div>' : '') +
      '<div class="hint">The live location is shown on the courier’s own tracking page.</div>';
  } else if (r.lat == null) {
    html = 'Out for delivery. Waiting for the seller’s first GPS update…';
  } else {
    var age = secsSince(r.position_at);
    var hasDest = r.dest_lat != null && r.dest_lng != null;
    var line = '';
    if (hasDest) {
      var straight = kmBetween(r.lat, r.lng, r.dest_lat, r.dest_lng);
      if (straight * 1000 < 40) {
        line = '<b>The seller is at your pin.</b>';
      } else {
        var dist, eta;
        if (ctl.route && ctl.route.straight > 0.01) {
          var ratio = Math.min(1, straight / ctl.route.straight);
          dist = fmtDist(Math.max(straight, ctl.route.dist / 1000 * ratio)) + ' by road';
          eta = fmtEta(ctl.route.dur * ratio);
        } else {
          dist = fmtDist(straight) + ' straight-line';
          var v = (r.speed && r.speed > 1.5) ? r.speed : 5.5;                 // m/s, falls back to ~20 km/h
          eta = fmtEta(straight * 1.3 * 1000 / v);
        }
        line = '<b>' + esc(dist) + '</b> left · arriving in about <b>' + esc(eta) + '</b>';
      }
    } else {
      line = 'Drop your delivery pin on the map to see the distance and arrival time.';
    }
    var stale = '';
    if (age != null && age > 60) {
      stale = '<div style="margin-top:.3rem;padding:.4rem .6rem;border-radius:8px;background:#fff3cd;color:#664d03">No new location for ' +
        esc(agoShort(age).replace(' ago', '')) + '. The seller’s phone may have lost signal or the page was closed.</div>';
    }
    html = '<div>' + line + '</div><div class="hint">Updated ' + esc(agoShort(age)) +
      (r.accuracy ? ' · GPS accuracy ±' + Math.round(r.accuracy) + ' m' : '') + '</div>' + stale;
  }
  if (html === ctl.lastInfo) return;
  ctl.lastInfo = html; el.innerHTML = html;
}

function trackActions(ctl) {
  var r = ctl.row, el = tById('trk-act-' + ctl.id); if (!el) return;
  var html = '';
  var locked = r && (r.status === 'delivered' || r.mode === 'courier');
  if (!locked && ctl.map) {
    var id = esc(ctl.id), hasDest = r && r.dest_lat != null;
    if (ctl.pendLL) {
      html = '<div class="hint">Drag the pin to the exact spot, then save it.</div>' +
        '<button class="btn btn-primary btn-sm" type="button" data-trk-save="' + id + '">Save delivery pin</button> ' +
        '<button class="btn btn-ghost btn-sm" type="button" data-trk-cancel="' + id + '">Cancel</button>';
    } else if (hasDest) {
      html = '<button class="btn btn-ghost btn-sm" type="button" data-trk-move="' + id + '">Move my pin</button> ' +
        '<button class="btn btn-ghost btn-sm" type="button" data-trk-center="' + id + '">Recenter map</button>';
    } else {
      html = '<div class="hint">Tap the map where the seller should deliver, or use your current location.</div>' +
        '<button class="btn btn-soft btn-sm" type="button" data-trk-here="' + id + '">' + ic('target') + ' Use my current location</button>';
    }
  }
  if (html === ctl.lastAct) return;
  ctl.lastAct = html; el.innerHTML = html;
}

function trackMapClick(ctl, ll) {
  var r = ctl.row;
  if (r && (r.status === 'delivered' || r.mode === 'courier')) return;
  if (r && r.dest_lat != null && !ctl.pinning) return;
  trackSetPending(ctl, ll);
}
function trackSetPending(ctl, ll) {
  ctl.pendLL = ll;
  if (ctl.map) {
    if (ctl.pend) ctl.pend.setLatLng(ll);
    else {
      ctl.pend = L.marker(ll, { draggable: true, icon: trkIcon('📍', '#2a9d5c') }).addTo(ctl.map);
      ctl.pend.on('dragend', function () { ctl.pendLL = ctl.pend.getLatLng(); });
    }
  }
  trackActions(ctl);
}
function trackClearPending(ctl) {
  ctl.pendLL = null; ctl.pinning = false;
  if (ctl.pend && ctl.map) { ctl.map.removeLayer(ctl.pend); }
  ctl.pend = null;
}

document.addEventListener('click', function (e) {
  var b, id, ctl;
  if ((b = e.target.closest('[data-trk-open]'))) { trackOpen(b.getAttribute('data-trk-open')); return; }
  if ((b = e.target.closest('[data-trk-close]'))) { trackClose(b.getAttribute('data-trk-close')); return; }
  if ((b = e.target.closest('[data-trk-copy]'))) {
    var txt = b.getAttribute('data-trk-copy');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast('Copied.', 'ok'); }, function () { window.prompt('Copy this number:', txt); });
    else window.prompt('Copy this number:', txt);
    return;
  }
  if ((b = e.target.closest('[data-trk-move]')))   { ctl = buyerTracks[b.getAttribute('data-trk-move')]; if (ctl) { ctl.pinning = true; toast('Tap the map to place your new pin.'); } return; }
  if ((b = e.target.closest('[data-trk-cancel]'))) { ctl = buyerTracks[b.getAttribute('data-trk-cancel')]; if (ctl) { trackClearPending(ctl); trackActions(ctl); } return; }
  if ((b = e.target.closest('[data-trk-center]'))) {
    ctl = buyerTracks[b.getAttribute('data-trk-center')];
    if (ctl && ctl.map) {
      var pts = [];
      if (ctl.rider) pts.push(ctl.rider.getLatLng());
      if (ctl.dest) pts.push(ctl.dest.getLatLng());
      if (pts.length) ctl.map.fitBounds(pts.length === 1 ? [pts[0], pts[0]] : pts, { padding: [40, 40], maxZoom: 17 });
    }
    return;
  }
  if ((b = e.target.closest('[data-trk-here]'))) {
    ctl = buyerTracks[b.getAttribute('data-trk-here')];
    if (!ctl) return;
    if (!navigator.geolocation) { toast('This browser cannot find your location. Tap the map instead.', 'bad'); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      if (buyerTracks[ctl.id] !== ctl) return;
      var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      trackSetPending(ctl, ll);
      if (ctl.map) ctl.map.setView(ll, 17);
      if (pos.coords.accuracy > 100) toast('Your location is rough (±' + Math.round(pos.coords.accuracy) + ' m). Drag the pin to the exact spot.');
    }, function () { toast('Could not get your location. Tap the map instead.', 'bad'); },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    return;
  }
  if ((b = e.target.closest('[data-trk-save]'))) {
    id = b.getAttribute('data-trk-save'); ctl = buyerTracks[id];
    if (!ctl || !ctl.pendLL) return;
    var ll = ctl.pendLL;
    D.setDeliveryPin(id, ll.lat, ll.lng).then(function (row) {
      if (buyerTracks[id] !== ctl) return;
      trackClearPending(ctl);
      ctl.row = row; ctl.fitDest = false; ctl.routeAt = 0;
      toast('Delivery pin saved.', 'ok');
      trackRender(ctl);
    }).catch(function (err) { toast(D.niceError(err), 'bad'); });
  }
});
