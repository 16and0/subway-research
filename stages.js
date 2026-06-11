/* =================================================================
   호선 기반 알고리즘 — 7단계 인터랙티브 노선도 뷰어
   subway_stages.js(window.SUBWAY_STAGES)를 읽어 SVG로 단계별 렌더링
   ================================================================= */
(function () {
  const DATA = window.SUBWAY_STAGES;
  const svg  = document.getElementById('stageSvg');
  if (!DATA || !svg) return;

  const SVGNS = 'http://www.w3.org/2000/svg';

  // 14개 호선 구분 색 (matplotlib tab20 계열 근사)
  const LAYER_COLORS = [
    '#4C72B0', '#DD8452', '#55A868', '#C44E52', '#8172B3',
    '#937860', '#DA8BC3', '#8C8C8C', '#CCB974', '#64B5CD',
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'
  ];

  // ── 좌표 → 화면 픽셀 스케일 (종횡비 유지, y 뒤집기) ──────────
  const W = 760, M = 24;
  const xs = DATA.nodes.map(n => n.x), ys = DATA.nodes.map(n => n.y);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const scale = (W - 2 * M) / (xmax - xmin);
  const H = Math.round(scale * (ymax - ymin) + 2 * M);
  const px = x => M + (x - xmin) * scale;
  const py = y => M + (ymax - y) * scale;   // y축 뒤집기(북쪽이 위)

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // 레이어: 간선(아래) → 노드(위)
  const gEdges = document.createElementNS(SVGNS, 'g');
  const gNodes = document.createElementNS(SVGNS, 'g');
  svg.appendChild(gEdges);
  svg.appendChild(gNodes);

  // 모든 역 점은 항상 깔아둠(연결 안 된 역은 흐리게)
  const nodeEls = DATA.nodes.map((n, i) => {
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', px(n.x));
    c.setAttribute('cy', py(n.y));
    c.setAttribute('r', 2.2);
    c.setAttribute('class', 'st-node');
    const t = document.createElementNS(SVGNS, 'title');
    t.textContent = n.name;
    c.appendChild(t);
    gNodes.appendChild(c);
    return c;
  });

  function styleForKind(kind, layer) {
    const color = layer >= 0 ? LAYER_COLORS[layer % LAYER_COLORS.length] : '#94a3b8';
    if (kind === 'transfer') return { stroke: '#94a3b8', width: 1.2, dash: '2 3', opacity: 0.6 };
    if (kind === 'main')     return { stroke: color, width: 3.4, dash: '6 4', opacity: 0.95 };
    if (kind === 'branch')   return { stroke: color, width: 1.8, dash: null,  opacity: 0.9 };
    return { stroke: color, width: 2.3, dash: null, opacity: 0.92 };          // normal
  }

  // ── 한 단계 렌더 ───────────────────────────────────────────
  let current = 1;
  function render(stageIdx) {
    current = stageIdx;
    const stage = DATA.stages[stageIdx - 1];

    // 간선 다시 그림
    gEdges.replaceChildren();
    stage.edges.forEach(e => {
      const a = DATA.nodes[e.u], b = DATA.nodes[e.v];
      const ln = document.createElementNS(SVGNS, 'line');
      ln.setAttribute('x1', px(a.x)); ln.setAttribute('y1', py(a.y));
      ln.setAttribute('x2', px(b.x)); ln.setAttribute('y2', py(b.y));
      const s = styleForKind(e.kind, e.layer);
      ln.setAttribute('stroke', s.stroke);
      ln.setAttribute('stroke-width', s.width);
      ln.setAttribute('stroke-linecap', 'round');
      ln.setAttribute('opacity', s.opacity);
      if (s.dash) ln.setAttribute('stroke-dasharray', s.dash);
      gEdges.appendChild(ln);
    });

    // 연결된 역 강조
    const active = new Set(stage.activeNodes);
    nodeEls.forEach((c, i) => {
      if (active.has(i)) { c.setAttribute('r', 2.8); c.classList.add('on'); }
      else               { c.setAttribute('r', 2.2); c.classList.remove('on'); }
    });

    // 버튼 활성 상태
    document.querySelectorAll('.st-btn').forEach(btn => {
      btn.classList.toggle('active', +btn.dataset.stage === stageIdx);
    });

    // 캡션
    document.getElementById('stNum').textContent = stage.index;
    document.getElementById('stTitle').textContent = stage.title;
    document.getElementById('stDesc').textContent = stage.desc;

    // 통계 (간선/연결역) + 최종 지표
    const countEl = document.getElementById('stCount');
    countEl.textContent = `연결된 역 ${active.size}개 · 간선 ${stage.edges.length}개`;

    const mEl = document.getElementById('stMetrics');
    if (stage.metrics) {
      const m = stage.metrics;
      mEl.innerHTML =
        `<span class="st-m"><b>TL</b> ${m.TL} km</span>` +
        `<span class="st-m"><b>WMD</b> ${m.WMD} km</span>` +
        `<span class="st-m good"><b>FT</b> ${m.FT}</span>` +
        `<span class="st-m good"><b>Cent</b> ${m.Cent}</span>`;
      mEl.style.display = 'flex';
    } else {
      mEl.style.display = 'none';
      mEl.innerHTML = '';
    }
  }

  // ── 컨트롤 연결 ────────────────────────────────────────────
  document.querySelectorAll('.st-btn').forEach(btn => {
    btn.addEventListener('click', () => { stopPlay(); render(+btn.dataset.stage); });
  });

  const prevBtn = document.getElementById('stPrev');
  const nextBtn = document.getElementById('stNext');
  if (prevBtn) prevBtn.addEventListener('click', () => { stopPlay(); render(Math.max(1, current - 1)); });
  if (nextBtn) nextBtn.addEventListener('click', () => { stopPlay(); render(Math.min(7, current + 1)); });

  // 자동 재생
  let timer = null;
  const playBtn = document.getElementById('stPlay');
  function stopPlay() {
    if (timer) { clearInterval(timer); timer = null; if (playBtn) playBtn.textContent = '▶ 자동 재생'; }
  }
  function startPlay() {
    if (current >= 7) render(1);
    if (playBtn) playBtn.textContent = '❚❚ 정지';
    timer = setInterval(() => {
      if (current >= 7) { stopPlay(); return; }
      render(current + 1);
    }, 1400);
  }
  if (playBtn) playBtn.addEventListener('click', () => { timer ? stopPlay() : startPlay(); });

  // 키보드 ← →
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { stopPlay(); render(Math.max(1, current - 1)); }
    if (e.key === 'ArrowRight') { stopPlay(); render(Math.min(7, current + 1)); }
  });

  render(1);
})();
