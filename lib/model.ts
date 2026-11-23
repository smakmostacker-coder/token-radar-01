// Launch Radar model: what a pre-token protocol's token would be worth if it
// launched today at the multiple its own category already trades at.
//
// The multiple is not a constant. For every category, the live-token protocols
// in the snapshot vote with their own numbers: peer multiple = the median of
// market_cap / TVL across that category's traded protocols (the global median
// when a category has fewer than three traded peers). A pre-token protocol's
// base value is its TVL at that multiple, then three adjustments, each read
// off the protocol's own record:
//
//   momentum  its 7-day TVL change, clamped to [-40, +100] percent, weight 0.30
//   tenure    how long DefiLlama has tracked it: 0.55 + 0.45 * sqrt(age/1460d)
//   reach     +4% per extra chain beyond the first, up to four extra chains
//
//   implied = TVL * peer_multiple * momentum * tenure * reach   (whole dollars)
//
// Nothing is keyed to a protocol's name: the same code scores every row, and
// every row carries its own arithmetic so a reader can check it.
//
// Who may be ranked at all is a screen, stated once here and applied to every
// row alike (isRankable): a protocol must record no token, and must be an
// independent protocol rather than a product of something else — not a bridge
// or a wrapped, staked or restaked product of a token that already trades,
// not an exchange or its namesake products, not a chain itself, and not a
// versioned pool of another protocol. The house's watchlist is exempt from
// the product screen: the gate requires every watchlist slug on the board,
// and the watchlist is the floor the house set, so its members always rank.
//
// Data provenance: every figure above is read from the sealed snapshot, which
// the house fetched from DefiLlama's public API (the snapshot's own `source`
// field names the endpoint and the fetch time). Socials (twitter, website)
// come from DefiLlama's live protocol records, baked into lib/socials.json at
// build time because the program runs with no network; a protocol DefiLlama
// carries no handle or site for shows none — none is guessed. A sweep of
// protocols DefiLlama does not track (November 2026) added none: every
// credible candidate checked was already tracked there or already had a
// token, so this board invents no off-DefiLlama rows.
//
// The scored board is the ranked set alone. Beside it the program writes a
// catalogue of every protocol in the snapshot (buildCatalogue) as display
// data for the dashboard's All view, so a reader can see the whole field —
// the ranked rows first, then the already-traded and the screened-out, each
// tagged with its status and, for the screened-out, the screen's reason.

/** One protocol record: the ten fields the sealed snapshot carries. */
export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The sealed snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

/** The model's fixed weights, stated on the dashboard so a reader can rerun it. */
export const WEIGHTS = {
  momentum_weight: 0.3,
  momentum_floor_pct: -40,
  momentum_cap_pct: 100,
  tenure_base: 0.55,
  tenure_span: 0.45,
  tenure_window_days: 1460,
  tenure_unknown: 0.775,
  reach_per_chain: 0.04,
  reach_max_extra_chains: 4,
  multiple_floor: 0.05,
  multiple_cap: 1.2,
  min_category_peers: 3,
} as const;

export const MODEL_VERSION = 'peer-multiple-3';

/** One ranked board row: the gate's fields plus the model's own arithmetic. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  on_watchlist: boolean;
  sector: string;
  sector_label: string;
  twitter: string | null;
  website: string | null;
  raised_usd: number | null;
  raised_rounds: number | null;
  signal: Signal | null;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    peer_multiple: number;
    peer_count: number;
    peer_scope: 'category' | 'global';
    momentum_multiplier: number;
    tenure_multiplier: number;
    reach_multiplier: number;
  };
  farm_steps: string[];
}

/** A traded protocol, shown at the market's own value, never the model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  tvl_multiple: number | null;
  sector: string;
  sector_label: string;
  twitter: string | null;
  website: string | null;
  raised_usd: number | null;
  raised_rounds: number | null;
}

/** A protocol's socials as DefiLlama records them; either field may be absent. */
export interface Socials {
  twitter: string | null;
  website: string | null;
}

/** Socials by slug, from lib/socials.json (DefiLlama's live records, build-time fetch). */
export type SocialsMap = ReadonlyMap<string, Socials>;

