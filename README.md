# Launch Radar — a token launch radar for make.fun

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/smakmostacker-coder/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/smakmostacker-coder/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

An entry for the make.fun bounty [token-radar-01](https://make.fun/bounty/token-radar-01): build the best token launch radar.

Launch Radar reads the sealed DefiLlama snapshot (758 protocols) and ranks the protocols that record no token yet and are plausible token-launch candidates — all 40 house-list protocols plus 150 more the screen lets through, 190 rows — and shows a reader how to farm each one. The dashboard's All view lists all 758 snapshot protocols: the ranked board first, then every other protocol tagged with its status — already traded (at the market's own values) or not ranked, with the screen's reason. The scored board (`board.json`) stays exactly the ranked set.

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

- **All protocols** — every protocol in the snapshot (758): the ranked board first, in rank order, then the already-traded and the screened-out, each tagged with its status. Only this view carries the board's rank numbers.
- **Top protocols** — every ranked protocol that clears either size lane: TVL of at least $10M, or trailing-30-day trading volume of at least $10M (the snapshot carries no volume field, so volume is an enrichment from DefiLlama's public volume datasets; the 7-day TVL change remains the activity gauge). Rows are ordered by the larger of the two figures — the bold figure on each row — so a protocol that runs on volume rather than locked value is not buried. On this snapshot that is 155 protocols: 148 through the TVL lane, 19 through the volume lane, 12 through both. Polymarket International, whose locked value understates it, stands at #6 on its $2.67B of 30-day volume.
- **Early protocols** — the youngest on the board: tracked for 90 days or fewer (three months at most), ordered youngest first and numbered in that order.
- **Watchlist** — the sourced signal set, in two kinds: confirmed airdrops (tagged CONFIRMED), where the team has publicly committed to a token and an airdrop (an explicit public statement, or an official points-to-token conversion commitment), and points/XP programmes that could convert into an airdrop — a potential, not confirmed. Every row names its source. On this snapshot exactly one is confirmed: Polymarket International, whose CMO said on the record that there will be a token and an airdrop. The points side holds marginfi, Loopscale (lending and curation) and Hyperbeat, whose detail pages carry a “Points programme — a potential, unconfirmed airdrop” note. The 40 house-list protocols stay ranked on the board — the gate requires their coverage — but house-list membership is the bounty's own coverage rule and carries no sourced signal, so it does not by itself put them on this tab.

Each row carries its sector (mapped from the DefiLlama category), chains, TVL, 30-day trading volume, 7-day change, implied value, money raised, and age, plus its X handle and website as text — the page ships no outbound links. Filters: sector chips, chain, minimum TVL, search; every column sorts. Top, Early and Watchlist number their rows in the order shown. A detail view per protocol shows the model's arithmetic, the raise record, its house-list basis, signal or confirmation, and a six-step farm plan with its cost and its time. A Method & sources view documents the model, the screen, and the provenance below.

## Sources

Every field is traceable to a named source; nothing is estimated or scraped from a dubious page.

- **Board fields** (TVL, 7-day change, chains, category, tracking start, token record): the sealed snapshot — DefiLlama's public protocols dataset (`https://api.llama.fi/protocols`), fetched by the house on 2026-11-14T01:18:33Z, as of 2026-11-14. It does not move; every run reads the same bytes.
- **Sector**: mapped from the snapshot's DefiLlama category by the table in `lib/model.ts` (Lending → DeFi · Lending, Dexs → DeFi · DEX, Derivatives → DeFi · Perps, Risk Curators → DeFi · Vault Curators, and so on).
- **X handle and website**: DefiLlama's live protocol records (their `twitter` and `url` fields), fetched 2026-11-23 and baked into `lib/socials.json`, because the program runs with no network. 752 of the snapshot's 758 protocols are covered; a protocol with no record shows none — none is guessed.
- **Money raised**: DefiLlama's raises records, read per protocol on 2026-11-23 (the bulk raises endpoint is paywalled, so each board protocol's own record was read) and totalled in `lib/raises.json`. Amounts are converted from DefiLlama's millions denomination. 55 board protocols have a raise on record; a dash means none is recorded — never an estimate.
- **Trading volume**: DefiLlama's public volume datasets (the dexs and options overviews at `api.llama.fi/overview/`), fetched 2026-11-23 and baked into `lib/volumes.json`, joined on DefiLlama's own protocol slugs; the figure is the trailing 30 days. The derivatives overview is paywalled (HTTP 402 on every public route checked), so perpetuals protocols show no volume figure rather than an estimate. 114 of the snapshot's protocols carry a figure, 21 of them on the board; a dash means none is on that public record.
- **Signals**: checked by hand on 2026-11-23 against the source named on each row, stored in `lib/signals.json`, each with a `confirmed` verdict and a `points` flag under the Watchlist rules above. An unsourced hunch is never recorded; a points/XP programme is recorded as a potential, never dressed up as a confirmation.
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
