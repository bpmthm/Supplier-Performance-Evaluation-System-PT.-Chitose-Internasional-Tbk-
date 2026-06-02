/**
 * dashboard.js — Role-Aware Dashboard Integration
 * Memuat data dari API & merender sesuai role aktif
 */

document.addEventListener('DOMContentLoaded', async () => {
  const role = getActiveRole();

  try {
    // Ambil data aktual (heatmap) periode berjalan seperti di Master Rekap
    const periode = new Date().toISOString().slice(0, 7);
    const heatmap = await getHeatmapData(periode).catch(() => []);

    if (heatmap.length > 0) {
      // 1. Hitung KPI Summary dari data aktual
      const gradeA = heatmap.filter(h => h.grade === 'A' || h.grade === 'BAIK').length;
      const gradeC = heatmap.filter(h => h.grade === 'C' || h.grade === 'KURANG').length;
      const pending = heatmap.filter(h => !h.total_score || h.total_score == 0).length;

      const summary = {
        total_suppliers: heatmap.length,
        grade_a: gradeA,
        grade_c: gradeC,
        pending_input: pending
      };
      updateKPICards(summary, role);

      // 2. Top Performers chart dari data aktual
      const sorted = [...heatmap]
        .filter(h => h.total_score > 0)
        .sort((a, b) => (Number(b.total_score) || 0) - (Number(a.total_score) || 0));
      const top5 = sorted.slice(0, 5);
      
      if (top5.length > 0) {
        renderTopChart(top5);
      } else {
        const container = document.getElementById('top-chart');
        if (container) container.innerHTML = '<div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:13px">Belum ada data penilaian</div>';
      }

      // 3. Heatmap / critical alerts & Horizontal Bar Chart
      updateCriticalAlerts(heatmap);
      updateRadarFromHeatmap(heatmap);
    } else {
      // Handle jika heatmap kosong — update SEMUA section
      updateKPICards({ total_suppliers: 0, grade_a: 0, grade_c: 0, pending_input: 0 }, role);

      const topChart = document.getElementById('top-chart');
      if (topChart) topChart.innerHTML = '<div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:13px">Belum ada data periode ini</div>';

      const divisiChart = document.getElementById('divisi-chart');
      if (divisiChart) divisiChart.innerHTML = '<div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:13px"><span class="material-symbols-outlined" style="font-size:28px;display:block;margin-bottom:6px">analytics</span>Belum ada data penilaian untuk periode ini</div>';

      // Update alert ticker to neutral state
      updateCriticalAlerts([]);
    }

  } catch (err) {
    console.error('[Dashboard]', err);
  }
});

/**
 * Update KPI cards dengan animasi counter
 */
function updateKPICards(summary, role) {
  const map = {
    'kpi-total':    summary.total_suppliers || 0,
    'kpi-top':      summary.grade_a || 0,
    'kpi-critical': summary.grade_c || 0,
    'kpi-pending':  summary.pending_input || 0,
  };

  // Role-specific label overrides
  if (role === 'QC') {
    const lbl = document.getElementById('kpi-total-label');
    if (lbl) lbl.textContent = 'Supplier Aktif';
    const cl = document.getElementById('kpi-critical-label');
    if (cl) cl.textContent = '% NG Tinggi (>1%)';
  }

  Object.entries(map).forEach(([id, target]) => {
    const el = document.getElementById(id);
    if (!el) return;
    animateCounter(el, 0, target, 900);
  });
}

/**
 * Animasi counter angka
 */
function animateCounter(el, from, to, duration) {
  const start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * ease);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * Render top performers bar chart
 */
function renderTopChart(items) {
  const container = document.getElementById('top-chart');
  if (!container) return;

  const maxScore = Math.max(...items.map(i => Number(i.total_score) || 0), 100);
  container.innerHTML = items.map((item, idx) => {
    const pct = Math.round(((Number(item.total_score) || 0) / maxScore) * 100);
    const delay = idx * 120;
    return `
      <div class="anim-fadeInUp" style="animation-delay:${delay}ms">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <span style="font-size:12.5px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%">${item.nama_vendor || '—'}</span>
          <span style="font-size:12px;font-weight:650;color:#5b6af8;flex-shrink:0;margin-left:8px">${item.total_score || 0} pts</span>
        </div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="width:0%" data-target="${pct}"></div>
        </div>
      </div>`;
  }).join('');

  // Animate bars after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.querySelectorAll('.chart-bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.target + '%';
      });
    });
  });
}

/**
 * Update Horizontal Bar chart dari heatmap data (menggantikan radar)
 */
