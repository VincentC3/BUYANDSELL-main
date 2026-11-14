/* =====================================================================
   FILE: page-auth.js  —  LOGIN / SIGNUP PAGE  (#/auth)
   ---------------------------------------------------------------------
   [AUTH-SCREEN]   the page with the Login and Signup forms
   [AUTH-LOGIN]    what happens when you press Login
   [AUTH-SIGNUP]   what happens when you press Signup  (add signup fields here)
   After login it goes to the page in the "next" part of the link.
   ===================================================================== */

/* -------------------------------------------------------------- [AUTH-SCREEN] */
function showAuth(params) {
  state.page = 'auth';
  destroyMap('main'); destroyMap('pick');
  var mode = params.mode === 'signup' ? 'signup' : 'login';
  var next = params.next || '/market';
  var phoneMode = C.AUTH_MODE !== 'email';
  var idLabel = phoneMode ? 'Mobile Number' : 'E-mail';

  $('#app').innerHTML =
    '<div class="auth">' +
      '<section class="splash" aria-hidden="true">' +
        '<span class="shape t1"></span><span class="shape t2"></span><span class="shape t3"></span><span class="shape t4"></span>' +
        '<span class="shape dot d1"></span><span class="shape dot d2"></span><span class="shape dot d3"></span>' +
        '<div class="splash-inner"><div class="logo">' + logoSvg('#3a35c8', '#ff7a3d', '#fff') + '</div><h1>' + esc(C.STORE_NAME) + '</h1><p>Buy &amp; sell, right in your neighbourhood.</p></div>' +
      '</section>' +
      '<section class="auth-side"><div class="auth-card">' +
        '<div class="auth-top"><button class="back" type="button" id="backBtn">' + ic('back') + ' Back to Market</button></div>' +
        '<div><h2 id="authTitle">' + (mode === 'signup' ? 'Signup' : 'Login') + '</h2></div>' +
        (params.buy === '1' ? '<div class="notice">' + ic('lock') + '<span>Log in or sign up to see the seller’s information for this item.</span></div>' : '') +
        '<div class="form-error" id="authErr" role="alert" hidden></div>' +

        /* ----- LOGIN FORM ----- */
        '<form class="auth-form" id="loginForm" ' + (mode === 'signup' ? 'hidden' : '') + ' novalidate>' +
          '<label class="uline">' + ic(phoneMode ? 'mobile' : 'mail') + '<input id="lId" type="' + (phoneMode ? 'tel' : 'email') + '" placeholder="' + idLabel + '" autocomplete="username"></label>' +
          '<label class="uline">' + ic('lock') + '<input id="lPw" type="password" placeholder="Password" autocomplete="current-password"><button class="eye" type="button" data-eye>' + ic('eye') + '</button></label>' +
          '<button class="forgot" type="button" id="forgot">Forgot Password?</button>' +
          '<button class="btn btn-primary btn-lg btn-block" id="loginBtn" type="submit" style="margin-top:.6rem">Login</button>' +
          '<p class="switch">Don’t have an account? <button type="button" data-switch="signup">Signup</button></p>' +
          '<button class="btn btn-google btn-lg btn-block" type="button" id="googleBtn"><span class="g">G</span> Or Login With Google</button>' +
        '</form>' +

        /* ----- SIGNUP FORM ----- */
        '<form class="auth-form" id="signupForm" ' + (mode === 'login' ? 'hidden' : '') + ' novalidate>' +
          '<label class="uline">' + ic('user') + '<input id="sName" type="text" placeholder="Username" maxlength="40"></label>' +
          '<label class="uline">' + ic('mobile') + '<input id="sMobile" type="tel" placeholder="Mobile Number"></label>' +
          '<label class="uline">' + ic('mail') + '<input id="sEmail" type="email" placeholder="E-mail"></label>' +
          '<label class="uline">' + ic('building') + '<input id="sCompany" type="text" placeholder="Company / Shop Name (optional)" maxlength="60"></label>' +
          '<label class="uline">' + ic('store') + '<select id="sType"><option value="buyer">Account Type: Buyer</option><option value="seller">Account Type: Seller</option><option value="buyer & seller">Account Type: Buyer &amp; Seller</option></select>' + ic('chevron') + '</label>' +
          '<label class="uline">' + ic('lock') + '<input id="sPw" type="password" placeholder="Password (8+ characters)" autocomplete="new-password"><button class="eye" type="button" data-eye>' + ic('eye') + '</button></label>' +
          '<label class="uline">' + ic('lock') + '<input id="sPw2" type="password" placeholder="Re-Password" autocomplete="new-password"></label>' +
          '<button class="btn btn-primary btn-lg btn-block" id="signupBtn" type="submit" style="margin-top:.6rem">Signup</button>' +
          '<p class="switch">Already have an account? <button type="button" data-switch="login">Login</button></p>' +
        '</form>' +
      '</div></section>' +
    '</div>';

  function err(msg) { var el = $('#authErr'); el.hidden = !msg; el.textContent = msg || ''; }
  function setMode(m) {
    $('#loginForm').hidden = m !== 'login'; $('#signupForm').hidden = m !== 'signup';
    $('#authTitle').textContent = m === 'signup' ? 'Signup' : 'Login'; err('');
    history.replaceState(null, '', '#/auth?mode=' + m + '&next=' + encodeURIComponent(next) + (params.buy === '1' ? '&buy=1' : ''));
  }
  $$('[data-switch]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-switch')); }); });
  $$('[data-eye]').forEach(function (b) {
    b.addEventListener('click', function () { var inp = b.parentElement.querySelector('input'); inp.type = inp.type === 'password' ? 'text' : 'password'; });
  });
  $('#backBtn').addEventListener('click', function () { go('/market'); });
  $('#forgot').addEventListener('click', function () { toast('Password reset is not set up yet. Ask the site owner to reset it in Supabase.'); });
  $('#googleBtn').addEventListener('click', function () {
    try { sessionStorage.setItem('palit_next', next); } catch (e) {}
    D.signInGoogle().catch(function (e) { err(D.niceError(e)); });
  });

  /* ------------------------------------------------------------ [AUTH-LOGIN] */
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault(); err('');
    var id = $('#lId').value.trim(), pw = $('#lPw').value;
    if (!id || !pw) { err('Enter your ' + idLabel.toLowerCase() + ' and password.'); return; }
    if (phoneMode) {
      var n = D.normalizePhone(id);
      if (n) id = n; else if (D.mode !== 'demo') { err('Enter a valid mobile number, e.g. 0917 123 4567.'); return; }
    }
    var btn = $('#loginBtn'); btn.disabled = true; btn.textContent = 'Logging in…';
    D.signIn(id, pw).then(function () { return D.init(); }).then(function (u) {
      state.user = u;
      return loadMyBuying().then(function () { toast('Welcome back, ' + (u ? u.name : '') + '!', 'ok'); go(next); });
    }).catch(function (ex) { err(D.niceError(ex)); btn.disabled = false; btn.textContent = 'Login'; });
  });

  /* ----------------------------------------------------------- [AUTH-SIGNUP] */
  $('#signupForm').addEventListener('submit', function (e) {
    e.preventDefault(); err('');
    var f = { username: $('#sName').value.trim(), mobile: $('#sMobile').value.trim(), email: $('#sEmail').value.trim(),
              company: $('#sCompany').value.trim(), accountType: $('#sType').value, password: $('#sPw').value };
    var e164 = D.normalizePhone(f.mobile);
    if (f.username.length < 3) return err('Username needs at least 3 characters.');
    if (!e164) return err('Enter a valid mobile number, e.g. 0917 123 4567.');
    if (!EMAIL_RE.test(f.email)) return err('Enter a valid e-mail address.');
    if (f.password.length < 8) return err('Password needs at least 8 characters.');
    if (f.password !== $('#sPw2').value) return err('Passwords do not match.');
    f.mobile = e164;
    var btn = $('#signupBtn'); btn.disabled = true; btn.textContent = 'Creating account…';
    D.signUp(f).then(function (res) {
      if (res.signedIn) {
        return D.init().then(function (u) { state.user = u; toast('Account created. Welcome!', 'ok'); go(next); });
      }
      toast('Account created — please log in.', 'ok'); setMode('login'); btn.disabled = false; btn.textContent = 'Signup';
    }).catch(function (ex) { err(D.niceError(ex)); btn.disabled = false; btn.textContent = 'Signup'; });
  });
  window.scrollTo(0, 0);
}