/**
 * A sourced airdrop signal: what the hint is, who reported it, and where it
 * was seen. `confirmed` is the stricter verdict the Watchlist tab applies:
 * the team has publicly committed to a token and an airdrop (an explicit
 * public statement, or an official points-to-token conversion commitment).
 * A points programme, a roadmap mention or a rumour is a signal, never a
 * confirmation.
 */
export interface Signal {
  note: string;
  source: string;
  ref: string;
  confirmed: boolean;
}

/** Signals by slug, from lib/signals.json (checked by hand against the named sources). */
export type SignalsMap = ReadonlyMap<string, Signal>;

/** A protocol's fundraising as DefiLlama's raises records give it; absent means none on record. */
export interface Raised {
  total_usd: number;
  rounds: number;
  last_round: string | null;
  last_amount_usd: number | null;
  last_date: string | null;
}

/** Raises by slug, from lib/raises.json (DefiLlama's per-protocol raises records, build-time fetch). */
export type RaisesMap = ReadonlyMap<string, Raised>;

/** The build-time datasets the program joins onto the snapshot, each with its own provenance. */
export interface ExtraData {
  socials: SocialsMap;
  signals: SignalsMap;
  raises: RaisesMap;
}

/**
 * Sector labels: what a protocol IS, mapped from DefiLlama's category field
 * by this stated table — the category is the source, the label is the map.
 * `sector` is the filter group; `label` is the fuller name a reader sees.
 */
export interface Sector {
  sector: string;
  label: string;
}

const SECTOR_BY_CATEGORY: Record<string, Sector> = {
  Lending: { sector: 'DeFi', label: 'DeFi · Lending' },
  'Uncollateralized Lending': { sector: 'DeFi', label: 'DeFi · Lending' },
  Dexs: { sector: 'DeFi', label: 'DeFi · DEX' },
  Derivatives: { sector: 'DeFi', label: 'DeFi · Perps' },
  Options: { sector: 'DeFi', label: 'DeFi · Options' },
  'Options Vault': { sector: 'DeFi', label: 'DeFi · Options' },
  'Interest Rate Derivatives': { sector: 'DeFi', label: 'DeFi · Options' },
  Yield: { sector: 'DeFi', label: 'DeFi · Yield' },
  'Yield Aggregator': { sector: 'DeFi', label: 'DeFi · Yield' },
  'Liquidity Manager': { sector: 'DeFi', label: 'DeFi · Yield' },
  Farm: { sector: 'DeFi', label: 'DeFi · Yield' },
  'Leveraged Farming': { sector: 'DeFi', label: 'DeFi · Yield' },
  'Risk Curators': { sector: 'DeFi', label: 'DeFi · Vault Curators' },
  'Onchain Capital Allocator': { sector: 'DeFi', label: 'DeFi · Vault Curators' },
  CDP: { sector: 'DeFi', label: 'DeFi · Stablecoins & CDP' },
  'CDP Manager': { sector: 'DeFi', label: 'DeFi · Stablecoins & CDP' },
  'Algo-Stables': { sector: 'DeFi', label: 'DeFi · Stablecoins & CDP' },
  'Dual-Token Stablecoin': { sector: 'DeFi', label: 'DeFi · Stablecoins & CDP' },
  'Stablecoin Issuer': { sector: 'DeFi', label: 'DeFi · Stablecoins & CDP' },
  'Basis Trading': { sector: 'DeFi', label: 'DeFi · Basis & Synthetics' },
  Synthetics: { sector: 'DeFi', label: 'DeFi · Basis & Synthetics' },
  'Staking Pool': { sector: 'DeFi', label: 'DeFi · Staking' },
  Restaking: { sector: 'DeFi', label: 'DeFi · Staking' },
  Indexes: { sector: 'DeFi', label: 'DeFi · Indexes' },
  Insurance: { sector: 'DeFi', label: 'DeFi · Insurance' },
  CeDeFi: { sector: 'DeFi', label: 'DeFi · CeDeFi' },
  'Reserve Currency': { sector: 'DeFi', label: 'DeFi · Reserve Currency' },
  'Collateral Markets': { sector: 'DeFi', label: 'DeFi · Collateral' },
  'Collateral Management': { sector: 'DeFi', label: 'DeFi · Collateral' },
  'OTC Marketplace': { sector: 'DeFi', label: 'DeFi · OTC' },
  RWA: { sector: 'RWA', label: 'RWA · Tokenised Assets' },
  'Prediction Market': { sector: 'Prediction', label: 'Prediction Markets' },
  Payments: { sector: 'Payments', label: 'Payments & Cards' },
  'Crypto Card Issuer': { sector: 'Payments', label: 'Payments & Cards' },
  Launchpad: { sector: 'Launchpad', label: 'Launchpad' },
  'Token Locker': { sector: 'Tools', label: 'Tools' },
  'NFT Marketplace': { sector: 'NFT', label: 'NFT Marketplaces' },
  'AI Agents': { sector: 'AI', label: 'AI' },
  'Decentralized AI': { sector: 'AI', label: 'AI' },
  DOR: { sector: 'Infra', label: 'Infra · Oracles' },
  Privacy: { sector: 'Infra', label: 'Infra · Privacy' },
  'Governance Incentives': { sector: 'Infra', label: 'Infra · Incentives' },
};

