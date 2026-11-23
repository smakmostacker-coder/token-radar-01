// Launch Radar page: four views — All protocols (every protocol in the
// snapshot: the ranked board first, then the already-traded and the
// screened-out, each tagged with its status), Top protocols (the biggest
// by TVL), Early protocols (tracked under six months) and the Watchlist
// (the house list plus protocols carrying a sourced airdrop signal) —
// plus a detail view per protocol and a method page. Only All carries the
// board's rank numbers; Top, Early and Watchlist number their rows in the
// order shown. No network: every figure comes from ../data.js, written by
// the entry program. Socials and links are shown as text, never as live
// links.

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
const catBySlug = new Map(R.catalogue.map((c) => [c.slug, c]));
const kitCount = R.rows.filter((r) => r.on_watchlist).length;
const confirmedRows = R.rows.filter((r) => r.signal?.confirmed);
const confirmedCount = confirmedRows.length;

/* ---------- header, stats, footer ---------- */

document.getElementById('stats').innerHTML = [
  [R.counts.scanned, 'protocols scanned'],
  [R.counts.board, 'ranked pre-token'],
  [confirmedCount, 'confirmed airdrops'],
  [R.counts.traded, 'already traded'],
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
    blurb: 'Every protocol in the snapshot. The ranked board comes first, in rank order — ranked by implied value: what its token would be worth if it launched today at the multiple its own category already trades at. Below it, every other protocol, tagged with its status: already traded, or not ranked with the screen’s reason.',
    rows: () => R.catalogue,
  },
  top: {
    title: 'Top protocols',
    blurb: `The ${TOP_N} biggest ranked protocols by TVL — the most established names still without a token. Numbered here by TVL, largest first; each protocol's board rank is on its detail page.`,
    rows: () => [...R.rows].sort((a, b) => b.tvl_usd - a.tvl_usd).slice(0, TOP_N),
  },
  early: {
    title: 'Early protocols',
    blurb: `Protocols DefiLlama has tracked for ${EARLY_DAYS} days or fewer — newly launched or newly listed, small but live, and still without a token.`,
    rows: () => R.rows.filter((r) => r.age_days !== null && r.age_days <= EARLY_DAYS),
  },
  watchlist: {
    title: 'Watchlist',
    blurb: 'Confirmed airdrops only: a protocol belongs here when its team has publicly committed to a token and an airdrop — an explicit public statement by the team or its leadership, or an official points-to-token conversion commitment. Points programmes, roadmap mentions, rumours and likely-someday hints do not qualify. Every row states its confirmation and its source.',
    rows: () => R.rows.filter((r) => r.signal?.confirmed),
  },
};

function whyLine(r) {
  if (r.signal) return `<b>Confirmed:</b> ${esc(r.signal.note)} <span>— ${esc(r.signal.source)} · ${esc(r.signal.ref)}</span>`;
  return `<b>House list:</b> records no token at or above the ${money(R.floor_usd)} TVL floor in the snapshot's DefiLlama record.`;
}

/* ---------- board ---------- */

