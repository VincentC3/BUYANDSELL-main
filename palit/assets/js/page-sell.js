/* =====================================================================
   FILE: page-sell.js  —  SELL ITEM (#/sell)  +  MY LISTINGS (#/my-listings)
   ---------------------------------------------------------------------
   SELLER CRUD:
     CREATE = Sell Item form          (this file, top half)
     READ   = My Listings page        (this file, bottom half)
     UPDATE = Edit pop-up in My Listings (edit details, price, status...)
     DELETE = Delete button in My Listings
   [SELL-DRAFT]     remembers what you typed while the page changes
   [SELL-PHOTOS]    photo resize + add + remove
   [SELL-CHECK]     which fields are still missing
   [SELL-SCREEN]    the form layout   <- add a new input here
   [SELL-MAP]       pin picker + area name lookup
   [SELL-UPLOAD]    the Upload button (CREATE)
   [LISTINGS-SCREEN]  the My Listings page
   [LISTINGS-ROW]     ONE listing card
   [EDIT-MODAL]       the Edit pop-up (UPDATE)
   [LISTINGS-DELETE]  delete (DELETE)
   ===================================================================== */

/* ------------------------------------------------------------- [SELL-DRAFT] */
var draft = emptyDraft();
function emptyDraft() {
  return { title: '', category: '', price: '', condition: 'used', quantity: 1, description: '', meetup: '',
           contact: '', gmail: '', label: '', labelTouched: false, lat: null, lng: null, photos: [] };
}
function resetDraft() {
  draft.photos.forEach(function (p) { URL.revokeObjectURL(p.url); });
  draft = emptyDraft();
}