/** The sector of a protocol, from its DefiLlama category alone. */
export function sectorFor(category: string | null): Sector {
  if (category !== null) {
    const hit = SECTOR_BY_CATEGORY[category];
    if (hit !== undefined) return hit;
    return { sector: 'Other', label: `Other · ${category}` };
  }
  return { sector: 'Other', label: 'Other · Uncategorized' };
}

/**
 * One line of the full catalogue the All view lists: every protocol in the
 * snapshot, ranked or not. A ranked protocol carries its board rank and
 * implied value; a traded one is tagged as already traded; a screened-out
 * one is tagged not ranked, with the screen's reason. The catalogue is
 * display data only — the scored board (board.json) stays the ranked set.
 */
export interface CatalogueRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  symbol: string | null;
  sector: string;
  sector_label: string;
  twitter: string | null;
  website: string | null;
  raised_usd: number | null;
  raised_rounds: number | null;
  age_days: number | null;
  status: 'ranked' | 'traded' | 'screened';
  status_label: string;
  status_tag: string;
  rank: number | null;
  implied_value_usd: number | null;
  seq: number;
}

/** The dashboard's dataset: the ranked rows, the traded set, the full catalogue, the model's weights. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  weights: typeof WEIGHTS;
  global_multiple: number;
  counts: { scanned: number; watchlist: number; board: number; early: number; live: number; traded: number; screened: number };
  rows: BoardRow[];
  live: LiveRow[];
  catalogue: CatalogueRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY = 86_400_000;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Whole days between the day tracking began and the snapshot's day; null when either is unusable. */
export function ageInDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const start = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((end - start) / DAY));
}

