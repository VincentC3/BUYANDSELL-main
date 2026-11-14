/* =====================================================================
   FILE: page-profile.js  —  PROFILE PAGE  (#/profile)
   ---------------------------------------------------------------------
   Shows the client's profile + status and lets them edit it.
   [PROFILE-SCREEN]   the page layout (header card, status tiles, form)
   [PROFILE-STATUS]   the "profile complete" % and the activity numbers
   [PROFILE-SAVE]     the Save button (UPDATE the profile)
   Fields saved: name, mobile, e-mail, company, account type, city, bio.
   (Add a new field: put it in the form below, in showProfile's save code,
    in data.js updateProfile, and as a column in schema.sql.)
   ===================================================================== */

/* ---------------------------------------------------------- [PROFILE-SCREEN] */
function showProfile() {
  state.page = 'profile';
  destroyMap('main');
  updateChrome();
  if (!state.user) {
    $('#view').innerHTML = '<div class="page-head"><div class="grow"><h1>My Profile</h1></div></div><div class="empty"><b>Log in to see your profile</b><a href="#/auth?mode=login&next=%2Fprofile">Log in</a></div>';
    return;
  }
  $('#view').innerHTML = '<div class="page-head"><div class="grow"><h1>My Profile</h1><p>Your account details and activity.</p></div></div><div class="skel"></div>';
  Promise.all([D.getProfile(), D.myItems().catch(function () { return []; }), loadMyBuying(), refreshStats()]).then(function (res) {
    if (state.page === 'profile') drawProfile(res[0], res[1]);
  }).catch(function (e) { toast(D.niceError(e), 'bad'); });
}

/* ---------------------------------------------------------- [PROFILE-STATUS] */
/* How complete is the profile? Each filled field = one point. */
function profileCompleteness(p) {
  var fields = [p.name, p.mobile, p.email, p.company, p.city, p.bio];
  var filled = fields.filter(function (v) { return v && String(v).trim(); }).length;
  return Math.round(filled / fields.length * 100);
}
function typeLabel(t) {
  if (t === 'seller') return 'Seller';
  if (t === 'buyer & seller') return 'Buyer & Seller';
  return 'Buyer';
}

function drawProfile(p, mine) {
  var percent = profileCompleteness(p);
  var soldCount = 0, ratingSum = 0, ratingCount = 0;
  mine.forEach(function (it) {
    var st = statOf(it.id);
    soldCount += st.buys; ratingSum += st.avg * st.count; ratingCount += st.count;
  });
  var avg = ratingCount ? (ratingSum / ratingCount).toFixed(1) : '–';
  var tiles = [
    ['Items bought', state.purchases.length, 'bag'],
    ['Ratings given', Object.keys(state.myRatings).length, 'star'],
    ['Items listed', mine.length, 'store'],
    ['Sold to buyers', soldCount, 'fire'],
    ['Seller rating', avg === '–' ? '–' : '★ ' + avg, 'star']
  ];
  var tileHtml = '';
  tiles.forEach(function (t) { tileHtml += '<div class="tile">' + ic(t[2]) + '<strong>' + esc(t[1]) + '</strong><span>' + esc(t[0]) + '</span></div>'; });

  var typeOptions = '';
  [['buyer', 'Buyer'], ['seller', 'Seller'], ['buyer & seller', 'Buyer & Seller']].forEach(function (o) {
    typeOptions += '<option value="' + o[0] + '"' + (p.accountType === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  });

  $('#view').innerHTML =
    '<div class="page-head"><div class="grow"><h1>My Profile</h1><p>Your account details and activity.</p></div></div>' +
    '<section class="panel profile-head">' +
      '<div class="avatar big">' + esc((p.name || '?').charAt(0).toUpperCase()) + '</div>' +
      '<div class="profile-who"><h2>' + esc(p.name) + '</h2>' +
        '<div class="chips"><span class="chip warm">' + esc(typeLabel(p.accountType)) + '</span>' +
          (p.company ? '<span class="chip">' + ic('building') + ' ' + esc(p.company) + '</span>' : '') +
          (p.city ? '<span class="chip">' + ic('pin') + ' ' + esc(p.city) + '</span>' : '') +
          '<span class="chip">Member since ' + esc(dateText(p.createdAt)) + '</span></div>' +
        (p.bio ? '<p class="hint" style="margin-top:.5rem">' + esc(p.bio) + '</p>' : '') +
      '</div>' +
      '<div class="profile-status"><small>Profile status</small><strong>' + percent + '% complete</strong>' +
        '<div class="progress"><i style="width:' + percent + '%"></i></div>' +
        '<small>' + (percent === 100 ? 'Your profile is complete.' : 'Fill the empty fields below to reach 100%.') + '</small></div>' +
    '</section>' +
    '<div class="tiles">' + tileHtml + '</div>' +
    '<section class="panel"><div class="panel-head"><h2>Edit profile</h2></div>' +
      '<form class="panel-body" id="profileForm" novalidate>' +
        '<div class="form-error" id="pErr" hidden></div>' +
        '<div class="two"><div class="field"><label>Username</label><input class="input" id="pName" maxlength="40" value="' + esc(p.name) + '"></div>' +
          '<div class="field"><label>Account type</label><select class="select" id="pType">' + typeOptions + '</select></div></div>' +
        '<div class="two"><div class="field"><label>Mobile number</label><input class="input" id="pMobile" type="tel" value="' + esc(p.mobile) + '"></div>' +
          '<div class="field"><label>E-mail</label><input class="input" id="pEmail" type="email" value="' + esc(p.email) + '"></div></div>' +
        '<div class="two"><div class="field"><label>Company / Shop name</label><input class="input" id="pCompany" maxlength="60" value="' + esc(p.company) + '"></div>' +
          '<div class="field"><label>City / Area</label><input class="input" id="pCity" maxlength="60" value="' + esc(p.city) + '"></div></div>' +
        '<div class="field"><label>About me</label><textarea class="textarea" id="pBio" maxlength="300" placeholder="Tell buyers a little about you or your shop">' + esc(p.bio) + '</textarea></div>' +
        '<div class="edit-btns"><button class="btn btn-primary" id="pSave" type="submit">Save profile</button></div>' +
      '</form></section>';

  $('#profileForm').addEventListener('submit', function (e) { e.preventDefault(); saveProfile(); });
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------ [PROFILE-SAVE] */
function saveProfile() {
  function say(msg) { var el = $('#pErr'); el.hidden = !msg; el.textContent = msg || ''; }
  var f = {
    name: $('#pName').value.trim(), accountType: $('#pType').value, mobile: $('#pMobile').value.trim(),
    email: $('#pEmail').value.trim(), company: $('#pCompany').value.trim(), city: $('#pCity').value.trim(), bio: $('#pBio').value.trim()
  };
  if (f.name.length < 3) return say('Username needs at least 3 characters.');
  if (f.mobile && !D.normalizePhone(f.mobile)) return say('Enter a valid mobile number, e.g. 0917 123 4567.');
  if (f.email && !EMAIL_RE.test(f.email)) return say('Enter a valid e-mail address.');
  if (f.mobile) f.mobile = D.normalizePhone(f.mobile);
  var btn = $('#pSave'); btn.disabled = true; btn.textContent = 'Saving…';
  D.updateProfile(f).then(function () {
    state.user = D.user();
    toast('Profile saved.', 'ok');
    return loadItems();
  }).then(function () { showProfile(); })
    .catch(function (e) { say(D.niceError(e)); btn.disabled = false; btn.textContent = 'Save profile'; });
}
