/* =====================================================================
   FILE: page-ratings.js  —  RATINGS PAGE  (#/ratings)
   ---------------------------------------------------------------------
   Top selling / best rated items. Ratings are GIVEN on the My Purchases page.
   [RATINGS-SCREEN]  top-3 podium + full ranking list
   ===================================================================== */
function showRatings() {
  state.page = 'ratings';
  destroyMap('main');
  updateChrome();

  /* 1) build the ranked list */
  var list = state.items.map(function (i) { return { it: i, st: statOf(i.id) }; });
  if (state.rankBy === 'sold') {
    list = list.filter(function (x) { return x.st.buys > 0; });
    list.sort(function (a, b) { return b.st.buys - a.st.buys || b.st.avg - a.st.avg; });
  } else {
    list = list.filter(function (x) { return x.st.count > 0; });
    list.sort(function (a, b) { return b.st.avg - a.st.avg || b.st.count - a.st.count; });
  }
  var top = list.slice(0, 3), rest = list.slice(3);
  var order = top.length === 3 ? [1, 0, 2] : top.map(function (_x, i) { return i; });
  var biggest = 1;
  list.forEach(function (x) { biggest = Math.max(biggest, state.rankBy === 'sold' ? x.st.buys : x.st.avg); });

  /* 2) podium */
  var podium = '';
  order.forEach(function (i) {
    var x = top[i];
    podium += '<button type="button" class="pod p' + (i + 1) + '" data-open="' + esc(x.it.id) + '">' +
      '<span class="medal">' + (i + 1) + '</span>' +
      '<div class="ph"><img src="' + esc(imgOf(x.it)) + '" alt=""></div>' +
      '<div class="t">' + esc(x.it.title) + '</div>' +
      '<div class="price">' + esc(priceText(x.it.price)) + '</div>' +
      '<div class="sold">' + ic('fire') + ' ' + x.st.buys + ' sold</div>' +
      '<div>' + starsHtml(x.st.avg) + ' <small class="hint">' + (x.st.count ? Number(x.st.avg).toFixed(1) + ' (' + x.st.count + ')' : 'no ratings') + '</small></div></button>';
  });

  /* 3) rest of the ranking */
  var rows = '';
  rest.forEach(function (x, i) {
    var value = state.rankBy === 'sold' ? x.st.buys : x.st.avg;
    rows += '<button type="button" class="rank-row" data-open="' + esc(x.it.id) + '">' +
      '<span class="n">' + (i + 4) + '</span>' +
      '<span class="ph"><img loading="lazy" src="' + esc(imgOf(x.it)) + '" alt=""></span>' +
      '<span style="min-width:0"><span class="t" style="display:block">' + esc(x.it.title) + '</span>' +
        '<span class="m"><span>' + esc(priceText(x.it.price)) + '</span><span>' + esc(x.it.location_label || '') + '</span></span>' +
        '<span class="bar" style="display:block"><i style="width:' + Math.max(6, Math.round(value / biggest * 100)) + '%"></i></span></span>' +
      '<span class="right"><strong>' + x.st.buys + ' sold</strong><br>' + starsHtml(x.st.avg) + '</span></button>';
  });

  var body;
  if (!state.loaded) body = '<div class="empty"><b>Loading…</b></div>';
  else if (list.length === 0) body = '<div class="empty"><b>No ratings yet</b>Items appear here once buyers buy and rate them.</div>';
  else body = '<div class="podium" style="grid-template-columns:repeat(' + top.length + ',1fr)">' + podium + '</div>' +
    (rest.length ? '<h3 class="sec-title" style="margin-bottom:.6rem">Full ranking</h3>' : '') + '<div class="rank">' + rows + '</div>';

  $('#view').innerHTML =
    '<div class="page-head"><div class="grow"><h1>Ratings</h1><p>The top selling items, ranked by buyers.</p></div>' +
      '<div class="seg" style="display:inline-flex">' +
        '<button type="button" data-rank="sold" class="' + (state.rankBy === 'sold' ? 'on' : '') + '">' + ic('fire') + ' Most sold</button>' +
        '<button type="button" data-rank="rated" class="' + (state.rankBy === 'rated' ? 'on' : '') + '">' + ic('star') + ' Best rated</button>' +
      '</div></div>' + body;

  $$('[data-rank]').forEach(function (b) {
    b.addEventListener('click', function () { state.rankBy = b.getAttribute('data-rank'); showRatings(); });
  });
}