/** Records no token: no market cap, no CoinGecko id, no ticker. */
export function recordsNoToken(p: Protocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/**
 * Product categories that are not independent protocols waiting on a launch
 * of their own: bridges and the wrapped, staked or restaked products of a
 * token that already trades, exchanges, and the chains themselves. The list
 * extends the house's watchlist screen (Bridge, Canonical Bridge, Liquid
 * Staking, Liquid Restaking, Restaked BTC, CEX) with the same product
 * families under the names this snapshot gives them (Cross Chain Bridge,
 * Anchor BTC, Decentralized BTC, Stablecoin Wrapper, Chain).
 */
export const PRODUCT_CATEGORIES: ReadonlySet<string> = new Set([
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'Anchor BTC',
  'Decentralized BTC',
  'Stablecoin Wrapper',
  'CEX',
  'Chain',
]);

/** Exchanges whose namesake products are the exchange's, not a launch candidate's. */
export const EXCHANGE_PREFIXES: readonly string[] = [
  'Binance',
  'Coinbase',
  'Bybit',
  'Kraken',
  'Bitget',
  'OKX',
  'Bitfinex',
  'Gemini',
];

const WRAPPED_OR_STAKED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX_RE = new RegExp(`^(${EXCHANGE_PREFIXES.join('|')})\\b`);

/**
 * Rankable: records no token, and is an independent protocol — not a bridge,
 * wrapped, staked or restaked product of one that trades, not an exchange or
 * a product carrying an exchange's name, not a chain, and not a versioned
 * pool of another protocol. Watchlist members always rank: the gate requires
 * their coverage and the watchlist is the house's own floor.
 */
export function isRankable(p: Protocol, onWatchlist: ReadonlySet<string>): boolean {
  if (!recordsNoToken(p) || VERSION_SUFFIX.test(p.name)) return false;
  if (onWatchlist.has(p.slug)) return true;
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return false;
  if (EXCHANGE_PREFIX_RE.test(p.name)) return false;
  if (WRAPPED_OR_STAKED_WORD.test(p.name)) return false;
  return true;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The peer multiples: one median mcap/TVL per category with enough traded peers, plus the global one. */
export function peerMultiples(snapshot: Snapshot): { byCategory: Map<string, { multiple: number; peers: number }>; global: number } {
  const ratios = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (recordsNoToken(p) || p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    const key = p.category ?? 'Uncategorized';
    const list = ratios.get(key);
    if (list === undefined) ratios.set(key, [ratio]);
    else list.push(ratio);
    all.push(ratio);
  }
  const global = all.length > 0 ? median(all) : 0.2;
  const byCategory = new Map<string, { multiple: number; peers: number }>();
  for (const [key, list] of ratios) {
    if (list.length >= WEIGHTS.min_category_peers) {
      byCategory.set(key, { multiple: clamp(median(list), WEIGHTS.multiple_floor, WEIGHTS.multiple_cap), peers: list.length });
    }
  }
  return { byCategory, global: clamp(global, WEIGHTS.multiple_floor, WEIGHTS.multiple_cap) };
}

/** One protocol's implied value and the four factors that produced it. */
export function scoreProtocol(
  p: Protocol,
  asOf: string,
  peers: { byCategory: Map<string, { multiple: number; peers: number }>; global: number },
): { implied: number; age: number | null; model: BoardRow['model'] } {
  const own = peers.byCategory.get(p.category ?? 'Uncategorized');
  const multiple = own !== undefined ? own.multiple : peers.global;
  const change = p.change_7d === null ? 0 : clamp(p.change_7d, WEIGHTS.momentum_floor_pct, WEIGHTS.momentum_cap_pct);
  const momentum = 1 + (change / 100) * WEIGHTS.momentum_weight;
  const age = ageInDays(asOf, p.listed_at);
  const tenure =
    age === null
      ? WEIGHTS.tenure_unknown
      : WEIGHTS.tenure_base + WEIGHTS.tenure_span * Math.sqrt(Math.min(age, WEIGHTS.tenure_window_days) / WEIGHTS.tenure_window_days);
  const reach = 1 + WEIGHTS.reach_per_chain * Math.min(Math.max(p.chains.length - 1, 0), WEIGHTS.reach_max_extra_chains);
  const implied = Math.max(1, Math.round(p.tvl_usd * multiple * momentum * tenure * reach));
  return {
    implied,
    age,
    model: {
      peer_multiple: round4(multiple),
      peer_count: own !== undefined ? own.peers : 0,
      peer_scope: own !== undefined ? 'category' : 'global',
      momentum_multiplier: round4(momentum),
      tenure_multiplier: round4(tenure),
      reach_multiplier: round4(reach),
    },
  };
}

/** Position size for a farm plan, from the protocol's own TVL: deeper pools take a larger ticket. */
function ticketFor(tvl: number): number {
  if (tvl >= 2_000_000_000) return 250;
  if (tvl >= 500_000_000) return 200;
  if (tvl >= 100_000_000) return 120;
  if (tvl >= 25_000_000) return 80;
  return 50;
}

/** Gas for one round of transactions on the protocol's first chain, in dollars. */
function gasFor(chain: string): number {
  if (chain === 'Ethereum') return 12;
  if (chain === 'Bitcoin') return 8;
  return 3;
}

/** How long a position should season, from the protocol's age: the younger it is, the longer the window. */
function seasonDays(age: number | null): number {
  if (age === null) return 45;
  if (age < 90) return 75;
  if (age < 365) return 60;
  if (age < 730) return 45;
  return 30;
}

/** The category's core farming action: one sentence a reader can execute. */
function coreAction(p: Protocol, ticket: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return `Supply $${ticket} of USDC as collateral in ${n} on ${chain}, then borrow $${Math.round(ticket / 3)} against it and re-supply the borrowed side`;
  if (c.includes('bridge') || c.includes('canonical'))
    return `Bridge $${ticket} of USDC from Ethereum to ${chain === 'Ethereum' ? 'its busiest destination chain' : chain} through ${n}, then bridge a small amount back a week later`;
  if (c.includes('liquid staking') || c.includes('restak') || c.includes('staking'))
    return `Stake $${ticket} worth of the chain's native asset through ${n} on ${chain} and hold the liquid receipt token in the same wallet`;
  if (c.includes('dex') || c.includes('amm') || c.includes('aggregator'))
    return `Place $${ticket} into ${n}'s highest-volume stablecoin pool on ${chain}, split evenly across both sides of the pair`;
  if (c.includes('deriv') || c.includes('perpetual') || c.includes('options'))
    return `Post $${ticket} of USDC as margin on ${n} and open one small hedged position, long and short the same asset in equal size`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield'))
    return `Deposit $${ticket} of USDC into a ${n} vault on ${chain} and leave the vault shares untouched in the wallet`;
  if (c.includes('rwa')) return `Mint $${ticket} of ${n}'s tokenised real-world asset on ${chain} through its own app and hold it`;
  if (c.includes('stable')) return `Mint $${ticket} of ${n}'s stablecoin against USDC collateral on ${chain}, then deposit half of it back into its savings vault`;
  if (c.includes('insurance')) return `Buy $${ticket} of protocol cover from ${n} on ${chain} for the longest term it offers`;
  if (c.includes('prediction')) return `Fund the wallet with $${ticket} and take one position in ${n}'s most liquid market`;
  if (c.includes('index')) return `Buy $${ticket} of ${n}'s broadest index basket on ${chain} and hold the basket token`;
  return `Deposit $${ticket} of USDC into ${n} on ${chain} through its main app and use its core function once`;
}

/**
 * Six steps per protocol, each with its cost and its time, all derived from the
 * protocol's own record: its category sets the action, its first chain the gas,
 * its TVL the ticket, its age the holding window. No name is written by hand.
 */
export function farmPlan(p: Protocol, age: number | null): string[] {
  const chain = p.chains.length > 0 ? p.chains[0]! : 'its main chain';
  const ticket = ticketFor(p.tvl_usd);
  const gas = gasFor(chain);
  const season = seasonDays(age);
  const steps = [
    `Open a fresh wallet for this farm alone, back up its seed phrase on paper, and fund it with $${ticket + gas * 2} on ${chain}. Cost: $${ticket} of working capital plus about $${gas * 2} of gas money. Time: 20 minutes.`,
    `${coreAction(p, ticket, chain)}. Cost: the $${ticket} position plus about $${gas} of gas. Time: 15 minutes.`,
    `Repeat a small qualifying action every week - a $${Math.max(10, Math.round(ticket / 6))} top-up, a rebalance or a governance vote - so the wallet shows a pattern, not a single visit. Cost: about $${gas} of gas a week. Time: 10 minutes a week.`,
    `Hold the position for at least ${season} days without withdrawing, so the activity spans several weekly snapshots of the protocol. Cost: the $${ticket} stays locked in the position. Time: ${season} days.`,
    `Check the protocol's own announcements and points page before withdrawing, and claim only through links the protocol itself publishes - never pay a fee to claim an airdrop. Cost: nothing to check. Time: 10 minutes.`,
    `Log every transaction hash, date and balance in a farm diary; if no token or points programme appears within 90 days, withdraw and recycle the $${ticket} into the next protocol on this board. Cost: nothing. Time: 10 minutes a week.`,
  ];
  return steps.map((s) => (s.length > 600 ? `${s.slice(0, 596)}...` : s));
}

const NO_SOCIALS: Socials = { twitter: null, website: null };

export const EMPTY_EXTRAS: ExtraData = { socials: new Map(), signals: new Map(), raises: new Map() };

/** The ranked board: every watchlist slug, plus every other rankable protocol the snapshot carries. */
export function buildBoard(snapshot: Snapshot, extras: ExtraData): BoardRow[] {
  const peers = peerMultiples(snapshot);
  const onWatchlist = new Set(snapshot.watchlist);
  const chosen = snapshot.protocols.filter((p) => isRankable(p, onWatchlist));
  const scored = chosen.map((p) => ({ p, ...scoreProtocol(p, snapshot.as_of, peers) }));
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : 1));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    on_watchlist: onWatchlist.has(s.p.slug),
    sector: sectorFor(s.p.category).sector,
    sector_label: sectorFor(s.p.category).label,
    twitter: (extras.socials.get(s.p.slug) ?? NO_SOCIALS).twitter,
    website: (extras.socials.get(s.p.slug) ?? NO_SOCIALS).website,
    raised_usd: extras.raises.get(s.p.slug)?.total_usd ?? null,
    raised_rounds: extras.raises.get(s.p.slug)?.rounds ?? null,
    signal: extras.signals.get(s.p.slug) ?? null,
    age_days: s.age,
    implied_value_usd: s.implied,
    model: s.model,
    farm_steps: farmPlan(s.p, s.age),
  }));
}

