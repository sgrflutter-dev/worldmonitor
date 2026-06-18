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

  // Enable the shared shell styling on EVERY page that loads this script (the
  // dashboard's main.ts sets this, but the settings/live-channels subpages use
  // different entry scripts — without it the gt nav + ticker stay unstyled).
  document.documentElement.setAttribute('data-gt-shell', '');

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

// --- Shared market ticker (Good Thoughts shell) ------------------------------
(function(){
      var scroll=document.getElementById('gtTickerScroll'),dot=document.getElementById('gtTickerDot'),liveEl=document.getElementById('gtTickerLive'),band=document.getElementById('gtTicker');
      if(!scroll||!band)return;
      function mktOpen(){var n=new Date();var ist=n.getUTCHours()*60+n.getUTCMinutes()+330;var day=(n.getUTCDay()+Math.floor(ist/1440))%7;var m=((ist%1440)+1440)%1440;if(day===0||day===6)return false;return m>=555&&m<=930;}
      function fmt(it){var pos=(it.change_percent==null?0:it.change_percent)>=0;var price=it.price!=null?Number(it.price).toLocaleString('en-IN',{maximumFractionDigits:2}):'-';var pct=it.change_percent!=null?((it.change_percent>0?'+':'')+Number(it.change_percent).toFixed(2)+'%'):'';var sym=(it.symbol&&it.symbol.charAt(0)==='^')?it.name:it.symbol;var h='<span class="gt-ticker__item"><span class="gt-ticker__sym">'+sym+'</span><span class="gt-ticker__price">'+price+'</span>';if(pct)h+='<span class="'+(pos?'gt-ticker__pos':'gt-ticker__neg')+'">'+(pos?'▲':'▼')+' '+pct+'</span>';return h+'</span>';}
      function render(items){if(!items.length){band.style.display='none';return;}band.style.display='block';var d=items.concat(items);scroll.innerHTML=d.map(fmt).join('');scroll.style.animation='gtTickerScroll '+Math.max(30,items.length*3.5)+'s linear infinite';var live=mktOpen();dot.style.background=live?'#22c55e':'#ef4444';liveEl.textContent=live?'LIVE':'CLOSED';}
      function load(){fetch('/api/v1/market/ticker').then(function(r){return r.ok?r.json():null;}).then(function(d){if(!d)return;render([].concat(d.indices||[],d.stocks||[]));}).catch(function(){});}
      load();setInterval(load,10000);
    })();
