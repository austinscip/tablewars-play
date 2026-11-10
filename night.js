/* G2 YOUR NIGHT, the shared card (night.html?n=<id>): what SHARE on MY CARD links to. Anyone with the link sees this one
   night's numbers and the player's nickname; nothing else, never another player's record. Asks tw_night_phone
   ('shared' {id}, no token) with the public anon key; draws card.js's nightCard (the same rows as MY CARD). */
(() => {
  const CFG = window.TW_PLAYER_SITE || {};
  const app = document.getElementById('app');
  const L = window.TWLanding;
  const id = String(new URLSearchParams(location.search).get('n') || '').toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 32);
  const BUG = '<div class="bug"><b><i>TABLE WARS</i></b><span><i>A NIGHT</i></span></div>';
  const off = (title, text) => {
    app.innerHTML = `${BUG}<div class="board"><div class="rbtitle">${L.esc(title)}</div><p class="empty">${L.esc(text)}</p></div>`;
    app.dataset.screen = 'off';
    window.__night = { screen: 'off', title };
  };
  (async () => {
    if (!/^https?:\/\//.test(String(CFG.supabaseUrl || '')) || !CFG.anonKey || /YOUR-/.test(`${CFG.supabaseUrl}${CFG.anonKey}`)) {
      off('NOT SET UP YET', 'This page needs its cloud address.'); return;
    }
    if (id.length !== 32) { off("THAT LINK ISN'T RIGHT", 'Ask for the link again.'); return; }
    const url = String(CFG.supabaseUrl).replace(/\/+$/, '');
    let r, j = {};
    try {
      r = await fetch(`${url}/rest/v1/rpc/tw_night_phone`, { method: 'POST', cache: 'no-store',
        headers: { apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: null, p_action: 'shared', p_args: { id } }) });
      j = await r.json().catch(() => ({}));
    } catch { off("CAN'T REACH TABLE WARS", "Check your phone's internet, then open the link again."); return; }
    if (!r.ok) { off('THAT NIGHT ISN\'T SHARED', 'Ask for the link again.'); return; }
    const d = j.doc || {};
    app.innerHTML = `${BUG}${window.TWCard.nightCard(d, j.venue, String(j.nickname || '').toUpperCase())}
      <p class="line dim">Played on Table Wars. Numbers only.</p>`;
    app.dataset.screen = 'night';
    document.title = `${String(j.nickname || '').toUpperCase()} · ${d.day || ''} · Table Wars`;
    window.__night = { screen: 'night', nickname: j.nickname, doc: d };
  })();
})();
