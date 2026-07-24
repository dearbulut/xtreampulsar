// Auto-generated embeddable widget loader (Shadow DOM). Served raw at /api/v1/public/widgets/embed.js
export const WIDGET_EMBED_JS = `(function(){
  var s = document.currentScript;
  if(!s){ return; }
  var key = s.getAttribute('data-key');
  if(!key){ if(window.console){ console.error('[XP Widget] data-key missing'); } return; }
  var origin;
  try { origin = new URL(s.getAttribute('src'), location.href).origin; } catch(e){ origin = location.origin; }
  var api = origin + '/api/v1/public/widgets/' + encodeURIComponent(key);
  var host = document.createElement('div');
  host.setAttribute('data-xp-widget', key);
  s.parentNode.insertBefore(host, s.nextSibling);
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var accent = '#6d28d9';

  function deviceFp(){
    try {
      var parts = [navigator.userAgent, navigator.language, navigator.platform, screen.width + 'x' + screen.height, screen.colorDepth, new Date().getTimezoneOffset(), (navigator.hardwareConcurrency || 0)];
      try {
        var cv = document.createElement('canvas'); var cx = cv.getContext('2d');
        cx.textBaseline = 'top'; cx.font = '14px Arial'; cx.fillStyle = '#f60'; cx.fillRect(0,0,60,20);
        cx.fillStyle = '#069'; cx.fillText('xp-fp', 2, 2);
        parts.push(cv.toDataURL().slice(-64));
      } catch(e){}
      var str = parts.join('|'); var h = 5381;
      for (var i=0;i<str.length;i++){ h = (((h<<5)+h) ^ str.charCodeAt(i)) >>> 0; }
      return 'd' + h.toString(16) + str.length.toString(16);
    } catch(e){ return ''; }
  }
  var fp = deviceFp();

  function esc(v){ v = (v==null?'':String(v)); return v.replace(/[&<>"]/g, function(c){ return c=='&'?'&amp;':c=='<'?'&lt;':c=='>'?'&gt;':'&quot;'; }); }
  function css(a){ return '<style>'
    + '.w{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:380px;border:1px solid #e5e7eb;border-radius:16px;padding:20px;background:#fff;color:#111;box-shadow:0 6px 24px rgba(0,0,0,.08)}'
    + '.w *{box-sizing:border-box}'
    + '.w h3{margin:0 0 4px;font-size:18px}'
    + '.w .sub{margin:0 0 14px;color:#6b7280;font-size:13px}'
    + '.w label{display:block;font-size:12px;color:#374151;margin:10px 0 4px;font-weight:600}'
    + '.w input,.w select{width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:14px}'
    + '.w input:focus,.w select:focus{outline:none;border-color:' + a + '}'
    + '.w button{width:100%;margin-top:16px;padding:12px;border:0;border-radius:10px;background:' + a + ';color:#fff;font-size:15px;font-weight:600;cursor:pointer}'
    + '.w button:disabled{opacity:.6}'
    + '.w .ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;padding:12px;border-radius:10px;font-size:13px;margin-top:12px;word-break:break-all}'
    + '.w .er{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:10px;border-radius:10px;font-size:13px;margin-top:12px}'
    + '.w .cr{font-family:ui-monospace,monospace;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px;margin-top:6px;font-size:13px}'
    + '.w .pw{font-size:10px;text-align:center;color:#9ca3af;margin-top:12px}'
    + '</style>'; }
  function paint(inner){ root.innerHTML = css(accent) + '<div class="w">' + inner + '</div>'; }
  function q(sel){ return root.querySelector(sel); }

  function post(payload, done){
    if(!payload.deviceId){ payload.deviceId = fp; }
    var b = [];
    for (var k in payload){ if(payload.hasOwnProperty(k)){ b.push(encodeURIComponent(k) + '=' + encodeURIComponent(payload[k]==null?'':payload[k])); } }
    fetch(api + '/submit', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: b.join('&') })
      .then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
      .then(function(x){ var d = x.j && x.j.data ? x.j.data : x.j; done(x.ok && (!x.j || x.j.success !== false), d, x.j); })
      .catch(function(){ done(false, { message: 'Network error' }, null); });
  }

  function poweredBy(){ return '<div class="pw">Powered by XtreamPulsar</div>'; }

  function trialForm(cfg){
    var title = cfg.title || 'Free trial';
    paint('<h3>' + esc(title) + '</h3>' + (cfg.subtitle ? '<div class="sub">' + esc(cfg.subtitle) + '</div>' : '')
      + '<label>Email (optional)</label><input id="em" type="email" placeholder="you@example.com"/>'
      + '<button id="go">Get trial</button><div id="msg"></div>' + poweredBy());
    q('#go').onclick = function(){
      var btn = q('#go'); btn.disabled = true; btn.textContent = 'Please wait...';
      post({ email: q('#em').value }, function(ok, d, raw){
        btn.disabled = false; btn.textContent = 'Get trial';
        if(ok){
          q('#msg').innerHTML = '<div class="ok">' + esc(d.message || 'Your trial is ready.')
            + '<div class="cr">Username: ' + esc(d.username) + '<br/>Password: ' + esc(d.password) + '</div>'
            + (d.m3uUrl ? '<div class="cr">' + esc(d.m3uUrl) + '</div>' : '') + '</div>';
        } else {
          q('#msg').innerHTML = '<div class="er">' + esc((raw && raw.message) || (d && d.message) || 'Failed') + '</div>';
        }
      });
    };
  }

  function pkgOptions(cfg){
    var o = '';
    (cfg.packages||[]).forEach(function(p){
      o += '<option value="' + esc(p.id) + '">' + esc(p.name) + (p.price ? ' - ' + esc(p.price) : '') + '</option>';
    });
    return o;
  }

  function storeForm(cfg, renew){
    var title = cfg.title || (renew ? 'Renew subscription' : 'Buy subscription');
    paint('<h3>' + esc(title) + '</h3>' + (cfg.subtitle ? '<div class="sub">' + esc(cfg.subtitle) + '</div>' : '')
      + '<label>Package</label><select id="pk">' + pkgOptions(cfg) + '</select>'
      + (renew ? '<label>Your username</label><input id="un" placeholder="username"/>' : '')
      + '<label>Email</label><input id="em" type="email" placeholder="you@example.com"/>'
      + '<button id="go">' + (renew ? 'Request renewal' : 'Place order') + '</button><div id="msg"></div>' + poweredBy());
    q('#go').onclick = function(){
      var btn = q('#go'); btn.disabled = true;
      var payload = { packageId: q('#pk').value, email: q('#em').value };
      if(renew && q('#un')){ payload.username = q('#un').value; }
      post(payload, function(ok, d, raw){
        btn.disabled = false;
        if(ok){
          q('#msg').innerHTML = '<div class="ok">' + esc(d.message || 'Order received. We will contact you shortly.') + '</div>';
          if(d.redirectUrl){ setTimeout(function(){ location.href = d.redirectUrl; }, 1500); }
        } else {
          q('#msg').innerHTML = '<div class="er">' + esc((raw && raw.message) || 'Failed') + '</div>';
        }
      });
    };
  }

  paint('<div class="sub">Loading...</div>');
  fetch(api).then(function(r){ return r.json(); }).then(function(res){
    var cfg = res && res.data ? res.data : res;
    if(!cfg || cfg.enabled === false){ paint('<div class="er">Widget unavailable.</div>'); return; }
    if(cfg.accentColor){ accent = cfg.accentColor; }
    if(cfg.type === 'TRIAL'){ trialForm(cfg); }
    else if(cfg.type === 'RENEWAL'){ storeForm(cfg, true); }
    else { storeForm(cfg, false); }
  }).catch(function(){ paint('<div class="er">Could not load widget.</div>'); });
})();`;
