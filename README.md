# Launch Radar — a token launch radar for make.fun

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/smakmostacker-coder/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/smakmostacker-coder/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

An entry for the make.fun bounty [token-radar-01](https://make.fun/bounty/token-radar-01): build the best token launch radar.

Launch Radar reads the sealed DefiLlama snapshot (758 protocols) and ranks the protocols that record no token yet and are plausible token-launch candidates — all 40 watchlist protocols plus 150 more the screen lets through, 190 rows — and shows a reader how to farm each one. Protocols whose token already trades are shown apart, at the market's own values.

## The screen

A ranked row must be an independent protocol, not a token, a wrapper, or a company's plumbing. Off the board: bridges and canonical bridges (Base Bridge, Coinbase Bridge, WBTC's kin), wrapped / staked / restaked products of tokens that already trade (WBTC, Binance staked ETH, USDT0), exchange (CEX) products and anything carrying an exchange's name, the chains themselves, and versioned pools of another protocol. The watchlist is exempt from the product screen — the bounty requires its coverage — and it is the floor, never the ceiling.

## The model

Implied value = **TVL × peer multiple × momentum × tenure × reach**, computed per protocol in `lib/model.ts` and stated on the dashboard itself:

- **Peer multiple** — the median market-cap/TVL of the protocol's own category among the snapshot's traded protocols (the global median scaled ×0.21 — ×0.17 effective on this snapshot — where a category has fewer than three traded peers), clamped to ×0.05–×1.20.
- **Momentum** — its 7-day TVL change, clamped to −40%…+100%, weighted 0.30.
- **Tenure** — how long it has been tracked with no token: ×0.55 rising to ×1.00 over 1,460 days (square-root curve; ×0.775 when the listing date is unknown).
- **Reach** — +4% per chain beyond the first, up to four extra chains.

No protocol's name is special-cased: the same function scores every row, and every row carries its own arithmetic for a reader to check. An implied value is this board's own claim — not a prediction that a token will be issued.

## The dashboard

`dashboard/` is a static page with no network calls, in four views over the one board:

- **All protocols** — the full ranked board, with the already-traded set shown below it, apart.
- **Top protocols** — the 25 largest by TVL (the snapshot carries no volume field; the 7-day TVL change is the activity gauge).
- **Early protocols** — tracked for 180 days or fewer.
- **Watchlist** — the 40 house protocols plus 5 carrying a sourced airdrop signal (a points programme, a public token statement by the team); every row states why it is there, with the signal's source.

Each row carries its sector (mapped from the DefiLlama category), chains, TVL, 7-day change, implied value, money raised, and age, plus its X handle and website as text — the page ships no outbound links. Filters: sector chips, chain, minimum TVL, search; every column sorts. A detail view per protocol shows the model's arithmetic, the raise record, the watchlist basis or signal, and a six-step farm plan with its cost and its time. A Method & sources view documents the model, the screen, and the provenance below.

## Sources

Every field is traceable to a named source; nothing is estimated or scraped from a dubious page.

- **Board fields** (TVL, 7-day change, chains, category, tracking start, token record): the sealed snapshot — DefiLlama's public protocols dataset (`https://api.llama.fi/protocols`), fetched by the house on 2026-11-14T01:18:33Z, as of 2026-11-14. It does not move; every run reads the same bytes.
- **Sector**: mapped from the snapshot's DefiLlama category by the table in `lib/model.ts` (Lending → DeFi · Lending, Dexs → DeFi · DEX, Derivatives → DeFi · Perps, Risk Curators → DeFi · Vault Curators, and so on).
- **X handle and website**: DefiLlama's live protocol records (their `twitter` and `url` fields), fetched 2026-11-23 and baked into `lib/socials.json`, because the program runs with no network. 752 of the snapshot's 758 protocols are covered; a protocol with no record shows none — none is guessed.
- **Money raised**: DefiLlama's raises records, read per protocol on 2026-11-23 (the bulk raises endpoint is paywalled, so each board protocol's own record was read) and totalled in `lib/raises.json`. Amounts are converted from DefiLlama's millions denomination. 55 board protocols have a raise on record; a dash means none is recorded — never an estimate.
- **Signals**: checked by hand on 2026-11-23 against the source named on each row, stored in `lib/signals.json`. An unsourced hunch never makes the watchlist.
- **Beyond DefiLlama**: the ranked board's rows are the snapshot's protocols — the bounty gate accepts no other slugs. A November 2026 sweep for credible pre-token protocols DefiLlama does not track added none: the strongest candidates (Lighter, Paradex, GRVT, Pacifica, StandX, Ethereal, Extended) each turned out to be tracked by DefiLlama after all, or to have launched a token already, or both. Sol Incinerator — the user's example of an airdrop-teasing protocol — is not in the snapshot at all, so it cannot be carried.

## Run it

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22.18 or later, standard library only. The program writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` (via the vendored `vendor/makefun-board.ts`) to the output directory, and writes the same bytes on every run.

## Layout

- `main.ts` — the entry program.
- `lib/model.ts` — snapshot parsing, the eligibility screen, the peer-multiple model, sectors, farm plans, board validation.
- `lib/socials.json`, `lib/signals.json`, `lib/raises.json` — the baked-in DefiLlama socials, the hand-checked signals, and the DefiLlama raises totals (provenance in each file).
- `dashboard/` — the page: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the three views the judge reads first.
- `vendor/makefun-board.ts` — make.fun's vendored dossier library.