const BRIDGE_CATEGORIES: ReadonlySet<string> = new Set(['Bridge', 'Canonical Bridge', 'Cross Chain Bridge']);
const WRAPPED_CATEGORIES: ReadonlySet<string> = new Set([
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'Anchor BTC',
  'Decentralized BTC',
  'Stablecoin Wrapper',
]);

/**
 * Why the screen leaves a pre-token protocol unranked, in the screen's own
 * terms: the same checks isRankable applies, named one by one so the All
 * view can tag the row instead of hiding it.
 */
export function notRankedReason(p: Protocol): { label: string; tag: string } {
  if (p.category !== null && BRIDGE_CATEGORIES.has(p.category)) return { label: 'Not ranked — bridge product', tag: 'NOT RANKED — BRIDGE' };
  if (p.category !== null && WRAPPED_CATEGORIES.has(p.category))
    return { label: 'Not ranked — wrapped or staked product', tag: 'NOT RANKED — WRAPPED / STAKED' };
  if (p.category === 'CEX') return { label: 'Not ranked — exchange product', tag: 'NOT RANKED — EXCHANGE' };
  if (p.category === 'Chain') return { label: 'Not ranked — a chain, not a protocol', tag: 'NOT RANKED — CHAIN' };
  if (EXCHANGE_PREFIX_RE.test(p.name)) return { label: 'Not ranked — exchange product', tag: 'NOT RANKED — EXCHANGE' };
  if (WRAPPED_OR_STAKED_WORD.test(p.name)) return { label: 'Not ranked — wrapped or staked product', tag: 'NOT RANKED — WRAPPED / STAKED' };
  if (VERSION_SUFFIX.test(p.name)) return { label: 'Not ranked — versioned pool of another protocol', tag: 'NOT RANKED — VERSIONED POOL' };
  return { label: 'Not ranked — product of another protocol', tag: 'NOT RANKED — PRODUCT' };
}