/* ------------------------------------------------------------ [SELL-PHOTOS] */
function resizeImage(file, maxSize, quality) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var k = Math.min(1, maxSize / Math.max(img.width, img.height));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * k)); canvas.height = Math.max(1, Math.round(img.height * k));
      var g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height); g.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error('Could not process photo')); }, 'image/jpeg', quality);
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not read photo')); };
    img.src = url;
  });
}
function addPhotos(fileList) {
  var files = Array.prototype.slice.call(fileList || []).filter(function (f) { return /^image\//.test(f.type); });
  var room = C.MAX_PHOTOS - draft.photos.length;
  if (!files.length) { toast('Please choose image files.', 'bad'); return; }
  if (files.length > room) toast('You can add up to ' + C.MAX_PHOTOS + ' photos.', 'bad');
  var demo = D.mode === 'demo';
  Promise.all(files.slice(0, Math.max(0, room)).map(function (f) {
    return resizeImage(f, demo ? 720 : 1280, demo ? 0.7 : 0.82).then(function (blob) { return { blob: blob, url: URL.createObjectURL(blob) }; }).catch(function () { return null; });
  })).then(function (res) {
    var ok = res.filter(Boolean);
    if (ok.length < res.length) toast('Some photos could not be read.', 'bad');
    ok.forEach(function (p) { draft.photos.push(p); });
    if (state.page === 'sell') { paintThumbs(); syncSell(); }
  });
}
function paintThumbs() {
  var t = $('#thumbsUp'); if (!t) return;
  var html = '';
  draft.photos.forEach(function (p, i) {
    html += '<div class="t"><img src="' + esc(p.url) + '" alt="">' + (i === 0 ? '<span class="cover">Cover</span>' : '') + '<button type="button" data-rm="' + i + '" aria-label="Remove photo">×</button></div>';
  });
  t.innerHTML = html;
  $('#photoCount').textContent = draft.photos.length;
}

/* ------------------------------------------------------------- [SELL-CHECK]
   Returns an object listing every field that is still wrong/missing. */
function sellProblems() {
  var p = {};
  if (!draft.photos.length) p.photos = 'Add at least one photo';
  if (draft.title.trim().length < 3) p.title = 'Title (3+ letters)';
  if (!draft.category) p.category = 'Category';
  if (draft.price === '' || !isFinite(Number(draft.price)) || Number(draft.price) < 0) p.price = 'Price';
  if (draft.description.trim().length < 10) p.description = 'Description (10+ characters)';
  if (!D.normalizePhone(draft.contact)) p.contact = 'Contact number';
  if (!EMAIL_RE.test(draft.gmail.trim())) p.gmail = 'Gmail';
  if (draft.lat == null) p.location = 'Pin on map';
  return p;
}
function syncSell() {
  if (state.page !== 'sell') return;
  var problems = sellProblems();
  var labels = { photos: 'Photo', title: 'Title', category: 'Category', price: 'Price', description: 'Description', contact: 'Contact number', gmail: 'Gmail', location: 'Location pin' };
  var keys = Object.keys(labels), missing = Object.keys(problems).length, html = '';
  $('#prog').style.width = Math.round((keys.length - missing) / keys.length * 100) + '%';
  keys.forEach(function (k) { html += '<span class="' + (problems[k] ? '' : 'ok') + '">' + labels[k] + '</span>'; });
  $('#checks').innerHTML = html;
}

/* helper: <option> lists used by the Sell form AND the Edit pop-up */
function categoryOptions(selected) {
  var h = '<option value="">Choose a category…</option>';
  CATS.forEach(function (c) { h += '<option value="' + esc(c.id) + '"' + (selected === c.id ? ' selected' : '') + '>' + esc(c.emoji + ' ' + c.label) + '</option>'; });
  return h;
}
function conditionOptions(selected) {
  var h = '';
  (C.CONDITIONS || []).forEach(function (c) { h += '<option value="' + esc(c.id) + '"' + (selected === c.id ? ' selected' : '') + '>' + esc(c.label) + '</option>'; });
  return h;
}

/* ------------------------------------------------------------ [SELL-SCREEN] */
function showSell() {
  state.page = 'sell';
  destroyMap('main');
  updateChrome();
  var u = state.user;
  if (u) {
    if (!draft.gmail && EMAIL_RE.test(u.email || '')) draft.gmail = u.email;
    if (!draft.contact && u.mobile) draft.contact = u.mobile;
  }
  $('#view').innerHTML =
    '<div class="page-head"><div class="grow"><h1>Sell Item</h1><p>Post what you’re selling — buyers nearby will see it in the Market. Manage it later in <a href="#/my-listings">My Listings</a>.</p></div></div>' +
    '<div class="sell single"><section class="panel">' +
      '<div class="panel-head"><small>Market</small><h2>Item for sale</h2></div>' +
      '<div class="panel-body">' +
        (u ? '' : '<div class="notice">' + ic('info') + '<span>Fill everything in now — you’ll be asked to log in when you press <b>Upload</b>.</span></div>') +
        /* photos */
        '<div><div class="hint" style="margin-bottom:.4rem"><b>Photos</b> · <span id="photoCount">0</span>/' + C.MAX_PHOTOS + ' – the first photo is the cover.</div>' +
          '<div class="drop" id="drop" tabindex="0" role="button"><div class="ic">' + ic('photo') + '</div><strong>Add photos</strong><span>or drag and drop</span></div>' +
          '<input type="file" id="fFiles" accept="image/*" multiple hidden><div class="thumbs-up" id="thumbsUp" style="margin-top:.6rem"></div></div>' +
        /* required fields */
        '<div><div class="sec-title">Required</div><div class="hint">Be as descriptive as possible.</div></div>' +
        '<div class="field"><label for="fTitle">Title</label><input class="input" id="fTitle" maxlength="80" placeholder="e.g. Mountain bike 26&quot;" value="' + esc(draft.title) + '"></div>' +
        '<div class="two">' +
          '<div class="field"><label for="fCat">Category</label><select class="select" id="fCat">' + categoryOptions(draft.category) + '</select></div>' +
          '<div class="field"><label for="fCond">Condition</label><select class="select" id="fCond">' + conditionOptions(draft.condition) + '</select></div>' +
        '</div>' +
        '<div class="two">' +
          '<div class="field"><label for="fPrice">Price</label><div class="price-wrap"><span>' + esc(C.CURRENCY) + '</span><input class="input" id="fPrice" type="number" min="0" step="0.01" placeholder="0.00" value="' + esc(draft.price) + '"></div><div class="hint">Enter 0 to give it away.</div></div>' +
          '<div class="field"><label for="fQty">Quantity</label><input class="input" id="fQty" type="number" min="1" step="1" value="' + esc(draft.quantity) + '"></div>' +
        '</div>' +
        '<div class="field"><label for="fDesc">Description</label><textarea class="textarea" id="fDesc" maxlength="2000" placeholder="Condition, size, why you’re selling…">' + esc(draft.description) + '</textarea></div>' +
        '<div class="field"><label for="fMeet">Meet-up notes (optional)</label><input class="input" id="fMeet" maxlength="200" placeholder="e.g. Weekdays after 5pm, near the mall" value="' + esc(draft.meetup) + '"></div>' +
        /* contact */
        '<div><div class="sec-title">Contact</div><div class="hint">Only logged-in buyers see this after pressing BUY ITEM.</div></div>' +
        '<div class="two">' +
          '<div class="field"><label for="fContact">Contact Number</label><input class="input" id="fContact" type="tel" placeholder="0917 123 4567" value="' + esc(draft.contact) + '"></div>' +
          '<div class="field"><label for="fGmail">Gmail</label><input class="input" id="fGmail" type="email" placeholder="name@gmail.com" value="' + esc(draft.gmail) + '"></div>' +
        '</div>' +
        /* location */
        '<div><div class="sec-title">Location</div><div class="hint">Tap the map to drop a pin where the item can be picked up.</div></div>' +
        '<div class="pick" id="pickBox"><div id="pickMap" style="height:100%"></div></div>' +
        '<div class="two">' +
          '<div class="field"><label for="fLabel">Area / town</label><input class="input" id="fLabel" maxlength="80" placeholder="e.g. Makati" value="' + esc(draft.label) + '"></div>' +
          '<div class="field"><label>&nbsp;</label><button type="button" class="btn btn-soft" id="pickMe">' + ic('target') + ' Use my location</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="panel-foot"><div class="progress"><i id="prog"></i></div><div class="checks" id="checks"></div>' +
        '<button type="button" class="btn btn-coral btn-lg btn-block" id="uploadBtn">' + ic('upload') + ' Upload</button></div>' +
    '</section></div>';

  /* every input saves what you type into "draft" */
  bindDraft('fTitle', 'title'); bindDraft('fCat', 'category'); bindDraft('fCond', 'condition'); bindDraft('fPrice', 'price');
  bindDraft('fQty', 'quantity'); bindDraft('fDesc', 'description'); bindDraft('fMeet', 'meetup');
  bindDraft('fContact', 'contact'); bindDraft('fGmail', 'gmail'); bindDraft('fLabel', 'label');

  var drop = $('#drop'), file = $('#fFiles');
  drop.addEventListener('click', function () { file.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { addPhotos(e.dataTransfer.files); });
  file.addEventListener('change', function () { addPhotos(file.files); file.value = ''; });
  $('#thumbsUp').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]'); if (!b) return;
    var gone = draft.photos.splice(Number(b.getAttribute('data-rm')), 1)[0];
    if (gone) URL.revokeObjectURL(gone.url);
    paintThumbs(); syncSell();
  });
  $('#pickMe').addEventListener('click', function () {
    if (!navigator.geolocation) { toast('Your browser cannot share location.', 'bad'); return; }
    navigator.geolocation.getCurrentPosition(function (p) { setPin(p.coords.latitude, p.coords.longitude, true); },
      function () { toast('Location is blocked. Tap the map to drop a pin instead.', 'bad'); }, { timeout: 9000 });
  });
  $('#uploadBtn').addEventListener('click', doUpload);

  startPickMap();
  paintThumbs(); syncSell();
}
function bindDraft(id, key) {
  $('#' + id).addEventListener('input', function (e) {
    draft[key] = e.target.value;
    if (key === 'label') draft.labelTouched = true;
    syncSell();
  });
}

