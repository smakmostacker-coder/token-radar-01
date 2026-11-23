// Launch Radar page: four views over one ranked board — All protocols, Top
// protocols (the biggest by TVL), Early protocols (tracked under six
// months) and the Watchlist (the house list plus protocols carrying a
// sourced airdrop signal) — plus a detail view per protocol and a method
// page. No network: every figure comes from ../data.js, written by the
// entry program. Socials and links are shown as text, never as live links.

'use strict';

const R = window.RADAR;
const W = R.weights;
const view = document.getElementById('view');
const TOP_N = 25;
const EARLY_DAYS = 180;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function money(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}
const moneyFull = (n) => (n === null || n === undefined ? '—' : `$${Math.round(n).toLocaleString('en-US')}`);

function pctCell(n) {
  if (n === null || n === undefined) return '<span class="flat">n/a</span>';
  const cls = n > 0.05 ? 'up' : n < -0.05 ? 'down' : 'flat';
  const w = Math.min(Math.abs(n), 40) * 2.5;
  const col = n < -0.05 ? 'var(--down)' : 'var(--accent)';
  return `<span class="bar7"><i style="width:${w}%;background:${col}"></i></span><span class="${cls}">${n > 0 ? '+' : ''}${n.toFixed(1)}%</span>`;
}

function ageText(days) {
  if (days === null || days === undefined) return '—';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30.4)} mo`;
  return `${(days / 365.25).toFixed(1)} yrs`;
}

/** A recorded website as bare text: host and path, no scheme, not a link. */
const siteText = (u) => (u ? u.replace(/^https?:\/\//i, '').replace(/\/$/, '') : null);

function socialsHTML(r) {
  const bits = [];
  if (r.twitter) bits.push(`<span class="x">X @${esc(r.twitter)}</span>`);
  if (r.website) bits.push(esc(siteText(r.website)));
  return bits.length ? `<div class="psub">${bits.join(' · ')}</div>` : '';
}

const bySlug = new Map(R.rows.map((r) => [r.slug, r]));
const liveBySlug = new Map(R.live.map((r) => [r.slug, r]));
const kitCount = R.rows.filter((r) => r.on_watchlist).length;
const signalRows = R.rows.filter((r) => r.signal !== null);
const watchCount = R.rows.filter((r) => r.on_watchlist || r.signal !== null).length;

/* ---------- header, stats, footer ---------- */

document.getElementById('stats').innerHTML = [
  [R.counts.scanned, 'protocols scanned'],
  [R.counts.board, 'ranked pre-token'],
  [watchCount, 'on the watchlist'],
  [R.counts.live, 'already traded'],
  [esc(R.as_of), 'snapshot date'],
]
  .map(([v, k]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
  .join('');

document.getElementById('side-foot').innerHTML =
  `Model <b>${esc(R.model_version)}</b><br>Global peer multiple ×${R.global_multiple.toFixed(2)}<br>Watchlist floor ${money(R.floor_usd)}`;

document.getElementById('source-line').textContent = `Board data: ${R.source}. Socials and raises: DefiLlama's protocol records, fetched 2026-11-23 and baked into the repository (the program runs with no network). Signals: checked by hand on 2026-11-23 against the sources named on each row.`;

/* ---------- routing ---------- */

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('p/')) return { view: 'detail', slug: decodeURIComponent(h.slice(2)) };
  const params = new URLSearchParams(h.includes('?') ? h.slice(h.indexOf('?') + 1) : h.startsWith('segment') ? h : '');
  const seg = h.startsWith('method') ? 'method' : params.get('segment') || 'all';
  return {
    view: 'board',
    segment: ['all', 'top', 'early', 'watchlist', 'method'].includes(seg) ? seg : 'all',
    sector: params.get('sector') || '',
    chain: params.get('chain') || '',
    q: params.get('q') || '',
    min: params.get('min') || '',
    sort: params.get('sort') || '',
    dir: params.get('dir') || '',
  };
}

