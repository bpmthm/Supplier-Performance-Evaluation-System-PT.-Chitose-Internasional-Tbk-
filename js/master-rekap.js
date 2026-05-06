/**
 * Master Rekap Page
 * - Role protection (PCH / MANAGER / BOD / ADMIN only)
 * - Periode dropdown auto-generated
 * - Tabel di-populate dari API backend
 * - Fitur perbandingan 2 periode (2 bulan)
 * - Detail modal interaktif eksploratif & responsif (actual input data)
 */

const urlParams   = new URLSearchParams(window.location.search);
const activeRole  = (urlParams.get('role') || '').toUpperCase();
const allowedRoles = ['PCH', 'MANAGER', 'BOD', 'ADMIN'];

let currentPeriode = '';
let currentMode = 'monthly'; // 'monthly' atau 'compare'

// Global states untuk menyimpan data aktif
let currentMonthlyData = [];
let currentCompareData = { mapA: new Map(), mapB: new Map(), periodeA: '', periodeB: '' };

// ---- IIFE: jalankan role check SEBELUM DOM selesai ----
(function enforceRoleAccess() {
  if (!activeRole || !allowedRoles.includes(activeRole)) {
    // Tampilkan overlay akses ditolak dengan UI yang elegan di dalam tag main
    document.addEventListener('DOMContentLoaded', () => {
      const main = document.querySelector('main');
      if (main) {
        main.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full min-h-[70vh] text-center animate-fadeInUp">
            <div class="relative mb-6">
              <div class="absolute inset-0 bg-red-200 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <div class="relative w-28 h-28 bg-gradient-to-br from-red-50 to-red-100 rounded-full flex items-center justify-center shadow-md border-[6px] border-white">
                <span class="material-symbols-outlined text-[56px] text-red-500" style="font-variation-settings: 'FILL' 1;">gpp_bad</span>
              </div>
            </div>
            
            <h1 class="font-headline-xl text-[36px] font-bold text-slate-800 mb-3 tracking-tight bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Akses Ditolak</h1>
            
            <p class="text-slate-500 text-[15px] max-w-md mb-10 leading-relaxed">
              Maaf, Anda tidak memiliki izin untuk melihat halaman ini. Akses ke <strong>Master Rekap</strong> secara eksklusif dibatasi untuk divisi <strong class="text-slate-700">Purchasing, Manager, dan BOD</strong>.
            </p>
            
            <a href="dashboard.html?role=${activeRole || 'GUEST'}" 
               class="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 text-white font-semibold rounded-2xl overflow-hidden shadow-xl shadow-slate-900/20 hover:shadow-slate-900/30 transition-all duration-300 hover:-translate-y-1">
              <div class="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span class="material-symbols-outlined text-[20px] relative z-10 transition-transform duration-300 group-hover:-translate-x-1">arrow_back</span>
              <span class="relative z-10">Kembali ke Dashboard</span>
            </a>
          </div>
        `;
      }
      
      // Sembunyikan navbar rekap aktif agar tidak terlihat sedang di menu rekap
      const navRekap = document.getElementById('nav-rekap');
      if (navRekap) {
        navRekap.className = "text-slate-400 hover:text-white mx-2 px-4 py-2 flex items-center gap-3 hover:bg-slate-800 transition-all duration-150 active:scale-95 origin-left";
      }
    });
    return; // Hentikan eksekusi sisa script
  }
})();

document.addEventListener('DOMContentLoaded', async () => {
  // Jika role tidak diizinkan, halaman sudah diganti, hentikan
  if (!activeRole || !allowedRoles.includes(activeRole)) return;

  // Suntikkan style kustom untuk transisi & animasi modern
  injectCustomStyles();

  // Pasang role ke semua nav links agar tidak hilang saat berpindah halaman
  forwardRoleToNavLinks();

  // Build periode dropdown (rekap bulanan)
  setupPeriodeDropdown();

  // Build periode dropdown (perbandingan 2 bulan)
  setupCompareDropdowns();

  // Setup event tab switcher
  setupTabs();

  // Setup tombol bandingkan
  setupCompareButton();

  // Setup event listeners untuk click row (Detail Modal)
  setupRowDetailsClick();

  // Load data heatmap pertama kali
  await loadHeatmapData();
});

/** Suntikkan style kustom untuk transisi & animasi */
function injectCustomStyles() {
  if (!document.getElementById('custom-rekap-styles')) {
    const s = document.createElement('style');
    s.id = 'custom-rekap-styles';
    s.textContent = `
      @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      
      .animate-spin { animation: spin 1s linear infinite; }
      .animate-fadeIn { animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      .animate-fadeInUp { animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    `;
    document.head.appendChild(s);
  }
}

/** Forward ?role= ke semua link navbar */
function forwardRoleToNavLinks() {
  const navDashboard = document.getElementById('nav-dashboard');
  const navInput     = document.getElementById('nav-input');
  const navRekap     = document.getElementById('nav-rekap');

  if (navDashboard) navDashboard.href = `./dashboard.html?role=${activeRole}`;
  if (navInput)     navInput.href     = `./input.html?role=${activeRole}`;
  if (navRekap)     navRekap.href     = `./master-rekap.html?role=${activeRole}`;
}

/** Auto-generate dropdown periode (6 bulan terakhir) */
function setupPeriodeDropdown() {
  const select = document.querySelector('[data-select="periode"]');
  if (!select) return;

  const today      = new Date();
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni',
                      'Juli','Agustus','September','Oktober','November','Desember'];

  select.innerHTML = '';
  for (let i = 0; i <= 5; i++) {
    const d     = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    const opt   = document.createElement('option');
    opt.value       = value;
    opt.textContent = label;
    select.appendChild(opt);
  }

  // Default: bulan lalu
  select.selectedIndex = 1;
  currentPeriode = select.value;

  select.addEventListener('change', (e) => {
    currentPeriode = e.target.value;
    loadHeatmapData();
  });
}

/** Auto-generate dropdown periode awal & akhir untuk perbandingan */
function setupCompareDropdowns() {
  const selectAwal = document.getElementById('periode-awal');
  const selectAkhir = document.getElementById('periode-akhir');
  if (!selectAwal || !selectAkhir) return;

  const today      = new Date();
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni',
                      'Juli','Agustus','September','Oktober','November','Desember'];

  selectAwal.innerHTML = '';
  selectAkhir.innerHTML = '';

  for (let i = 0; i <= 5; i++) {
    const d     = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

    // Option untuk periode awal
    const optA   = document.createElement('option');
    optA.value       = value;
    optA.textContent = label;
    selectAwal.appendChild(optA);

    // Option untuk periode akhir
    const optB   = document.createElement('option');
    optB.value       = value;
    optB.textContent = label;
    selectAkhir.appendChild(optB);
  }

  // Default: Periode Awal (2 bulan lalu), Periode Akhir (1 bulan lalu)
  if (selectAwal.options.length > 2) {
    selectAwal.selectedIndex = 2; // 2 bulan lalu
  } else {
    selectAwal.selectedIndex = selectAwal.options.length - 1;
  }
  selectAkhir.selectedIndex = 1; // 1 bulan lalu
}

/** Setup logika navigasi tab switcher */
function setupTabs() {
  const tabMonthly = document.getElementById('tab-monthly');
  const tabCompare = document.getElementById('tab-compare');

  const filterMonthly = document.getElementById('filter-monthly-container');
  const filterCompare = document.getElementById('filter-compare-container');

  const tableMonthly = document.getElementById('table-monthly');
  const tableCompare = document.getElementById('table-compare');

  if (!tabMonthly || !tabCompare) return;

  tabMonthly.addEventListener('click', () => {
    currentMode = 'monthly';
    
    // Style tabs aktif/nonaktif
    tabMonthly.className = "flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all duration-200 bg-white text-slate-800 shadow-sm flex items-center justify-center gap-2";
    tabCompare.className = "flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all duration-200 text-slate-600 hover:text-slate-800 flex items-center justify-center gap-2";

    // Show/hide filter containers
    filterMonthly.classList.remove('hidden');
    filterCompare.classList.add('hidden');

    // Show/hide tables
    tableMonthly.classList.remove('hidden');
    tableCompare.classList.add('hidden');

    // Reload data heatmap bulanan
    loadHeatmapData();
  });

  tabCompare.addEventListener('click', () => {
    currentMode = 'compare';

    // Style tabs aktif/nonaktif
    tabCompare.className = "flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all duration-200 bg-white text-slate-800 shadow-sm flex items-center justify-center gap-2";
    tabMonthly.className = "flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all duration-200 text-slate-600 hover:text-slate-800 flex items-center justify-center gap-2";

    // Show/hide filter containers
    filterCompare.classList.remove('hidden');
    filterMonthly.classList.add('hidden');

    // Show/hide tables
    tableCompare.classList.remove('hidden');
    tableMonthly.classList.add('hidden');

    // Jalankan perbandingan data
    doComparison();
  });
}

function setupCompareButton() {
  const btnBandingkan = document.getElementById('btn-bandingkan');
  if (btnBandingkan) {
    btnBandingkan.addEventListener('click', doComparison);
  }
}

/** Setup click event delegation untuk menampilkan detail modal */
function setupRowDetailsClick() {
  // Untuk Rekap Bulanan
  const tbodyMonthly = document.getElementById('heatmap-tbody');
  if (tbodyMonthly) {
    tbodyMonthly.addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      if (!row || row.id === 'loading-row') return;
      
      const rowId = row.dataset.rowId;
      if (rowId) {
        const item = currentMonthlyData.find(d => String(d.id) === String(rowId));
        if (item) {
          openSingleDetailModal(item);
        }
      }
    });
  }

  // Untuk Perbandingan 2 Bulan
  const tbodyCompare = document.getElementById('compare-tbody');
  if (tbodyCompare) {
    tbodyCompare.addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      if (!row) return;

      const kodeVendor = row.dataset.kode;
      if (kodeVendor) {
        const itemA = currentCompareData.mapA.get(kodeVendor) || null;
        const itemB = currentCompareData.mapB.get(kodeVendor) || null;
        openCompareDetailModal(kodeVendor, itemA, itemB);
      }
    });
  }
}

/** Mengambil data kedua periode secara paralel dan membandingkannya */
async function doComparison() {
  const selectAwal = document.getElementById('periode-awal');
  const selectAkhir = document.getElementById('periode-akhir');
  const tbody = document.getElementById('compare-tbody');
  const count = document.getElementById('record-count');

  if (!selectAwal || !selectAkhir || !tbody) return;

  const pAwal = selectAwal.value;
  const pAkhir = selectAkhir.value;

  if (pAwal === pAkhir) {
    tbody.innerHTML = `
      <tr><td colspan="9" class="px-sm py-10 text-center text-amber-600">
        <span class="material-symbols-outlined text-[36px]">warning</span><br>
        Periode A dan Periode B tidak boleh sama! Pilih dua periode berbeda untuk menghitung rata-ratanya.
      </td></tr>`;
    if (count) count.textContent = 'Perhitungan gagal (periode sama).';
    return;
  }

  // Tampilkan loading state di tabel perbandingan
  tbody.innerHTML = `
    <tr><td colspan="9" class="px-sm py-10 text-center text-on-surface-variant">
      <div class="flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-[36px] animate-spin text-primary">autorenew</span>
        <span class="text-sm">Menarik dan menghitung rata-rata data kedua periode...</span>
      </div>
    </td></tr>`;

  try {
    const dataA = await getHeatmapData(pAwal);
    const dataB = await getHeatmapData(pAkhir);

    // Filter null/falsy secara defensif
    const arrA = Array.isArray(dataA) ? dataA.filter(Boolean) : [];
    const arrB = Array.isArray(dataB) ? dataB.filter(Boolean) : [];

    // Simpan ke state global untuk detail modal
    currentCompareData.mapA = new Map(arrA.map(item => [item.kode_vendor ?? '', item]));
    currentCompareData.mapB = new Map(arrB.map(item => [item.kode_vendor ?? '', item]));
    currentCompareData.periodeA = pAwal;
    currentCompareData.periodeB = pAkhir;

    renderComparisonTable(arrA, arrB, pAwal, pAkhir);
  } catch (err) {
    console.error('Error loading comparison data:', err);
    tbody.innerHTML = `
      <tr><td colspan="9" class="px-sm py-10 text-center text-red-600">
        <span class="material-symbols-outlined text-[36px]">error</span><br>
        Gagal memuat data perbandingan. Pastikan koneksi server backend berjalan.<br>
        <span class="text-xs font-mono text-red-500 block mt-2">Detail: ${err.message || err}</span>
      </td></tr>`;
    if (count) count.textContent = 'Gagal memuat data perbandingan.';
  }
}

/** Render comparison table rows */
function renderComparisonTable(dataA, dataB, pAwal, pAkhir) {
  const tbody = document.getElementById('compare-tbody');
  const count = document.getElementById('record-count');
  if (!tbody) return;

  const mapA = currentCompareData.mapA;
  const mapB = currentCompareData.mapB;

  // Gabungkan semua vendor dari kedua periode
  const allVendors = [];
  const seen = new Set();

  dataB.forEach(item => {
    if (item && item.kode_vendor && !seen.has(item.kode_vendor)) {
      seen.add(item.kode_vendor);
      allVendors.push({ kode: item.kode_vendor, name: item.nama_vendor, category: item.jenis_bahan });
    }
  });

  dataA.forEach(item => {
    if (item && item.kode_vendor && !seen.has(item.kode_vendor)) {
      seen.add(item.kode_vendor);
      allVendors.push({ kode: item.kode_vendor, name: item.nama_vendor, category: item.jenis_bahan });
    }
  });

  if (allVendors.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9" class="px-sm py-10 text-center text-on-surface-variant">
        <span class="material-symbols-outlined" style="font-size:36px;">inbox</span><br>
        Tidak ada data penilaian di kedua periode tersebut.
      </td></tr>`;
    if (count) count.textContent = 'Tidak ada data untuk dibandingkan.';
    return;
  }

  tbody.innerHTML = '';
  allVendors.forEach(v => {
    const itemA = mapA.get(v.kode) || null;
    const itemB = mapB.get(v.kode) || null;

    // Hitung rerata untuk setiap divisi
    const qcComp = formatAverageCell(
      itemA ? itemA.qc_score : null,
      itemB ? itemB.qc_score : null,
      ' Pts',
      itemA ? itemA.qc_ng_percent : null,
      itemB ? itemB.qc_ng_percent : null,
      'qc'
    );

    const ppicComp = formatAverageCell(
      itemA ? itemA.ppic_score : null,
      itemB ? itemB.ppic_score : null,
      ' Pts',
      itemA ? itemA.ppic_ot_percent : null,
      itemB ? itemB.ppic_ot_percent : null,
      'ppic'
    );

    const pchComp = formatAverageCell(
      itemA ? itemA.pch_score : null,
      itemB ? itemB.pch_score : null,
      ' Pts'
    );

    const hseComp = formatAverageCell(
      itemA ? itemA.hse_score : null,
      itemB ? itemB.hse_score : null,
      ' Pts'
    );

    const totalComp = formatAverageCell(
      itemA ? itemA.total_score : null,
      itemB ? itemB.total_score : null,
      ' Pts'
    );

    // Hitung rerata total_score untuk menentukan Grade Rerata
    const scoreA = itemA ? parseFloat(itemA.total_score) : null;
    const scoreB = itemB ? parseFloat(itemB.total_score) : null;
    let avgTotal = null;
    if (scoreA !== null && scoreB !== null) avgTotal = (scoreA + scoreB) / 2;
    else if (scoreA !== null) avgTotal = scoreA;
    else if (scoreB !== null) avgTotal = scoreB;

    let avgGrade = '-';
    if (avgTotal !== null) {
      if (avgTotal >= 90) avgGrade = 'A';
      else if (avgTotal >= 70) avgGrade = 'B';
      else avgGrade = 'C';
    }

    const gradeBadgeA = itemA ? itemA.grade : '';
    const gradeBadgeB = itemB ? itemB.grade : '';
    let gradeTransitionText = '';
    if (gradeBadgeA && gradeBadgeB) {
      gradeTransitionText = `${gradeBadgeA} ➔ ${gradeBadgeB}`;
    } else if (gradeBadgeA) {
      gradeTransitionText = `${gradeBadgeA} ➔ N/A`;
    } else if (gradeBadgeB) {
      gradeTransitionText = `N/A ➔ ${gradeBadgeB}`;
    }

    let gradeComp = `<span class="text-slate-400">-</span>`;
    if (avgGrade === 'A') {
      gradeComp = `
        <div class="flex flex-col items-center gap-1">
          <span class="px-2 py-0.5 bg-green-100 text-green-800 text-[11px] font-bold rounded-md border border-green-200">A</span>
          ${gradeTransitionText ? `<span class="text-[9px] text-slate-400 font-semibold">(${gradeTransitionText})</span>` : ''}
        </div>
      `;
    } else if (avgGrade === 'B') {
      gradeComp = `
        <div class="flex flex-col items-center gap-1">
          <span class="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[11px] font-bold rounded-md border border-yellow-200">B</span>
          ${gradeTransitionText ? `<span class="text-[9px] text-slate-400 font-semibold">(${gradeTransitionText})</span>` : ''}
        </div>
      `;
    } else if (avgGrade === 'C') {
      gradeComp = `
        <div class="flex flex-col items-center gap-1">
          <span class="px-2 py-0.5 bg-red-100 text-red-800 text-[11px] font-bold rounded-md border border-red-200">C</span>
          ${gradeTransitionText ? `<span class="text-[9px] text-slate-400 font-semibold">(${gradeTransitionText})</span>` : ''}
        </div>
      `;
    }

    const rowClass = 'hover:bg-slate-50 transition-colors cursor-pointer group border-l-4 border-l-slate-300';

    tbody.insertAdjacentHTML('beforeend', `
      <tr data-kode="${v.kode}" class="${rowClass}">
        <td class="px-sm py-4 text-center">
          <span class="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors">zoom_in</span>
        </td>
        <td class="px-sm py-4">
          <div class="font-bold text-slate-800">${v.name ?? '-'}</div>
          <div class="text-[11px] text-slate-400">Kode: ${v.kode}</div>
        </td>
        <td class="px-sm py-4 text-on-surface-variant text-sm">${v.category ?? '-'}</td>
        <td class="px-sm py-4 text-center">${qcComp}</td>
        <td class="px-sm py-4 text-center">${ppicComp}</td>
        <td class="px-sm py-4 text-center">${pchComp}</td>
        <td class="px-sm py-4 text-center">${hseComp}</td>
        <td class="px-sm py-4 text-center font-bold">${totalComp}</td>
        <td class="px-sm py-4 text-center">${gradeComp}</td>
      </tr>`);
  });

  const labelAwal = formatPeriode(pAwal);
  const labelAkhir = formatPeriode(pAkhir);
  if (count) {
    count.textContent = `Rerata ${allVendors.length} supplier dari periode ${labelAwal} dan ${labelAkhir}. Klik baris manapun untuk rincian detail!`;
  }
}

/**
 * Format rata-rata nilai A dan B untuk ditaruh di sel tabel
 */
function formatAverageCell(valA, valB, suffix = '', extraA = null, extraB = null, type = '') {
  const vA = valA !== null && valA !== undefined ? parseFloat(valA) : null;
  const vB = valB !== null && valB !== undefined ? parseFloat(valB) : null;

  if (vA === null && vB === null) {
    return `<span class="text-slate-400 font-medium text-sm">-</span>`;
  }

  // Hitung Rerata
  let avgVal = 0;
  let labelDetail = '';
  if (vA !== null && vB !== null) {
    avgVal = (vA + vB) / 2;
    labelDetail = `A: ${vA}${suffix} | B: ${vB}${suffix}`;
  } else if (vA !== null) {
    avgVal = vA;
    labelDetail = `A: ${vA}${suffix} | B: N/A`;
  } else {
    avgVal = vB;
    labelDetail = `A: N/A | B: ${vB}${suffix}`;
  }

  // Format persentase tambahan (QC NG %, PPIC OT %)
  let extraAverageText = '';
  const exA = extraA !== null && extraA !== undefined ? parseFloat(extraA) : null;
  const exB = extraB !== null && extraB !== undefined ? parseFloat(extraB) : null;

  if (type === 'qc') {
    if (exA !== null && exB !== null) {
      extraAverageText = `Rata-rata NG: ${((exA + exB) / 2).toFixed(2)}%`;
    } else if (exA !== null) {
      extraAverageText = `Rata-rata NG: ${exA.toFixed(2)}%`;
    } else if (exB !== null) {
      extraAverageText = `Rata-rata NG: ${exB.toFixed(2)}%`;
    }
  } else if (type === 'ppic') {
    if (exA !== null && exB !== null) {
      extraAverageText = `Rata-rata OT: ${((exA + exB) / 2).toFixed(2)}%`;
    } else if (exA !== null) {
      extraAverageText = `Rata-rata OT: ${exA.toFixed(2)}%`;
    } else if (exB !== null) {
      extraAverageText = `Rata-rata OT: ${exB.toFixed(2)}%`;
    }
  }

  const getCellBg = (score, t) => {
    if (t === 'qc' || t === 'ppic') {
      if (score >= 30) return 'bg-green-50/40 border-l border-green-200';
      if (score >= 15) return 'bg-yellow-50/40 border-l border-yellow-200';
      return 'bg-red-50/40 border-l border-red-200';
    }
    return '';
  };
  const cellBg = getCellBg(avgVal, type);

  return `
    <div class="flex flex-col items-center justify-center p-2 rounded-lg ${cellBg}">
      <div class="text-sm font-bold text-slate-800">
        ${avgVal.toFixed(1).replace('.0', '')}${suffix}
      </div>
      <div class="flex flex-col items-center gap-0.5 mt-1">
        ${extraAverageText ? `<div class="text-[10px] text-indigo-600 font-bold">${extraAverageText}</div>` : ''}
        <div class="text-[9px] text-slate-400 font-medium">${labelDetail}</div>
      </div>
    </div>
  `;
}

/** Fetch data dari API dan render tabel */
async function loadHeatmapData() {
  showLoading(true);
  try {
    const data = await getHeatmapData(currentPeriode);
    currentMonthlyData = data; // Simpan ke state global untuk detail modal
    renderTable(data);
  } catch (err) {
    console.error('Error loading heatmap:', err);
    showError();
  } finally {
    showLoading(false);
  }
}

function showLoading(loading) {
  const tbody = document.getElementById('heatmap-tbody');
  if (!tbody) return;
  if (loading) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="px-sm py-10 text-center text-on-surface-variant">
        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
          <span class="material-symbols-outlined" style="font-size:36px;color:#434fc6;animation:spin 1s linear infinite;">autorenew</span>
          <span style="font-size:14px;">Memuat data dari database...</span>
        </div>
      </td></tr>`;

    // Tambah keyframe spin jika belum ada
    if (!document.getElementById('spin-style')) {
      const s = document.createElement('style');
      s.id = 'spin-style';
      s.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
      document.head.appendChild(s);
    }
  }
}

function showError() {
  const tbody = document.getElementById('heatmap-tbody');
  if (tbody) tbody.innerHTML = `
    <tr><td colspan="8" class="px-sm py-10 text-center" style="color:#ba1a1a;">
      <span class="material-symbols-outlined" style="font-size:36px;">error</span><br>
      Gagal memuat data. Pastikan server backend berjalan.
    </td></tr>`;
  const count = document.getElementById('record-count');
  if (count) count.textContent = 'Gagal memuat data.';
}

/** Render rows tabel dari array data API */
function renderTable(data) {
  const tbody = document.getElementById('heatmap-tbody');
  const count = document.getElementById('record-count');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="px-sm py-10 text-center text-on-surface-variant">
        <span class="material-symbols-outlined" style="font-size:36px;">inbox</span><br>
        Belum ada data penilaian untuk periode ini.
      </td></tr>`;
    if (count) count.textContent = 'Tidak ada data untuk periode ini.';
    return;
  }

  tbody.innerHTML = '';
  data.forEach(item => {
    // Warna Background berdasarkan SKOR POIN
    const getBgColor = (score, type) => {
      score = parseFloat(score);
      if (type === 'qc' || type === 'ppic') {
        if (score >= 30) return 'bg-green-100';
        if (score >= 15) return 'bg-yellow-100';
        return 'bg-red-100';
      }
      if (type === 'pch') {
        if (score >= 25) return 'bg-green-100';
        if (score >= 15) return 'bg-yellow-100';
        return 'bg-red-100';
      }
      if (type === 'hse') {
        if (score >= 10) return 'bg-green-100';
        if (score >= 6) return 'bg-yellow-100';
        return 'bg-red-100';
      }
      return '';
    };

    const qcBg = getBgColor(item.qc_score ?? 0, 'qc');
    const ppicBg = getBgColor(item.ppic_score ?? 0, 'ppic');
    const pchBg = getBgColor(item.pch_score ?? 0, 'pch');
    const hseBg = getBgColor(item.hse_score ?? 0, 'hse');

    // Format Teks
    const qcText = item.qc_ng_percent !== null ? `${parseFloat(item.qc_ng_percent).toFixed(2)}% (${item.qc_score ?? 0} Poin)` : '-';
    const ppicText = item.ppic_ot_percent !== null ? `${parseFloat(item.ppic_ot_percent).toFixed(2)}% (${item.ppic_score ?? 0} Poin)` : '-';
    const pchText = `${item.pch_score ?? 0} Poin`;
    const hseText = `${item.hse_score ?? 0} Poin`;

    // Total dan Grade
    const totalColor = getScoreColor(item.total_score ?? 0, 100);
    let gradeBadge = '-';
    if (item.grade === 'A') gradeBadge = `<span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-md border border-green-200">A</span>`;
    else if (item.grade === 'B') gradeBadge = `<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-md border border-yellow-200">B</span>`;
    else if (item.grade === 'C') gradeBadge = `<span class="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-md border border-red-200">C</span>`;

    const rowClass = 'hover:bg-slate-50 transition-colors cursor-pointer group border-l-4 border-l-slate-300';

    tbody.insertAdjacentHTML('beforeend', `
      <tr data-row-id="${item.id}" class="${rowClass}">
        <td class="px-sm py-4 text-center">
          <span class="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors">zoom_in</span>
        </td>
        <td class="px-sm py-4 font-semibold">${item.nama_vendor ?? '-'}</td>
        <td class="px-sm py-4 text-on-surface-variant text-sm">${item.jenis_bahan ?? '-'}</td>
        <td class="px-sm py-4 text-center font-bold ${qcBg}">${qcText}</td>
        <td class="px-sm py-4 text-center font-bold ${ppicBg}">${ppicText}</td>
        <td class="px-sm py-4 text-center font-bold ${pchBg}">${pchText}</td>
        <td class="px-sm py-4 text-center font-bold ${hseBg}">${hseText}</td>
        <td class="px-sm py-4 text-center font-bold text-lg" style="color: ${totalColor}">${item.total_score ?? '-'}</td>
        <td class="px-sm py-4 text-center">${gradeBadge}</td>
      </tr>`);
  });

  if (count) count.textContent = `Menampilkan ${data.length} supplier untuk periode ${formatPeriode(currentPeriode)}. Klik baris manapun untuk melihat rincian detail aktual!`;
}

function getRowClass(grade) {
  return 'hover:bg-slate-50 transition-colors cursor-pointer group border-l-4 border-l-slate-300';
}

function getScoreColor(value, max) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  if (pct >= 80) return '#22c55e';
  if (pct >= 60) return '#f59e0b';
  return '#ef4444';
}


// ==========================================
// INTERACTIVE EXPLORATIVE DETAILS MODALS
// ==========================================

/**
 * Membuka Modal Detail untuk Rekap Bulanan Tunggal
 */
function openSingleDetailModal(item) {
  // Pastikan modal lama dibersihkan
  const oldModal = document.getElementById('detail-modal');
  if (oldModal) oldModal.remove();

  const gradeColor = getGradeColor(item.grade);
  const gradeLabel = getGradeLabel(item.grade);

  // Format ribuan helper
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    return parseFloat(num).toLocaleString('id-ID');
  };

  // Convert ENUM PCH/HSE ke Teks Indah
  const formatEnum = (val) => {
    if (!val) return '<span class="text-slate-400 font-medium">N/A</span>';
    if (val === 'BAIK') return '<span class="px-2 py-0.5 bg-green-50 text-green-700 font-bold text-xs rounded border border-green-200">BAIK</span>';
    if (val === 'CUKUP') return '<span class="px-2 py-0.5 bg-yellow-50 text-yellow-700 font-bold text-xs rounded border border-yellow-200">CUKUP</span>';
    return '<span class="px-2 py-0.5 bg-red-50 text-red-700 font-bold text-xs rounded border border-red-200">KURANG</span>';
  };

  const modalHtml = `
    <div id="detail-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-6 animate-fadeIn font-['Inter']">
      <div class="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-fadeInUp">
        
        <!-- Header -->
        <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <div class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Rincian Evaluasi Aktual</div>
            <h3 class="text-2xl font-black text-slate-800 dark:text-white leading-tight">${item.nama_vendor}</h3>
            <div class="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
              <span class="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-medium">Kode: ${item.kode_vendor}</span>
              <span class="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-medium">Kategori: ${item.jenis_bahan}</span>
              <span class="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">calendar_today</span>
                ${formatPeriode(item.periode)}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
            <div class="text-center">
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Skor Total</div>
              <div class="text-3xl font-black text-slate-800 dark:text-white">${item.total_score ?? '-'}<span class="text-sm text-slate-400 font-semibold">/100</span></div>
            </div>
            <div class="w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black text-2xl text-white shadow-md shadow-indigo-600/10" style="background-color: ${gradeColor}">
              ${item.grade ?? '-'}
            </div>
            <button id="close-modal-btn" class="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <span class="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div class="p-6 overflow-y-auto space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <!-- Quality Control (QC) Card -->
            <div class="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-center mb-4">
                  <div class="flex items-center gap-2">
                    <span class="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                      <span class="material-symbols-outlined text-[20px]">verified</span>
                    </span>
                    <span class="font-bold text-slate-800 dark:text-slate-200">Quality Control (QC)</span>
                  </div>
                  <span class="text-sm font-black text-green-600">${item.qc_score ?? 0} <span class="text-xs text-slate-400 font-medium">/ 30 Pts</span></span>
                </div>
                <div class="space-y-2.5 text-sm">
                  <div class="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-2">
                    <span class="text-slate-500">Qty Barang Diterima (OK)</span>
                    <span class="font-semibold text-slate-800 dark:text-slate-200">${formatNumber(item.qc_qty_terima)} Pcs</span>
                  </div>
                  <div class="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-2">
                    <span class="text-slate-500">Qty Barang Reject (NG)</span>
                    <span class="font-semibold text-red-600 dark:text-red-400">${formatNumber(item.qc_qty_reject)} Pcs</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-slate-500">Persentase NG (%)</span>
                    <span class="font-bold text-slate-800 dark:text-slate-200">${item.qc_ng_percent !== null ? parseFloat(item.qc_ng_percent).toFixed(2) + '%' : '-'}</span>
                  </div>
                </div>
              </div>
              <div class="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800 text-[11px] text-slate-400">
                Kriteria Score: 0% = 30 poin | &le;1% = 15 poin | &gt;1% = 10 poin
              </div>
            </div>

            <!-- PPIC Card -->
            <div class="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-center mb-4">
                  <div class="flex items-center gap-2">
                    <span class="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <span class="material-symbols-outlined text-[20px]">schedule</span>
                    </span>
                    <span class="font-bold text-slate-800 dark:text-slate-200">PPIC (On-Time Delivery)</span>
                  </div>
                  <span class="text-sm font-black text-blue-600">${item.ppic_score ?? 0} <span class="text-xs text-slate-400 font-medium">/ 30 Pts</span></span>
                </div>
                <div class="space-y-2.5 text-sm">
                  <div class="flex justify-between items-center">
                    <span class="text-slate-500">Persentase On-Time Delivery</span>
                    <span class="font-bold text-slate-800 dark:text-slate-200">${item.ppic_ot_percent !== null ? parseFloat(item.ppic_ot_percent).toFixed(2) + '%' : '-'}</span>
                  </div>
                </div>
              </div>
              <div class="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800 text-[11px] text-slate-400">
                Kriteria Score: &ge;90% = 30 poin | &ge;71% = 15 poin | &le;70% = 10 poin
              </div>
            </div>

            <!-- Purchasing (PCH) Card -->
            <div class="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between md:col-span-2">
              <div>
                <div class="flex justify-between items-center mb-4">
                  <div class="flex items-center gap-2">
                    <span class="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <span class="material-symbols-outlined text-[20px]">shopping_cart</span>
                    </span>
                    <span class="font-bold text-slate-800 dark:text-slate-200">Purchasing (PCH)</span>
                  </div>
                  <span class="text-sm font-black text-amber-600">${item.pch_score ?? 0} <span class="text-xs text-slate-400 font-medium">/ 30 Pts</span></span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex flex-col justify-between gap-1.5">
                    <span class="text-xs text-slate-500 font-semibold">Kesesuaian Harga (Max 10)</span>
                    <div class="flex justify-between items-center">
                      ${formatEnum(item.pch_harga)}
                      <span class="font-bold text-slate-700 dark:text-slate-300 text-xs">${item.pch_harga === 'BAIK' ? '10' : item.pch_harga === 'CUKUP' ? '5' : '3'} Pts</span>
                    </div>
                  </div>
                  <div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex flex-col justify-between gap-1.5">
                    <span class="text-xs text-slate-500 font-semibold">Kesesuaian MOQ (Max 10)</span>
                    <div class="flex justify-between items-center">
                      ${formatEnum(item.pch_moq)}
                      <span class="font-bold text-slate-700 dark:text-slate-300 text-xs">${item.pch_moq === 'BAIK' ? '10' : item.pch_moq === 'CUKUP' ? '5' : '3'} Pts</span>
                    </div>
                  </div>
                  <div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex flex-col justify-between gap-1.5">
                    <span class="text-xs text-slate-500 font-semibold">Term of Payment (Max 5)</span>
                    <div class="flex justify-between items-center">
                      ${formatEnum(item.pch_top)}
                      <span class="font-bold text-slate-700 dark:text-slate-300 text-xs">${item.pch_top === 'BAIK' ? '5' : item.pch_top === 'CUKUP' ? '3' : '1'} Pts</span>
                    </div>
                  </div>
                  <div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex flex-col justify-between gap-1.5">
                    <span class="text-xs text-slate-500 font-semibold">Kualitas Pelayanan (Max 5)</span>
                    <div class="flex justify-between items-center">
                      ${formatEnum(item.pch_pelayanan)}
                      <span class="font-bold text-slate-700 dark:text-slate-300 text-xs">${item.pch_pelayanan === 'BAIK' ? '5' : item.pch_pelayanan === 'CUKUP' ? '3' : '1'} Pts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- HSE Card -->
            <div class="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between md:col-span-2">
              <div>
                <div class="flex justify-between items-center mb-4">
                  <div class="flex items-center gap-2">
                    <span class="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <span class="material-symbols-outlined text-[20px]">shield</span>
                    </span>
                    <span class="font-bold text-slate-800 dark:text-slate-200">Health, Safety, & Environment (HSE)</span>
                  </div>
                  <span class="text-sm font-black text-teal-600">${item.hse_score ?? 0} <span class="text-xs text-slate-400 font-medium">/ 10 Pts</span></span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex justify-between items-center">
                    <span class="text-xs text-slate-500 font-semibold">Uji Emisi Kendaraan (Max 5)</span>
                    <div class="flex items-center gap-2">
                      ${formatEnum(item.hse_uji_emisi)}
                      <span class="font-bold text-slate-700 dark:text-slate-300 text-xs">${item.hse_uji_emisi === 'BAIK' ? '5' : item.hse_uji_emisi === 'CUKUP' ? '3' : '1'} Pts</span>
                    </div>
                  </div>
                  <div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex justify-between items-center">
                    <span class="text-xs text-slate-500 font-semibold">Penggunaan APD Driver (Max 5)</span>
                    <div class="flex items-center gap-2">
                      ${formatEnum(item.hse_apd)}
                      <span class="font-bold text-slate-700 dark:text-slate-300 text-xs">${item.hse_apd === 'BAIK' ? '5' : item.hse_apd === 'CUKUP' ? '3' : '1'} Pts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Footer -->
        <div class="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button id="close-modal-footer-btn" class="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold rounded-xl text-sm shadow-md hover:opacity-90 active:scale-95 transition-all">
            Tutup Rincian
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Pasang event listeners untuk close modal
  const closeModal = () => {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.remove();
  };

  document.getElementById('close-modal-btn')?.addEventListener('click', closeModal);
  document.getElementById('close-modal-footer-btn')?.addEventListener('click', closeModal);
  document.getElementById('detail-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') closeModal();
  });
}

/**
 * Membuka Modal Detail untuk Perbandingan 2 Bulan (Menampilkan Rerata / Average)
 */
function openCompareDetailModal(kodeVendor, itemA, itemB) {
  // Pastikan modal lama dibersihkan
  const oldModal = document.getElementById('detail-modal');
  if (oldModal) oldModal.remove();

  const name = itemB?.nama_vendor || itemA?.nama_vendor || 'Supplier';
  const category = itemB?.jenis_bahan || itemA?.jenis_bahan || '-';

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    return parseFloat(num).toLocaleString('id-ID');
  };

  const getEnumBadge = (val) => {
    if (!val) return '<span class="text-slate-400 font-medium">N/A</span>';
    if (val === 'BAIK') return '<span class="px-2 py-0.5 bg-green-50 text-green-700 font-bold text-xs rounded border border-green-200">BAIK</span>';
    if (val === 'CUKUP') return '<span class="px-2 py-0.5 bg-yellow-50 text-yellow-700 font-bold text-xs rounded border border-yellow-200">CUKUP</span>';
    return '<span class="px-2 py-0.5 bg-red-50 text-red-700 font-bold text-xs rounded border border-red-200">KURANG</span>';
  };

  const getGradeBadge = (grade) => {
    if (grade === 'A') return `<span class="px-2.5 py-1 bg-green-100 text-green-800 text-xs font-extrabold rounded-md border border-green-200">A</span>`;
    if (grade === 'B') return `<span class="px-2.5 py-1 bg-yellow-100 text-yellow-800 text-xs font-extrabold rounded-md border border-yellow-200">B</span>`;
    if (grade === 'C') return `<span class="px-2.5 py-1 bg-red-100 text-red-800 text-xs font-extrabold rounded-md border border-red-200">C</span>`;
    return `<span class="text-slate-400">-</span>`;
  };

  const getAverageSpan = (valA, valB, suffix = '', isFloat = false) => {
    const vA = valA !== null && valA !== undefined ? parseFloat(valA) : null;
    const vB = valB !== null && valB !== undefined ? parseFloat(valB) : null;

    if (vA === null && vB === null) {
      return '<span class="text-slate-400 font-medium">-</span>';
    }

    let avg = 0;
    if (vA !== null && vB !== null) {
      avg = (vA + vB) / 2;
    } else if (vA !== null) {
      avg = vA;
    } else {
      avg = vB;
    }

    const formattedAvg = isFloat ? avg.toFixed(2) : avg.toFixed(1).replace('.0', '');
    return `<span class="text-indigo-600 dark:text-indigo-400 font-black text-sm">${formattedAvg}${suffix}</span>`;
  };

  // Hitung rerata total_score untuk Grade
  const scoreA = itemA ? parseFloat(itemA.total_score) : null;
  const scoreB = itemB ? parseFloat(itemB.total_score) : null;
  let avgTotal = null;
  if (scoreA !== null && scoreB !== null) avgTotal = (scoreA + scoreB) / 2;
  else if (scoreA !== null) avgTotal = scoreA;
  else if (scoreB !== null) avgTotal = scoreB;

  let avgGrade = '-';
  if (avgTotal !== null) {
    if (avgTotal >= 90) avgGrade = 'A';
    else if (avgTotal >= 70) avgGrade = 'B';
    else avgGrade = 'C';
  }

  const getAverageGradeBadge = (gradeA, gradeB, currentAvgGrade) => {
    let transitionText = '';
    if (gradeA && gradeB) {
      transitionText = `${gradeA} ➔ ${gradeB}`;
    } else if (gradeA) {
      transitionText = `${gradeA} ➔ N/A`;
    } else if (gradeB) {
      transitionText = `N/A ➔ ${gradeB}`;
    }

    return `
      <div class="flex flex-col items-center gap-1">
        ${getGradeBadge(currentAvgGrade)}
        ${transitionText ? `<span class="text-[9px] text-slate-400 font-semibold">(${transitionText})</span>` : ''}
      </div>
    `;
  };

  const labelA = currentCompareData.periodeA ? formatPeriode(currentCompareData.periodeA) : 'Periode A';
  const labelB = currentCompareData.periodeB ? formatPeriode(currentCompareData.periodeB) : 'Periode B';

  const modalHtml = `
    <div id="detail-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-6 animate-fadeIn font-['Inter']">
      <div class="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-fadeInUp">
        
        <!-- Header -->
        <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <div class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Rincian Rerata & Performa 2 Periode</div>
            <h3 class="text-2xl font-black text-slate-800 dark:text-white leading-tight">${name}</h3>
            <div class="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
              <span class="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-medium">Kode: ${kodeVendor}</span>
              <span class="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-medium">Kategori: ${category}</span>
            </div>
          </div>
          <div class="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
            <button id="close-modal-btn" class="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <span class="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>
        </div>

        <!-- Scrollable Comparison Table -->
        <div class="p-6 overflow-y-auto space-y-6">
          <div class="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase">
                  <th class="px-4 py-3">Kriteria Evaluasi</th>
                  <th class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20 w-[25%]">${labelA}</th>
                  <th class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10 w-[25%]">${labelB}</th>
                  <th class="px-4 py-3 text-center w-[18%]">Rerata (Average)</th>
                </tr>
              </thead>
              <tbody class="text-sm text-slate-600 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                
                <!-- SUMMARY SECTION -->
                <tr class="bg-indigo-50/20 font-bold">
                  <td class="px-4 py-3.5 text-indigo-900 dark:text-indigo-400">GRADE KESELURUHAN</td>
                  <td class="px-4 py-3.5 text-center bg-slate-100/50 dark:bg-slate-800/20">${itemA ? getGradeBadge(itemA.grade) : 'N/A'}</td>
                  <td class="px-4 py-3.5 text-center bg-indigo-50/40 dark:bg-indigo-950/10">${itemB ? getGradeBadge(itemB.grade) : 'N/A'}</td>
                  <td class="px-4 py-3.5 text-center">${getAverageGradeBadge(itemA?.grade, itemB?.grade, avgGrade)}</td>
                </tr>
                <tr class="font-bold">
                  <td class="px-4 py-3.5 text-slate-800 dark:text-slate-200">SKOR TOTAL (Max 100)</td>
                  <td class="px-4 py-3.5 text-center bg-slate-100/50 dark:bg-slate-800/20 text-slate-800 dark:text-slate-200 text-lg">${itemA ? itemA.total_score : 'N/A'}</td>
                  <td class="px-4 py-3.5 text-center bg-indigo-50/40 dark:bg-indigo-950/10 text-slate-900 dark:text-white text-lg">${itemB ? itemB.total_score : 'N/A'}</td>
                  <td class="px-4 py-3.5 text-center">${getAverageSpan(itemA?.total_score, itemB?.total_score)}</td>
                </tr>

                <!-- DIVISION 1: QC -->
                <tr class="bg-slate-50/30 font-bold text-slate-700 dark:text-slate-300">
                  <td colspan="4" class="px-4 py-2 text-xs uppercase tracking-wider">Quality Control (QC)</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Poin QC (Max 30)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20 font-semibold">${itemA ? itemA.qc_score : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10 font-bold">${itemB ? itemB.qc_score : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.qc_score, itemB?.qc_score)}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Qty Barang Diterima (OK)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20">${itemA ? formatNumber(itemA.qc_qty_terima) + ' Pcs' : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10 font-semibold text-slate-850">${itemB ? formatNumber(itemB.qc_qty_terima) + ' Pcs' : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.qc_qty_terima, itemB?.qc_qty_terima, ' Pcs')}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Qty Barang Reject (NG)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20 text-red-600 dark:text-red-400">${itemA ? formatNumber(itemA.qc_qty_reject) + ' Pcs' : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10 text-red-600 dark:text-red-400 font-semibold">${itemB ? formatNumber(itemB.qc_qty_reject) + ' Pcs' : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.qc_qty_reject, itemB?.qc_qty_reject, ' Pcs')}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Persentase NG (%)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20">${itemA && itemA.qc_ng_percent !== null ? parseFloat(itemA.qc_ng_percent).toFixed(2) + '%' : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10 font-semibold">${itemB && itemB.qc_ng_percent !== null ? parseFloat(itemB.qc_ng_percent).toFixed(2) + '%' : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.qc_ng_percent, itemB?.qc_ng_percent, '%', true)}</td>
                </tr>

                <!-- DIVISION 2: PPIC -->
                <tr class="bg-slate-50/30 font-bold text-slate-700 dark:text-slate-300">
                  <td colspan="4" class="px-4 py-2 text-xs uppercase tracking-wider">PPIC (On-Time Delivery)</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Poin PPIC (Max 30)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20 font-semibold">${itemA ? itemA.ppic_score : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10 font-bold">${itemB ? itemB.ppic_score : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.ppic_score, itemB?.ppic_score)}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">On-Time Delivery (%)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20">${itemA && itemA.ppic_ot_percent !== null ? parseFloat(itemA.ppic_ot_percent).toFixed(2) + '%' : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10 font-semibold">${itemB && itemB.ppic_ot_percent !== null ? parseFloat(itemB.ppic_ot_percent).toFixed(2) + '%' : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.ppic_ot_percent, itemB?.ppic_ot_percent, '%', true)}</td>
                </tr>

                <!-- DIVISION 3: PCH -->
                <tr class="bg-slate-50/30 font-bold text-slate-700 dark:text-slate-300">
                  <td colspan="4" class="px-4 py-2 text-xs uppercase tracking-wider">Purchasing (PCH)</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Poin PCH (Max 30)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20 font-semibold">${itemA ? itemA.pch_score : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10 font-bold">${itemB ? itemB.pch_score : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.pch_score, itemB?.pch_score)}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Kesesuaian Harga (Max 10)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20">${itemA ? getEnumBadge(itemA.pch_harga) : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10">${itemB ? getEnumBadge(itemB.pch_harga) : '-'}</td>
                  <td class="px-4 py-3 text-center">-</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Kesesuaian MOQ (Max 10)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20">${itemA ? getEnumBadge(itemA.pch_moq) : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10">${itemB ? getEnumBadge(itemB.pch_moq) : '-'}</td>
                  <td class="px-4 py-3 text-center">-</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Term of Payment (Max 5)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20">${itemA ? getEnumBadge(itemA.pch_top) : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10">${itemB ? getEnumBadge(itemB.pch_top) : '-'}</td>
                  <td class="px-4 py-3 text-center">-</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Kualitas Pelayanan (Max 5)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20">${itemA ? getEnumBadge(itemA.pch_pelayanan) : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10">${itemB ? getEnumBadge(itemB.pch_pelayanan) : '-'}</td>
                  <td class="px-4 py-3 text-center">-</td>
                </tr>

                <!-- DIVISION 4: HSE -->
                <tr class="bg-slate-50/30 font-bold text-slate-700 dark:text-slate-300">
                  <td colspan="4" class="px-4 py-2 text-xs uppercase tracking-wider">Health, Safety, & Environment (HSE)</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Poin HSE (Max 10)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20 font-semibold">${itemA ? itemA.hse_score : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10 font-bold">${itemB ? itemB.hse_score : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.hse_score, itemB?.hse_score)}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Uji Emisi Kendaraan (Max 5)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20">${itemA ? getEnumBadge(itemA.hse_uji_emisi) : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10">${itemB ? getEnumBadge(itemB.hse_uji_emisi) : '-'}</td>
                  <td class="px-4 py-3 text-center">-</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Penggunaan APD Driver (Max 5)</td>
                  <td class="px-4 py-3 text-center bg-slate-100/50 dark:bg-slate-800/20">${itemA ? getEnumBadge(itemA.hse_apd) : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/40 dark:bg-indigo-950/10">${itemB ? getEnumBadge(itemB.hse_apd) : '-'}</td>
                  <td class="px-4 py-3 text-center">-</td>
                </tr>

              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button id="close-modal-footer-btn" class="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold rounded-xl text-sm shadow-md hover:opacity-90 active:scale-95 transition-all">
            Tutup Detail Rerata
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Pasang event listeners untuk close modal
  const closeModal = () => {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.remove();
  };

  document.getElementById('close-modal-btn')?.addEventListener('click', closeModal);
  document.getElementById('close-modal-footer-btn')?.addEventListener('click', closeModal);
  document.getElementById('detail-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') closeModal();
  });
}