/* --------------------------------------------------------------- [SELL-MAP] */
function startPickMap() {
  destroyMap('pick'); maps.pickPin = null;
  if (!HAS_MAP) { $('#pickMap').innerHTML = mapFallback('Use the “Use my location” button instead.'); return; }
  var center = draft.lat != null ? [draft.lat, draft.lng] : [state.location.lat, state.location.lng];
  maps.pick = makeMap('pickMap', center, draft.lat != null ? 15 : 12);
  maps.pick.on('click', function (e) { setPin(e.latlng.lat, e.latlng.lng, false); });
  if (draft.lat != null) maps.pickPin = L.marker(center, { icon: pinIcon('Item here', 'hot') }).addTo(maps.pick);
  setTimeout(function () { if (maps.pick) maps.pick.invalidateSize(); }, 80);
}
function setPin(lat, lng, recenter) {
  draft.lat = Math.round(lat * 1e6) / 1e6; draft.lng = Math.round(lng * 1e6) / 1e6;
  if (HAS_MAP && maps.pick) {
    if (maps.pickPin) maps.pickPin.setLatLng([lat, lng]);
    else maps.pickPin = L.marker([lat, lng], { icon: pinIcon('Item here', 'hot') }).addTo(maps.pick);
    if (recenter) maps.pick.setView([lat, lng], 15);
  }
  if (!draft.labelTouched) fillAreaName(lat, lng);
  syncSell();
}
/* asks OpenStreetMap for the town name of the pin */
function fillAreaName(lat, lng) {
  fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&lat=' + lat + '&lon=' + lng, { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.address || draft.labelTouched) return;
      var a = d.address;
      var parts = [a.suburb || a.neighbourhood || a.village || a.city_district, a.city || a.town || a.municipality || a.county].filter(Boolean);
      var label = parts.join(', ');
      if (label && $('#fLabel')) { draft.label = label.slice(0, 80); $('#fLabel').value = draft.label; syncSell(); }
    }).catch(function () {});
}

