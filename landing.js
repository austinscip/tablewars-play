/* THE SEAT LANDING (W44b, docs/ux/journey/PLAN.md step 3 + edge cases E1 E2 E4 E12 E13; mockups
   docs/ux/journey/mock/phone.html). What a seat card's QR opens: the venue page (/me?table=N&seat=S) and the
   player site (<site>/s/<CODE>?seat=S) draw the SAME screens from this one file (the player site keeps a copy,
   pinned byte for byte by tests/test_seat_landing.py). Pure: data in, HTML out; each page wires its own buttons.

   Every screen: one primary at most, the rest secondary (outlined or a link), the whole screen fits a 390 x 844
   phone. No player code (removed at launch, E3). Never "bar" on screen.

   c = { venue, table, seat, color, nick, other (the seat's nickname, E2), elsewhere ({table, color, venue} E13),
         known ([{nick}] the other profiles this phone knows, E4), gem (the gem picture's address), armed, msg,
         card (true: the page has MY CARD), backTo (BACK's screen), guest (make: the guest way is there) } */
(() => {
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const SEAT_N = { BLUE: 1, PINK: 2, GOLD: 3, GREEN: 4, PURPLE: 5, ORANGE: 6, CYAN: 7, RED: 8 };
  // KELLY'S CORNER POCKET -> Kelly's Corner Pocket; BLUE -> Blue
  const tc = (v) => String(v || '').toLowerCase().replace(/(^|[\s\-&.])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const word = (v) => String(v || '').charAt(0) + String(v || '').slice(1).toLowerCase();
  const n = (c) => SEAT_N[c.color] || c.seat || 1;
  const cvar = (c) => (n(c) <= 4 ? `var(--p${n(c)})` : ['#a855f7', '#f97316', '#06b6d4', '#ef4444'][n(c) - 5]);
  const gem = (c) => `<img src="${esc(c.gem)}" alt="">`;
  const bug = (b) => `<div class="bug"><b><i>TABLE WARS</i></b><span><i>${esc(b)}</i></span></div>`;
  const where = (c, withSeat = true) => `<div class="where"><span>${esc(tc(c.venue))}${c.table ? ` &middot; <em>Table ${esc(c.table)}${withSeat && c.color ? ` &middot; ${esc(word(c.color))}` : ''}</em>` : ''}</span></div>`;
  const back = (to) => `<div class="backrow"><button class="btn sm" data-go="${esc(to)}">&#9664; BACK</button></div>`;
  const msg = (c) => `<p class="msg${c.msg && c.msg.ok ? ' ok' : ''}" role="status">${c.msg ? esc(c.msg.text) : ''}</p>`;
  const vcard = (c, small, name) => `<div class="vcard" style="--c:${cvar(c)}"><i></i><div><small>${esc(small)}</small><b id="ini">${esc(name)}</b></div></div>`;
  const seatSquare = (c) => `<div class="seatbig"><div class="seat s${n(c)}" aria-hidden="true"><div class="puck"></div><div class="pn">P${esc(c.seat)}</div><div class="name">${esc(c.color)}</div></div></div>`;
  const seatWords = (c) => `${word(c.color)} seat, P${c.seat}`;

  const S = {};

  // 3a THIS PHONE KNOWS YOU: one big PLAY; "Not NICK?" small (E13: signed in somewhere else, PLAY moves you here)
  S.known = (c) => `${bug(`${c.color} SEAT`)}${where(c)}
    ${vcard(c, seatWords(c), c.nick)}
    <div class="hl metal" id="lh">PLAY AS ${esc(c.nick)}?</div>
    <p class="line" id="ll">${c.elsewhere
      ? `You are signed in at ${c.elsewhere.venue && c.elsewhere.venue !== c.venue ? `${esc(tc(c.elsewhere.venue))}, ` : ''}table ${esc(c.elsewhere.table)}, ${esc(String(c.elsewhere.color || '').toLowerCase())}. PLAY moves you here.`
      : `Your ${esc(String(c.color).toLowerCase())} card on the TV turns into <b>${esc(c.nick)}</b>.`}</p>
    ${msg(c)}
    <div class="btns"><button class="btn primary" id="lPlay">${gem(c)} PLAY</button></div>
    <button class="tap" data-go="notme" id="lNotMe">Not ${esc(word(c.nick))}?</button>`;

  // 3b/3c NEW ON THIS PHONE: MAKE A PROFILE (primary) or PLAY AS A GUEST (secondary). No player code (E3).
  S.fresh = (c) => `${bug(`${c.color} SEAT`)}${where(c)}
    ${seatSquare(c)}
    <div class="hl metal" id="lh">YOU&rsquo;RE ${esc(c.color)}</div>
    <p class="line" id="ll">A profile keeps your name, ranks and records.</p>
    ${msg(c)}
    <div class="btns"><button class="btn primary" data-go="make" id="lMake">${gem(c)} MAKE A PROFILE</button><button class="btn" id="lGuest">PLAY AS A GUEST</button></div>`;

  // E4 NOT NICK?: ask, never make a profile by itself. The other profiles this phone knows come back with one tap.
  S.notme = (c) => `${back(c.backTo || 'seat')}${where(c)}
    <div class="hl metal" id="lh">WHO&rsquo;S PLAYING?</div>
    <p class="line" id="ll">This phone knows <b>${esc(c.nick)}</b>. Make a new profile${c.color ? ', or play as a guest' : ''}?</p>
    ${msg(c)}
    <div class="btns"><button class="btn primary" data-go="make" id="lMakeNew">${gem(c)} MAKE A NEW PROFILE</button>${
      (c.known || []).map((k, i) => `<button class="btn" data-switch="${i}">PLAY AS ${esc(k.nick)}</button>`).join('')
    }${c.color ? '<button class="btn" id="lGuest">PLAY AS A GUEST</button>' : ''}</div>`;

  // 3b MAKE A PROFILE: nickname + 13 or older. Unticked: MAKE stays off and the guest way shows (E12).
  // c.color = the seat it signs in at (a seat QR or a tapped colour); c.guest = the guest way is there (a seat QR)
  S.make = (c) => `${c.backTo ? back(c.backTo) : ''}${where(c)}
    <div class="hl metal">MAKE YOUR PROFILE</div>
    <div class="field" style="--c:${c.color ? cvar(c) : 'var(--brass)'}">
      <div class="qh"><b>NICKNAME</b><span id="mk_n">0/10</span></div>
      <input class="typed" id="mk_ini" maxlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Your nickname" placeholder="YOUR NAME">
      <div class="rule" id="mk_rule">3 to 10 letters or numbers.</div>
    </div>
    <label class="tick"><input type="checkbox" id="mk_age"><i id="mk_box" aria-hidden="true"></i><span><b class="s">I am 13 or older</b></span></label>
    <p class="msg" id="mk_err" role="status"></p>
    <button class="btn primary" id="mk_go" disabled>${gem(c)} MAKE MY PROFILE</button>
    <div class="young" id="mk_young">${c.guest
      ? '<p class="line dim">You can still play as a guest.</p><button class="btn" id="lGuest">PLAY AS A GUEST</button>'
      : '<p class="line dim">Under 13? You can still play as your colour.</p>'}</div>
    <p class="line dim" id="mk_keep">We keep your nickname and your games. Never your real name, email or phone.</p>`;

  // AFTER PLAY or MAKE: you're in. No rank before a game is picked (Austin 2026-11-02, decision 2).
  S.in = (c) => `${bug(c.table ? `TABLE ${c.table}` : 'SIGN IN')}${where(c)}
    ${vcard(c, seatWords(c), c.nick)}
    <div class="hl metal" id="lh">YOU&rsquo;RE IN</div>
    <p class="line" id="ll">You&rsquo;re in as <b>${esc(c.nick)}</b>. Look at the TV: the ${esc(String(c.color).toLowerCase())} card says ${esc(c.nick)}. Play with your puck.</p>
    ${msg(c)}
    ${c.card ? '<div class="btns"><button class="btn" data-go="card" id="lCard">MY CARD</button></div>' : ''}
    <button class="tap${c.armed ? ' armed' : ''}" id="lLeave">${c.armed ? 'Tap again to leave the seat' : 'Leave the seat'}</button>`;

  // 3c A GUEST: the seat stays its colour; nothing is saved
  S.guest = (c) => `${bug(`${c.color} SEAT`)}${where(c)}
    ${seatSquare(c)}
    <div class="hl metal" id="lh">YOU&rsquo;RE PLAYING AS ${esc(c.color)}</div>
    <p class="line" id="ll">Play with your puck. Nothing is saved.</p>
    <button class="tap" data-go="seat" id="lUndoGuest">Make a profile instead</button>`;

  // E1 AN OLD QR / A SEAT NOBODY HOLDS
  S.stale = (c) => `${bug(c.table ? `TABLE ${c.table}` : 'SIGN IN')}${where(c, false)}
    <div class="hl metal" id="lh">THAT SEAT ISN&rsquo;T PLAYING</div>
    <p class="line" id="ll">That seat isn&rsquo;t playing right now. Hold your puck to join. Then scan your seat card on the TV.</p>
    ${msg(c)}
    <div class="btns"><button class="btn primary" id="lRetry">${gem(c)} TRY AGAIN</button></div>`;

  // E2 SOMEONE SCANNED FIRST
  S.taken = (c) => `${bug(`${c.color} SEAT`)}${where(c)}
    <div class="hl metal" id="lh">THIS SEAT IS TAKEN</div>
    ${vcard(c, seatWords(c), c.other)}
    <p class="line" id="ll">This seat is ${esc(c.color)}: ${esc(c.other)}. Hold another puck to join.</p>
    ${msg(c)}
    <div class="btns"><button class="btn primary" id="lRetry">${gem(c)} TRY AGAIN</button></div>`;

  // a link with no seat (the old table QR on the player site): tap your colour
  S.tap = (c) => `${bug('SIGN IN')}${where(c, false)}
    <div class="hl metal">TAP YOUR COLOUR</div>
    <div class="seats" id="sitSeats">${(c.seats || []).map((s) => `<button class="seat s${SEAT_N[s.color] || s.seat}${s.nickname ? ' taken' : ''}" data-seat="${esc(s.seat)}"${s.nickname ? ' disabled' : ''}>` +
      `<div class="puck"></div><div class="pn">P${esc(s.seat)}</div><div class="name">${esc(s.nickname || s.color)}</div></button>`).join('')}</div>
    ${msg(c)}`;

  // PROFILES ARE OFF (family mode, staff switch: E10) / the page can't reach the cloud
  S.off = (c) => `${bug('SIGN IN')}<div class="hl metal" id="lh">${esc(c.title || 'NO PROFILES TONIGHT')}</div><p class="line" id="ll">${esc(c.text || 'Play with your puck. Every game still shows on the TV.')}</p>`;

  // the make screen's live checks (both pages): the nickname rule and MAKE MY PROFILE on only with 13+ ticked
  function wireMake(doc) {
    const $ = (id) => doc.getElementById(id);
    const inp = $('mk_ini'), box = $('mk_box'), tick = $('mk_age');
    if (!inp) return;
    const ok = (v) => /^[A-Z0-9](?:[A-Z0-9]|[ -](?=[A-Z0-9])){2,9}$/.test(v);
    const upd = () => {
      const v = inp.value.toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 10);
      if (v !== inp.value) inp.value = v;
      $('mk_n').textContent = `${v.trim().length}/10`;
      const good = ok(v.trim());
      $('mk_rule').textContent = good ? 'Looks good. You can change it later.' : '3 to 10 letters or numbers.';
      $('mk_rule').classList.toggle('ok', good);
      $('mk_go').disabled = !tick.checked;
      $('mk_young').hidden = tick.checked;
      box.classList.toggle('on', tick.checked); box.textContent = tick.checked ? '✓' : '';
    };
    inp.addEventListener('input', upd);
    tick.addEventListener('change', upd);
    upd();
  }

  window.TWLanding = { screens: S, wireMake, esc, tc, word, SEAT_N };
})();
