/**
 * dashboard.js — Role-Aware Dashboard Integration
 * Memuat data dari API & merender sesuai role aktif
 */
let memoriDataDashboard = [];
let memoriPeriodeAktif = '';
document.addEventListener('DOMContentLoaded', async () => {
  const role = getActiveRole();

  // 1. Setup Dropdown Periode
  const selectPeriode = document.getElementById('dashboard-periode');
  if (selectPeriode) {
    populatePeriodeDropdown(selectPeriode);
    
    // Event Listener saat user ganti bulan
    selectPeriode.addEventListener('change', async (e) => {
      const selectedPeriode = e.target.value;
      await loadDashboardData(selectedPeriode, role);
    });
  }

  // 2. Load data awal (Periode bulan ini)
  const defaultPeriode = new Date().toISOString().slice(0, 7); // Format: YYYY-MM
  await loadDashboardData(defaultPeriode, role);
});

/**
 * Fungsi Utama Buat Narik dan Nampilin Data Dashboard
 */
async function loadDashboardData(periode, role) {
  try {
    // Tembak API Heatmap CI4 lo buat dapet data performa di bulan yang dipilih
    const heatmap = await getHeatmapData(periode).catch(() => []);
    memoriDataDashboard = heatmap;
    memoriPeriodeAktif = periode;
    if (heatmap.length > 0) {
      // 1. Hitung KPI Summary
      const gradeA = heatmap.filter(h => h.grade === 'A' || h.grade === 'BAIK').length;
      const gradeC = heatmap.filter(h => h.grade === 'C' || h.grade === 'KURANG').length;
      const pending = heatmap.filter(h => 
        (h.qc_ng_percent === null || h.qc_ng_percent === undefined || h.qc_ng_percent === '') ||
        (h.ppic_ot_percent === null || h.ppic_ot_percent === undefined || h.ppic_ot_percent === '') ||
        (h.pch_score === null || h.pch_score === undefined || h.pch_score === '') ||
        (h.hse_score === null || h.hse_score === undefined || h.hse_score === '')
      ).length;

      const summary = {
        total_suppliers: heatmap.length,
        grade_a: gradeA,
        grade_c: gradeC,
        pending_input: pending
      };
      updateKPICards(summary, role);

      // 2. Top Performers Chart
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

      // 3. Update Chart Divisi & Alert
      updateCriticalAlerts(heatmap);
      updateRadarFromHeatmap(heatmap);
      renderGradeDonut(heatmap);
    } else {
      // Jika kosong di bulan tersebut (Reset Semua UI)
      updateKPICards({ total_suppliers: 0, grade_a: 0, grade_c: 0, pending_input: 0 }, role);
      renderGradeDonut([]);

      const topChart = document.getElementById('top-chart');
      if (topChart) topChart.innerHTML = '<div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:13px">Belum ada data periode ini</div>';

      const divisiChart = document.getElementById('divisi-chart');
      if (divisiChart) divisiChart.innerHTML = '<div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:13px"><span class="material-symbols-outlined" style="font-size:28px;display:block;margin-bottom:6px">analytics</span>Belum ada data penilaian untuk periode ini</div>';

      updateCriticalAlerts([]);
    }


  } catch (err) {
    console.error('[Dashboard]', err);
  }
}

/**


/**
 * Isi Dropdown Periode (Mundur 6 Bulan ke belakang)
 */
function populatePeriodeDropdown(selectEl) {
  const d = new Date();
  selectEl.innerHTML = '';
  
  for (let i = 0; i < 6; i++) {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const val = `${year}-${month}`;
    
    // Format buat tampilan (e.g., "Mei 2026")
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    
    selectEl.add(new Option(label, val));
    d.setMonth(d.getMonth() - 1);
  }
}

// =========================================================
// Helper Functions (Tetap sama seperti aslinya)
// =========================================================