function go(patch) {
  const cur = parseRoute();
  const next = { ...cur, ...patch, view: 'board' };
  const params = new URLSearchParams();
  if (next.segment && next.segment !== 'all') params.set('segment', next.segment);
  if (next.sector) params.set('sector', next.sector);
  if (next.chain) params.set('chain', next.chain);
  if (next.q) params.set('q', next.q);
  if (next.min) params.set('min', next.min);
  if (next.sort) params.set('sort', next.sort);
  if (next.dir) params.set('dir', next.dir);
  const qs = params.toString();
  location.hash = '#/' + (qs ? `?${qs}` : '');
}

/* ---------- segments ---------- */

const SEGMENTS = {
  all: {
    title: 'All protocols',
    blurb: 'Every protocol the screen lets through, ranked by implied value: what its token would be worth if it launched today at the multiple its own category already trades at.',
    rows: () => R.rows,
  },
  top: {
    title: 'Top protocols',
    blurb: `The ${TOP_N} biggest ranked protocols by TVL — the most established names still without a token. Rank here is by TVL; the board rank and implied value travel with each row.`,
    rows: () => [...R.rows].sort((a, b) => b.tvl_usd - a.tvl_usd).slice(0, TOP_N),
  },
  early: {
    title: 'Early protocols',
    blurb: `Protocols DefiLlama has tracked for ${EARLY_DAYS} days or fewer — newly launched or newly listed, small but live, and still without a token.`,
    rows: () => R.rows.filter((r) => r.age_days !== null && r.age_days <= EARLY_DAYS),
  },
  watchlist: {
    title: 'Watchlist',
    blurb: 'The house watchlist (DefiLlama record: no token, at or above the floor, no wrapped or bridged product) plus protocols whose team has publicly signalled a token. Every row states why it is here; a signal names its source, and an unsourced hunch never makes this list.',
    rows: () => R.rows.filter((r) => r.on_watchlist || r.signal !== null),
  },
};

function whyLine(r) {
  if (r.signal) return `<b>Signal:</b> ${esc(r.signal.note)} <span>— ${esc(r.signal.source)} · ${esc(r.signal.ref)}</span>`;
  return `<b>House watchlist:</b> records no token at or above the ${money(R.floor_usd)} TVL floor in the snapshot's DefiLlama record.`;
}

/* ---------- board ---------- */

const SORTS = {
  rank: (a, b) => a.rank - b.rank,
  name: (a, b) => a.name.localeCompare(b.name),
  tvl: (a, b) => b.tvl_usd - a.tvl_usd,
  change: (a, b) => (b.change_7d ?? -1e9) - (a.change_7d ?? -1e9),
  implied: (a, b) => b.implied_value_usd - a.implied_value_usd,
  raised: (a, b) => (b.raised_usd ?? -1) - (a.raised_usd ?? -1),
  age: (a, b) => (a.age_days ?? 1e9) - (b.age_days ?? 1e9),
};

function filteredRows(state) {
  let rows = SEGMENTS[state.segment].rows();
  if (state.sector) rows = rows.filter((r) => r.sector === state.sector);
  if (state.chain) rows = rows.filter((r) => r.chains.includes(state.chain));
  if (state.min) rows = rows.filter((r) => r.tvl_usd >= Number(state.min));
  if (state.q) {
    const q = state.q.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q) || (r.twitter ?? '').toLowerCase().includes(q));
  }
  const key = state.sort || (state.segment === 'top' ? 'tvl' : 'rank');
  const sorted = [...rows].sort(SORTS[key] ?? SORTS.rank);
  if (state.dir === 'rev') sorted.reverse();
  return sorted;
}

