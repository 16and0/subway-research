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

/* ── CHART.JS — 성능 비교 ─────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const ctx = document.getElementById('metricsChart');
  if (!ctx || typeof Chart === 'undefined') return;

  // Normalize to 0-1 for radar-style grouped bar
  // Better approach: show actual values in grouped bars
  const labels  = ['TL (km)', 'WMD (km)', 'FT', 'Cent'];
  const actual  = [423.93, 12.07, 0.8886, 0.1798];
  const algo    = [444.08, 12.61, 0.9300, 0.0888];

  // Normalize each metric to [0,1] using a fixed reference scale
  const scales  = [500, 15, 1, 0.3];
  const actualN = actual.map((v,i) => +(v/scales[i]).toFixed(4));
  const algoN   = algo.map((v,i)   => +(v/scales[i]).toFixed(4));

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '실제 서울 지하철',
          data: actualN,
          backgroundColor: 'rgba(100,116,139,0.75)',
          borderColor: '#64748b',
          borderWidth: 1.5,
          borderRadius: 6,
        },
        {
          label: '호선 기반 알고리즘',
          data: algoN,
          backgroundColor: 'rgba(59,130,246,0.75)',
          borderColor: '#3b82f6',
          borderWidth: 1.5,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { family: 'Noto Sans KR', size: 11 }, padding: 16 },
        },
        title: {
          display: true,
          text: '정규화 비교 (각 지표 최대값 기준)',
          font: { family: 'Noto Sans KR', size: 12, weight: '600' },
          color: '#64748b',
          padding: { bottom: 12 },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const raw = ctx.datasetIndex === 0 ? actual : algo;
              return ` ${ctx.dataset.label}: ${raw[ctx.dataIndex]}`;
            },
          },
          bodyFont: { family: 'Noto Sans KR' },
          titleFont: { family: 'Noto Sans KR' },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 1.1,
          ticks: { font: { family: 'Noto Sans KR', size: 10 } },
          grid: { color: 'rgba(0,0,0,.06)' },
        },
        x: { ticks: { font: { family: 'Noto Sans KR', size: 11 } } },
      },
      animation: { duration: 1000, easing: 'easeOutQuart' },
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