function updateKPICards(summary, role) {
  const map = {
    'kpi-total':    summary.total_suppliers || 0,
    'kpi-top':      summary.grade_a || 0,
    'kpi-critical': summary.grade_c || 0,
    'kpi-pending':  summary.pending_input || 0,
  };

  if (role === 'QC') {
    const cl = document.getElementById('kpi-critical-label');
    if (cl) cl.textContent = '% NG Tinggi (>1%)';
  }

  Object.entries(map).forEach(([id, target]) => {
    const el = document.getElementById(id);
    if (!el) return;
    animateCounter(el, 0, target, 900);
  });
}

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

function renderTopChart(items) {
  const container = document.getElementById('top-chart');
  if (!container) return;

  if (items.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:13px">Belum ada data penilaian</div>';
      return;
  }

  container.innerHTML = items.map((item, idx) => {
    const delay = idx * 100;
    
    let rankIcon = '';
    let rankBg = 'bg-slate-100 text-slate-500'; 
    
    if (idx === 0) {
        rankIcon = '🏆';
        rankBg = 'bg-amber-100 text-amber-600 border border-amber-200 shadow-sm';
    } else if (idx === 1) {
        rankIcon = '🥈';
        rankBg = 'bg-slate-200 text-slate-600 border border-slate-300 shadow-sm';
    } else if (idx === 2) {
        rankIcon = '🥉';
        rankBg = 'bg-orange-100 text-orange-600 border border-orange-200 shadow-sm';
    } else {
        rankIcon = `#${idx + 1}`;
    }
    const qc = item.qc_ng_percent || 0;
    const ppic = item.ppic_ot_percent || 0;

    return `
      <div class="anim-fadeInUp group p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all flex items-center justify-between" style="animation-delay:${delay}ms">
        
        <div class="flex items-center gap-3.5">
          <div class="w-9 h-9 rounded-full ${rankBg} flex items-center justify-center font-bold text-sm flex-shrink-0">
            ${rankIcon}
          </div>
          
          <div>
            <div class="text-[13px] font-bold text-slate-800">${item.nama_vendor || item.kode_vendor}</div>
            
            <div class="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
              <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[12px] text-emerald-500">fact_check</span> QC: <strong class="text-emerald-600">${qc}% NG</strong></span>
              <span class="text-slate-300">•</span>
              <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[12px] text-indigo-500">local_shipping</span> PPIC: <strong class="text-indigo-600">${ppic}% OT</strong></span>
            </div>
          </div>
        </div>

        <div class="text-right flex-shrink-0 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
          <div class="text-[14px] font-black text-indigo-600 leading-none">${item.total_score || 0}</div>
          <div class="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Poin</div>
        </div>
        
      </div>
    `;
  }).join('');
}