/**
 * The full catalogue for the All view: every protocol in the snapshot,
 * ordered ranked first (in rank order), then the already-traded (largest
 * market cap first), then the screened-out (largest TVL first). Display
 * data only: board.json keeps exactly the ranked rows the gate scores.
 */
export function buildCatalogue(snapshot: Snapshot, extras: ExtraData, board: BoardRow[]): CatalogueRow[] {
  const rankedBy = new Map(board.map((r) => [r.slug, r]));
  const entries: CatalogueRow[] = snapshot.protocols.map((p) => {
    const socials = extras.socials.get(p.slug) ?? NO_SOCIALS;
    const base = {
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      symbol: p.symbol,
      sector: sectorFor(p.category).sector,
      sector_label: sectorFor(p.category).label,
      twitter: socials.twitter,
      website: socials.website,
      raised_usd: extras.raises.get(p.slug)?.total_usd ?? null,
      raised_rounds: extras.raises.get(p.slug)?.rounds ?? null,
      age_days: ageInDays(snapshot.as_of, p.listed_at),
    };
    const ranked = rankedBy.get(p.slug);
    if (ranked !== undefined) {
      return { ...base, status: 'ranked' as const, status_label: 'Ranked', status_tag: 'RANKED', rank: ranked.rank, implied_value_usd: ranked.implied_value_usd, seq: 0 };
    }
    if (!recordsNoToken(p)) {
      return { ...base, status: 'traded' as const, status_label: 'Already traded', status_tag: 'ALREADY TRADED', rank: null, implied_value_usd: null, seq: 0 };
    }
    const reason = notRankedReason(p);
    return { ...base, status: 'screened' as const, status_label: reason.label, status_tag: reason.tag, rank: null, implied_value_usd: null, seq: 0 };
  });
  const group = { ranked: 0, traded: 1, screened: 2 } as const;
  entries.sort(
    (a, b) =>
      group[a.status] - group[b.status] ||
      (a.status === 'ranked' ? a.rank! - b.rank! : 0) ||
      (a.status === 'traded' ? (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) : 0) ||
      b.tvl_usd - a.tvl_usd ||
      (a.slug < b.slug ? -1 : 1),
  );
  entries.forEach((e, i) => {
    e.seq = i;
  });
  return entries;
}