/* ------------------------------------------------------------ [SELL-UPLOAD] */
function doUpload() {
  var problems = sellProblems();
  if (Object.keys(problems).length) {
    var names = Object.keys(problems).map(function (k) { return problems[k]; });
    toast('Still needed: ' + names.join(', ') + '.', 'bad');
    return;
  }
  if (!state.user) { toast('Log in or sign up to post your item — your form is saved.'); go('/auth?mode=login&next=' + encodeURIComponent('/sell')); return; }
  var btn = $('#uploadBtn');
  btn.disabled = true; btn.textContent = 'Uploading…';
  var form = {
    title: draft.title.trim(), category: draft.category, condition: draft.condition, quantity: Math.max(1, parseInt(draft.quantity, 10) || 1),
    price: Number(draft.price), description: draft.description.trim(), meetup: draft.meetup.trim(),
    contact: draft.contact.trim(), gmail: draft.gmail.trim(), lat: draft.lat, lng: draft.lng, label: draft.label.trim()
  };
  var blobs = draft.photos.map(function (x) { return x.blob; });
  D.createItem(form, blobs, function (f) { btn.textContent = 'Uploading… ' + Math.round(f * 100) + '%'; })
    .then(function (item) {
      resetDraft();
      return loadItems().then(function () {
        state.highlight = item.id; state.sort = 'new'; state.search = ''; state.category = 'all'; state.page = '';
        toast('Your item is now live in the Market!', 'ok');
        go('/market');
      });
    })
    .catch(function (e) { toast(D.niceError(e), 'bad'); btn.disabled = false; btn.innerHTML = ic('upload') + ' Upload'; });
}

/* ========================================================== MY LISTINGS (READ) */
var myListings = [];     // the seller's own items (including sold ones)

/* ------------------------------------------------------- [LISTINGS-SCREEN] */
function showMyListings() {
  state.page = 'my-listings';
  destroyMap('main');
  updateChrome();
  if (!state.user) {
    $('#view').innerHTML = '<div class="page-head"><div class="grow"><h1>My Listings</h1></div></div><div class="empty"><b>Log in to manage your listings</b><a href="#/auth?mode=login&next=%2Fmy-listings">Log in</a></div>';
    return;
  }
  $('#view').innerHTML = '<div class="page-head"><div class="grow"><h1>My Listings</h1><p>Edit, mark as sold, or delete the items you are selling.</p></div>' +
    '<a class="btn btn-coral" href="#/sell">' + ic('plus') + ' Add new item</a></div><div class="plist" id="llist"><div class="skel"></div></div>';
  refreshMyListings();
}
function refreshMyListings() {
  return Promise.all([D.myItems(), refreshStats()]).then(function (res) {
    myListings = res[0];
    paintMyListings();
  }).catch(function (e) { toast(D.niceError(e), 'bad'); });
}
function paintMyListings() {
  var box = $('#llist'); if (!box) return;
  if (myListings.length === 0) { box.innerHTML = '<div class="empty"><b>You have no listings yet</b><a href="#/sell">Sell your first item</a></div>'; return; }
  var html = '';
  myListings.forEach(function (it) { html += listingRowHtml(it); });
  box.innerHTML = html;
}