function updateRadarFromHeatmap(data) {
  const container = document.getElementById('divisi-chart');
  if (!container || !data.length) return;

  const getStats = (key, maxScore) => {
    const vals = data.map(d => Number(d[key]) || 0).filter(v => v > 0);
    const count = vals.length;
    const avg = count ? vals.reduce((a, b) => a + b, 0) / count : 0;
    
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

  const getIndicator = (pct) => {
    if (pct >= 90) return { color: '#16a34a', bg: 'rgba(34,197,94,.1)', icon: 'trending_up' };
    if (pct >= 70) return { color: '#d97706', bg: 'rgba(245,158,11,.1)', icon: 'trending_flat' };
    return { color: '#dc2626', bg: 'rgba(239,68,68,.1)', icon: 'trending_down' };
  };

  const items = [
    { 
      label: 'QC (Quality Control)', 
      stats: qc, 
      desc: `Rata-rata tingkat barang reject (NG) supplier bulan ini adalah <strong class="text-white">${qc.avg.toFixed(2)}%</strong>. ${qc.avg > 5 ? '<span class="text-red-400">Angka reject cukup tinggi.</span>' : '<span class="text-emerald-400">Kondisi stabil di bawah batas maksimal.</span>'}` 
    },
    { 
      label: 'PPIC / Delivery', 
      stats: ppic, 
      desc: `Tingkat ketepatan waktu pengiriman (On-Time) rata-rata mencapai <strong class="text-white">${ppic.avg.toFixed(1)}%</strong>. ${ppic.avg < 85 ? '<span class="text-red-400">Banyak supplier terlambat kirim.</span>' : '<span class="text-emerald-400">Mayoritas pengiriman tepat waktu.</span>'}` 
    },
    { 
      label: 'Purchasing (PCH)', 
      stats: pch, 
      desc: `Evaluasi gabungan untuk harga, MOQ, dan respons pelayanan berada di rata-rata <strong class="text-white">${pch.avg.toFixed(1)} dari 25 poin</strong> maksimal.` 
    },
    { 
      label: 'Health & Safety (HSE)', 
      stats: hse, 
      desc: `Tingkat kepatuhan dokumen kelengkapan dan APD supplier berada di angka rata-rata <strong class="text-white">${hse.avg.toFixed(1)} dari 10 poin</strong> maksimal.` 
    }
  ];

  container.innerHTML = items.map((item, idx) => {
    const delay = idx * 100;
    const ind = getIndicator(item.stats.pct);

    return `
      <div class="anim-fadeInUp group relative" style="animation-delay:${delay}ms">
        
        <div class="absolute bottom-full left-0 mb-2 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
          <div class="bg-slate-800 text-slate-300 text-[11px] p-3 rounded-xl shadow-xl leading-relaxed border border-slate-700">
            ${item.desc}
          </div>
          <div class="w-3 h-3 bg-slate-800 transform rotate-45 absolute -bottom-1.5 left-6 border-b border-r border-slate-700"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:12.5px;font-weight:650;color:#1e293b;cursor:help;border-bottom:1px dashed #94a3b8">${item.label}</span>
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
      </div>`;
  }).join('');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.querySelectorAll('.chart-bar-fill').forEach(bar => {
        bar.style.width = Math.min(Math.max(bar.dataset.target, 0), 100) + '%';
      });
    });
  });
}

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

// --- VARIABEL GLOBAL BUAT CHART ---
let gradeChartInstance = null;

function renderGradeDonut(data) {
  const ctx = document.getElementById('gradeDonutChart');
  if (!ctx) return;

  // Hancurkan chart lama kalau user ganti filter bulan (biar gak numpuk/glitch)
  if (gradeChartInstance) {
      gradeChartInstance.destroy();
  }

  const total = data.length;
  document.getElementById('donut-total').innerText = total;

  // Kalau datanya kosong, bikin chart abu-abu
  if (total === 0) {
      gradeChartInstance = new Chart(ctx, {
          type: 'doughnut',
          data: { datasets: [{ data: [1], backgroundColor: ['#f8fafc'], borderWidth: 0 }] },
          options: { cutout: '78%', responsive: true, maintainAspectRatio: false, animation: false, plugins: { tooltip: { enabled: false } } }
      });
      return;
  }

  // Hitung jumlah masing-masing grade
  const gradeA = data.filter(d => d.grade === 'A' || d.grade === 'BAIK').length;
  const gradeB = data.filter(d => d.grade === 'B' || d.grade === 'CUKUP').length;
  const gradeC = data.filter(d => d.grade === 'C' || d.grade === 'KURANG').length;

  // Gambar Chart-nya wuss wuss!
  gradeChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
          labels: ['Grade A (Baik)', 'Grade B (Cukup)', 'Grade C (Kurang)'],
          datasets: [{
              data: [gradeA, gradeB, gradeC],
              backgroundColor: [
                  '#22c55e', // Hijau
                  '#f59e0b', // Kuning
                  '#ef4444'  // Merah
              ],
              borderWidth: 3, // Jarak antar potongan
              borderColor: '#ffffff',
              hoverOffset: 6 // Efek pop-up pas disorot mouse
          }]
      },
      options: {
          cutout: '78%', // Ukuran bolongan donat (makin gede makin tipis rotinya)
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event, elements) => {
              if (elements.length > 0) {
                  const clickedIndex = elements[0].index; 
                  // index 0 = A, 1 = B, 2 = C
                  bukaModalDetailGrade(clickedIndex, data);
              }
          },
          plugins: {
              legend: { display: false }, // Legend default dimatiin biar clean
              tooltip: {
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  titleFont: { size: 13, family: 'Inter', weight: 'bold' },
                  bodyFont: { size: 12, family: 'Inter' },
                  padding: 12,
                  cornerRadius: 10,
                  displayColors: true,
                  callbacks: {
                      label: function(context) {
                          let value = context.parsed || 0;
                          let percentage = Math.round((value / total) * 100);
                          return ` ${value} Supplier (${percentage}%)`;
                      }
                  }
              }
          }
      }
  });
}

