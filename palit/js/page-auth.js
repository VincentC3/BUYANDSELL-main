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
  var mode = ({ signup: 1, forgot: 1, reset: 1 })[params.mode] ? params.mode : 'login';
  var needLink = false;
  /* The "new password" page only works after opening the link from the reset e-mail. */
  if (mode === 'reset' && !state.user) { mode = 'forgot'; needLink = true; }
  var TITLES = { login: 'Login', signup: 'Signup', forgot: 'Forgot Password', reset: 'New Password' };
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
        '<div><h2 id="authTitle">' + TITLES[mode] + '</h2></div>' +
        (params.buy === '1' ? '<div class="notice">' + ic('lock') + '<span>Log in or sign up to see the seller’s information for this item.</span></div>' : '') +
        '<div class="form-error" id="authErr" role="alert" hidden></div>' +

        /* ----- LOGIN FORM ----- */
        '<form class="auth-form" id="loginForm" ' + (mode !== 'login' ? 'hidden' : '') + ' novalidate>' +
          '<label class="uline">' + ic(phoneMode ? 'mobile' : 'mail') + '<input id="lId" type="' + (phoneMode ? 'tel' : 'email') + '" placeholder="' + idLabel + '" autocomplete="username"></label>' +
          '<label class="uline">' + ic('lock') + '<input id="lPw" type="password" placeholder="Password" autocomplete="current-password"><button class="eye" type="button" data-eye>' + ic('eye') + '</button></label>' +
          '<button class="forgot" type="button" id="forgot">Forgot Password?</button>' +
          '<button class="btn btn-primary btn-lg btn-block" id="loginBtn" type="submit" style="margin-top:.6rem">Login</button>' +
          '<p class="switch">Don’t have an account? <button type="button" data-switch="signup">Signup</button></p>' +
          '<button class="btn btn-google btn-lg btn-block" type="button" id="googleBtn"><span class="g">G</span> Or Login With Google</button>' +
        '</form>' +

        /* ----- SIGNUP FORM ----- */
        '<form class="auth-form" id="signupForm" ' + (mode !== 'signup' ? 'hidden' : '') + ' novalidate>' +
          '<label class="uline">' + ic('user') + '<input id="sName" type="text" placeholder="Username" maxlength="40"></label>' +
          '<label class="uline">' + ic('mobile') + '<input id="sMobile" type="tel" placeholder="Mobile Number"></label>' +
          '<label class="uline">' + ic('mail') + '<input id="sEmail" type="email" placeholder="E-mail"></label>' +
          '<label class="uline">' + ic('building') + '<input id="sCompany" type="text" placeholder="Company / Shop Name (optional)" maxlength="60"></label>' +
          '<label class="uline">' + ic('store') + '<select id="sType"><option value="buyer">Account Type: Buyer</option><option value="seller">Account Type: Seller</option></select>' + ic('chevron') + '</label>' +
          '<label class="uline">' + ic('lock') + '<input id="sPw" type="password" placeholder="Password (8+ characters)" autocomplete="new-password"><button class="eye" type="button" data-eye>' + ic('eye') + '</button></label>' +
          '<label class="uline">' + ic('lock') + '<input id="sPw2" type="password" placeholder="Re-Password" autocomplete="new-password"></label>' +
          '<button class="btn btn-primary btn-lg btn-block" id="signupBtn" type="submit" style="margin-top:.6rem">Signup</button>' +
          '<p class="switch">Already have an account? <button type="button" data-switch="login">Login</button></p>' +
        '</form>' +

        /* ----- FORGOT PASSWORD FORM (step 1: ask for the e-mail) ----- */
        '<form class="auth-form" id="forgotForm" ' + (mode !== 'forgot' ? 'hidden' : '') + ' novalidate>' +
          '<p class="hint" style="margin:0 0 .6rem">Enter the e-mail you signed up with. We will send you a link to choose a new password.</p>' +
          '<label class="uline">' + ic('mail') + '<input id="fEmail" type="email" placeholder="E-mail" autocomplete="email"></label>' +
          '<div class="notice" id="fOk" hidden style="margin-top:.6rem">' + ic('check') + '<span></span></div>' +
          '<button class="btn btn-primary btn-lg btn-block" id="forgotBtn" type="submit" style="margin-top:.6rem">Send reset link</button>' +
          '<p class="switch">Remembered it? <button type="button" data-switch="login">Login</button></p>' +
        '</form>' +

        /* ----- NEW PASSWORD FORM (step 3: opened from the e-mail link) ----- */
        '<form class="auth-form" id="resetForm" ' + (mode !== 'reset' ? 'hidden' : '') + ' novalidate>' +
          '<p class="hint" style="margin:0 0 .6rem">Choose a new password for your account.</p>' +
          '<label class="uline">' + ic('lock') + '<input id="rPw" type="password" placeholder="New password (8+ characters)" autocomplete="new-password"><button class="eye" type="button" data-eye>' + ic('eye') + '</button></label>' +
          '<label class="uline">' + ic('lock') + '<input id="rPw2" type="password" placeholder="Re-type new password" autocomplete="new-password"></label>' +
          '<button class="btn btn-primary btn-lg btn-block" id="resetBtn" type="submit" style="margin-top:.6rem">Save new password</button>' +
        '</form>' +
      '</div></section>' +
    '</div>';

  function err(msg) { var el = $('#authErr'); el.hidden = !msg; el.textContent = msg || ''; }
  function setMode(m) {
    ['login', 'signup', 'forgot', 'reset'].forEach(function (k) { $('#' + k + 'Form').hidden = m !== k; });
    $('#authTitle').textContent = TITLES[m]; err('');
    history.replaceState(null, '', '#/auth?mode=' + m + '&next=' + encodeURIComponent(next) + (params.buy === '1' ? '&buy=1' : ''));
  }
  $$('[data-switch]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-switch')); }); });
  $$('[data-eye]').forEach(function (b) {
    b.addEventListener('click', function () { var inp = b.parentElement.querySelector('input'); inp.type = inp.type === 'password' ? 'text' : 'password'; });
  });
  $('#backBtn').addEventListener('click', function () { go('/market'); });
  $('#forgot').addEventListener('click', function () {
    setMode('forgot');
    var typed = $('#lId').value.trim();
    if (typed.indexOf('@') > 0) $('#fEmail').value = typed;   /* reuse what they already typed */
  });
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

  /* ------------------------------------------------------ [AUTH-FORGOT]
     Step 1: send the reset e-mail. The message is the same whether or not the e-mail has an account. */
  $('#forgotForm').addEventListener('submit', function (e) {
    e.preventDefault(); err(''); $('#fOk').hidden = true;
    var email = $('#fEmail').value.trim();
    if (!EMAIL_RE.test(email)) return err('Enter a valid e-mail address.');
    var btn = $('#forgotBtn'); btn.disabled = true; btn.textContent = 'Sending…';
    D.resetPassword(email).then(function () {
      var ok = $('#fOk');
      ok.querySelector('span').textContent = 'If an account exists for ' + email + ', a reset link is on its way. Check your inbox and spam folder. The link works for about 1 hour.';
      ok.hidden = false;
      var left = 60;
      btn.textContent = 'Send again in ' + left + 's';
      var timer = setInterval(function () {
        left--;
        var b = $('#forgotBtn');
        if (!b) { clearInterval(timer); return; }
        if (left <= 0) { clearInterval(timer); b.disabled = false; b.textContent = 'Send reset link'; }
        else b.textContent = 'Send again in ' + left + 's';
      }, 1000);
    }).catch(function (ex) { err(D.niceError(ex)); btn.disabled = false; btn.textContent = 'Send reset link'; });
  });

  /* ------------------------------------------------------ [AUTH-RESET]
     Step 3: the person opened the link from the e-mail and is now allowed to save a new password. */
  $('#resetForm').addEventListener('submit', function (e) {
    e.preventDefault(); err('');
    var pw = $('#rPw').value;
    if (pw.length < 8) return err('Password needs at least 8 characters.');
    if (pw !== $('#rPw2').value) return err('Passwords do not match.');
    var btn = $('#resetBtn'); btn.disabled = true; btn.textContent = 'Saving…';
    D.updatePassword(pw).then(function () {
      D.clearRecovery();
      return D.init();
    }).then(function (u) {
      state.user = u;
      return loadMyBuying();
    }).then(function () {
      toast('Password changed. You are logged in.', 'ok'); go('/market');
    }).catch(function (ex) { err(D.niceError(ex)); btn.disabled = false; btn.textContent = 'Save new password'; });
  });

  if (needLink) err('Open the link from your reset e-mail to choose a new password, or request a new link below.');
  window.scrollTo(0, 0);
}
