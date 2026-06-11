/* =================================================================
   호선 기반 알고리즘 — 7단계 인터랙티브 노선도 뷰어
   subway_stages.js(window.SUBWAY_STAGES)를 읽어 SVG로 단계별 렌더링
   ================================================================= */
(function () {
  const DATA = window.SUBWAY_STAGES;
  const svg  = document.getElementById('stageSvg');
  if (!DATA || !svg) return;

  // ── 단계별 개념·수식 설명 (오른쪽 패널) ──────────────────────
  const CONCEPT = {
    1: `
      <div class="eq-block">
        <div class="eq-title">등거리 평면 투영</div>
        <div class="eq-body">$$x=(\\text{lon}-\\text{lon}_{\\min})\\,111.32\\cos\\bar\\varphi,\\;\\; y=(\\text{lat}-\\text{lat}_{\\min})\\,111.0$$</div>
        <div class="eq-note">위·경도(°)를 km로 변환. 이후 거리는 유클리드 $\\lVert u-v\\rVert$.</div>
      </div>`,
    2: `
      <div class="eq-block">
        <div class="eq-title">볼록껍질 (Quickhull)</div>
        <div class="eq-note">점들을 감싸는 최소 볼록 다각형. 껍질 위 가장 먼 두 역 $(u^*,v^*)=\\arg\\max\\lVert u-v\\rVert$을 종점으로.</div>
      </div>
      <div class="eq-block">
        <div class="eq-title">다익스트라 뼈대 · 거리 세제곱 가중</div>
        <div class="eq-body">$$w(u,v)=\\lVert u-v\\rVert^{3}$$</div>
        <div class="eq-note">세제곱 = 초장거리 페널티. 인접 거리 ≤ 임계 3.5 km만 간선 채택, 안쪽으로 박피 반복.</div>
      </div>`,
    3: `
      <div class="eq-block">
        <div class="eq-title">고립 파편 흡수</div>
        <div class="eq-note">역 ≤ 3개 조각을 최근접 거대 호선에 편입.<br>
          ① ≤ 3.5 km 직접 · ② 아니면 재귀 다리(선분까지 ≤ 2.8 km 경유) · ③ 실패 시 지선.</div>
      </div>`,
    4: `
      <div class="eq-block">
        <div class="eq-title">재귀 봉합 · 선분 투영</div>
        <div class="eq-body">$$t=\\frac{(w-u)\\cdot(v-u)}{\\lVert v-u\\rVert^{2}}$$</div>
        <div class="eq-note">같은 호선의 끊긴 조각을 최근접 쌍부터: ≤ 3.5 km 직접, 아니면 선분 위 최근접 역을 끼워 재귀.</div>
      </div>`,
    5: `
      <div class="eq-block">
        <div class="eq-title">최소 신장 트리 (MST)</div>
        <div class="eq-body">$$T^{*}=\\arg\\min\\sum_{(i,j)\\in T} W_{ij}$$</div>
        <div class="eq-note">호선=정점, 가중치 $W_{ij}=\\min\\lVert u-v\\rVert$. 14호선을 13개 환승 링크로 최소비용 연결.</div>
      </div>`,
    6: `
      <div class="eq-block">
        <div class="eq-title">지름길 채택 조건</div>
        <div class="eq-body">$$d_y \\ge 7\\,d_x \\;\\wedge\\; \\text{hops} > 3$$</div>
        <div class="eq-note">후보 $d_x\\le 1.5$ km · $d_y$=그래프 최단거리. 사잇각 $\\theta<60^\\circ$ 본선 교체, $\\ge 60^\\circ$ 지선.</div>
      </div>`,
    7: `
      <div class="eq-block">
        <div class="eq-title">평가 지표</div>
        <div class="eq-body">$$TL=\\sum_e l_e,\\qquad WMD=\\frac{\\sum d_{uv} w_{uv}}{\\sum w_{uv}}$$</div>
        <div class="eq-body">$$FT=\\frac{|E|-|B|}{|E|},\\qquad Cent=\\frac{\\sum_i(bc_{\\max}-bc_i)}{n-1}$$</div>
        <div class="eq-note">TL·WMD 낮을수록, FT 높을수록, Cent 낮을수록 우수. $|B|$=브릿지 수.</div>
      </div>`
  };

  function typeset(el) {
    if (window.renderMathInElement) {
      window.renderMathInElement(el, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
        throwOnError: false
      });
    }
  }
  const conceptEl = document.getElementById('stConcept');

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

  // 모든 역 점은 항상 깔아둠 — 아주 옅게(검정 점 없앰)
  const HI = '#f59e0b';   // 변화 하이라이트 색(앰버)
  const nodeEls = DATA.nodes.map((n, i) => {
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', px(n.x));
    c.setAttribute('cy', py(n.y));
    c.setAttribute('r', 1.3);
    c.setAttribute('class', 'st-node');
    const t = document.createElementNS(SVGNS, 'title');
    t.textContent = n.name;
    c.appendChild(t);
    gNodes.appendChild(c);
    return c;
  });

  function styleForKind(kind, layer) {
    const color = layer >= 0 ? LAYER_COLORS[layer % LAYER_COLORS.length] : '#94a3b8';
    if (kind === 'transfer') return { stroke: '#94a3b8', width: 1.4, dash: '2 3' };
    if (kind === 'main')     return { stroke: color, width: 3.4, dash: '6 4' };
    if (kind === 'branch')   return { stroke: color, width: 1.9, dash: null  };
    return { stroke: color, width: 2.4, dash: null };          // normal
  }

  const pairKey = (u, v) => (u < v ? u + '_' + v : v + '_' + u);

  function mkLine(a, b, stroke, width, dash, opacity) {
    const ln = document.createElementNS(SVGNS, 'line');
    ln.setAttribute('x1', px(a.x)); ln.setAttribute('y1', py(a.y));
    ln.setAttribute('x2', px(b.x)); ln.setAttribute('y2', py(b.y));
    ln.setAttribute('stroke', stroke);
    ln.setAttribute('stroke-width', width);
    ln.setAttribute('stroke-linecap', 'round');
    ln.setAttribute('opacity', opacity);
    if (dash) ln.setAttribute('stroke-dasharray', dash);
    return ln;
  }

  // ── 한 단계 렌더 ───────────────────────────────────────────
  let current = 1;
  function render(stageIdx) {
    current = stageIdx;
    const stage = DATA.stages[stageIdx - 1];
    const prev  = stageIdx > 1 ? DATA.stages[stageIdx - 2] : null;

    // 이전 단계의 간선/연결역 (변화 감지용)
    const prevPairs  = new Set((prev ? prev.edges : []).map(e => pairKey(e.u, e.v)));
    const prevActive = new Set(prev ? prev.activeNodes : []);
    // (역쌍 + 소속 호선) 조합 — 같은 역쌍이 여러 호선에 있어도 오탐 없게
    const prevKL     = new Set((prev ? prev.edges : []).map(e => pairKey(e.u, e.v) + '|' + e.layer));
    const isInitial  = prevPairs.size === 0;        // 첫 생성(2단계): 전체를 컬러로

    // 이번 단계의 '변화' 간선 = 새로 생겼거나(흡수 다리·환승·지름길)
    //   소속 호선이 바뀐(=다른 호선으로 흡수된 조각) 간선. 단 connector(지름길 보조)는 제외.
    function changeOf(e) {
      if (e.kind === 'connector') return false;
      return !prevKL.has(pairKey(e.u, e.v) + '|' + e.layer);
    }
    const changedEdges = isInitial ? [] : stage.edges.filter(changeOf);
    const hasNew = changedEdges.length > 0;

    // 노드 → 소속 호선(레이어) 매핑 (환승 간선이 잇는 호선 판별용)
    const nodeLayer = {};
    stage.edges.forEach(e => {
      if (e.layer >= 0) { nodeLayer[e.u] = e.layer; nodeLayer[e.v] = e.layer; }
    });
    // 이번 단계에 변화 간선이 잇는(=강조할) 호선 집합
    const involved = new Set();
    changedEdges.forEach(e => {
      if (e.layer >= 0) involved.add(e.layer);
      else {                                        // 환승 간선: 양 끝점의 호선
        if (nodeLayer[e.u] != null) involved.add(nodeLayer[e.u]);
        if (nodeLayer[e.v] != null) involved.add(nodeLayer[e.v]);
      }
    });

    // 쌓는 순서: 디밍(맨 아래) → 강조 호선 → 변화 간선 글로우 → 변화 간선(맨 위)
    gEdges.replaceChildren();
    const hostLines = [], glowLines = [], newLines = [];

    stage.edges.forEach(e => {
      const a = DATA.nodes[e.u], b = DATA.nodes[e.v];
      const s = styleForKind(e.kind, e.layer);

      if (isInitial || !hasNew) {
        // 2단계(첫 생성) 또는 변화 없는 단계(7) → 전체 컬러로 밝게
        gEdges.appendChild(mkLine(a, b, s.stroke, s.width, s.dash, e.kind === 'transfer' ? 0.55 : 0.95));
      } else if (changeOf(e)) {
        // 이번 단계 변화 간선 → 앰버 글로우 + 앰버 본선(종류 불문 확실히 보임)
        glowLines.push(mkLine(a, b, HI, s.width + 7, null, 0.35));
        newLines.push(mkLine(a, b, HI, s.width + 1.4, s.dash, 1));
      } else if (e.layer >= 0 && involved.has(e.layer)) {
        // 변화 간선이 잇는 호선 → 자기 색으로 또렷하게(다른 느낌)
        hostLines.push(mkLine(a, b, s.stroke, s.width, s.dash, 0.9));
      } else {
        // 무관한 기존 간선 → 어둡게 디밍
        gEdges.appendChild(mkLine(a, b, s.stroke, s.width, s.dash, 0.18));
      }
    });
    hostLines.forEach(ln => gEdges.appendChild(ln));
    glowLines.forEach(ln => gEdges.appendChild(ln));
    newLines.forEach(ln => gEdges.appendChild(ln));

    // 노드: 연결된 역도 옅게, 이번 단계에 새로 연결된 역만 하이라이트
    const active = new Set(stage.activeNodes);
    nodeEls.forEach((c, i) => {
      const on    = active.has(i);
      const isNew = on && hasNew && !prevActive.has(i);
      if (isNew) {
        c.setAttribute('r', 2.8); c.setAttribute('fill', HI);
        c.setAttribute('opacity', 1); c.style.filter = 'none';
      } else if (on) {
        c.setAttribute('r', 1.3); c.setAttribute('fill', '#94a3b8'); c.setAttribute('opacity', 0.5);
      } else {
        c.setAttribute('r', 1.3); c.setAttribute('fill', '#cbd5e1'); c.setAttribute('opacity', 0.4);
      }
    });

    // 버튼 활성 상태
    document.querySelectorAll('.st-btn').forEach(btn => {
      btn.classList.toggle('active', +btn.dataset.stage === stageIdx);
    });

    // 캡션
    document.getElementById('stNum').textContent = stage.index;
    document.getElementById('stTitle').textContent = stage.title;
    document.getElementById('stDesc').textContent = stage.desc;

    // 개념·수식 패널 갱신 + KaTeX 렌더
    if (conceptEl) {
      conceptEl.innerHTML = CONCEPT[stageIdx] || '';
      typeset(conceptEl);
    }

    // 통계 (간선/연결역, 이번 단계 추가량) + 최종 지표
    const countEl = document.getElementById('stCount');
    const addTxt = hasNew ? ` · 이번 단계 변화 ${changedEdges.length}개(밝게 강조)` : '';
    countEl.textContent = `연결된 역 ${active.size}개 · 간선 ${stage.edges.length}개${addTxt}`;

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