// =========================================================
// FITUR MODAL DETAIL GRADE (DONUT CHART CLICK)
// =========================================================

function bukaModalDetailGrade(index, semuaData) {
    // Mapping indeks chart ke Grade
    const gradeMap = ['A', 'B', 'C'];
    const gradePilihan = gradeMap[index];
    const warnaMap = { 'A': '#16a34a', 'B': '#d97706', 'C': '#dc2626' };
    const bgMap = { 'A': 'rgba(34,197,94,.1)', 'B': 'rgba(245,158,11,.1)', 'C': 'rgba(239,68,68,.1)' };

    // Filter data supplier yang masuk ke grade tersebut (A/BAIK, B/CUKUP, C/KURANG)
    const vendorList = semuaData.filter(d => {
        const g = d.grade ? d.grade.toUpperCase() : '';
        if (gradePilihan === 'A') return g === 'A' || g === 'BAIK';
        if (gradePilihan === 'B') return g === 'B' || g === 'CUKUP';
        if (gradePilihan === 'C') return g === 'C' || g === 'KURANG';
        return false;
    });

    if (vendorList.length === 0) {
        Swal.fire({ icon: 'info', title: 'Kosong', text: `Tidak ada supplier di Grade ${gradePilihan}`});
        return;
    }

    // Bangun HTML List Vendor pake gaya Tailwind
    let htmlContent = `<div class="flex flex-col gap-3 mt-4 max-h-[60vh] overflow-y-auto pr-2 text-left">`;
    
    vendorList.forEach(v => {
        const analisis = analisisPerformaVendor(v, gradePilihan);
        
        htmlContent += `
        <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <div class="text-[14px] font-bold text-slate-800">${v.nama_vendor || v.kode_vendor}</div>
                    <div class="text-[11px] font-semibold text-slate-500">Skor Total: <span style="color:${warnaMap[gradePilihan]}">${v.total_score || 0} pts</span></div>
                </div>
                <span class="px-2.5 py-1 rounded-md text-[11px] font-black" style="background:${bgMap[gradePilihan]}; color:${warnaMap[gradePilihan]}">
                    GRADE ${gradePilihan}
                </span>
            </div>
            
            <div class="mt-3 flex flex-col gap-1.5">
                ${analisis.kelebihan.length > 0 ? `
                <div class="flex items-start gap-2 text-[12px]">
                    <span class="material-symbols-outlined text-[16px] text-green-600 mt-0.5">check_circle</span>
                    <div><span class="font-semibold text-slate-700">Unggul:</span> <span class="text-slate-600">${analisis.kelebihan.join(', ')}</span></div>
                </div>` : ''}
                
                ${analisis.kelemahan.length > 0 ? `
                <div class="flex items-start gap-2 text-[12px]">
                    <span class="material-symbols-outlined text-[16px] text-red-500 mt-0.5">warning</span>
                    <div><span class="font-semibold text-slate-700">Kelemahan:</span> <span class="text-slate-600">${analisis.kelemahan.join(', ')}</span></div>
                </div>` : ''}
            </div>
        </div>`;
    });
    
    htmlContent += `</div>`;

    // Tembak SweetAlert
    Swal.fire({
        title: `<div class="text-xl font-bold text-slate-800">Daftar Supplier Grade ${gradePilihan}</div>`,
        html: htmlContent,
        width: 600,
        showConfirmButton: true,
        confirmButtonText: 'Tutup',
        buttonsStyling: false,
        customClass: {
            popup: 'rounded-2xl border border-slate-100 shadow-xl p-6',
            title: 'text-left border-b border-slate-100 pb-3',
            confirmButton: 'mt-6 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors w-full'
        }
    });
}

