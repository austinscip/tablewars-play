/* G3 THE CITY LADDER on the player site (city.html). Phone-first, the site's own look (the boards and rows of MY CARD).
   No ?c: the cities with 3 or more Table Wars venues. ?c=<key>: that city's ladder for THIS MONTH or LAST MONTH: every
   venue of the city, its online wins against the other venues of the same city, its losses (the tie rule: fewer
   losses, then the venue that got to its count first). ?v=<venue> lights that venue. Asks tw_lad_phone (no token) with
   the public anon key. The month is the city's own (the cloud's answer). */
(() => {
  const CFG = window.TW_PLAYER_SITE || {};
  const app = document.getElementById('app');
  const L = window.TWLanding;
  const q = new URLSearchParams(location.search);
  const city = String(q.get('c') || '').slice(0, 80);
  const lit = String(q.get('v') || '').slice(0, 64);
  const BUG = '<div class="bug"><b><i>TABLE WARS</i></b><span><i>CITY LADDER</i></span></div>';
  const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const esc = (s) => L.esc(String(s ?? ''));
  const off = (title, text) => {
    app.innerHTML = `${BUG}<div class="board"><div class="rbtitle">${esc(title)}</div><p class="empty">${esc(text)}</p></div>`;
    app.dataset.screen = 'off';
    window.__city = { screen: 'off', title };
  };
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  let which = 'this';
  async function ask(action, args) {
    const url = String(CFG.supabaseUrl).replace(/\/+$/, '');
    const r = await fetch(`${url}/rest/v1/rpc/tw_lad_phone`, { method: 'POST', cache: 'no-store',
      headers: { apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_action: action, p_args: args || {} }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || 'refused');
    return j;
  }
  async function cities() {
    const j = await ask('cities');
    const rows = (j.cities || []).map((c) => `<a class="row" href="city.html?c=${encodeURIComponent(c.key)}"><span><b>${esc(c.city)}</b><small>${esc(c.state)} · ${c.venues} venues</small></span><span class="w">›</span></a>`).join('');
    app.innerHTML = `${BUG}<div class="board" id="cities"><div class="rbtitle">CITY LADDERS</div>${rows || '<p class="empty">No city has 3 Table Wars venues yet.</p>'}</div>
      <p class="line dim">Each city ranks its venues by online wins against each other this month.</p>`;
    app.dataset.screen = 'cities';
    window.__city = { screen: 'cities', n: (j.cities || []).length };
  }
  async function ladder() {
    const now = new Date();
    const m = which === 'this' ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const j = await ask('ladder', { city, month: ymd(m) });
    const month = MONTHS[Number(String(j.month || ymd(m)).slice(5, 7)) - 1] || '';
    const tabs = `<div class="months"><button class="tlink" data-m="this">THIS MONTH</button><button class="tlink" data-m="last">LAST MONTH</button></div>`;
    const town = String(j.city || '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
    if (!Array.isArray(j.standings)) {
      app.innerHTML = `${BUG}<div class="board"><div class="rbtitle">${esc(j.city || 'THIS CITY')}</div><p class="empty">A city ladder starts when a city has 3 Table Wars venues.</p></div>`;
      app.dataset.screen = 'nocity';
      window.__city = { screen: 'nocity' };
      return;
    }
    const rows = j.standings.map((s, i) => `<div class="row${s.loc === lit ? ' lit' : ''}"><span class="pl">${i + 1}</span><span><b>${esc(s.name)}</b><small>${s.losses} ${s.losses === 1 ? 'loss' : 'losses'} against ${esc(town)} venues</small></span><span class="w">${s.wins} ${s.wins === 1 ? 'WIN' : 'WINS'}</span></div>`).join('');
    const done = which === 'last' && j.standings[0] && j.standings[0].wins > 0 ? `<p class="line"><b>${esc(j.standings[0].name)}</b> won ${esc(month)}.</p>` : '';
    app.innerHTML = `${BUG}<div class="board" id="ladder"><div class="rbtitle">${esc(j.city)} · ${esc(month)}</div>${tabs}${rows}</div>${done}
      <p class="line dim">Online wins against other ${esc(town)} venues. A tie goes to fewer losses, then to whoever got there first.</p>`;
    app.querySelectorAll('[data-m]').forEach((b) => { b.style.opacity = b.dataset.m === which ? '1' : '.55'; b.addEventListener('click', () => { which = b.dataset.m; run(); }); });
    app.dataset.screen = 'ladder';
    window.__city = { screen: 'ladder', city: j.city, month, rows: j.standings.length, which };
  }
  async function run() {
    if (!/^https?:\/\//.test(String(CFG.supabaseUrl || '')) || !CFG.anonKey || /YOUR-/.test(`${CFG.supabaseUrl}${CFG.anonKey}`)) {
      off('NOT SET UP YET', 'This page needs its cloud address.'); return;
    }
    try { if (city) await ladder(); else await cities(); } catch { off("CAN'T REACH TABLE WARS", "Check your phone's internet, then open the page again."); }
  }
  run();
})();
