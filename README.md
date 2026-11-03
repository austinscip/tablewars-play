# Table Wars player site

The page a Table Wars seat QR opens on a phone: `<site>/s/<CODE>?seat=S`. It works on any internet, mobile data
included. The phone does not need the venue's Wi-Fi.

A person can play as their profile (PLAY), make a profile, or play as a guest. The page talks only to the Table Wars
cloud's phone function (`tw_pf_phone`) with the public anon key. The phone keeps its own token in the browser. The
cloud keeps only the token's hash.

Plain static files. No build step. Every font and picture is in this folder. Nothing loads from another site.

## Files

- `index.html`: the page. `404.html` is the same file. GitHub Pages serves it for `/s/<CODE>`, so those
  addresses work with no server.
- `config.js`: the ONE setting: the cloud address and its anon key.
- `app.js`: this page's logic.
- `landing.js`, `style.css`, `fonts/`, `art/`: copied from the main Table Wars repo. Change them there, not here.
- `fonts/OFL.txt`, `art/CREDITS.txt`: the font licence and the picture credits (all CC0).

## Deploy on GitHub Pages

1. Fill in `config.js`: `supabaseUrl` (`https://<project>.supabase.co`) and `anonKey` (the project's anon key).
   Never a service key.
2. Push this folder as the root of a public repo.
3. On GitHub: Settings, Pages, "Deploy from a branch", branch `main`, folder `/ (root)`. Save.
4. Open `https://<user>.github.io/<repo>/s/TEST00?seat=1`. It should say "That seat isn't playing".

## Point the venue boxes at it

On every box set `TW_PLAYER_SITE_URL=https://<user>.github.io/<repo>` (https only, no slash at the end) and restart
the box service. The TV then draws each seat's QR as `<that address>/s/<CODE>?seat=S`. With no internet on the box,
the TV falls back to the venue page on the venue's Wi-Fi.