/* --------------------------------------------------------- [LISTINGS-ROW] */
function listingRowHtml(it) {
  var st = statOf(it.id);
  var sold = it.status === 'sold';
  return '<div class="prow">' +
    '<img src="' + esc(imgOf(it)) + '" alt="">' +
    '<div class="prow-main">' +
      '<div class="prow-top"><b>' + esc(it.title) + '</b>' +
        '<span class="' + (sold ? 'badge-sold' : 'badge-live') + '">' + (sold ? 'Sold out' : 'Live in Market') + '</span></div>' +
      '<div class="hint">' + esc(priceText(it.price)) + ' · ' + esc(catLabel(catOf(it))) + ' · ' + esc(conditionLabel(it.condition)) + ' · qty ' + esc(it.quantity || 1) + ' · listed ' + esc(timeAgo(it.created_at)) + '</div>' +
      '<div class="hint">' + ic('fire') + ' ' + st.buys + ' bought · ' + (st.count ? '★ ' + Number(st.avg).toFixed(1) + ' (' + st.count + ' ratings)' : 'no ratings yet') + '</div>' +
    '</div>' +
    '<div class="prow-btns">' +
      '<button class="btn btn-soft btn-sm" type="button" data-edit="' + esc(it.id) + '">' + ic('edit') + ' Edit</button>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-toggle="' + esc(it.id) + '">' + (sold ? 'Mark available' : 'Mark sold') + '</button>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-del="' + esc(it.id) + '">' + ic('trash') + ' Delete</button>' +
    '</div></div>';
}