function rowHTML(r, state) {
  const tags = `${r.on_watchlist ? '<span class="tag wl">WATCHLIST</span>' : ''}${r.signal ? '<span class="tag sig">SIGNAL</span>' : ''}`;
  const main = `<tr data-slug="${esc(r.slug)}">
    <td class="rank">${r.rank}</td>
    <td><span class="pname">${esc(r.name)}</span>${tags}${socialsHTML(r)}</td>
    <td class="sector">${esc(r.sector_label)}</td>
    <td class="chains">${esc(r.chains.slice(0, 2).join(', '))}${r.chains.length > 2 ? ` +${r.chains.length - 2}` : ''}</td>
    <td class="num">${money(r.tvl_usd)}</td>
    <td class="num">${pctCell(r.change_7d)}</td>
    <td class="num"><b>${money(r.implied_value_usd)}</b></td>
    <td class="num">${money(r.raised_usd)}</td>
    <td class="num">${ageText(r.age_days)}</td>
  </tr>`;
  if (state.segment !== 'watchlist') return main;
  return main + `<tr><td></td><td colspan="8" class="sigline">${whyLine(r)}</td></tr>`;
}

function tradedHTML() {
  const body = R.live
    .map(
      (r) => `<tr>
      <td><span class="pname">${esc(r.name)}</span>${socialsHTML(r)}</td>
      <td class="sector">${esc(r.sector_label)}</td>
      <td class="chains">${esc(r.chains.slice(0, 2).join(', '))}${r.chains.length > 2 ? ` +${r.chains.length - 2}` : ''}</td>
      <td class="num">${money(r.tvl_usd)}</td>
      <td class="num"><b>${money(r.mcap_usd)}</b></td>
      <td class="num">${r.tvl_multiple === null ? '—' : `×${r.tvl_multiple.toFixed(2)}`}</td>
      <td class="num">${money(r.raised_usd)}</td>
    </tr>`,
    )
    .join('');
  return `<section class="panel traded">
    <div class="panel-head"><h2>Already traded — shown apart, never ranked</h2>
    <p>Protocols whose token already exists, at the market's own values. Their market-cap/TVL ratios are the peer multiples the model reads; they are not launch candidates and the model never scores them.</p></div>
    <div class="tbl-wrap"><table class="board"><thead><tr>
      <th>Protocol</th><th>Sector</th><th>Chains</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">Mcap / TVL</th><th class="num">Raised</th>
    </tr></thead><tbody>${body}</tbody></table></div>
  </section>`;
}

