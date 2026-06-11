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
        <div class="eq-body">$$x=(\\text{lon}-\\text{lon}_{\\min})\\cdot 111.32\\cos\\bar\\varphi,\\quad y=(\\text{lat}-\\text{lat}_{\\min})\\cdot 111.0$$</div>
        <div class="eq-note">위·경도(°)를 km 평면으로 변환. $\\bar\\varphi$는 평균 위도, 1° ≈ 111 km. 이후 모든 거리는 유클리드 거리 $\\lVert u-v\\rVert$.</div>
      </div>
      <div class="key-finding">
        <h4>이 단계의 역할</h4>
        <ul><li>서울시 <strong>403개 역</strong>을 좌표점으로 배치(아직 간선 없음)</li>
        <li>다음 단계부터 이 점들을 호선으로 묶어 나감</li></ul>
      </div>`,
    2: `
      <div class="key-finding">
        <h4>볼록껍질(Convex Hull)이란?</h4>
        <ul><li>주어진 점들을 <strong>모두 포함하는 가장 작은 볼록 다각형</strong> — 점들에 고무줄을 씌운 바깥 경계</li>
        <li>본 연구는 <strong>Quickhull</strong>(분할 정복, 평균 $O(n\\log n)$)으로 계산</li></ul>
      </div>
      <div class="eq-block">
        <div class="eq-title">층별 종점 선정 — 껍질 위 최원거리 쌍</div>
        <div class="eq-body">$$(u^*,v^*)=\\arg\\max_{u,v\\,\\in\\,\\mathrm{CH}(S_k)}\\lVert u-v\\rVert$$</div>
      </div>
      <div class="eq-block">
        <div class="eq-title">뼈대 = 다익스트라 최단경로 (거리 세제곱 가중)</div>
        <div class="eq-body">$$w(u,v)=\\lVert u-v\\rVert^{3}$$</div>
        <div class="eq-note">세제곱 가중치는 초장거리 한 방에 잇는 경로에 큰 페널티를 줘, 가까운 역들을 징검다리로 잇는 자연스러운 노선을 유도.</div>
      </div>
      <div class="eq-block">
        <div class="eq-title">박피(Peeling) + 간선 채택 조건</div>
        <div class="eq-body">$$\\lVert u-v\\rVert \\le \\text{THRESHOLD}=3.5\\,\\text{km}$$</div>
        <div class="eq-note">경로의 역들을 한 호선으로 확정·제거한 뒤, 남은 안쪽 점들로 같은 과정을 반복(껍질을 한 겹씩 벗김).</div>
      </div>`,
    3: `
      <div class="key-finding">
        <h4>고립 파편(orphan)의 정의</h4>
        <ul><li>호선이 끊겨 생긴 연결 요소 중 <strong>역 수 ≤ 3</strong>(MAX_ORPHAN_SIZE)인 작은 조각</li>
        <li>역 수가 그보다 큰 조각은 거대(giant) 호선으로 분류</li></ul>
      </div>
      <div class="eq-block">
        <div class="eq-title">편입 대상 — 가장 가까운 거대 호선</div>
        <div class="eq-body">$$d=\\min_{u\\in O,\\;v\\in G}\\lVert u-v\\rVert$$</div>
      </div>
      <div class="eq-block">
        <div class="eq-title">연결 조건(단계적)</div>
        <div class="eq-note">
          ① $d\\le 3.5\\,\\text{km}$ → 직접 연결<br>
          ② 아니면 <strong>재귀 다리</strong>: 선분 $uv$까지 거리 $\\le 0.8\\cdot\\text{THRESHOLD}=2.8\\,\\text{km}$인 가장 가까운 역을 끼워 재귀<br>
          ③ 그래도 실패 → 지선으로 직접 연결
        </div>
      </div>`,
    4: `
      <div class="key-finding">
        <h4>이 단계의 목표</h4>
        <ul><li>같은 호선 안에서 끊긴 <strong>큰 조각들(연결 요소 ≥ 2)</strong>을 하나로 봉합</li>
        <li>가장 가까운 두 조각 쌍부터 차례로 이음 → 모두 연결될 때까지 반복</li></ul>
      </div>
      <div class="eq-block">
        <div class="eq-title">가장 가까운 조각 쌍</div>
        <div class="eq-body">$$\\min_{u\\in C_i,\\;v\\in C_j}\\lVert u-v\\rVert$$</div>
      </div>
      <div class="eq-block">
        <div class="eq-title">재귀 다리 — 선분 위 수선의 발 투영</div>
        <div class="eq-body">$$t=\\frac{(w-u)\\cdot(v-u)}{\\lVert v-u\\rVert^{2}},\\quad p=u+t\\,(v-u)$$</div>
        <div class="eq-note">두 역 거리 $\\le 3.5$ km면 직접 연결, 아니면 선분 $uv$에 가장 가까운 역 $p$를 끼워 양쪽을 재귀적으로 봉합(분할 정복).</div>
      </div>`,
    5: `
      <div class="key-finding">
        <h4>왜 환승 링크가 필요한가</h4>
        <ul><li>여기까지는 호선들이 <strong>서로 떨어진 섬</strong> — 전체가 하나로 연결되지 않음</li>
        <li>각 호선을 하나의 정점으로 보고 최소 비용으로 전부 연결</li></ul>
      </div>
      <div class="eq-block">
        <div class="eq-title">호선 그래프의 간선 가중치</div>
        <div class="eq-body">$$W_{ij}=\\min_{u\\in L_i,\\;v\\in L_j}\\lVert u-v\\rVert$$</div>
        <div class="eq-note">두 호선 사이 가장 가까운 역쌍의 거리.</div>
      </div>
      <div class="eq-block">
        <div class="eq-title">최소 신장 트리(MST)</div>
        <div class="eq-body">$$T^{*}=\\arg\\min_{T\\subseteq G_\\mathcal{L}}\\sum_{(i,j)\\in T}W_{ij}$$</div>
        <div class="eq-note">$k$개 호선을 $k-1$개 환승 링크로 사이클 없이 연결(여기선 14호선 → 13개 링크).</div>
      </div>`,
    6: `
      <div class="key-finding">
        <h4>지름길(Shortcut)을 넣는 이유</h4>
        <ul><li>물리적으로 가까운데 <strong>그래프상 한참 돌아가는</strong> 역쌍을 직접 이어 우회를 단축</li></ul>
      </div>
      <div class="eq-block">
        <div class="eq-title">후보와 판정값</div>
        <div class="eq-note">후보: 직선거리 $d_x=\\lVert u-v\\rVert \\le 1.5$ km인 다른 역쌍 · $d_y$ = 현재 그래프 최단경로 길이 · hops = 최소 정거장 수</div>
      </div>
      <div class="eq-block">
        <div class="eq-title">지름길 채택 조건</div>
        <div class="eq-body">$$d_y \\ge \\lambda\\, d_x \\;\\wedge\\; \\text{hops} > 3,\\quad \\lambda=7$$</div>
      </div>
      <div class="eq-block">
        <div class="eq-title">사잇각 $\\theta$로 분류</div>
        <div class="eq-note">$\\theta<60^\\circ$ → <strong>본선 편입</strong>(기존 간선 교체) · $\\theta\\ge 60^\\circ$ → <strong>지선 편입</strong>(추가)</div>
      </div>`,
    7: `
      <div class="eq-block">
        <div class="eq-title">총 길이 — 경제성 (↓ 좋음)</div>
        <div class="eq-body">$$TL=\\sum_{e\\in E} l_e$$</div>
      </div>
      <div class="eq-block">
        <div class="eq-title">가중 평균 이동거리 — 효율성 (↓)</div>
        <div class="eq-body">$$WMD=\\frac{\\sum_{u\\ne v} d_{uv}\\,w_{uv}}{\\sum_{u\\ne v} w_{uv}}$$</div>
        <div class="eq-note">$w_{uv}$는 두 역의 이용객 곱(수요 가중).</div>
      </div>
      <div class="eq-block">
        <div class="eq-title">고장 허용성 — 신뢰성 (↑)</div>
        <div class="eq-body">$$FT=\\frac{|E|-|B|}{|E|}$$</div>
        <div class="eq-note">$|B|$ = 브릿지(끊기면 망이 분리되는 간선) 수.</div>
      </div>
      <div class="eq-block">
        <div class="eq-title">매개중심성 집중도 — 트래픽 분산 (↓)</div>
        <div class="eq-body">$$Cent=\\frac{\\sum_i (\\,bc_{\\max}-bc_i\\,)}{n-1}$$</div>
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