/* --------------------------------------------------------- [EDIT-MODAL] (UPDATE) */
function openEditModal(id) {
  var it = myListings.filter(function (i) { return i.id === id; })[0];
  if (!it) return;
  D.getContact(id).then(function (c) {
    c = c || { number: '', gmail: '' };
    $('#modalRoot').innerHTML =
      '<div class="backdrop" id="bd"><div class="sheet edit-sheet">' +
        '<button class="close" type="button" aria-label="Close">' + ic('x') + '</button>' +
        '<form class="edit-form" id="editForm" novalidate>' +
          '<h2>Edit listing</h2><p class="hint">Photos and the map pin stay the same. Everything else can be changed.</p>' +
          '<div class="form-error" id="editErr" hidden></div>' +
          '<div class="field"><label>Title</label><input class="input" id="eTitle" maxlength="80" value="' + esc(it.title) + '"></div>' +
          '<div class="two"><div class="field"><label>Category</label><select class="select" id="eCat">' + categoryOptions(catOf(it)) + '</select></div>' +
            '<div class="field"><label>Condition</label><select class="select" id="eCond">' + conditionOptions(it.condition || 'used') + '</select></div></div>' +
          '<div class="two"><div class="field"><label>Price (' + esc(C.CURRENCY) + ')</label><input class="input" id="ePrice" type="number" min="0" step="0.01" value="' + esc(it.price) + '"></div>' +
            '<div class="field"><label>Quantity</label><input class="input" id="eQty" type="number" min="1" step="1" value="' + esc(it.quantity || 1) + '"></div></div>' +
          '<div class="field"><label>Description / more details</label><textarea class="textarea" id="eDesc" maxlength="2000">' + esc(it.description) + '</textarea></div>' +
          '<div class="field"><label>Meet-up notes</label><input class="input" id="eMeet" maxlength="200" value="' + esc(it.meetup_notes || '') + '"></div>' +
          '<div class="two"><div class="field"><label>Contact number</label><input class="input" id="eContact" type="tel" value="' + esc(c.number) + '"></div>' +
            '<div class="field"><label>Gmail</label><input class="input" id="eGmail" type="email" value="' + esc(c.gmail) + '"></div></div>' +
          '<div class="two"><div class="field"><label>Area / town</label><input class="input" id="eLabel" maxlength="80" value="' + esc(it.location_label || '') + '"></div>' +
            '<div class="field"><label>Status</label><select class="select" id="eStatus"><option value="available"' + (it.status !== 'sold' ? ' selected' : '') + '>Available</option><option value="sold"' + (it.status === 'sold' ? ' selected' : '') + '>Sold out (hidden from Market)</option></select></div></div>' +
          '<div class="edit-btns"><button type="button" class="btn btn-ghost" id="editCancel">Cancel</button><button type="submit" class="btn btn-primary" id="editSave">Save changes</button></div>' +
        '</form></div></div>';
    document.body.style.overflow = 'hidden';
    $('.close').addEventListener('click', closeModal);
    $('#editCancel').addEventListener('click', closeModal);
    $('#editForm').addEventListener('submit', function (e) { e.preventDefault(); saveEdit(id); });
  }).catch(function (e) { toast(D.niceError(e), 'bad'); });
}
function saveEdit(id) {
  function say(msg) { var el = $('#editErr'); el.hidden = !msg; el.textContent = msg || ''; }
  var f = {
    title: $('#eTitle').value.trim(), category: $('#eCat').value, condition: $('#eCond').value,
    price: Number($('#ePrice').value), quantity: Math.max(1, parseInt($('#eQty').value, 10) || 1),
    description: $('#eDesc').value.trim(), meetup: $('#eMeet').value.trim(),
    contact: $('#eContact').value.trim(), gmail: $('#eGmail').value.trim(),
    label: $('#eLabel').value.trim(), status: $('#eStatus').value
  };
  if (f.title.length < 3) return say('Title needs at least 3 letters.');
  if (!f.category) return say('Choose a category.');
  if ($('#ePrice').value === '' || !isFinite(f.price) || f.price < 0) return say('Enter a valid price.');
  if (f.description.length < 10) return say('Description needs at least 10 characters.');
  var phone = D.normalizePhone(f.contact);
  if (!phone) return say('Enter a valid contact number.');
  if (!EMAIL_RE.test(f.gmail)) return say('Enter a valid Gmail.');
  f.contact = phone;
  var btn = $('#editSave'); btn.disabled = true; btn.textContent = 'Saving…';
  D.updateItem(id, f).then(function () { return Promise.all([loadItems(), refreshMyListings()]); })
    .then(function () { closeModal(); toast('Listing updated.', 'ok'); })
    .catch(function (e) { say(D.niceError(e)); btn.disabled = false; btn.textContent = 'Save changes'; });
}

/* quick Mark sold / Mark available button */
function toggleSold(id) {
  var it = myListings.filter(function (i) { return i.id === id; })[0]; if (!it) return;
  D.getContact(id).then(function (c) {
    c = c || { number: '', gmail: '' };
    return D.updateItem(id, {
      title: it.title, category: catOf(it), condition: it.condition || 'used', price: it.price, quantity: it.quantity || 1,
      description: it.description, meetup: it.meetup_notes || '', contact: c.number, gmail: c.gmail,
      label: it.location_label || '', status: it.status === 'sold' ? 'available' : 'sold'
    });
  }).then(function () { return Promise.all([loadItems(), refreshMyListings()]); })
    .then(function () { toast('Status updated.', 'ok'); })
    .catch(function (e) { toast(D.niceError(e), 'bad'); });
}

/* ------------------------------------------------------- [LISTINGS-DELETE] */
function deleteListing(id) {
  if (!window.confirm('Delete this listing? This cannot be undone.')) return;
  D.deleteItem(id).then(function () { return Promise.all([loadItems(), refreshMyListings()]); })
    .then(function () { toast('Listing deleted.', 'ok'); })
    .catch(function (e) { toast(D.niceError(e), 'bad'); });
}