function renderBoard(state) {
  const seg = SEGMENTS[state.segment];
  const segRows = seg.rows();
  const sectors = [...new Set(segRows.map((r) => r.sector))].sort();
  const chains = [...new Set(R.rows.flatMap((r) => r.chains))].sort();
  const chips = sectors
    .map((s) => `<button class="chip ${state.sector === s ? 'on' : ''}" data-sector="${esc(s)}">${esc(s)} <small>${segRows.filter((r) => r.sector === s).length}</small></button>`)
    .join('');
  view.innerHTML = `
  <section class="panel">
    <div class="panel-head"><h2>${seg.title}</h2><p>${seg.blurb}</p></div>
    <div class="toolbar">
      <div class="tools-row">
        <input class="search" id="f-q" type="search" placeholder="Search name or X handle" value="${esc(state.q)}">
        <select class="pick" id="f-chain"><option value="">All chains</option>${chains.map((c) => `<option ${state.chain === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <select class="pick" id="f-min">
          <option value="">Any TVL</option>
          ${[1e7, 5e7, 1e8, 5e8].map((v) => `<option value="${v}" ${state.min === String(v) ? 'selected' : ''}>TVL ≥ ${money(v)}</option>`).join('')}
        </select>
        <span class="count-note" id="count-note"></span>
      </div>
      <div class="chips"><button class="chip ${!state.sector ? 'on' : ''}" data-sector="">All sectors</button>${chips}</div>
    </div>
    <div class="tbl-wrap"><table class="board" id="board-table">
      <thead><tr>
        <th class="sortable" data-sort="rank">#</th>
        <th class="sortable" data-sort="name">Protocol</th>
        <th>Sector</th>
        <th>Chains</th>
        <th class="num sortable" data-sort="tvl">TVL</th>
        <th class="num sortable" data-sort="change">7d</th>
        <th class="num sortable" data-sort="implied">Implied value</th>
        <th class="num sortable" data-sort="raised">Raised</th>
        <th class="num sortable" data-sort="age">Age</th>
      </tr></thead>
      <tbody id="tbody"></tbody>
    </table></div>
  </section>
  ${state.segment === 'all' ? tradedHTML() : ''}`;

  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.getAttribute('data-seg') === state.segment));
  const update = () => {
    const rows = filteredRows(state);
    document.getElementById('tbody').innerHTML = rows.length ? rows.map((r) => rowHTML(r, state)).join('') : '<tr><td colspan="9" class="empty">No protocol matches these filters.</td></tr>';
    document.getElementById('count-note').textContent = `${rows.length} of ${segRows.length} shown`;
    view.querySelectorAll('#tbody tr[data-slug]').forEach((tr) =>
      tr.addEventListener('click', () => {
        location.hash = `#/p/${encodeURIComponent(tr.getAttribute('data-slug'))}`;
      }),
    );
  };
  update();

  const q = document.getElementById('f-q');
  q.addEventListener('input', () => {
    state.q = q.value.trim();
    update();
  });
  document.getElementById('f-chain').addEventListener('change', (e) => go({ chain: e.target.value, segment: state.segment }));
  document.getElementById('f-min').addEventListener('change', (e) => go({ min: e.target.value, segment: state.segment }));
  view.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => go({ sector: c.getAttribute('data-sector'), segment: state.segment })));
  view.querySelectorAll('th.sortable').forEach((th) =>
    th.addEventListener('click', () => {
      const k = th.getAttribute('data-sort');
      go({ sort: k, dir: state.sort === k && state.dir !== 'rev' ? 'rev' : '', segment: state.segment });
    }),
  );
}

/* ---------- detail ---------- */

