/* =====================================================================
   FILE: page-market.js  —  MARKET PAGE  (#/market)
   ---------------------------------------------------------------------
   [MARKET-SCREEN]   the page layout (search box, sort, category chips, grid + map)
   [MARKET-FILTER]   which items are shown + how they are sorted
   [MARKET-CARD]     ONE item card in the grid  <- change the card look here
   [MARKET-PAINT]    puts the cards on screen
   [MARKET-MARKERS]  price pins on the map
   [MARKET-LOCATION] "Use my location" button
   Items you already BOUGHT are hidden here: they live in My Purchases.
   ===================================================================== */

/* ------------------------------------------------------------ [MARKET-SCREEN] */
function showMarket() {
  S.view = 'market';
  destroyMap('main'); maps.mainLayer = null; maps.mainMe = null;
  updateChrome();

  var catButtons = '';
  var allIds = ['all'];
  CATS.forEach(function (c) { allIds.push(c.id); });
  allIds.forEach(function (id) {
    var text = id === 'all' ? '✨ All' : catEmoji(id) + ' ' + catLabel(id);
    catButtons += '<button type="button" data-cat="' + esc(id) + '" class="' + (S.category === id ? 'on' : '') + '">' + esc(text) + '</button>';
  });

  $('#view').innerHTML =
    '<div class="page-head">' +
      '<div class="grow"><h1>Market</h1><p id="mCount">&nbsp;</p></div>' +
      '<span class="chip" id="locChip"></span>' +
    '</div>' +
    '<div class="tools">' +
      '<div class="searchbox">' + ic('search') + '<input class="input" id="q" type="search" placeholder="Search items, places…" value="' + esc(S.q) + '" autocomplete="off"></div>' +
      '<select class="select" id="sort">' +
        '<option value="new">Newest first</option><option value="near">Nearest first</option>' +
        '<option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="top">Top selling</option>' +
      '</select>' +
      '<div class="seg" role="group">' +
        '<button type="button" data-pane="grid" class="' + (S.pane === 'grid' ? 'on' : '') + '">' + ic('grid') + ' Items</button>' +
        '<button type="button" data-pane="map" class="' + (S.panee === 'map' ? 'on' : '') + '">' + ic('map') + ' Map</button>' +
      '</div>' +
    '</div>' +
    '<div class="cats" id="cats">' + catButtons + '</div>' +
    '<div class="market" id="market" data-pane="' + S.pane + '">' +
      '<div class="grid" id="grid"></div>' +
      '<aside class="mapcol"><div class="mapbox" id="mapbox">' +
        '<div id="mainMap" style="height:100%"></div>' +
        '<div class="map-tools"><button type="button" class="btn btn-primary btn-sm" id="locBtn">' + ic('target') + ' Use my location</button></div>' +
      '</div></aside>' +
    '</div>';

  $('#sort').value = S.sort;

  /* typing in the search box */
  $('#q').addEventListener('input', function (e) { S.q = e.target.value; paintMarket(true); });
  /* changing the sort */
  $('#sort').addEventListener('change', function (e) { S.sort = e.target.value; paintMarket(false); });
  /* clicking a category chip */
  $('#cats').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]'); if (!b) return;
    S.category = b.getAttribute('data-cat');
    $$('#cats [data-cat]').forEach(function (x) { x.classList.toggle('on', x === b); });
    paintMarket(true);
  });
  $('#locBtn').addEventListener('click', function () { askLocation(true); });
  /* Items / Map switch (phone) */
  $$('.seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      S.pane = b.getAttribute('data-pane');
      $('#market').setAttribute('data-pane', S.pane);
      $$('.seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
      if (maps.main) setTimeout(function () { maps.main.invalidateSize(); }, 50);
    });
  });

  if (HAS_MAP) {
    maps.main = makeMap('mainMap', [S.location.lat, S.location.lng], 11);
    maps.mainLayer = L.layerGroup().addTo(maps.main);
  } else {
    $('#mainMap').innerHTML = mapFallback('The map library could not load. Check your internet connection.');
  }
  paintMarket(true);
  if (!S.location.known && !showMarket.asked) { showMarket.asked = true; askLocation(false); }
}

/* ------------------------------------------------------------ [MARKET-FILTER] */
function getFilteredItems() {
  var q = S.q.trim().toLowerCase();
  var list = S.items.filter(function (i) {
    if (S.boughtIds[i.id]) return false;                       // already bought -> hidden
    if (S.category !== 'all' && catOf(i) !==S.category) return false;
    if (!q) return true;
    var text = i.title + ' ' + (i.description || '') + ' ' + (i.location_label || '') + ' ' + (i.seller_name || '');
    return text.toLowerCase().indexOf(q) >= 0;
  });
  if (S.sort === 'new')  list.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  if (S.sort === 'near') list.sort(function (a, b) { return distOf(a) - distOf(b); });
  if (S.sort === 'low')  list.sort(function (a, b) { return a.price - b.price; });
  if (S.sort === 'high') list.sort(function (a, b) { return b.price - a.price; });
  if (S.sort === 'top')  list.sort(function (a, b) { return statOf(b.id).buys - statOf(a.id).buys; });
  return list;
}