// Fungsi "AI" Sederhana buat ngebedah alasan performa
function analisisPerformaVendor(v, grade) {
    let kelebihan = [];
    let kelemahan = [];

    const qc = Number(v.qc_ng_percent) || 0;     // Kalo > 5% jelek
    const ppic = Number(v.ppic_ot_percent) || 0; // Kalo < 85% jelek
    const pch = Number(v.pch_score) || 0;        // Max 25, Kalo < 20 jelek
    const hse = Number(v.hse_score) || 0;        // Max 10, Kalo < 8 jelek

    // Cek QC
    if (qc <= 2) kelebihan.push(`Kualitas sangat stabil (NG ${qc}%)`);
    else if (qc > 5) kelemahan.push(`Reject/NG tinggi (${qc}%)`);

    // Cek PPIC
    if (ppic >= 95) kelebihan.push(`Pengiriman selalu On-Time (${ppic}%)`);
    else if (ppic < 85) kelemahan.push(`Sering telat kirim (${ppic}%)`);

    // Cek PCH
    if (pch >= 22) kelebihan.push(`Harga & Layanan PCH sangat baik`);
    else if (pch < 18) kelemahan.push(`Evaluasi Purchasing di bawah standar`);

    // Cek HSE
    if (hse >= 9) kelebihan.push(`Kepatuhan APD/HSE lengkap`);
    else if (hse < 7) kelemahan.push(`Dokumen/APD HSE kurang`);

    // Penyesuaian kalimat biar natural sesuai Grade
    if (grade === 'A' && kelebihan.length === 0) kelebihan.push('Performa stabil di semua divisi penilaian.');
    if (grade === 'C' && kelemahan.length === 0) kelemahan.push('Akumulasi skor di seluruh divisi sangat rendah.');

    return { kelebihan, kelemahan };
}

// =========================================================
// FITUR MODAL INTERAKTIF KPI CARDS
// =========================================================

