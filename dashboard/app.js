// Launch Radar page: a sortable, filterable board of pre-token protocols, a
// detail view per protocol with the model's arithmetic and its farm plan, and
// the traded set shown apart at the market's own values. No network: every
// number comes from ../data.js, written by the entry program.

'use strict';

const R = window.RADAR;
const view = document.getElementById('view');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** $1.23B, $45.6M, $789K, $123: compact dollars for tables. */
function money(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

/** Full dollars with separators, for the detail view. */
const moneyFull = (n) => (n === null || n === undefined ? '—' : `$${Math.round(n).toLocaleString('en-US')}`);

function pct(n) {
  if (n === null || n === undefined) return '<span class="flat">n/a</span>';
  const cls = n > 0.05 ? 'up' : n < -0.05 ? 'down' : 'flat';
  return `<span class="${cls}">${n > 0 ? '+' : ''}${n.toFixed(1)}%</span>`;
}

function ageText(days) {
  if (days === null || days === undefined) return 'untracked';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30.4)} mo`;
  return `${(days / 365.25).toFixed(1)} yrs`;
}

const bySlug = new Map(R.rows.map((r) => [r.slug, r]));
const liveBySlug = new Map(R.live.map((r) => [r.slug, r]));

/* ---------- header and footer ---------- */

document.getElementById('masthead-stats').innerHTML = [
  [R.counts.scanned, 'protocols scanned'],
  [R.counts.watchlist, 'on the watchlist'],
  [R.counts.board, 'ranked pre-token'],
  [R.counts.live, 'already traded'],
]
  .map(([v, k]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
  .join('');

const W = R.weights;
document.getElementById('model-line').innerHTML =
  `The model (${esc(R.model_version)}): implied value = TVL × peer multiple × momentum × tenure × reach. ` +
  `A category's peer multiple is the median market-cap/TVL of its traded protocols in this snapshot ` +
  `(global median ×${R.global_multiple.toFixed(2)} where a category has under ${W.min_category_peers} traded peers, clamped to ×${W.multiple_floor}–×${W.multiple_cap}). ` +
  `Momentum weighs the 7-day TVL change at ${W.momentum_weight}, clamped to ${W.momentum_floor_pct}%…+${W.momentum_cap_pct}%. ` +
  `Tenure runs ×${W.tenure_base}–×${(W.tenure_base + W.tenure_span).toFixed(2)} over ${W.tenure_window_days} days of tracking. ` +
  `Reach adds ${Math.round(W.reach_per_chain * 100)}% per extra chain, up to ${W.reach_max_extra_chains}.`;
document.getElementById('source-line').textContent = `Data: ${R.source}. Snapshot as of ${R.as_of}. Watchlist floor: ${moneyFull(R.floor_usd)} of TVL.`;

/* ---------- routing ---------- */

function parseRoute() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, query] = hash.split('?');
  const params = new URLSearchParams(query ?? '');
  if (path.startsWith('/p/')) return { view: 'detail', slug: decodeURIComponent(path.slice(3)) };
  return {
    view: 'board',
    segment: params.get('segment') ?? 'all',
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    chain: params.get('chain') ?? '',
    min: params.get('min') ?? '',
    sort: params.get('sort') ?? 'value',
  };
}

function boardHash(state) {
  const params = new URLSearchParams();
  if (state.segment !== 'all') params.set('segment', state.segment);
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.chain) params.set('chain', state.chain);
  if (state.min) params.set('min', state.min);
  if (state.sort !== 'value') params.set('sort', state.sort);
  const qs = params.toString();
  return `#/${qs ? `?${qs}` : ''}`;
}

function go(state) {
  location.hash = boardHash(state);
}

/* ---------- board ---------- */

const SEGMENTS = [
  ['all', 'All pre-token'],
  ['watchlist', 'Watchlist'],
  ['early', 'Early radar'],
  ['live', 'Already traded'],
];

const SORTS = { value: 'Implied value', tvl: 'TVL', change: '7d change', age: 'Age', name: 'Name' };

function filteredRows(state) {
  let rows = R.rows;
  if (state.segment === 'watchlist') rows = rows.filter((r) => r.on_watchlist);
  if (state.segment === 'early') rows = rows.filter((r) => !r.on_watchlist);
  if (state.category) rows = rows.filter((r) => (r.category ?? 'Uncategorized') === state.category);
  if (state.chain) rows = rows.filter((r) => r.chains.includes(state.chain));
  if (state.min) rows = rows.filter((r) => r.tvl_usd >= Number(state.min));
  if (state.q) {
    const q = state.q.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q));
  }
  const by = {
    value: (a, b) => b.implied_value_usd - a.implied_value_usd,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    change: (a, b) => (b.change_7d ?? -Infinity) - (a.change_7d ?? -Infinity),
    age: (a, b) => (b.age_days ?? -1) - (a.age_days ?? -1),
    name: (a, b) => a.name.localeCompare(b.name),
  }[state.sort];
  return [...rows].sort(by);
}