/* -------------------------------------------------------------- [MARKET-CARD] */
function makeCardHtml(it) {
  var st = statOf(it.id);
  var soldTag = st.buys ? '<span class="tag">' + ic('fire') + ' ' + st.buys + ' sold</span>' : '';
  return '<button class="card" type="button" data-open="' + esc(it.id) + '">' +
    '<div class="ph"><img loading="lazy" src="' + esc(imgOf(it)) + '" alt="">' + soldTag + '</div>' +
    '<div class="info">' +
      '<div class="price ' + (Number(it.price) === 0 ? 'free' : '') + '">' + esc(priceText(it.price)) + '</div>' +
      '<div class="t">' + esc(it.title) + '</div>' +
      '<div class="m">' + esc(it.location_label || 'Nearby') + ' · ' + esc(fmtDist(distOf(it))) + ' away</div>' +
    '</div></button>';
}

/* ------------------------------------------------------------- [MARKET-PAINT] */
function paintMarket(fitMap) {
  if (S.view !== 'market') return;
  var grid = $('#grid'); if (!grid) return;
  if (!S.loaded) { grid.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>'; return; }

  var list = getFilteredItems();
  var count = list.length + (list.length === 1 ? ' item' : ' items');
  $('#mCount').textContent = S.loadError ? S.loadError : count + (S.q ? ' matching “' + S.q + '”' : ' posted near you');

  $('#locChip').innerHTML = S.location.known ? ic('target') + ' Distances from your location' : ic('pin') + ' Distances from ' + esc(C.DEFAULT_CENTER.label);
  $('#locChip').className = 'chip ' + (S.location.known ? 'dist' : 'warm');

  if (list.length === 0) {
    grid.innerHTML = '<div class="empty"><b>Nothing here yet</b>Try another word or category, or <a href="#/sell">sell something</a>.</div>';
  } else {
    var html = '';
    list.forEach(function (it) { html += makeCardHtml(it); });
    grid.innerHTML = html;
  }
  paintMarkers(list, fitMap);
}

/* ----------------------------------------------------------- [MARKET-MARKERS] */
function paintMarkers(list, fitMap) {
  if (!HAS_MAP || !maps.main || !maps.mainLayer) return;
  maps.mainLayer.clearLayers();
  var points = [];
  list.forEach(function (it) {
    var hot = S.highlight === it.id;
    var marker = L.marker([it.lat, it.lng], { icon: pinIcon(priceText(it.price), hot ? 'hot' : ''), title: it.title, riseOnHover: true }).addTo(maps.mainLayer);
    marker.bindPopup('<div class="pop"><img src="' + esc(imgOf(it)) + '" alt=""><b>' + esc(it.title) + '</b><span>' + esc(priceText(it.price)) + ' · ' + esc(fmtDist(distOf(it))) + ' away</span><button type="button" class="btn btn-primary btn-sm" data-open="' + esc(it.id) + '">View details</button></div>');
    points.push([it.lat, it.lng]);
  });
  if (maps.mainMe) { maps.main.removeLayer(maps.mainMe); maps.mainMe = null; }
  if (S.location.known) {
    maps.mainMe = L.marker([S.location.lat, S.location.lng], { icon: pinIcon('You', 'me'), zIndexOffset: 1000, interactive: false }).addTo(maps.main);
    points.push([S.location.lat, S.location.lng]);
  }
  if (fitMap && points.length) { try { maps.main.fitBounds(points, { padding: [40, 40], maxZoom: 14 }); } catch (e) {} }
}

/* ----------------------------------------------------------- [MARKET-LOCATION] */
function askLocation(manual) {
  if (!navigator.geolocation) { if (manual) toast('Your browser cannot share location.', 'bad'); return; }
  navigator.geolocation.getCurrentPosition(function (p) {
    S.location = { lat: p.coords.latitude, lng: p.coords.longitude, known: true };
    try { localStorage.setItem('palit_loc', JSON.stringify(S.location)); } catch (e) {}
    if (S.view === 'market') paintMarket(true);
    if (manual) toast('Location updated — distances are now from you.', 'ok');
  }, function () {
    if (manual) toast('Location is blocked. Allow it in your browser settings to see real distances.', 'bad');
  }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 300000 });
}
