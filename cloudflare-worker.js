// =============================================
// WebReview — Cloudflare Worker Proxy
// =============================================
// INSTRUCTIONS:
// 1. Go to https://dash.cloudflare.com/
// 2. Click "Workers & Pages" in the sidebar
// 3. Click "Create" → "Create Worker"
// 4. Name it "webreview-proxy" (or whatever you want)
// 5. Click "Deploy" to create it
// 6. Click "Edit Code" and paste this entire file
// 7. Click "Deploy" again
// 8. Your proxy URL will be: https://webreview-proxy.<your-subdomain>.workers.dev
// 9. Paste that URL in WebReview Settings → Proxy URL
// =============================================

const ALLOWED_ORIGINS = [
  'https://hparra07.github.io',
  'http://localhost:8090',
  'http://localhost:3000',
  'http://localhost:5500'
];

const ELEMENT_PICKER_SCRIPT = `
<script data-webreview-injected="true">
(function() {
  if (window.__webreviewInjected) return;
  window.__webreviewInjected = true;

  let highlight = null;
  let enabled = false;
  let selectedEl = null;

  function createHighlight() {
    const el = document.createElement('div');
    el.id = '__webreview-highlight';
    el.style.cssText = 'position:fixed;pointer-events:none;z-index:999999;border:2px solid #6366f1;background:rgba(99,102,241,0.08);transition:all 0.1s ease;display:none;border-radius:3px;';
    const label = document.createElement('div');
    label.id = '__webreview-label';
    label.style.cssText = 'position:absolute;top:-22px;left:0;background:#6366f1;color:white;font-size:11px;padding:2px 8px;border-radius:3px;font-family:-apple-system,sans-serif;white-space:nowrap;pointer-events:none;';
    el.appendChild(label);
    document.body.appendChild(el);
    return el;
  }

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    let tag = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\\s+/).filter(c => !c.startsWith('__webreview')).slice(0, 2).join('.');
      if (cls) return tag + '.' + cls;
    }
    return tag;
  }

  document.addEventListener('mousemove', function(e) {
    if (!enabled) return;
    const target = e.target;
    if (!target || target.id === '__webreview-highlight' || target.id === '__webreview-label') return;
    if (target.hasAttribute && target.hasAttribute('data-webreview-injected')) return;

    if (!highlight) highlight = createHighlight();
    const rect = target.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.left = rect.left + 'px';
    highlight.style.top = rect.top + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
    highlight.querySelector('#__webreview-label').textContent = getSelector(target) + ' (' + Math.round(rect.width) + 'x' + Math.round(rect.height) + ')';
    selectedEl = target;
  }, true);

  document.addEventListener('click', function(e) {
    if (!enabled || !selectedEl) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = selectedEl.getBoundingClientRect();
    const data = {
      type: 'webreview-element-selected',
      selector: getSelector(selectedEl),
      tag: selectedEl.tagName.toLowerCase(),
      text: (selectedEl.textContent || '').trim().substring(0, 100),
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    };
    window.parent.postMessage(data, '*');
  }, true);

  window.addEventListener('message', function(e) {
    if (e.data === 'webreview-enable-picker') {
      enabled = true;
      document.body.style.cursor = 'crosshair';
    } else if (e.data === 'webreview-disable-picker') {
      enabled = false;
      document.body.style.cursor = '';
      if (highlight) highlight.style.display = 'none';
    }
  });

  // Interceptar navegación: los links deben seguir pasando por el proxy
  var PROXY_ORIGIN = window.location.origin;
  var TARGET_ORIGIN = document.querySelector('base') ? new URL(document.querySelector('base').href).origin : '';

  function toProxyUrl(href) {
    try {
      var abs = new URL(href, TARGET_ORIGIN || undefined);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
      return PROXY_ORIGIN + '/?url=' + encodeURIComponent(abs.href);
    } catch (err) { return null; }
  }

  document.addEventListener('click', function(e) {
    if (enabled) return; // en modo picker el otro handler se encarga
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    var proxied = toProxyUrl(a.href);
    if (!proxied) return;
    e.preventDefault();
    e.stopPropagation();
    window.parent.postMessage({ type: 'webreview-navigating', url: a.href }, '*');
    window.location.href = proxied;
  }, true);

  // Interceptar submits de formularios GET (búsquedas, etc.)
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form || (form.method || 'get').toLowerCase() !== 'get') return;
    var action = form.getAttribute('action') || TARGET_ORIGIN;
    try {
      var abs = new URL(action, TARGET_ORIGIN || undefined);
      var params = new URLSearchParams(new FormData(form));
      abs.search = params.toString();
      var proxied = toProxyUrl(abs.href);
      if (!proxied) return;
      e.preventDefault();
      window.location.href = proxied;
    } catch (err) {}
  }, true);

  var currentTargetUrl = new URLSearchParams(window.location.search).get('url') || '';
  window.parent.postMessage({ type: 'webreview-proxy-ready', url: currentTargetUrl }, '*');
})();
</script>
`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(origin)
      });
    }

    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'webreview-proxy',
        usage: 'Add ?url=https://example.com to proxy a site'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
      });
    }

    try {
      const target = new URL(targetUrl);

      const headers = new Headers();
      headers.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0');
      headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
      headers.set('Accept-Language', 'en-US,en;q=0.5');

      const response = await fetch(target.href, {
        headers,
        redirect: 'follow'
      });

      const contentType = response.headers.get('Content-Type') || '';

      if (contentType.includes('text/html')) {
        let html = await response.text();

        html = html.replace(/<base\s[^>]*>/gi, '');

        const baseTag = `<base href="${target.origin}${target.pathname.replace(/\/[^/]*$/, '/')}">`;

        if (html.includes('<head>')) {
          html = html.replace('<head>', '<head>' + baseTag);
        } else if (html.includes('<HEAD>')) {
          html = html.replace('<HEAD>', '<HEAD>' + baseTag);
        } else {
          html = baseTag + html;
        }

        html = html.replace('</body>', ELEMENT_PICKER_SCRIPT + '</body>');

        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
        responseHeaders.set('Access-Control-Allow-Origin', origin || '*');
        responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        responseHeaders.set('Cache-Control', 'no-cache');

        return new Response(html, {
          status: response.status,
          headers: responseHeaders
        });
      }

      const responseHeaders = new Headers();
      responseHeaders.set('Content-Type', contentType);
      responseHeaders.set('Access-Control-Allow-Origin', origin || '*');
      responseHeaders.set('Cache-Control', 'public, max-age=86400');

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
      });
    }
  }
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}