function renderDetail(slug) {
  const r = bySlug.get(slug);
  const back = `<button class="backbtn" onclick="history.back()">← Back</button>`;
  if (r === undefined) {
    const l = liveBySlug.get(slug);
    view.innerHTML = back + (l
      ? `<div class="detail-head"><h2>${esc(l.name)}</h2><p class="detail-meta">${esc(l.sector_label)} · already traded — market cap ${moneyFull(l.mcap_usd)} at TVL ${moneyFull(l.tvl_usd)}</p></div>`
      : '<p>No such protocol on this board.</p>');
    return;
  }
  const m = r.model;
  const raisedBox = r.raised_usd === null
    ? '<p>No fundraising round is on DefiLlama’s record for this protocol.</p>'
    : `<p><b>${moneyFull(r.raised_usd)}</b> across ${r.raised_rounds} recorded round${r.raised_rounds === 1 ? '' : 's'} (DefiLlama raises records).</p>`;
  view.innerHTML = `
  ${back}
  <div class="detail-head">
    <h2>${esc(r.name)}${r.on_watchlist ? '<span class="tag wl">WATCHLIST</span>' : ''}${r.signal ? '<span class="tag sig">SIGNAL</span>' : ''}</h2>
    <p class="detail-meta">${esc(r.sector_label)} · ${esc(r.chains.join(', ') || 'no chains recorded')} · records no token${r.twitter ? ` · <span class="x">X @${esc(r.twitter)}</span>` : ''}${r.website ? ` · ${esc(siteText(r.website))}` : ''}</p>
  </div>
  <section class="stats dgrid">
    ${[
      [moneyFull(r.implied_value_usd), `implied value · rank #${r.rank}`],
      [moneyFull(r.tvl_usd), 'TVL'],
      [r.change_7d === null ? 'n/a' : `${r.change_7d > 0 ? '+' : ''}${r.change_7d.toFixed(2)}%`, 'TVL change, 7 days'],
      [r.age_days === null ? 'unknown' : `${r.age_days} days`, r.listed_at ? `tracked since ${r.listed_at}` : 'tracking start unrecorded'],
    ]
      .map(([v, k]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
      .join('')}
  </section>
  <div class="cols">
    <div style="display:flex;flex-direction:column;gap:14px">
      <section class="box">
        <h3>How the model gets ${money(r.implied_value_usd)}</h3>
        <table class="factors">
          <tr><td>TVL</td><td class="num">${moneyFull(r.tvl_usd)}</td></tr>
          <tr><td>Peer multiple — ${m.peer_scope === 'category' ? `median mcap/TVL of ${esc(r.category ?? 'its category')}’s ${m.peer_count} traded protocols` : 'global median (too few traded peers in its category)'}</td><td class="num">×${m.peer_multiple.toFixed(3)}</td></tr>
          <tr><td>Momentum — its 7-day TVL change, weighted ${W.momentum_weight}, clamped ${W.momentum_floor_pct}%…+${W.momentum_cap_pct}%</td><td class="num">×${m.momentum_multiplier.toFixed(3)}</td></tr>
          <tr><td>Tenure — tracked with no token, ×${W.tenure_base} rising to ×${(W.tenure_base + W.tenure_span).toFixed(2)} over ${W.tenure_window_days} days</td><td class="num">×${m.tenure_multiplier.toFixed(3)}</td></tr>
          <tr><td>Reach — +${Math.round(W.reach_per_chain * 100)}% per extra chain, up to ${W.reach_max_extra_chains}</td><td class="num">×${m.reach_multiplier.toFixed(3)}</td></tr>
          <tr class="total"><td>Implied value</td><td class="num">${moneyFull(r.implied_value_usd)}</td></tr>
        </table>
      </section>
      <section class="box">
        <h3>Money raised</h3>
        ${raisedBox}
      </section>
      ${r.signal || r.on_watchlist ? `<section class="box sigbox"><h3>Why it is on the watchlist</h3><p>${whyLine(r)}</p></section>` : ''}
    </div>
    <section class="box">
      <h3>Farm plan — six steps</h3>
      <ol class="steps">${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    </section>
  </div>`;
  window.scrollTo(0, 0);
}

/* ---------- method ---------- */

function renderMethod() {
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.getAttribute('data-seg') === 'method'));
  view.innerHTML = `
  <section class="panel"><div class="panel-head"><h2>Method &amp; sources</h2><p>How the board is built, what each field rests on, and where every number comes from.</p></div>
  <div class="method" style="padding:14px">
    <h3>The model</h3>
    <p>Implied value = TVL × peer multiple × momentum × tenure × reach, computed per protocol in the open (model ${esc(R.model_version)}). The peer multiple is the median market-cap/TVL of the protocol's own category among the snapshot's traded protocols — the market pricing protocols like it — falling back to the global median scaled ×0.21 (×${R.global_multiple.toFixed(2)} on this snapshot) where a category has fewer than ${W.min_category_peers} traded peers, and clamped to ×${W.multiple_floor}–×${W.multiple_cap}. Momentum weighs the 7-day TVL change at ${W.momentum_weight} (clamped ${W.momentum_floor_pct}%…+${W.momentum_cap_pct}%). Tenure runs ×${W.tenure_base} to ×${(W.tenure_base + W.tenure_span).toFixed(2)} over ${W.tenure_window_days} days of being tracked with no token. Reach adds ${Math.round(W.reach_per_chain * 100)}% per chain beyond the first, up to ${W.reach_max_extra_chains}. No name is special-cased; every row carries its own arithmetic on its detail page.</p>
    <h3>The screen</h3>
    <p>A protocol ranks only if it records no token and is an independent protocol: not a bridge, canonical bridge or cross-chain bridge; not a liquid staking, liquid restaking, restaked-BTC, anchored-BTC, decentralised-BTC or stablecoin-wrapper product of a token that already trades; not an exchange (CEX) or a product carrying an exchange's name; not a chain itself; and not a versioned pool of another protocol. The house watchlist is exempt from the product screen — the bounty requires its coverage, and it is the floor, never the ceiling.</p>
    <h3>The four views</h3>
    <p><b>All protocols</b> is the full ranked board. <b>Top protocols</b> is its ${TOP_N} largest by TVL (the snapshot carries no trading-volume field, so size is TVL and the activity gauge shown is the 7-day TVL change). <b>Early protocols</b> is tracked for ${EARLY_DAYS} days or fewer. <b>Watchlist</b> is the house list (${kitCount} protocols) plus ${signalRows.length} protocols carrying a sourced signal — a points programme, a public token statement by the team, or a token-teasing post — each stated on its row with its source. The user's example of the genre, Sol Incinerator's airdrop-teasing post, is exactly the kind of signal meant; Sol Incinerator itself is not in the snapshot (it sits below the snapshot's TVL floor), so it cannot appear here.</p>
    <h3>Field provenance</h3>
    <table>
      <tr><th>Field</th><th>Source</th></tr>
      <tr><td>TVL, 7-day change, chains, category, tracking start, token record</td><td>The sealed snapshot: ${esc(R.source)}. It does not move; every run reads the same bytes.</td></tr>
      <tr><td>Sector</td><td>Mapped from the snapshot's DefiLlama category by the stated table in the entry's model file (Lending → DeFi · Lending, Dexs → DeFi · DEX, Derivatives → DeFi · Perps, and so on).</td></tr>
      <tr><td>X handle, website</td><td>DefiLlama's live protocol records (its twitter and url fields), fetched 2026-11-23 and baked into the repository as data, because the program runs with no network. Shown as text. A protocol with no record shows none; none is guessed.</td></tr>
      <tr><td>Money raised</td><td>DefiLlama's raises records, read per protocol on 2026-11-23 and totalled in the repository's data. A dash means no round is on that record — never an estimate.</td></tr>
      <tr><td>Signals</td><td>Checked by hand on 2026-11-23 against the source named on each row (the protocol's own docs, its team's public statements, and reporting of them).</td></tr>
      <tr><td>Implied value, farm plan</td><td>The entry's own work, derived from the fields above by the stated model; the plan's ticket, gas and holding window come from the protocol's own TVL, first chain and age.</td></tr>
    </table>
    <h3>Beyond DefiLlama</h3>
    <p>The board's rows are the snapshot's protocols — the bounty gate accepts no other slugs in the ranked board. A sweep for credible pre-token protocols DefiLlama does not track (November 2026) added none: the strongest candidates (Lighter, Paradex, GRVT, Pacifica, StandX, Ethereal, Extended) each turned out to be tracked by DefiLlama after all, or to have launched a token already, or both. Rather than pad the board with unverifiable names, the radar says so.</p>
    <h3>Reading the numbers</h3>
    <p>“Records no token” is what DefiLlama's record says, never proof a protocol has none. An implied value is this board's own claim about what a launch would be worth if the record stayed as it is; it does not predict that a token will be issued, or when, and a signal is evidence a team has hinted at one — not a promise to any reader.</p>
  </div></section>`;
  window.scrollTo(0, 0);
}

/* ---------- go ---------- */

function render() {
  const route = parseRoute();
  if (route.view === 'detail') {
    document.querySelectorAll('#nav button').forEach((b) => b.classList.remove('on'));
    renderDetail(route.slug);
  } else if (route.segment === 'method') {
    renderMethod();
  } else {
    renderBoard(route);
  }
}

document.querySelectorAll('#nav button').forEach((b) =>
  b.addEventListener('click', () => {
    const seg = b.getAttribute('data-seg');
    if (seg === 'method') location.hash = '#/method';
    else go({ segment: seg, sector: '', chain: '', q: '', min: '', sort: '', dir: '' });
  }),
);
window.addEventListener('hashchange', render);
render();
