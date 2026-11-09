/* THE SEAT LANDING (W44b, docs/ux/journey/PLAN.md step 3 + edge cases E1 E2 E4 E12 E13; mockups
   docs/ux/journey/mock/phone.html). What a seat card's QR opens: the venue page (/me?table=N&seat=S) and the
   player site (<site>/s/<CODE>?seat=S) draw the SAME screens from this one file (the player site keeps a copy,
   pinned byte for byte by tests/test_seat_landing.py). Pure: data in, HTML out; each page wires its own buttons.

   Every screen: one primary at most, the rest secondary (outlined or a link), the whole screen fits a 390 x 844
   phone. No player code (removed at launch, E3). Never "bar" on screen.

   c = { venue, table, seat, color, nick, other (the seat's nickname, E2), elsewhere ({table, color, venue} E13),
         known ([{nick}] the other profiles this phone knows, E4), gem (the gem picture's address), armed, msg,
         card (true: the page has MY CARD), backTo (BACK's screen), guest (make: the guest way is there),
         tag (W46 the name tag #27, shown next to the name on the phone), email (W46: the email sign-in is on) }

   W46 "I ALREADY HAVE A PROFILE" (email code): the screens email / code / nomail / hasmail, and EmailFlow, the one
   controller both pages use (the page hands it send + verify; it keeps the email, the 30 s RESEND wait, the 3 tries
   and tells a wrong code from an expired one by the time since SEND, since Supabase answers both the same). */
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
  const tagged = (name, tag) => `${esc(name)}${tag ? ` <em class="tag">#${esc(tag)}</em>` : ''}`;
  const vcard = (c, small, name) => `<div class="vcard" style="--c:${cvar(c)}"><i></i><div><small>${esc(small)}</small><b id="ini">${tagged(name, c.tag)}</b></div></div>`;
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
    <div class="btns"><button class="btn primary" data-go="make" id="lMake">${gem(c)} MAKE A PROFILE</button><button class="btn" id="lGuest">PLAY AS A GUEST</button></div>
    ${c.email ? '<button class="tap" id="lHave">I already have a profile</button>' : ''}`;

  // E4 NOT NICK?: ask, never make a profile by itself. The other profiles this phone knows come back with one tap.
  S.notme = (c) => `${back(c.backTo || 'seat')}${where(c)}
    <div class="hl metal" id="lh">WHO&rsquo;S PLAYING?</div>
    <p class="line" id="ll">This phone knows <b>${esc(c.nick)}</b>. Make a new profile${c.color ? ', or play as a guest' : ''}?</p>
    ${msg(c)}
    <div class="btns"><button class="btn primary" data-go="make" id="lMakeNew">${gem(c)} MAKE A NEW PROFILE</button>${
      (c.known || []).map((k, i) => `<button class="btn" data-switch="${i}">PLAY AS ${esc(k.nick)}</button>`).join('')
    }${c.color ? '<button class="btn" id="lGuest">PLAY AS A GUEST</button>' : ''}</div>
    ${c.email ? '<button class="tap" id="lHave">I already have a profile</button>' : ''}`;

  // 3b MAKE A PROFILE: nickname + 13 or older. Unticked: MAKE stays off and the guest way shows (E12).
  // c.color = the seat it signs in at (a seat QR or a tapped colour); c.guest = the guest way is there (a seat QR)
  S.make = (c) => `${c.backTo ? back(c.backTo) : ''}${where(c)}
    <div class="hl metal">MAKE YOUR PROFILE</div>
    <div class="field" style="--c:${c.color ? cvar(c) : 'var(--brass)'}">
      <div class="qh"><b>NICKNAME</b><span id="mk_n">0/10</span></div>
      <input class="typed" id="mk_ini" maxlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Your nickname" placeholder="YOUR NAME">
      <div class="rule" id="mk_rule">3 to 10 letters or numbers.</div>
    </div>
    ${c.email ? `<div class="field mail" style="--c:var(--brass)">
      <div class="qh"><b>EMAIL</b><small class="opt">optional</small></div>
      <input class="typed mail" id="mk_email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="160" aria-label="Your email (optional)" placeholder="you@example.com" value="${esc(c.mail || '')}"${c.mailLocked ? ' readonly' : ''}>
      <div class="rule">${c.mailLocked ? 'Checked. This email signs you in.' : 'So you can get back in on another phone.'}</div>
    </div>` : ''}
    <label class="tick"><input type="checkbox" id="mk_age"><i id="mk_box" aria-hidden="true"></i><span><b class="s">I am 13 or older</b></span></label>
    <p class="msg" id="mk_err" role="status"></p>
    <button class="btn primary" id="mk_go" disabled>${gem(c)} MAKE MY PROFILE</button>
    <div class="young" id="mk_young">${c.guest
      ? '<p class="line dim">You can still play as a guest.</p><button class="btn" id="lGuest">PLAY AS A GUEST</button>'
      : '<p class="line dim">Under 13? You can still play as your colour.</p>'}</div>
    <p class="line dim" id="mk_keep">${c.email ? 'We keep your nickname and your games. An email only signs you in.' : 'We keep your nickname and your games. Never your real name, email or phone.'}</p>`;

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

  // W46 I ALREADY HAVE A PROFILE (purpose signin) / MAKE with an email (make) / MY CARD's email (attach): the email
  S.email = (c) => `${back(c.backTo || 'seat')}${where(c)}
    <div class="hl metal" id="lh">${c.purpose === 'attach' ? (c.had ? 'CHANGE YOUR EMAIL' : 'ADD YOUR EMAIL') : 'I ALREADY HAVE A PROFILE'}</div>
    <p class="line" id="ll">${c.purpose === 'attach' ? 'So you can get back in on another phone. We send a 6-digit code to check it.' : 'Type the email on your profile. We send you a 6-digit code.'}</p>
    <div class="field mail" style="--c:var(--brass)">
      <div class="qh"><b>EMAIL</b></div>
      <input class="typed mail" id="em_in" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="160" aria-label="Your email" placeholder="you@example.com" value="${esc(c.mail || '')}">
    </div>
    ${msg(c)}
    <button class="btn primary" id="emSend">${gem(c)} SEND MY CODE</button>`;

  // W46 CHECK YOUR EMAIL: the 6 numbers; RESEND after 30 s; a different email; wrong (3 tries) / expired
  S.code = (c) => `${back(c.backTo || 'email')}${where(c)}
    <div class="hl metal" id="lh">CHECK YOUR EMAIL</div>
    <p class="line" id="ll">We sent a 6-digit code to <b>${esc(c.hint)}</b>.</p>
    <div class="field" style="--c:var(--brass)">
      <div class="qh"><b>CODE</b><small class="opt">6 numbers</small></div>
      <input class="typed code" id="cd_in" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" aria-label="The code from your email" placeholder="000000"${c.locked ? ' disabled' : ''}>
    </div>
    ${msg(c)}
    <button class="btn primary" id="cdGo"${c.locked ? ' disabled' : ''}>${gem(c)} ${esc(c.goWord || 'SIGN IN')}</button>
    <div class="btns"><button class="btn" id="cdResend"${c.wait > 0 ? ' disabled' : ''}>${c.wait > 0 ? `RESEND IN <span id="cdWait">${c.wait}</span> S` : 'RESEND'}</button></div>
    <button class="tap" id="cdOther">Use a different email</button>`;

  // W46 the email has no profile (sign in): make one with it, or another email
  S.nomail = (c) => `${back(c.backTo || 'email')}${where(c)}
    <div class="hl metal" id="lh">NO PROFILE YET</div>
    <p class="line" id="ll">No profile with <b>${esc(c.hint)}</b>. Make one?</p>
    ${msg(c)}
    <div class="btns"><button class="btn primary" id="nmMake">${gem(c)} MAKE A PROFILE</button><button class="btn" id="cdOther">USE A DIFFERENT EMAIL</button></div>`;

  // W46 the email already has a profile (make with an email): sign in instead, or make it without the email
  S.hasmail = (c) => `${back(c.backTo || 'make')}${where(c)}
    <div class="hl metal" id="lh">YOU HAVE A PROFILE</div>
    <p class="line" id="ll">That email already has a profile: <b>${tagged(c.found && c.found.nickname, c.found && c.found.tag)}</b>. Sign in instead?</p>
    ${msg(c)}
    <div class="btns"><button class="btn primary" id="hmSignin">${gem(c)} SIGN IN AS ${esc(c.found && c.found.nickname)}</button><button class="btn" id="hmNoMail">MAKE IT WITHOUT AN EMAIL</button></div>`;

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

  // W46 the email code's state (one per page). io = { send(email), verify(email, code) -> {session, profile} };
  // errors carry .why: offline | rate | bad_email | bad_code. ttl = the code's life in seconds (Supabase's
  // "Email OTP Expiration", 3600 by default).
  function EmailFlow(io, ttl = 3600) {
    const f = { purpose: 'signin', email: '', hint: '', sentAt: 0, tries: 0, locked: false, session: null, found: null, msg: null, pending: null };
    f.start = (purpose, pending) => Object.assign(f, { purpose, pending: pending || null, email: '', hint: '', sentAt: 0, tries: 0, locked: false, session: null, found: null, msg: null });
    f.wait = () => (f.sentAt ? Math.max(0, 30 - Math.floor((Date.now() - f.sentAt) / 1000)) : 0);
    f.say = (text, ok) => { f.msg = text ? { text, ok: !!ok } : null; };
    f.send = async (email) => {
      const em = String(email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(em)) { const e = new Error("That email doesn't look right."); e.why = 'bad_email'; throw e; }
      const r = await io.send(em);
      Object.assign(f, { email: em, hint: (r && r.email) || `${em.charAt(0)}•••@${em.split('@')[1]}`, sentAt: Date.now(), tries: 0, locked: false, msg: null, session: null, found: null });
    };
    f.verify = async (code) => {
      try {
        const r = await io.verify(f.email, String(code || '').replace(/\D/g, ''));
        f.session = r.session; f.found = r.profile || null; f.msg = null;
        return r;
      } catch (e) {
        if (e.why === 'bad_code') {
          if (Date.now() - f.sentAt >= ttl * 1000) { f.locked = true; f.say('That code expired. Tap RESEND for a new one.'); }
          else {
            f.tries += 1;
            if (f.tries >= 3) { f.locked = true; f.say('Too many tries. Tap RESEND for a new code.'); }
            else f.say(`That code isn't right. ${3 - f.tries} ${3 - f.tries === 1 ? 'try' : 'tries'} left.`);
          }
        } else f.say(e.message);
        throw e;
      }
    };
    return f;
  }
  // the code screen's RESEND count down (both pages call it once)
  function tickResend(doc, flow) {
    setInterval(() => {
      const b = doc.getElementById('cdResend'); if (!b) return;
      const w = flow.wait();
      if (w > 0) { const s = doc.getElementById('cdWait'); if (s) s.textContent = String(w); else b.innerHTML = `RESEND IN <span id="cdWait">${w}</span> S`; b.disabled = true; }
      else if (b.disabled) { b.disabled = false; b.textContent = 'RESEND'; }
    }, 1000);
  }

  // the phone pages' build stamp (BUILD STAMP LAW): SETTINGS on /me shows it; the player site's copy carries the same
  const STAMP = 'ME-46·email-code';
  window.TWLanding = { screens: S, wireMake, esc, tc, word, SEAT_N, tagged, EmailFlow, tickResend, STAMP };
})();