function updateRadarFromHeatmap(data) {
  const container = document.getElementById('divisi-chart');
  if (!container || !data.length) return;

  // 1. Update Subtitle Dinamis
  const subtitleEl = document.getElementById('divisi-subtitle');
  if (subtitleEl) {
    const today = new Date();
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    subtitleEl.textContent = `Akumulasi skor dari ${data.length} vendor pada ${months[today.getMonth()]} ${today.getFullYear()}`;
  }

  // 2. Helper kalkulasi nilai rata-rata & jumlah vendor yang sudah dinilai
  const getStats = (key, maxScore) => {
    const vals = data.map(d => Number(d[key]) || 0).filter(v => v > 0);
    const count = vals.length;
    const avg = count ? vals.reduce((a, b) => a + b, 0) / count : 0;
    
    // Konversi ke persentase berdasarkan max score (QC = 100% logicnya beda)
    let pct = 0;
    if (key === 'qc_ng_percent') {
      pct = avg > 0 ? Math.round(100 - avg) : 0;
    } else {
      pct = avg ? Math.round((avg / maxScore) * 100) : 0;
    }
    return { pct, count, avg };
  };

  const qc = getStats('qc_ng_percent', 100); 
  const ppic = getStats('ppic_ot_percent', 100); 
  const pch = getStats('pch_score', 25);
  const hse = getStats('hse_score', 10);

  // 3. Helper penentuan warna & icon berdasarkan persentase
  const getIndicator = (pct) => {
    if (pct >= 90) return { color: '#16a34a', bg: 'rgba(34,197,94,.1)', icon: 'trending_up', status: 'Bagus (Sesuai Target)' };
    if (pct >= 70) return { color: '#d97706', bg: 'rgba(245,158,11,.1)', icon: 'trending_flat', status: 'Cukup (Perlu Ditingkatkan)' };
    return { color: '#dc2626', bg: 'rgba(239,68,68,.1)', icon: 'trending_down', status: 'Kurang (Di Bawah Standar)' };
  };

  const items = [
    { label: 'Quality Control (QC)', stats: qc, detail: `Nilai Rata-rata NG: ${qc.avg.toFixed(2)}%` },
    { label: 'PPIC / Delivery', stats: ppic, detail: `Rata-rata On-Time: ${ppic.avg.toFixed(1)}%` },
    { label: 'Purchasing (PCH)', stats: pch, detail: `Rata-rata Poin: ${pch.avg.toFixed(1)} / 25` },
    { label: 'Health & Safety (HSE)', stats: hse, detail: `Rata-rata Poin: ${hse.avg.toFixed(1)} / 10` }
  ];

  container.innerHTML = items.map((item, idx) => {
    const delay = idx * 100;
    const ind = getIndicator(item.stats.pct);
    const detailLabel = item.detail.split(': ')[0];
    const detailValue = item.detail.split(': ')[1];
    const shortStatus = ind.status.split(' (')[0];

    return `
      <div class="anim-fadeInUp group relative" style="animation-delay:${delay}ms">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:12.5px;font-weight:650;color:#1e293b;cursor:help;border-bottom:1px dashed #cbd5e1">${item.label}</span>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12px;font-weight:750;color:${ind.color}">${item.stats.pct}%</span>
            <div style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:4px;background:${ind.bg}">
              <span class="material-symbols-outlined" style="font-size:12px;color:${ind.color};font-weight:700">${ind.icon}</span>
            </div>
          </div>
        </div>
        <div class="chart-bar-track" style="height:7px;background:rgba(226,232,240,.6)">
          <div class="chart-bar-fill" style="width:0%; background:${ind.color}; border-radius:9999px" data-target="${item.stats.pct}"></div>
        </div>

        <!-- Custom Floating Tooltip -->
        <div class="absolute bottom-full left-14 mb-2 w-[220px] bg-slate-800 text-white p-3 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-20 pointer-events-none">
          <div style="font-size:12px;font-weight:650;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.1)">Detail ${item.label.split(' (')[0]}</div>
          <div style="display:flex;flex-direction:column;gap:5px;font-size:11px">
            <div style="display:flex;justify-content:space-between">
              <span style="color:#94a3b8">Vendor dinilai</span>
              <span style="font-weight:600">${item.stats.count} Supplier</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:#94a3b8">${detailLabel}</span>
              <span style="font-weight:600">${detailValue}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:2px">
              <span style="color:#94a3b8">Status</span>
              <span style="font-weight:700;color:${ind.color}">${shortStatus}</span>
            </div>
          </div>
          <!-- Arrow indicator -->
          <div class="absolute top-full left-8 -mt-[1px] border-[6px] border-transparent border-t-slate-800"></div>
        </div>
      </div>`;
  }).join('');

  // Animate bars
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.querySelectorAll('.chart-bar-fill').forEach(bar => {
        bar.style.width = Math.min(Math.max(bar.dataset.target, 0), 100) + '%';
      });
    });
  });
}

/**
 * Update alert ticker
 */
function updateCriticalAlerts(data) {
  const critical = data.filter(d => d.grade === 'C' || d.grade === 'KURANG');
  const tickerEl = document.getElementById('alert-ticker');
  const textEl   = document.querySelector('[data-alert="ticker-text"]');

  if (critical.length === 0) {
    if (tickerEl) {
      tickerEl.style.background = 'rgba(34,197,94,.06)';
      tickerEl.style.borderColor = 'rgba(34,197,94,.18)';
      const icon = tickerEl.querySelector('.material-symbols-outlined');
      if (icon) { icon.textContent = 'check_circle'; icon.closest('div').style.background = '#22c55e'; }
    }
    if (textEl) { textEl.style.color = '#16a34a'; textEl.textContent = 'Semua supplier dalam kondisi baik. Tidak ada Grade C saat ini.'; }
    return;
  }

  const names = critical.map(s => s.nama_vendor || s.kode_vendor).join(' · ');
  if (textEl) textEl.textContent = `⚠ ${critical.length} Supplier Grade C: ${names} — Segera lakukan evaluasi berkala.`;
}
