# Launch Radar — a token launch radar for make.fun

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/smakmostacker-coder/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/smakmostacker-coder/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

An entry for the make.fun bounty [token-radar-01](https://make.fun/bounty/token-radar-01): build the best token launch radar.

Launch Radar reads the sealed DefiLlama snapshot (758 protocols), ranks every protocol that records no token yet — all 40 watchlist protocols plus 249 more the radar finds below and beside the floor, 289 rows — and shows a reader how to farm each one. Protocols whose token already trades are shown apart, at the market's own values.

## The model

Implied value = **TVL × peer multiple × momentum × tenure × reach**, computed per protocol in `lib/model.ts` and stated on the dashboard itself:

- **Peer multiple** — the median market-cap/TVL of the protocol's own category among the snapshot's traded protocols (the global median, ×0.21 on this snapshot, where a category has fewer than three traded peers), clamped to ×0.05–×1.20.
- **Momentum** — its 7-day TVL change, clamped to −40%…+100%, weighted 0.30.
- **Tenure** — how long it has been tracked with no token: ×0.55 rising to ×1.00 over 1,460 days (square-root curve; ×0.775 when the listing date is unknown).
- **Reach** — +4% per chain beyond the first, up to four extra chains.

No protocol's name is special-cased: the same function scores every row, and every row carries its own arithmetic for a reader to check. An implied value is this board's own claim — not a prediction that a token will be issued.

## The dashboard

`dashboard/` is a static page with no network calls: a sortable, filterable board (segment, search, category, chain, minimum TVL), a detail view per protocol with the model's four factors and a six-step farm plan (each step with its cost and its time), and the traded set shown separately. `screenshots/` holds the board, a detail view, and a filtered view.

## Run it

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22.18 or later, standard library only. The program writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` (via the vendored `vendor/makefun-board.ts`) to the output directory, and writes the same bytes on every run.

## Layout

- `main.ts` — the entry program.
- `lib/model.ts` — snapshot parsing, the peer-multiple model, farm plans, board validation.
- `dashboard/` — the page: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the three views the judge reads first.
- `vendor/makefun-board.ts` — make.fun's vendored dossier library.