function controlsHTML(state) {
  const categories = [...new Set(R.rows.map((r) => r.category ?? 'Uncategorized'))].sort();
  const chains = [...new Set(R.rows.flatMap((r) => r.chains))].sort();
  const opt = (value, current, label) => `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`;
  return `<div class="controls">
    <div class="segments" role="group" aria-label="Board segment">
      ${SEGMENTS.map(([k, label]) => `<button data-seg="${k}" aria-pressed="${state.segment === k}">${label}</button>`).join('')}
    </div>
    <label>Search <input type="search" id="f-q" value="${esc(state.q)}" placeholder="name or slug"></label>
    <label>Category <select id="f-category">${opt('', state.category, 'All categories')}${categories.map((c) => opt(c, state.category, c)).join('')}</select></label>
    <label>Chain <select id="f-chain">${opt('', state.chain, 'All chains')}${chains.map((c) => opt(c, state.chain, c)).join('')}</select></label>
    <label>Min TVL <select id="f-min">
      ${[['', 'Any'], ['10000000', '$10M'], ['50000000', '$50M'], ['250000000', '$250M'], ['1000000000', '$1B']].map(([v, l]) => opt(v, state.min, l)).join('')}
    </select></label>
    <span class="result-count" id="result-count"></span>
  </div>`;
}

function boardTableHTML(state) {
  const rows = filteredRows(state);
  const head = (key, label, cls = '') =>
    `<th class="sortable ${cls}" data-sort="${key}">${label}${state.sort === key ? ' ↓' : ''}</th>`;
  const body = rows
    .map(
      (r) => `<tr data-slug="${esc(r.slug)}">
        <td class="rank">${r.rank}</td>
        <td><strong>${esc(r.name)}</strong><span class="sub">${esc(r.category ?? 'Uncategorized')}</span></td>
        <td><span class="pill ${r.on_watchlist ? 'watch' : 'early'}">${r.on_watchlist ? 'Watchlist' : 'Early'}</span></td>
        <td class="hide-s">${esc(r.chains.slice(0, 3).join(', '))}${r.chains.length > 3 ? ` +${r.chains.length - 3}` : ''}</td>
        <td class="num">${money(r.tvl_usd)}</td>
        <td class="num">${pct(r.change_7d)}</td>
        <td class="num hide-s">${ageText(r.age_days)}</td>
        <td class="num value">${money(r.implied_value_usd)}</td>
        <td class="num hide-s">×${(r.implied_value_usd / r.tvl_usd).toFixed(2)}</td>
        <td><span class="plan-link">Farm plan →</span></td>
      </tr>`,
    )
    .join('');
  return { count: rows.length, html: `<div class="board-wrap"><table class="board">
    <thead><tr><th>#</th>${head('name', 'Protocol')}<th>Set</th><th class="hide-s">Chains</th>${head('tvl', 'TVL')}${head('change', '7d')}${head('age', 'Age', 'hide-s')}${head('value', 'Implied value')}<th class="hide-s">Impl / TVL</th><th></th></tr></thead>
    <tbody>${body || '<tr><td colspan="10" class="dim">No protocol matches these filters.</td></tr>'}</tbody></table></div>` };
}

function liveTableHTML(state) {
  let rows = R.live;
  if (state.q) {
    const q = state.q.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q));
  }
  if (state.chain) rows = rows.filter((r) => r.chains.includes(state.chain));
  const body = rows
    .map(
      (r) => `<tr>
        <td><strong>${esc(r.name)}</strong><span class="sub">${esc(r.category ?? 'Uncategorized')}</span></td>
        <td class="hide-s">${esc(r.chains.slice(0, 3).join(', '))}</td>
        <td class="num">${money(r.tvl_usd)}</td>
        <td class="num">${pct(r.change_7d)}</td>
        <td class="num value">${money(r.mcap_usd)}</td>
        <td class="num">${r.tvl_multiple !== null ? `×${r.tvl_multiple.toFixed(2)}` : '—'}</td>
      </tr>`,
    )
    .join('');
  return {
    count: rows.length,
    html: `<div class="board-wrap"><table class="board">
    <thead><tr><th>Protocol</th><th class="hide-s">Chains</th><th>TVL</th><th>7d</th><th>Market cap (the market's own)</th><th>Mcap / TVL</th></tr></thead>
    <tbody>${body}</tbody></table></div>
    <p class="dim">These protocols already have a token: the board shows the market's own value and never ranks them. Their market-cap/TVL ratios are the peer multiples the model borrows.</p>`,
  };
}

function renderBoard(state) {
  const isLive = state.segment === 'live';
  const table = isLive ? liveTableHTML(state) : boardTableHTML(state);
  view.innerHTML = controlsHTML(state) + table.html;
  document.getElementById('result-count').textContent = `${table.count} shown`;
  wireControls(state);
}