const SORTS = {
  rank: (a, b) => (a.seq ?? a.rank) - (b.seq ?? b.rank),
  name: (a, b) => a.name.localeCompare(b.name),
  tvl: (a, b) => b.tvl_usd - a.tvl_usd,
  change: (a, b) => (b.change_7d ?? -1e9) - (a.change_7d ?? -1e9),
  implied: (a, b) => (b.implied_value_usd ?? -1) - (a.implied_value_usd ?? -1),
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

/**
 * A ranked-board row for Top, Early and Watchlist. The number is the
 * view's own sequence — the row's position in the order shown, renumbered
 * whenever the view is sorted or filtered — never the board rank (that
 * lives on the detail page). Tags appear in the Watchlist view alone.
 */
function rowHTML(r, state, idx) {
  const tags = state.segment === 'watchlist' ? '<span class="tag wl">WATCHLIST</span>' : '';
  const main = `<tr data-slug="${esc(r.slug)}">
    <td class="rank">${idx + 1}</td>
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

/**
 * A catalogue row for All: ranked protocols carry their board rank and
 * implied value; every other protocol carries its status tag instead —
 * already traded, or not ranked with the screen's reason.
 */
function allRowHTML(c) {
  const tag = c.status === 'ranked' ? '' : `<span class="tag off">${esc(c.status_tag)}</span>`;
  return `<tr data-slug="${esc(c.slug)}">
    <td class="rank">${c.rank ?? '—'}</td>
    <td><span class="pname">${esc(c.name)}</span>${tag}${socialsHTML(c)}</td>
    <td class="sector">${esc(c.sector_label)}</td>
    <td class="chains">${esc(c.chains.slice(0, 2).join(', '))}${c.chains.length > 2 ? ` +${c.chains.length - 2}` : ''}</td>
    <td class="num">${money(c.tvl_usd)}</td>
    <td class="num">${pctCell(c.change_7d)}</td>
    <td class="num">${c.implied_value_usd === null ? '—' : `<b>${money(c.implied_value_usd)}</b>`}</td>
    <td class="num">${money(c.raised_usd)}</td>
    <td class="num">${ageText(c.age_days)}</td>
  </tr>`;
}

function renderBoard(state) {
  const seg = SEGMENTS[state.segment];
  const segRows = seg.rows();
  const sectors = [...new Set(segRows.map((r) => r.sector))].sort();
  const chains = [...new Set(segRows.flatMap((r) => r.chains))].sort();
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
  </section>`;

  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.getAttribute('data-seg') === state.segment));
  const update = () => {
    const rows = filteredRows(state);
    document.getElementById('tbody').innerHTML = rows.length
      ? rows.map((r, i) => (state.segment === 'all' ? allRowHTML(r) : rowHTML(r, state, i))).join('')
      : '<tr><td colspan="9" class="empty">No protocol matches these filters.</td></tr>';
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

/** Detail for a protocol the board does not rank: its status, its figures, and why it is unranked. */
function renderCatalogueDetail(c, back) {
  const raisedBox = c.raised_usd === null
    ? '<p>No fundraising round is on DefiLlama’s record for this protocol.</p>'
    : `<p><b>${moneyFull(c.raised_usd)}</b> across ${c.raised_rounds} recorded round${c.raised_rounds === 1 ? '' : 's'} (DefiLlama raises records).</p>`;
  const statusBox = c.status === 'traded'
    ? `<section class="box"><h3>Status — already traded</h3><p>Its token already exists, so it is not a launch candidate and the model never scores it. It is listed at the market's own values; its category's market-cap/TVL ratios are among the peer multiples the model reads.</p></section>`
    : `<section class="box"><h3>Status — ${esc(c.status_label.toLowerCase())}</h3><p>The screen leaves it unranked: the ranked board is for independent protocols still to launch, and this is ${esc(c.status_label.replace(/^Not ranked — /, ''))}. It stays visible here so the screen's working can be checked, not hidden.</p></section>`;
  view.innerHTML = `
  ${back}
  <div class="detail-head">
    <h2>${esc(c.name)}<span class="tag off">${esc(c.status_tag)}</span></h2>
    <p class="detail-meta">${esc(c.sector_label)} · ${esc(c.chains.join(', ') || 'no chains recorded')} · ${esc(c.status_label.toLowerCase())}${c.twitter ? ` · <span class="x">X @${esc(c.twitter)}</span>` : ''}${c.website ? ` · ${esc(siteText(c.website))}` : ''}</p>
  </div>
  <section class="stats dgrid">
    ${[
      [moneyFull(c.tvl_usd), 'TVL'],
      [c.mcap_usd === null ? 'no token recorded' : moneyFull(c.mcap_usd), c.mcap_usd === null ? 'token record' : `market cap${c.symbol ? ` · ${esc(c.symbol)}` : ''}`],
      [c.change_7d === null ? 'n/a' : `${c.change_7d > 0 ? '+' : ''}${c.change_7d.toFixed(2)}%`, 'TVL change, 7 days'],
      [c.age_days === null ? 'unknown' : `${c.age_days} days`, 'tracked by DefiLlama'],
    ]
      .map(([v, k]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
      .join('')}
  </section>
  <div class="cols">
    ${statusBox}
    <section class="box">
      <h3>Money raised</h3>
      ${raisedBox}
    </section>
  </div>`;
  window.scrollTo(0, 0);
}

function renderDetail(slug) {
  const r = bySlug.get(slug);
  const back = `<button class="backbtn" onclick="history.back()">← Back</button>`;
  if (r === undefined) {
    const c = catBySlug.get(slug);
    if (c === undefined) {
      view.innerHTML = back + '<p>No such protocol in the snapshot.</p>';
      return;
    }
    renderCatalogueDetail(c, back);
    return;
  }
  const m = r.model;
  const raisedBox = r.raised_usd === null
    ? '<p>No fundraising round is on DefiLlama’s record for this protocol.</p>'
    : `<p><b>${moneyFull(r.raised_usd)}</b> across ${r.raised_rounds} recorded round${r.raised_rounds === 1 ? '' : 's'} (DefiLlama raises records).</p>`;
  view.innerHTML = `
  ${back}
  <div class="detail-head">
    <h2>${esc(r.name)}${r.signal?.confirmed ? '<span class="tag wl">WATCHLIST</span>' : ''}</h2>
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
      ${r.signal?.confirmed ? `<section class="box sigbox"><h3>On the watchlist — confirmed airdrop</h3><p>${whyLine(r)}</p></section>` : ''}
      ${r.signal && !r.signal.confirmed ? `<section class="box"><h3>Airdrop signal — not confirmed</h3><p><b>Signal:</b> ${esc(r.signal.note)} <span>— ${esc(r.signal.source)} · ${esc(r.signal.ref)}</span></p><p>A signal is not a public commitment to a token and an airdrop, so this protocol is not on the Watchlist tab, which holds confirmed airdrops only.</p></section>` : ''}
      ${!r.signal && r.on_watchlist ? `<section class="box"><h3>On the house list</h3><p>The bounty's own watchlist: it records no token at or above the ${money(R.floor_usd)} TVL floor in the snapshot's DefiLlama record, and the gate requires it ranked on this board. House-list membership is a coverage rule, not an airdrop confirmation — the Watchlist tab holds only protocols whose team has publicly committed to a token and an airdrop, and no such commitment is on record for this one.</p></section>` : ''}
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
    <p><b>All protocols</b> lists every protocol in the snapshot (${R.counts.scanned}): the ranked board first, in rank order, then the ${R.counts.traded} already traded and the ${R.counts.screened} the screen leaves unranked, each tagged with its status and, for the unranked, the screen's reason. Only All carries the board's rank numbers. <b>Top protocols</b> is the board's ${TOP_N} largest by TVL (the snapshot carries no trading-volume field, so size is TVL and the activity gauge shown is the 7-day TVL change), numbered by TVL. <b>Early protocols</b> is tracked for ${EARLY_DAYS} days or fewer. Top, Early and Watchlist number their rows in the order shown.</p>
    <p><b>Watchlist</b> is confirmed airdrops only. A protocol joins it when its team has publicly committed to a token and an airdrop — an explicit public statement by the team or its leadership, or an official points-to-token conversion commitment — with the statement's source named on its row. On this snapshot ${confirmedCount} protocol qualifies: ${confirmedRows.map((r) => esc(r.name)).join(', ')}. A points programme, a roadmap mention, a rumour or a likely-someday hint is a signal, not a confirmation: marginfi (points carried into its Project 0 relaunch; a token named in a later roadmap), Loopscale (points live; a conversion reported by a third-party tracker, not committed by the team) and Hyperbeat (a points programme and a ticker purchase) carry sourced signals, recorded on their detail pages, and stay off this tab. The house list (${kitCount} protocols) is the bounty's own list, not this tab: the gate requires every house-list protocol ranked on the board, and all ${kitCount} are — but house-list membership follows the house's coverage rule (no token recorded, at or above the floor), and is not an airdrop confirmation, so it does not put a protocol on the Watchlist tab. The genre's textbook signal, Sol Incinerator's airdrop-teasing post, would still not qualify its protocol here — a tease is not a commitment — and Sol Incinerator is not in the snapshot anyway (it sits below the snapshot's TVL floor).</p>
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