function bukaModalKPI(jenis) {
    if (memoriDataDashboard.length === 0) {
        Swal.fire({ icon: 'info', title: 'Data Kosong', text: 'Tidak ada data supplier di periode ini.' });
        return;
    }

    const role = getActiveRole();
    let vendorList = [];
    let title = '';

    // Filter data berdasarkan kotak apa yang diklik
    if (jenis === 'total') {
        vendorList = memoriDataDashboard;
        title = 'Total Semua Supplier';
    } else if (jenis === 'top') {
        vendorList = memoriDataDashboard.filter(d => d.grade === 'A' || d.grade === 'BAIK');
        title = 'Top Performers (Grade A)';
    } else if (jenis === 'critical') {
        vendorList = memoriDataDashboard.filter(d => d.grade === 'C' || d.grade === 'KURANG');
        title = 'Supplier Perhatian (Grade C)';
    } else if (jenis === 'pending') {
        // Anggap pending kalau ada SATU SAJA divisi yang nilainya kosong/null
        vendorList = memoriDataDashboard.filter(d => {
             return (d.qc_ng_percent === null || d.qc_ng_percent === undefined || d.qc_ng_percent === '') ||
                    (d.ppic_ot_percent === null || d.ppic_ot_percent === undefined || d.ppic_ot_percent === '') ||
                    (d.pch_score === null || d.pch_score === undefined || d.pch_score === '') ||
                    (d.hse_score === null || d.hse_score === undefined || d.hse_score === '');
        });
        title = 'Menunggu Penilaian (Pending)';
    }

    if (vendorList.length === 0) {
        Swal.fire({ icon: 'success', title: 'Hebat!', text: 'Tidak ada supplier di kategori ini.', confirmButtonColor: '#4f46e5' });
        return;
    }

    // Bangun HTML List Vendor
    let htmlContent = `<div class="flex flex-col gap-3 mt-4 max-h-[60vh] overflow-y-auto pr-2 text-left">`;
    
    vendorList.forEach(v => {
        if (jenis === 'pending') {
            // --- LOGIC DETEKTIF: Siapa yang belum ngisi? ---
            let belum = [];
            let sudah = [];
            
            // Catatan: 0 adalah nilai sah buat QC NG persentase. Jadi kita cuma ngecek null/string kosong
            if (v.qc_ng_percent === null || v.qc_ng_percent === undefined || v.qc_ng_percent === '') belum.push('QC'); else sudah.push('QC');
            if (v.ppic_ot_percent === null || v.ppic_ot_percent === undefined || v.ppic_ot_percent === '') belum.push('PPIC'); else sudah.push('PPIC');
            if (v.pch_score === null || v.pch_score === undefined || v.pch_score === '') belum.push('PCH'); else sudah.push('PCH');
            if (v.hse_score === null || v.hse_score === undefined || v.hse_score === '') belum.push('HSE'); else sudah.push('HSE');

            // Cek apakah user yang lagi login termasuk yang nunggak kerjaan
            const isNunggakKerjaan = belum.includes(role);

            htmlContent += `
            <div class="p-4 rounded-xl border ${isNunggakKerjaan ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-slate-50/50'}">
                <div class="font-bold text-[14px] text-slate-800 border-b border-slate-200 pb-2 mb-2">${v.nama_vendor || v.kode_vendor}</div>
                
                <div class="flex flex-col gap-1.5 text-[12px]">
                    <div class="flex items-start gap-2">
                        <span class="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                        <div><span class="font-semibold text-slate-700">Sudah Masuk:</span> <span class="text-slate-600">${sudah.length > 0 ? sudah.join(', ') : '-'}</span></div>
                    </div>
                    <div class="flex items-start gap-2">
                        <span class="material-symbols-outlined text-[16px] text-red-500">hourglass_empty</span>
                        <div><span class="font-semibold text-slate-700">Belum Dinilai:</span> <span class="font-bold text-red-500">${belum.length > 0 ? belum.join(', ') : '-'}</span></div>
                    </div>
                </div>
                
                ${isNunggakKerjaan ? `
                <div class="mt-3 pt-3 border-t border-amber-200/50">
                    <button onclick="window.location.href='./input.html?vendor=${v.kode_vendor}&periode=${memoriPeriodeAktif}'" 
                            class="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-sm transition-all hover:-translate-y-0.5">
                        <span class="material-symbols-outlined text-[16px]">edit_document</span>
                        Selesaikan Penilaian ${role}
                    </button>
                </div>
                ` : ''}
            </div>`;
        } else {
            // --- LOGIC NORMAL BUAT TOTAL, GRADE A, GRADE C ---
            const analisis = typeof analisisPerformaVendor === 'function' ? analisisPerformaVendor(v, v.grade || '') : {kelebihan:[], kelemahan:[]};
            const gradeText = v.grade || 'N/A';
            
            htmlContent += `
            <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <div class="text-[14px] font-bold text-slate-800">${v.nama_vendor || v.kode_vendor}</div>
                        <div class="text-[11px] font-semibold text-slate-500">Skor Total: <span class="text-indigo-600">${v.total_score || 0} pts</span></div>
                    </div>
                    <span class="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">GRADE ${gradeText}</span>
                </div>
                <div class="mt-2 flex flex-col gap-1">
                    ${analisis.kelebihan.length > 0 ? `<div class="text-[11px] text-slate-600"><span class="text-green-600 font-bold">+</span> ${analisis.kelebihan[0]}</div>` : ''}
                    ${analisis.kelemahan.length > 0 ? `<div class="text-[11px] text-slate-600"><span class="text-red-500 font-bold">-</span> ${analisis.kelemahan[0]}</div>` : ''}
                </div>
            </div>`;
        }
    });

    htmlContent += `</div>`;

    // Tampilkan Modal
    Swal.fire({
        title: `<div class="text-xl font-bold text-slate-800">${title}</div>`,
        html: htmlContent,
        width: 600,
        showConfirmButton: true,
        confirmButtonText: 'Tutup',
        buttonsStyling: false,
        customClass: {
            popup: 'rounded-2xl border border-slate-100 shadow-xl p-6',
            title: 'text-left border-b border-slate-100 pb-3',
            confirmButton: 'mt-6 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold w-full'
        }
    });
}