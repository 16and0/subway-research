/* ── NAVBAR SCROLL ────────────────────────────────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.style.background = window.scrollY > 60
    ? 'rgba(15,23,42,0.97)'
    : 'rgba(15,23,42,0.92)';
});

/* ── IMAGE MODAL ──────────────────────────────────────────── */
const modal   = document.getElementById('modal');
const modalImg= document.getElementById('modal-img');
const modalCap= document.getElementById('modal-caption');

function openModal(el) {
  const img = el.tagName === 'IMG' ? el : el.querySelector('img');
  const cap = el.querySelector?.('.viz-caption strong')?.textContent || '';
  modalImg.src = img.src;
  modalCap.textContent = cap;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ── CHART.JS — 3개 알고리즘 비교 ────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const ctx = document.getElementById('metricsChart');
  if (!ctx || typeof Chart === 'undefined') return;

  // FT 기준 정규화 비교 (FT: 높을수록 좋음 → 그대로, 나머지: 낮을수록 좋음 → 역수 정규화)
  // 레이더 형태로 "더 클수록 좋은" 방향으로 통일
  // 지표: FT (높을수록 좋음), Cent역 (낮을수록 좋음 → 1-x), TL역, WMD역
  const rawData = {
    labels: ['FT\n(신뢰성↑)', '1−Cent\n(분산성↑)', 'TL 효율\n(경제성↑)', 'WMD 효율\n(접근성↑)'],
    seoul:  [0.889,  1-0.180, 1-423.93/500, 1-12.07/18],
    slime:  [0.95,   1-0.04,  1-4500/5000,  1-10.0/18],
    algo:   [0.930,  1-0.089, 1-444.08/500, 1-12.61/18],
  };

  const rawActual = { FT:0.889, Cent:0.180, TL:423.93, WMD:12.07 };
  const rawSlime  = { FT:0.95,  Cent:0.04,  TL:4500,   WMD:10.0  };
  const rawAlgo   = { FT:0.930, Cent:0.089, TL:444.08, WMD:12.61 };

  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: rawData.labels,
      datasets: [
        { label:'실제 서울 지하철', data:rawData.seoul, backgroundColor:'rgba(100,116,139,.15)', borderColor:'#64748b', borderWidth:2, pointBackgroundColor:'#64748b', pointRadius:4 },
        { label:'점균류 알고리즘',  data:rawData.slime, backgroundColor:'rgba(76,114,176,.15)',  borderColor:'#4C72B0', borderWidth:2, pointBackgroundColor:'#4C72B0', pointRadius:4 },
        { label:'호선 기반 알고리즘', data:rawData.algo, backgroundColor:'rgba(85,168,104,.2)', borderColor:'#55A868', borderWidth:2.5, pointBackgroundColor:'#55A868', pointRadius:5 },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position:'top', labels:{ font:{family:'Noto Sans KR',size:11}, padding:14 } },
        title: { display:true, text:'알고리즘 성능 레이더 (정규화, 바깥쪽이 우수)', font:{family:'Noto Sans KR',size:12,weight:'600'}, color:'#64748b', padding:{bottom:8} },
        tooltip: {
          callbacks: {
            label: c => {
              const d = [rawActual, rawSlime, rawAlgo][c.datasetIndex];
              const keys = ['FT','Cent','TL','WMD'];
              const vals = [d.FT, d.Cent, d.TL, d.WMD];
              return ` ${c.dataset.label}: ${vals[c.dataIndex]}`;
            },
          },
          bodyFont:{family:'Noto Sans KR'}, titleFont:{family:'Noto Sans KR'},
        },
      },
      scales: {
        r: {
          min:0, max:1, ticks:{ stepSize:.2, font:{size:9} },
          pointLabels:{ font:{family:'Noto Sans KR',size:10} },
          grid:{ color:'rgba(0,0,0,.08)' },
        },
      },
      animation:{ duration:1000, easing:'easeOutQuart' },
    },
  });
});

/* ── SCROLL REVEAL (기본) ─────────────────────────────────── */
const observer = new IntersectionObserver(
  entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.style.opacity = '1'; e.target.style.transform = 'translateY(0)'; }
  }),
  { threshold: 0.12 }
);

document.querySelectorAll('.algo-card, .viz-card, .step, .concl-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity .55s ease, transform .55s ease';
  observer.observe(el);
});