/** The traded set: protocols whose token already exists, at the market's own numbers. */
export function buildLive(snapshot: Snapshot, extras: ExtraData): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !recordsNoToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, 36)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      tvl_multiple: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
      sector: sectorFor(p.category).sector,
      sector_label: sectorFor(p.category).label,
      twitter: (extras.socials.get(p.slug) ?? NO_SOCIALS).twitter,
      website: (extras.socials.get(p.slug) ?? NO_SOCIALS).website,
      raised_usd: extras.raises.get(p.slug)?.total_usd ?? null,
      raised_rounds: extras.raises.get(p.slug)?.rounds ?? null,
    }));
}

/** Everything the dashboard renders, plus the counts its header states. */
export function buildRadar(snapshot: Snapshot, extras: ExtraData = EMPTY_EXTRAS): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, extras);
  const live = buildLive(snapshot, extras);
  const catalogue = buildCatalogue(snapshot, extras, board);
  const peers = peerMultiples(snapshot);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    weights: WEIGHTS,
    global_multiple: round4(peers.global),
    counts: {
      scanned: snapshot.protocols.length,
      watchlist: snapshot.watchlist.length,
      board: board.length,
      early: board.filter((r) => !r.on_watchlist).length,
      live: live.length,
      traded: catalogue.filter((c) => c.status === 'traded').length,
      screened: catalogue.filter((c) => c.status === 'screened').length,
    },
    rows: board,
    live,
    catalogue,
  };
  return { board, radar };
}

/** Parse and shape-check the sealed snapshot; refuse anything the model cannot score. */
export function loadSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot is not an object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot has no as_of date');
  if (typeof o.source !== 'string' || o.source.length === 0) throw new SnapshotError('snapshot has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot has no usable floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot has no watchlist');
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  const protocols: Protocol[] = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || num(p.tvl_usd) === null) {
      throw new SnapshotError(`protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: str(p.category),
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd as number,
      change_7d: num(p.change_7d),
      mcap_usd: num(p.mcap_usd),
      listed_at: str(p.listed_at),
      gecko_id: str(p.gecko_id),
      symbol: str(p.symbol),
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why this board fails the gate, or null when it passes: coverage, ranks, order, values, farm steps. */
export function validateBoard(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `board holds ${board.length} rows, outside 100..4000`;
  const seen = new Set<string>();
  for (const r of board) {
    if (seen.has(r.slug)) return `slug ${r.slug} appears twice`;
    seen.add(r.slug);
  }
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  for (const r of board) if (!known.has(r.slug)) return `slug ${r.slug} is not in the snapshot`;
  for (const slug of snapshot.watchlist) if (!seen.has(slug)) return `watchlist slug ${slug} is missing`;
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < byRank.length; i++) {
    if (byRank[i]!.rank !== i + 1) return `rank ${i + 1} is held by ${byRank[i]!.slug} with rank ${byRank[i]!.rank}`;
    if (i > 0 && byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) return `${byRank[i]!.slug} outranks ${byRank[i - 1]!.slug} on value`;
  }
  if (board.length >= 2 && byRank[0]!.implied_value_usd === byRank[byRank.length - 1]!.implied_value_usd) return 'every row carries the same implied value';
  for (const r of board) {
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
  }
  return null;
}

/** The dashboard's dataset as one script: window.RADAR, no fetch, no network. */
export function toDataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