function wireControls(state) {
  const rerender = (patch) => go({ ...state, ...patch });
  view.querySelectorAll('[data-seg]').forEach((b) =>
    b.addEventListener('click', () => rerender({ segment: b.getAttribute('data-seg') })),
  );
  const q = document.getElementById('f-q');
  q.addEventListener('change', () => rerender({ q: q.value.trim() }));
  const cat = document.getElementById('f-category');
  cat.addEventListener('change', () => rerender({ category: cat.value }));
  const chain = document.getElementById('f-chain');
  chain.addEventListener('change', () => rerender({ chain: chain.value }));
  const min = document.getElementById('f-min');
  min.addEventListener('change', () => rerender({ min: min.value }));
  view.querySelectorAll('th.sortable').forEach((th) =>
    th.addEventListener('click', () => rerender({ sort: th.getAttribute('data-sort') })),
  );
  view.querySelectorAll('tbody tr[data-slug]').forEach((tr) =>
    tr.addEventListener('click', () => {
      location.hash = `#/p/${encodeURIComponent(tr.getAttribute('data-slug'))}`;
    }),
  );
}

/* ---------- detail ---------- */

function factorRow(name, note, value, barFrac) {
  return `<div class="factor"><span class="fname">${name}<span class="sub">${note}</span></span>
    <span class="fbar"><i style="width:${Math.round(barFrac * 100)}%"></i></span>
    <span class="fval">×${value.toFixed(3)}</span></div>`;
}

function renderDetail(slug) {
  const r = bySlug.get(slug);
  if (r === undefined) {
    const live = liveBySlug.get(slug);
    view.innerHTML = `<a class="back" href="#/">← Back to the board</a><p>${live ? `${esc(live.name)} already has a token; it is in the Already traded set.` : 'No such protocol on this board.'}</p>`;
    return;
  }
  const m = r.model;
  const cards = [
    ['Implied value', moneyFull(r.implied_value_usd), `rank #${r.rank} of ${R.counts.board}`],
    ['TVL', moneyFull(r.tvl_usd), `${esc(r.chains.join(', ') || 'no chains recorded')}`],
    ['7-day TVL change', r.change_7d === null ? 'not reported' : `${r.change_7d > 0 ? '+' : ''}${r.change_7d.toFixed(2)}%`, 'the momentum input'],
    ['Tracked for', r.age_days === null ? 'unknown' : `${r.age_days} days`, r.listed_at ? `since ${r.listed_at}` : 'no listing date recorded'],
    ['Set', r.on_watchlist ? 'Watchlist' : 'Early radar', r.on_watchlist ? `at or above the ${money(R.floor_usd)} floor, no token recorded` : 'below the floor, found by the radar'],
    ['Category', r.category ?? 'Uncategorized', `${m.peer_count > 0 ? `${m.peer_count} traded peers set its multiple` : 'multiple is the global median'}`],
  ];
  view.innerHTML = `
    <a class="back" href="#/">← Back to the board</a>
    <div class="detail-head">
      <div><h2>${esc(r.name)}</h2><p class="dim">${esc(r.category ?? 'Uncategorized')} · records no token · ${esc(r.slug)}</p></div>
      <span class="pill ${r.on_watchlist ? 'watch' : 'early'}">${r.on_watchlist ? 'Watchlist' : 'Early radar'}</span>
    </div>
    <div class="detail-grid">${cards.map(([k, v, n]) => `<div class="card"><div class="k">${k}</div><div class="v">${v}</div><div class="n">${n}</div></div>`).join('')}</div>
    <section class="panel">
      <h3>How the model gets ${money(r.implied_value_usd)}</h3>
      <p class="formula">implied = TVL ${moneyFull(r.tvl_usd)} × peer ×${m.peer_multiple.toFixed(3)} × momentum ×${m.momentum_multiplier.toFixed(3)} × tenure ×${m.tenure_multiplier.toFixed(3)} × reach ×${m.reach_multiplier.toFixed(3)}</p>
      ${factorRow('Peer multiple', m.peer_scope === 'category' ? `median mcap/TVL of ${esc(r.category ?? 'its category')}'s traded protocols` : 'global median: too few traded peers in its category', m.peer_multiple, m.peer_multiple / W.multiple_cap)}
      ${factorRow('Momentum', 'its 7-day TVL change, weighted and clamped', m.momentum_multiplier, (m.momentum_multiplier - 0.85) / 0.5)}
      ${factorRow('Tenure', 'how long it has run with no token', m.tenure_multiplier, m.tenure_multiplier)}
      ${factorRow('Reach', 'chains it operates on', m.reach_multiplier, (m.reach_multiplier - 1) / 0.16)}
    </section>
    <section class="panel">
      <h3>Farm plan</h3>
      <ol class="steps">${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    </section>`;
}

/* ---------- go ---------- */

function render() {
  const route = parseRoute();
  if (route.view === 'detail') renderDetail(route.slug);
  else renderBoard(route);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();
