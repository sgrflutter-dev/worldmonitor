/* Good Thoughts identity for the shared product nav (vanilla sections).
 *
 * Mirrors the React <GoodThoughtsShell>: reads the Supabase session that the
 * /auth page persists in localStorage (key `gt-auth`) and renders the signed-in
 * account + Logout into #gtIdentity, else a Sign in link.
 *
 * Loaded as an EXTERNAL script (not inline) because the Monitor HTML ships a
 * strict CSP meta (`script-src 'self' 'sha256-...'`, no 'unsafe-inline'); an
 * inline block would be blocked, but a same-origin file is allowed by 'self'.
 */
(function () {
  var KEY = 'gt-auth';

  function readUser() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      // tolerate supabase-js v1 ({currentSession}) and v2 (session / user) shapes
      var u = (p && (p.user || (p.currentSession && p.currentSession.user) || (p.session && p.session.user))) || null;
      if (!u || !u.email) return null;
      var m = u.user_metadata || {};
      return { email: u.email, name: m.full_name || m.name || null };
    } catch (e) {
      return null;
    }
  }

  function initials(name, email) {
    if (name) {
      return name.trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join('');
    }
    return email ? email[0].toUpperCase() : 'GT';
  }

  function render() {
    var slot = document.getElementById('gtIdentity');
    if (!slot) return;
    var acct = readUser();
    slot.innerHTML = '';

    if (!acct) {
      var a = document.createElement('a');
      a.className = 'gt-shell-nav__signin';
      a.href = '/auth';
      a.textContent = 'Sign in';
      slot.appendChild(a);
      return;
    }

    var name = document.createElement('span');
    name.className = 'gt-shell-nav__name';
    name.textContent = acct.name || acct.email;

    var av = document.createElement('span');
    av.className = 'gt-shell-nav__avatar';
    av.title = acct.email;
    av.textContent = initials(acct.name, acct.email);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gt-shell-nav__logout';
    btn.textContent = 'Logout';
    btn.addEventListener('click', function () {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      window.location.reload();
    });

    slot.appendChild(name);
    slot.appendChild(av);
    slot.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
