/**
 * Master Rekap Page
 * - Role protection (PCH / MANAGER / BOD / ADMIN only)
 * - Periode dropdown auto-generated
 * - Tabel di-populate dari API backend
 * - Fitur perbandingan 2 periode (2 bulan)
 * - Detail modal interaktif eksploratif & responsif (actual input data)
 */

const hasAccess = guardPage(['PCH', 'MANAGER', 'BOD', 'ADMIN'], 'Master Rekap');

let currentPeriode = '';
let currentMode = 'monthly'; // 'monthly' | 'compare' | 'evaluasi'

// Global states untuk menyimpan data aktif
let currentMonthlyData = [];
let rawMonthlyData = []; // Menyimpan data asli sebelum difilter
let currentCompareData = { mapA: new Map(), mapB: new Map(), periodeA: '', periodeB: '' };

// State untuk Filter & Sort
let searchQuery = '';
let categoryFilter = '';
let currentSortCol = ''; 
let currentSortAsc = false;

// State untuk Evaluasi Berkala
let currentEvaluasiPeriodeAwal = '';
let currentEvaluasiPeriodeAkhir = '';
let currentEvaluasiData = []; // Array hasil ringkasan rata-rata per vendor

document.addEventListener('DOMContentLoaded', async () => {
  // Jika role tidak diizinkan, halaman sudah diganti, hentikan
  if (!hasAccess) return;

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

  // Setup Evaluasi Berkala dropdowns, shortcut, & tombol load
  setupEvaluasiBerkala();

  // Setup event listeners untuk click row (Detail Modal)
  setupRowDetailsClick();

  // Setup fitur baru
  setupFiltersAndSearch();
  setupSorting();
  setupExport();

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
  const navInput = document.getElementById('nav-input');
  const navDaily = document.getElementById('nav-daily');
  const navRekap = document.getElementById('nav-rekap');
  const navVendor = document.getElementById('nav-vendor');

  if (navDashboard) navDashboard.href = `./dashboard.html`;
  if (navInput) navInput.href = `./input.html`;
  if (navDaily) navDaily.href = `./input-daily.html`;
  if (navRekap) navRekap.href = `./master-rekap.html`;
  if (navVendor) navVendor.href = `./master-vendor.html`;
}

/** Auto-generate dropdown periode (6 bulan terakhir) */
function setupPeriodeDropdown() {
  const select = document.querySelector('[data-select="periode"]');
  if (!select) return;

  const today = new Date();
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  select.innerHTML = '';
  for (let i = 0; i <= 5; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    const opt = document.createElement('option');
    opt.value = value;
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

  const today = new Date();
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  selectAwal.innerHTML = '';
  selectAkhir.innerHTML = '';

  for (let i = 0; i <= 5; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

    // Option untuk periode awal
    const optA = document.createElement('option');
    optA.value = value;
    optA.textContent = label;
    selectAwal.appendChild(optA);

    // Option untuk periode akhir
    const optB = document.createElement('option');
    optB.value = value;
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
  const tabEvaluasi = document.getElementById('tab-evaluasi');

  const filterMonthly = document.getElementById('filter-monthly-container');
  const filterEvaluasi = document.getElementById('filter-evaluasi-container');

  const tableMonthly = document.getElementById('table-monthly');
  const tableEvaluasi = document.getElementById('table-evaluasi');

  if (!tabMonthly) return;

  const CLS_ACTIVE = 'spe-tab active';
  const CLS_INACTIVE = 'spe-tab';

  const deactivateAll = () => {
    [tabMonthly, tabEvaluasi].forEach(t => { if (t) t.className = CLS_INACTIVE; });
    [filterMonthly, filterEvaluasi].forEach(f => { if (f) f.style.display = 'none'; });
    [tableMonthly, tableEvaluasi].forEach(t => { if (t) t.classList.add('hidden'); });
  };

  tabMonthly.addEventListener('click', () => {
    currentMode = 'monthly';
    deactivateAll();
    tabMonthly.className = CLS_ACTIVE;
    if (filterMonthly) filterMonthly.style.display = 'flex';
    if (tableMonthly) tableMonthly.classList.remove('hidden');
    loadHeatmapData();
  });

  if (tabEvaluasi) {
    tabEvaluasi.addEventListener('click', () => {
      currentMode = 'evaluasi';
      deactivateAll();
      tabEvaluasi.className = CLS_ACTIVE;
      if (filterEvaluasi) filterEvaluasi.style.display = 'flex';
      if (tableEvaluasi) tableEvaluasi.classList.remove('hidden');
    });
  }
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

    const rowClass = 'cursor-pointer';

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
    rawMonthlyData = data;
    updateCategoryDropdown();
    applyFiltersAndRender();
  } catch (err) {
    console.error('Error loading heatmap:', err);
    showError();
  } finally {
    showLoading(false);
  }
}

/** Terapkan Filter & Sort sebelum merender tabel */
function applyFiltersAndRender() {
  if (currentMode === 'monthly') {
    let filtered = [...rawMonthlyData];

    // 1. Kategori Filter
    if (categoryFilter) {
      filtered = filtered.filter(v => v.jenis_bahan === categoryFilter);
    }

    // 2. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(v => 
        (v.nama_vendor && v.nama_vendor.toLowerCase().includes(q)) ||
        (v.kode_vendor && String(v.kode_vendor).toLowerCase().includes(q))
      );
    }

    // 3. Sorting
    if (currentSortCol) {
      filtered.sort((a, b) => {
        let valA = a[currentSortCol];
        let valB = b[currentSortCol];

        if (currentSortCol === 'total_score') {
          valA = parseFloat(valA) || 0;
          valB = parseFloat(valB) || 0;
        } else if (currentSortCol === 'grade') {
          valA = valA || 'Z'; // Grade terburuk jika kosong
          valB = valB || 'Z';
        }
        
        if (valA < valB) return currentSortAsc ? -1 : 1;
        if (valA > valB) return currentSortAsc ? 1 : -1;
        return 0;
      });
    }

    currentMonthlyData = filtered; // Simpan untuk modal
    renderTable(filtered);
  } else if (currentMode === 'evaluasi') {
    const activeData = currentEvaluasiData.filter(d => d.status === 'success' && d.rata_rata);
    let filtered = [...activeData];

    // 1. Kategori Filter
    if (categoryFilter) {
      filtered = filtered.filter(v => v.jenis_bahan === categoryFilter);
    }

    // 2. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(v => 
        (v.nama_vendor && v.nama_vendor.toLowerCase().includes(q)) ||
        (v.kode_vendor && String(v.kode_vendor).toLowerCase().includes(q))
      );
    }

    // 3. Sorting
    if (currentSortCol) {
      filtered.sort((a, b) => {
        const rA = a.rata_rata || {};
        const rB = b.rata_rata || {};
        let valA, valB;

        if (currentSortCol === 'total_score') {
          valA = parseFloat(rA.avg_total_score) || 0;
          valB = parseFloat(rB.avg_total_score) || 0;
        } else if (currentSortCol === 'grade') {
          valA = rA.avg_grade || 'Z';
          valB = rB.avg_grade || 'Z';
        }

        if (valA < valB) return currentSortAsc ? -1 : 1;
        if (valA > valB) return currentSortAsc ? 1 : -1;
        return 0;
      });
    }

    // Render kembali tabel evaluasi dengan data terfilter/tersortir
    renderEvaluasiTable(filtered, currentEvaluasiPeriodeAwal, currentEvaluasiPeriodeAkhir);
  }
}

/** Populate Dropdown Kategori dari raw data yang ditarik */
function updateCategoryDropdown() {
  const select = document.getElementById('kategori-select');
  if (!select) return;

  const uniqueCategories = [...new Set(rawMonthlyData.map(v => v.jenis_bahan).filter(Boolean))].sort();
  
  // Simpan value yang sedang dipilih (jika ada)
  const currentVal = select.value;
  
  select.innerHTML = '<option value="">Semua Kategori</option>';
  uniqueCategories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });

  // Kembalikan pilihan jika masih relevan
  if (uniqueCategories.includes(currentVal)) {
    select.value = currentVal;
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
      <tr><td colspan="9" class="px-6 py-12 text-center text-slate-400">
        <span class="material-symbols-outlined text-[36px] mb-2 text-slate-300">inbox</span><br>
        <span class="text-sm font-semibold">Belum ada data penilaian untuk periode ini.</span>
      </td></tr>`;
    if (count) count.textContent = 'Tidak ada data untuk periode ini.';
    return;
  }

  tbody.innerHTML = '';
  data.forEach(item => {
    // Warna Background berdasarkan SKOR POIN
    const getCellClass = (score, type) => {
      score = parseFloat(score);
      if (type === 'qc' || type === 'ppic') {
        if (score >= 30) return 'heatmap-cell-good';
        if (score >= 15) return 'heatmap-cell-fair';
        return 'heatmap-cell-poor';
      }
      if (type === 'pch') {
        if (score >= 25) return 'heatmap-cell-good';
        if (score >= 15) return 'heatmap-cell-fair';
        return 'heatmap-cell-poor';
      }
      if (type === 'hse') {
        if (score >= 10) return 'heatmap-cell-good';
        if (score >= 6) return 'heatmap-cell-fair';
        return 'heatmap-cell-poor';
      }
      return '';
    };

    const qcBg = getCellClass(item.qc_score ?? 0, 'qc');
    const ppicBg = getCellClass(item.ppic_score ?? 0, 'ppic');
    const pchBg = getCellClass(item.pch_score ?? 0, 'pch');
    const hseBg = getCellClass(item.hse_score ?? 0, 'hse');

    // Format Teks
    const qcText = item.qc_ng_percent !== null ? `${parseFloat(item.qc_ng_percent).toFixed(2)}% (${item.qc_score ?? 0} Pts)` : '-';
    const ppicText = item.ppic_ot_percent !== null ? `${parseFloat(item.ppic_ot_percent).toFixed(2)}% (${item.ppic_score ?? 0} Pts)` : '-';
    const pchText = `${item.pch_score ?? 0} Pts`;
    const hseText = `${item.hse_score ?? 0} Pts`;

    // Total dan Grade
    const totalColor = getScoreColor(item.total_score ?? 0, 100);
    let gradeBadge = '-';
    if (item.grade === 'A') gradeBadge = `<span class="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-black rounded-lg border border-green-200/60">Grade A</span>`;
    else if (item.grade === 'B') gradeBadge = `<span class="px-2.5 py-1 bg-yellow-50 text-yellow-700 text-xs font-black rounded-lg border border-yellow-200/60">Grade B</span>`;
    else if (item.grade === 'C') gradeBadge = `<span class="px-2.5 py-1 bg-red-50 text-red-750 text-xs font-black rounded-lg border border-red-200/60">Grade C</span>`;

    const rowClass = 'cursor-pointer';

    tbody.insertAdjacentHTML('beforeend', `
      <tr data-row-id="${item.id}" class="${rowClass}">
        <td class="px-6 py-4 text-center">
          <span class="material-symbols-outlined text-slate-300 group-hover:text-indigo-600 transition-colors">zoom_in</span>
        </td>
        <td class="px-6 py-4">
          <div class="font-bold text-slate-800 text-sm">${item.nama_vendor ?? '-'}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Kode: ${item.kode_vendor ?? '-'}</div>
        </td>
        <td class="px-6 py-4 text-slate-500 text-sm">${item.jenis_bahan ?? '-'}</td>
        <td class="px-6 py-4 text-center ${qcBg}">${qcText}</td>
        <td class="px-6 py-4 text-center ${ppicBg}">${ppicText}</td>
        <td class="px-6 py-4 text-center ${pchBg}">${pchText}</td>
        <td class="px-6 py-4 text-center ${hseBg}">${hseText}</td>
        <td class="px-6 py-4 text-center">
          <span class="inline-block px-2.5 py-1 text-sm font-black rounded-lg" style="background-color: ${totalColor}15; color: ${totalColor}">
            ${item.total_score ?? '-'}
          </span>
        </td>
        <td class="px-6 py-4 text-center">${gradeBadge}</td>
      </tr>`);
  });

  if (count) count.textContent = `Menampilkan ${data.length} supplier untuk periode ${formatPeriode(currentPeriode)}. Klik baris manapun untuk melihat rincian detail aktual!`;
}

function getRowClass(grade) {
  return 'cursor-pointer';
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
    if (!val) return '<span class="px-2 py-0.5 bg-slate-50 text-slate-400 font-semibold text-xs rounded-lg border border-slate-200/50">N/A</span>';
    if (val === 'BAIK') return '<span class="px-2.5 py-0.5 bg-green-50 text-green-700 font-bold text-xs rounded-lg border border-green-200/50">BAIK</span>';
    if (val === 'CUKUP') return '<span class="px-2.5 py-0.5 bg-yellow-50 text-yellow-750 font-bold text-xs rounded-lg border border-yellow-200/50">CUKUP</span>';
    return '<span class="px-2.5 py-0.5 bg-red-50 text-red-700 font-bold text-xs rounded-lg border border-red-200/50">KURANG</span>';
  };

  const modalHtml = `
    <div id="detail-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-6 animate-fadeIn font-['Inter']">
      <div class="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-fadeInUp">
        
        <!-- Header -->
        <div class="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-violet-50 to-indigo-50">
          <div>
            <div class="text-[11px] font-bold text-violet-600 uppercase tracking-widest mb-1">Rincian Evaluasi Aktual</div>
            <h3 class="text-2xl font-black text-slate-800 leading-tight">${item.nama_vendor}</h3>
            <div class="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
              <span class="bg-slate-100 px-3 py-1.5 rounded-lg font-semibold border border-slate-200">Kode: ${item.kode_vendor}</span>
              <span class="bg-slate-100 px-3 py-1.5 rounded-lg font-semibold border border-slate-200">Kategori: ${item.jenis_bahan}</span>
              <span class="bg-violet-50 text-violet-800 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 border border-violet-200">
                <span class="material-symbols-outlined text-[14px]">calendar_today</span>
                ${formatPeriode(item.periode)}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
            <div class="text-center">
              <div class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Skor Total</div>
              <div class="text-3xl font-black text-slate-800">${item.total_score ?? '-'}<span class="text-sm text-slate-400 font-semibold">/100</span></div>
            </div>
            <div class="w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black text-2xl text-white shadow-md shadow-indigo-600/10" style="background-color: ${gradeColor}">
              ${item.grade ?? '-'}
            </div>
            <button id="close-modal-btn" class="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div class="p-6 overflow-y-auto space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <!-- Quality Control (QC) Card -->
            <div class="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-center mb-4">
                  <div class="flex items-center gap-2">
                    <span class="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                      <span class="material-symbols-outlined text-[20px]">verified</span>
                    </span>
                    <span class="font-bold text-slate-800">Quality Control (QC)</span>
                  </div>
                  <span class="text-sm font-black text-green-600">${item.qc_score ?? 0} <span class="text-xs text-slate-400 font-medium">/ 30 Pts</span></span>
                </div>
                <div class="space-y-2.5 text-sm">
                  <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span class="text-slate-500">Qty Barang Diterima (OK)</span>
                    <span class="font-semibold text-slate-800">${formatNumber(item.qc_qty_terima)} Pcs</span>
                  </div>
                  <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span class="text-slate-500">Qty Barang Reject (NG)</span>
                    <span class="font-semibold text-red-600">${formatNumber(item.qc_qty_reject)} Pcs</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-slate-500">Persentase NG (%)</span>
                    <span class="font-bold text-slate-800">${item.qc_ng_percent !== null ? parseFloat(item.qc_ng_percent).toFixed(2) + '%' : '-'}</span>
                  </div>
                </div>
              </div>
              <div class="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                Kriteria Score: &lt;0.5% = 30 poin | 0.5%-0.99% = 15 poin | &ge;1% = 10 poin
              </div>
            </div>

            <!-- PPIC Card -->
            <div class="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-center mb-4">
                  <div class="flex items-center gap-2">
                    <span class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <span class="material-symbols-outlined text-[20px]">schedule</span>
                    </span>
                    <span class="font-bold text-slate-800">PPIC (On-Time Delivery)</span>
                  </div>
                  <span class="text-sm font-black text-blue-600">${item.ppic_score ?? 0} <span class="text-xs text-slate-400 font-medium">/ 30 Pts</span></span>
                </div>
                <div class="space-y-2.5 text-sm">
                  <div class="flex justify-between items-center">
                    <span class="text-slate-500">Persentase On-Time Delivery</span>
                    <span class="font-bold text-slate-800">${item.ppic_ot_percent !== null ? parseFloat(item.ppic_ot_percent).toFixed(2) + '%' : '-'}</span>
                  </div>
                </div>
              </div>
              <div class="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                Kriteria Score: &ge;90% = 30 poin | &ge;71% = 15 poin | &lt;71% = 10 poin
              </div>
            </div>

            <!-- Purchasing (PCH) Card -->
            <div class="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between md:col-span-2">
              <div>
                <div class="flex justify-between items-center mb-4">
                  <div class="flex items-center gap-2">
                    <span class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <span class="material-symbols-outlined text-[20px]">shopping_cart</span>
                    </span>
                    <span class="font-bold text-slate-800">Purchasing (PCH)</span>
                  </div>
                  <span class="text-sm font-black text-amber-600">${item.pch_score ?? 0} <span class="text-xs text-slate-400 font-medium">/ 25 Pts</span></span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div class="p-3 bg-slate-50 rounded-xl flex flex-col justify-between gap-1.5">
                    <span class="text-xs text-slate-500 font-semibold">Kesesuaian Harga (Max 10)</span>
                    <div class="flex justify-between items-center">
                      ${formatEnum(item.pch_harga)}
                      <span class="font-bold text-slate-700 text-xs">${item.pch_harga === 'BAIK' ? '10' : item.pch_harga === 'CUKUP' ? '5' : '3'} Pts</span>
                    </div>
                  </div>
                  <div class="p-3 bg-slate-50 rounded-xl flex flex-col justify-between gap-1.5">
                    <span class="text-xs text-slate-500 font-semibold">Kesesuaian MOQ (Max 10)</span>
                    <div class="flex justify-between items-center">
                      ${formatEnum(item.pch_moq)}
                      <span class="font-bold text-slate-700 text-xs">${item.pch_moq === 'BAIK' ? '10' : item.pch_moq === 'CUKUP' ? '5' : '3'} Pts</span>
                    </div>
                  </div>
                  <div class="p-3 bg-slate-50 rounded-xl flex flex-col justify-between gap-1.5">
                    <span class="text-xs text-slate-500 font-semibold">Term of Payment (Max 5)</span>
                    <div class="flex justify-between items-center">
                      ${formatEnum(item.pch_top)}
                      <span class="font-bold text-slate-700 text-xs">${item.pch_top === 'BAIK' ? '5' : item.pch_top === 'CUKUP' ? '3' : '1'} Pts</span>
                    </div>
                  </div>
                  <div class="p-3 bg-slate-50 rounded-xl flex flex-col justify-between gap-1.5">
                    <span class="text-xs text-slate-500 font-semibold">Kualitas Pelayanan (Max 5)</span>
                    <div class="flex justify-between items-center">
                      ${formatEnum(item.pch_pelayanan)}
                      <span class="font-bold text-slate-700 text-xs">${item.pch_pelayanan === 'BAIK' ? '5' : item.pch_pelayanan === 'CUKUP' ? '3' : '1'} Pts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- HSE Card -->
            <div class="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between md:col-span-2">
              <div>
                <div class="flex justify-between items-center mb-4">
                  <div class="flex items-center gap-2">
                    <span class="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                      <span class="material-symbols-outlined text-[20px]">shield</span>
                    </span>
                    <span class="font-bold text-slate-800">Health, Safety, & Environment (HSE)</span>
                  </div>
                  <span class="text-sm font-black text-teal-600">${item.hse_score ?? 0} <span class="text-xs text-slate-400 font-medium">/ 10 Pts</span></span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div class="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                    <span class="text-xs text-slate-500 font-semibold">Uji Emisi Kendaraan (Max 5)</span>
                    <div class="flex items-center gap-2">
                      ${formatEnum(item.hse_uji_emisi)}
                      <span class="font-bold text-slate-700 text-xs">${item.hse_uji_emisi === 'BAIK' ? '5' : item.hse_uji_emisi === 'CUKUP' ? '3' : '1'} Pts</span>
                    </div>
                  </div>
                  <div class="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                    <span class="text-xs text-slate-500 font-semibold">Penggunaan APD Driver (Max 5)</span>
                    <div class="flex items-center gap-2">
                      ${formatEnum(item.hse_apd)}
                      <span class="font-bold text-slate-700 text-xs">${item.hse_apd === 'BAIK' ? '5' : item.hse_apd === 'CUKUP' ? '3' : '1'} Pts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Performance Analysis Section -->
          <div class="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col gap-4 mt-6">
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">psychology</span>
              </span>
              <span class="font-bold text-slate-800">Analisis Performa Supplier</span>
            </div>
            
            <div id="analisis-loading" class="text-xs text-slate-400 flex items-center gap-2">
              <span class="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full"></span>
              Sedang merangkai analisis performa...
            </div>
            
            <div id="analisis-content" class="hidden grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div class="p-4 bg-white rounded-xl border border-slate-100">
                <div class="font-bold text-emerald-600 mb-2 flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">trending_up</span> Kelebihan / Kekuatan
                </div>
                <ul id="analisis-strengths" class="list-disc pl-4 space-y-1 text-slate-600">
                </ul>
              </div>
              
              <div class="p-4 bg-white rounded-xl border border-slate-100">
                <div class="font-bold text-rose-600 mb-2 flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">trending_down</span> Kelemahan / Hambatan
                </div>
                <ul id="analisis-weaknesses" class="list-disc pl-4 space-y-1 text-slate-600">
                </ul>
              </div>
              
              <div class="md:col-span-2 p-4 bg-indigo-50/50 rounded-xl border border-indigo-150">
                <div class="font-bold text-indigo-900 mb-1 flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">gavel</span> Rekomendasi Tindak Lanjut
                </div>
                <p id="analisis-recommendation" class="text-slate-700 italic leading-relaxed"></p>
              </div>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button id="close-modal-footer-btn" class="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-sm shadow-md hover:opacity-90 active:scale-95 transition-all">
            Tutup Rincian
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Load analysis dynamically
  getAnalisisPerforma(item.supplier_id, item.periode).then(res => {
    const loadingEl = document.getElementById('analisis-loading');
    const contentEl = document.getElementById('analisis-content');
    if (loadingEl) loadingEl.remove();
    if (contentEl) {
      contentEl.classList.remove('hidden');
      
      const strengthsUl = document.getElementById('analisis-strengths');
      const weaknessesUl = document.getElementById('analisis-weaknesses');
      const recP = document.getElementById('analisis-recommendation');
      
      if (strengthsUl && res.strengths) {
        strengthsUl.innerHTML = res.strengths.map(s => `<li>${s}</li>`).join('') || '<li>Tidak ada kelebihan spesifik terdeteksi.</li>';
      }
      if (weaknessesUl && res.weaknesses) {
        weaknessesUl.innerHTML = res.weaknesses.map(w => `<li>${w}</li>`).join('') || '<li>Tidak ada kelemahan spesifik terdeteksi.</li>';
      }
      if (recP) {
        recP.textContent = res.recommendation || '-';
      }
    }
  }).catch(err => {
    console.error(err);
    const loadingEl = document.getElementById('analisis-loading');
    if (loadingEl) {
      loadingEl.innerHTML = `<span class="text-red-500 font-bold">Gagal memuat analisis performa dari server.</span>`;
    }
  });

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
    return `<span class="text-indigo-600 font-black text-sm">${formattedAvg}${suffix}</span>`;
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
      <div class="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-fadeInUp">
        
        <!-- Header -->
        <div class="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-violet-50 to-indigo-50">
          <div>
            <div class="text-[11px] font-bold text-violet-600 uppercase tracking-widest mb-1">Rincian Rerata & Performa 2 Periode</div>
            <h3 class="text-2xl font-black text-slate-800 leading-tight">${name}</h3>
            <div class="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
              <span class="bg-slate-100 px-3 py-1.5 rounded-lg font-semibold border border-slate-200">Kode: ${kodeVendor}</span>
              <span class="bg-slate-100 px-3 py-1.5 rounded-lg font-semibold border border-slate-200">Kategori: ${category}</span>
            </div>
          </div>
          <div class="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
            <button id="close-modal-btn" class="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>
        </div>

        <!-- Scrollable Comparison Table -->
        <div class="p-6 overflow-y-auto space-y-6">
          <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-700 text-xs font-bold text-slate-500 uppercase">
                  <th class="px-4 py-3">Kriteria Evaluasi</th>
                  <th class="px-4 py-3 text-center bg-slate-50/50 w-[25%]">${labelA}</th>
                  <th class="px-4 py-3 text-center bg-indigo-50/30 w-[25%]">${labelB}</th>
                  <th class="px-4 py-3 text-center w-[18%]">Rerata (Average)</th>
                </tr>
              </thead>
              <tbody class="text-sm text-slate-600 divide-y divide-slate-100">
                
                <!-- SUMMARY SECTION -->
                <tr class="bg-indigo-50/20 font-bold">
                  <td class="px-4 py-3.5 text-indigo-900">GRADE KESELURUHAN</td>
                  <td class="px-4 py-3.5 text-center bg-slate-50/50">${itemA ? getGradeBadge(itemA.grade) : 'N/A'}</td>
                  <td class="px-4 py-3.5 text-center bg-indigo-50/30">${itemB ? getGradeBadge(itemB.grade) : 'N/A'}</td>
                  <td class="px-4 py-3.5 text-center">${getAverageGradeBadge(itemA?.grade, itemB?.grade, avgGrade)}</td>
                </tr>
                <tr class="font-bold">
                  <td class="px-4 py-3.5 text-slate-800 font-bold">SKOR TOTAL (Max 100)</td>
                  <td class="px-4 py-3.5 text-center bg-slate-50/50 text-slate-800 text-lg">${itemA ? itemA.total_score : 'N/A'}</td>
                  <td class="px-4 py-3.5 text-center bg-indigo-50/30 text-slate-800 text-lg">${itemB ? itemB.total_score : 'N/A'}</td>
                  <td class="px-4 py-3.5 text-center">${getAverageSpan(itemA?.total_score, itemB?.total_score)}</td>
                </tr>

                <!-- DIVISION 1: QC -->
                <tr class="bg-slate-50 font-bold text-slate-500">
                  <td colspan="4" class="px-4 py-2 text-xs uppercase tracking-wider">Quality Control (QC)</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Poin QC (Max 30)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50 font-semibold">${itemA ? itemA.qc_score : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30 font-bold">${itemB ? itemB.qc_score : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.qc_score, itemB?.qc_score)}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Qty Barang Diterima (OK)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50">${itemA ? formatNumber(itemA.qc_qty_terima) + ' Pcs' : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30 font-semibold text-slate-850">${itemB ? formatNumber(itemB.qc_qty_terima) + ' Pcs' : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.qc_qty_terima, itemB?.qc_qty_terima, ' Pcs')}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Qty Barang Reject (NG)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50 text-red-600">${itemA ? formatNumber(itemA.qc_qty_reject) + ' Pcs' : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30 text-red-600 font-semibold">${itemB ? formatNumber(itemB.qc_qty_reject) + ' Pcs' : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.qc_qty_reject, itemB?.qc_qty_reject, ' Pcs')}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Persentase NG (%)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50">${itemA && itemA.qc_ng_percent !== null ? parseFloat(itemA.qc_ng_percent).toFixed(2) + '%' : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30 font-semibold">${itemB && itemB.qc_ng_percent !== null ? parseFloat(itemB.qc_ng_percent).toFixed(2) + '%' : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.qc_ng_percent, itemB?.qc_ng_percent, '%', true)}</td>
                </tr>

                <!-- DIVISION 2: PPIC -->
                <tr class="bg-slate-50 font-bold text-slate-500">
                  <td colspan="4" class="px-4 py-2 text-xs uppercase tracking-wider">PPIC (On-Time Delivery)</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Poin PPIC (Max 30)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50 font-semibold">${itemA ? itemA.ppic_score : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30 font-bold">${itemB ? itemB.ppic_score : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.ppic_score, itemB?.ppic_score)}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">On-Time Delivery (%)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50">${itemA && itemA.ppic_ot_percent !== null ? parseFloat(itemA.ppic_ot_percent).toFixed(2) + '%' : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30 font-semibold">${itemB && itemB.ppic_ot_percent !== null ? parseFloat(itemB.ppic_ot_percent).toFixed(2) + '%' : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.ppic_ot_percent, itemB?.ppic_ot_percent, '%', true)}</td>
                </tr>

                <!-- DIVISION 3: PCH -->
                <tr class="bg-slate-50 font-bold text-slate-500">
                  <td colspan="4" class="px-4 py-2 text-xs uppercase tracking-wider">Purchasing (PCH)</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Poin PCH (Max 25)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50 font-semibold">${itemA ? itemA.pch_score : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30 font-bold">${itemB ? itemB.pch_score : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.pch_score, itemB?.pch_score)}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Kesesuaian Harga (Max 10)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50">${itemA ? getEnumBadge(itemA.pch_harga) : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30">${itemB ? getEnumBadge(itemB.pch_harga) : '-'}</td>
                  <td class="px-4 py-3 text-center">-</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Kesesuaian MOQ (Max 10)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50">${itemA ? getEnumBadge(itemA.pch_moq) : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30">${itemB ? getEnumBadge(itemB.pch_moq) : '-'}</td>
                  <td class="px-4 py-3 text-center">-</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Term of Payment (Max 5)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50">${itemA ? getEnumBadge(itemA.pch_top) : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30">${itemB ? getEnumBadge(itemB.pch_top) : '-'}</td>
                  <td class="px-4 py-3 text-center">-</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Kualitas Pelayanan (Max 5)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50">${itemA ? getEnumBadge(itemA.pch_pelayanan) : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30">${itemB ? getEnumBadge(itemB.pch_pelayanan) : '-'}</td>
                  <td class="px-4 py-3 text-center">-</td>
                </tr>

                <!-- DIVISION 4: HSE -->
                <tr class="bg-slate-50 font-bold text-slate-500">
                  <td colspan="4" class="px-4 py-2 text-xs uppercase tracking-wider">Health, Safety, & Environment (HSE)</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Poin HSE (Max 10)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50 font-semibold">${itemA ? itemA.hse_score : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30 font-bold">${itemB ? itemB.hse_score : '-'}</td>
                  <td class="px-4 py-3 text-center">${getAverageSpan(itemA?.hse_score, itemB?.hse_score)}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Uji Emisi Kendaraan (Max 5)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50">${itemA ? getEnumBadge(itemA.hse_uji_emisi) : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30">${itemB ? getEnumBadge(itemB.hse_uji_emisi) : '-'}</td>
                  <td class="px-4 py-3 text-center">-</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 pl-8 text-slate-500">Penggunaan APD Driver (Max 5)</td>
                  <td class="px-4 py-3 text-center bg-slate-50/50">${itemA ? getEnumBadge(itemA.hse_apd) : '-'}</td>
                  <td class="px-4 py-3 text-center bg-indigo-50/30">${itemB ? getEnumBadge(itemB.hse_apd) : '-'}</td>
                  <td class="px-4 py-3 text-center">-</td>
                </tr>

              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button id="close-modal-footer-btn" class="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-sm shadow-md hover:opacity-90 active:scale-95 transition-all">
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

// ============================================================
//  EVALUASI BERKALA — Setup, Load, Render, Modal
// ============================================================

/** Setup dropdown awal/akhir (12 bulan), tombol shortcut 6 bln / 1 tahun */
function setupEvaluasiBerkala() {
  const selAwal = document.getElementById('evaluasi-periode-awal');
  const selAkhir = document.getElementById('evaluasi-periode-akhir');
  if (!selAwal || !selAkhir) return;

  const today = new Date();
  const names = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  selAwal.innerHTML = '';
  selAkhir.innerHTML = '';

  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lbl = `${names[d.getMonth()]} ${d.getFullYear()}`;
    selAwal.insertAdjacentHTML('beforeend', `<option value="${val}">${lbl}</option>`);
    selAkhir.insertAdjacentHTML('beforeend', `<option value="${val}">${lbl}</option>`);
  }

  // Default: awal = 6 bulan lalu, akhir = bulan lalu
  selAwal.selectedIndex = 5;
  selAkhir.selectedIndex = 1;

  const setShortcut = (nBulan) => {
    selAwal.selectedIndex = Math.min(nBulan - 1, selAwal.options.length - 1);
    selAkhir.selectedIndex = 1;
  };

  document.getElementById('btn-shortcut-6m')?.addEventListener('click', () => setShortcut(6));
  document.getElementById('btn-shortcut-1y')?.addEventListener('click', () => setShortcut(12));
  document.getElementById('btn-load-evaluasi')?.addEventListener('click', loadEvaluasiData);
}

/** Ambil ringkasan rata-rata semua vendor dalam rentang, lalu render tabel */
async function loadEvaluasiData() {
  const selAwal = document.getElementById('evaluasi-periode-awal');
  const selAkhir = document.getElementById('evaluasi-periode-akhir');
  const tbody = document.getElementById('evaluasi-tbody');
  const count = document.getElementById('record-count');
  if (!selAwal || !selAkhir || !tbody) return;

  const pAwal = selAwal.value;
  const pAkhir = selAkhir.value;

  if (pAwal > pAkhir) {
    tbody.innerHTML = `<tr><td colspan="10" class="px-sm py-8 text-center text-amber-600">
      <span class="material-symbols-outlined text-[32px]">warning</span><br>
      Periode "Dari" tidak boleh lebih baru dari "Sampai".
    </td></tr>`;
    return;
  }

  currentEvaluasiPeriodeAwal = pAwal;
  currentEvaluasiPeriodeAkhir = pAkhir;

  tbody.innerHTML = `<tr><td colspan="10" class="px-sm py-10 text-center text-on-surface-variant">
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
      <span class="material-symbols-outlined" style="font-size:36px;color:#7c3aed;animation:spin 1s linear infinite">autorenew</span>
      <span style="font-size:14px">Memuat data evaluasi berkala...</span>
    </div></td></tr>`;

  try {
    const vendorList = await getHeatmapData(pAkhir);
    const vendors = (vendorList && vendorList.length > 0) ? vendorList : (await getHeatmapData(pAwal) || []);

    if (!vendors.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="px-sm py-10 text-center text-on-surface-variant">
        <span class="material-symbols-outlined" style="font-size:36px">inbox</span><br>
        Tidak ada vendor pada rentang periode ini.
      </td></tr>`;
      if (count) count.textContent = 'Tidak ada data.';
      return;
    }

    const results = await Promise.allSettled(
      vendors.map(v => getDetailEvaluasi(v.kode_vendor, pAwal, pAkhir))
    );

    currentEvaluasiData = results
      .map((r, i) => r.status === 'fulfilled' ? { ...r.value, kode_vendor: vendors[i].kode_vendor } : null)
      .filter(Boolean);

    renderEvaluasiTable(currentEvaluasiData, pAwal, pAkhir);
  } catch (err) {
    console.error('loadEvaluasiData error:', err);
    tbody.innerHTML = `<tr><td colspan="10" class="px-sm py-10 text-center text-red-600">
      <span class="material-symbols-outlined text-[36px]">error</span><br>
      Gagal memuat data. Pastikan backend berjalan.<br>
      <span class="text-xs font-mono text-red-500 block mt-2">${err.message}</span>
    </td></tr>`;
    if (count) count.textContent = 'Gagal memuat data evaluasi berkala.';
  }
}

/** Render tabel ringkasan rata-rata semua vendor */
function renderEvaluasiTable(dataArr, pAwal, pAkhir) {
  const tbody = document.getElementById('evaluasi-tbody');
  const count = document.getElementById('record-count');
  if (!tbody) return;

  const active = dataArr.filter(d => d.status === 'success' && d.rata_rata);

  if (!active.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="px-6 py-12 text-center text-slate-400">
      <span class="material-symbols-outlined text-[36px] mb-2 text-slate-300">inbox</span><br>
      <span class="text-sm font-semibold">Tidak ada data dalam rentang periode ini.</span>
    </td></tr>`;
    if (count) count.textContent = 'Tidak ada data untuk evaluasi berkala.';
    return;
  }

  const fmt = (v, dec = 1) => (v !== null && v !== undefined) ? parseFloat(v).toFixed(dec) : '-';
  const gradeBadge = (g) => {
    if (g === 'A') return `<span class="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-black rounded-lg border border-green-200/60">Grade A</span>`;
    if (g === 'B') return `<span class="px-2.5 py-1 bg-yellow-50 text-yellow-700 text-xs font-black rounded-lg border border-yellow-200/60">Grade B</span>`;
    return `<span class="px-2.5 py-1 bg-red-50 text-red-750 text-xs font-black rounded-lg border border-red-200/60">Grade C</span>`;
  };

  tbody.innerHTML = '';
  active.forEach(d => {
    const r = d.rata_rata;
    const avgTotal = parseFloat(r.avg_total_score || 0);
    const totalColor = avgTotal >= 90 ? '#22c55e' : avgTotal >= 70 ? '#f59e0b' : '#ef4444';

    tbody.insertAdjacentHTML('beforeend', `
      <tr class="cursor-pointer">
        <td class="px-6 py-4 text-center">
          <span class="material-symbols-outlined text-slate-300 group-hover:text-violet-650 transition-colors">event_repeat</span>
        </td>
        <td class="px-6 py-4">
          <div class="font-bold text-slate-800 text-sm">${d.nama_vendor ?? '-'}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Kode: ${d.kode_vendor}</div>
        </td>
        <td class="px-6 py-4 text-slate-500 text-sm">${d.jenis_bahan ?? '-'}</td>
        <td class="px-6 py-4 text-center font-semibold text-slate-700 text-sm">${fmt(r.avg_qc_score)} Pts</td>
        <td class="px-6 py-4 text-center font-semibold text-slate-700 text-sm">${fmt(r.avg_ppic_score)} Pts</td>
        <td class="px-6 py-4 text-center font-semibold text-slate-700 text-sm">${fmt(r.avg_pch_score)} Pts</td>
        <td class="px-6 py-4 text-center font-semibold text-slate-700 text-sm">${fmt(r.avg_hse_score)} Pts</td>
        <td class="px-6 py-4 text-center">
          <span class="inline-block px-2.5 py-1 text-sm font-black rounded-lg" style="background-color: ${totalColor}15; color: ${totalColor}">
            ${fmt(r.avg_total_score)}
          </span>
        </td>
        <td class="px-6 py-4 text-center">${gradeBadge(r.avg_grade)}</td>
        <td class="px-6 py-4 text-center">
          <button
            onclick="openEvaluasiDetailModal('${d.kode_vendor}','${pAwal}','${pAkhir}')"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold rounded-lg border border-violet-200/60 transition-all duration-200 shadow-sm active:scale-95">
            <span class="material-symbols-outlined text-[14px]">open_in_new</span>
            <span>Lihat Detail</span>
          </button>
        </td>
      </tr>`);
  });

  if (count) count.textContent = `Evaluasi berkala: ${active.length} vendor, periode ${formatPeriode(pAwal)} — ${formatPeriode(pAkhir)}.`;
}

/**
 * Lazy-load modal detail per vendor.
 * Fungsi ini dipanggil via onclick inline di baris tabel evaluasi.
 */
async function openEvaluasiDetailModal(kodeVendor, pAwal, pAkhir) {
  document.getElementById('evaluasi-detail-modal')?.remove();

  // Skeleton modal muncul sebelum data tiba
  document.body.insertAdjacentHTML('beforeend', `
    <div id="evaluasi-detail-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn font-['Inter']">
      <div class="bg-white rounded-3xl w-[98vw] max-w-[1500px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[95vh] animate-fadeInUp">
        <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-violet-50 to-indigo-50">
          <div>
            <div class="text-[11px] font-bold text-violet-600 uppercase tracking-widest mb-1">Evaluasi Berkala — Detail Aktual</div>
            <h3 id="evaluasi-modal-title" class="text-xl font-black text-slate-800">Memuat data...</h3>
            <p class="text-xs text-slate-500 mt-1">${formatPeriode(pAwal)} — ${formatPeriode(pAkhir)}</p>
          </div>
          <button id="close-evaluasi-modal" class="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <span class="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>
        <div id="evaluasi-modal-body" class="p-6 overflow-y-auto">
          <div class="flex flex-col items-center gap-3 py-12 text-on-surface-variant">
            <span class="material-symbols-outlined text-[40px] text-violet-400" style="animation:spin 1s linear infinite">autorenew</span>
            <span class="text-sm">Mengambil data aktual per bulan...</span>
          </div>
        </div>
        <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap justify-between items-center gap-4">
          <div class="text-[10px] text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200">
            <strong class="text-slate-700">Kriteria Penilaian:</strong><br>
            <span class="inline-block mt-1 mr-3"><b>QC:</b> &lt;0.5% = 30 pts | 0.5-0.99% = 15 pts | &ge;1% = 10 pts</span>
            <span class="inline-block mt-1 mr-3"><b>PPIC:</b> &ge;90% = 30 pts | &ge;71% = 15 pts | &lt;71% = 10 pts</span>
            <span class="inline-block mt-1"><b>PCH/HSE:</b> Baik = Max pts | Cukup/Kurang = Mid/Min pts</span>
          </div>
          <button id="close-evaluasi-modal-footer" class="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-sm shadow-md hover:opacity-90 active:scale-95 transition-all">
            Tutup
          </button>
        </div>
      </div>
    </div>`);

  const closeEv = () => document.getElementById('evaluasi-detail-modal')?.remove();
  document.getElementById('close-evaluasi-modal')?.addEventListener('click', closeEv);
  document.getElementById('close-evaluasi-modal-footer')?.addEventListener('click', closeEv);
  document.getElementById('evaluasi-detail-modal')?.addEventListener('click', e => {
    if (e.target.id === 'evaluasi-detail-modal') closeEv();
  });

  try {
    const res = await getDetailEvaluasi(kodeVendor, pAwal, pAkhir);
    const titleEl = document.getElementById('evaluasi-modal-title');
    if (titleEl) titleEl.textContent = `Data Aktual: ${res.nama_vendor ?? kodeVendor}`;

    const fmt = (v, dec = 2) => (v !== null && v !== undefined) ? parseFloat(v).toFixed(dec) : '-';
    const enumBadge = (val, label = '') => {
      if (!val) return '<span class="text-slate-350">—</span>';
      const initial = val.charAt(0); // 'B', 'C', or 'K'
      const cls = val === 'BAIK' ? 'bg-green-50 text-green-700 border-green-200'
        : val === 'CUKUP' ? 'bg-yellow-50 text-yellow-750 border-yellow-200'
          : 'bg-red-50 text-red-750 border-red-200';
      const fullLabel = label ? `${label}: ${val}` : val;
      return `<span class="w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full border shadow-sm cursor-help ${cls}" title="${fullLabel}">${initial}</span>`;
    };
    const gradeBadge = (g) => {
      if (g === 'A') return `<span class="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-black rounded-lg border border-green-200/60">Grade A</span>`;
      if (g === 'B') return `<span class="px-2.5 py-1 bg-yellow-50 text-yellow-700 text-xs font-black rounded-lg border border-yellow-200/60">Grade B</span>`;
      return `<span class="px-2.5 py-1 bg-red-50 text-red-750 text-xs font-black rounded-lg border border-red-200/60">Grade C</span>`;
    };

    // Baris data aktual
    let rowsHtml = '';
    if (!res.data_aktual?.length) {
      rowsHtml = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">
        Tidak ada data aktual pada rentang ini.</td></tr>`;
    } else {
      res.data_aktual.forEach(row => {
        const sc = parseFloat(row.total_score || 0);
        const tc = sc >= 90 ? '#22c55e' : sc >= 70 ? '#f59e0b' : '#ef4444';

        // Data Tambahan
        const qtyTerima = row.qc_qty_terima ?? 0;
        const qtyReject = row.qc_qty_reject ?? 0;

        rowsHtml += `
          <tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
            <td class="px-4 py-3 text-center font-semibold text-slate-700 whitespace-nowrap text-xs">${formatPeriode(row.periode)}</td>
            <td class="px-4 py-3 text-center">
              <div class="font-bold text-slate-800 text-sm">${fmt(row.qc_ng_percent)}%</div>
              <div class="text-[10px] text-slate-500 leading-tight mt-1">Terima: ${qtyTerima} <br> Reject: ${qtyReject}</div>
              <div class="text-[10px] font-bold text-violet-700 mt-1.5 bg-violet-100/65 rounded-md inline-block px-2 py-0.5 border border-violet-200/40">${row.qc_score ?? 0} Pts</div>
            </td>
            <td class="px-4 py-3 text-center">
              <div class="font-bold text-slate-800 text-sm">${fmt(row.ppic_ot_percent)}%</div>
              <div class="text-[10px] text-slate-500 leading-tight mt-1">Ketepatan <br> Pengiriman</div>
              <div class="text-[10px] font-bold text-violet-700 mt-1.5 bg-violet-100/65 rounded-md inline-block px-2 py-0.5 border border-violet-200/40">${row.ppic_score ?? 0} Pts</div>
            </td>
            <td class="px-4 py-3 text-center">
              <div class="text-[12px] font-bold text-slate-800">${row.pch_score ?? 0} Pts</div>
              <div class="flex justify-center gap-1 mt-1.5">
                ${enumBadge(row.pch_harga, 'Harga')}${enumBadge(row.pch_moq, 'MOQ')}${enumBadge(row.pch_top, 'TOP')}${enumBadge(row.pch_pelayanan, 'Pelayanan')}
              </div>
            </td>
            <td class="px-4 py-3 text-center">
              <div class="text-[12px] font-bold text-slate-800">${row.hse_score ?? 0} Pts</div>
              <div class="flex justify-center gap-1 mt-1.5">
                ${enumBadge(row.hse_uji_emisi, 'Uji Emisi')}${enumBadge(row.hse_apd, 'APD')}
              </div>
            </td>
            <td class="px-4 py-3 text-center">
              <span class="inline-block px-2.5 py-1 text-sm font-black rounded-lg" style="background-color: ${tc}15; color: ${tc}">
                ${row.total_score ?? '-'}
              </span>
            </td>
            <td class="px-4 py-3 text-center">${gradeBadge(row.grade)}</td>
          </tr>`;
      });
    }

    // Baris footer rata-rata
    let footerHtml = '';
    const r = res.rata_rata;
    if (r) {
      const at = parseFloat(r.avg_total_score || 0);
      const ac = at >= 90 ? '#22c55e' : at >= 70 ? '#f59e0b' : '#ef4444';

      const sumTerima = r.sum_qc_qty_terima ?? 0;
      const sumReject = r.sum_qc_qty_reject ?? 0;

      footerHtml = `
        <tr class="bg-violet-50/70 border-t-2 border-violet-300 sticky bottom-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <td class="px-4 py-4 text-violet-850 text-xs font-black uppercase tracking-wider whitespace-nowrap">
            RATA-RATA <br><span class="text-[10px] font-semibold text-violet-600">(${r.jumlah_bulan} bln)</span>
          </td>
          <td class="px-4 py-4 text-center">
            <div class="font-black text-violet-850 text-sm">${fmt(r.avg_qc_ng_percent)}%</div>
            <div class="text-[10px] text-violet-600 font-semibold leading-tight mt-1">Tot. Terima: ${sumTerima} <br> Tot. Reject: ${sumReject}</div>
            <div class="text-[10px] font-bold text-violet-750 bg-violet-100/70 rounded-md inline-block px-2 py-0.5 mt-1.5 border border-violet-200/50">${fmt(r.avg_qc_score, 1)} Pts</div>
          </td>
          <td class="px-4 py-4 text-center">
            <div class="font-black text-violet-850 text-sm">${fmt(r.avg_ppic_ot_percent)}%</div>
            <div class="text-[10px] text-violet-600 font-semibold mt-1">&nbsp;</div>
            <div class="text-[10px] font-bold text-violet-750 bg-violet-100/70 rounded-md inline-block px-2 py-0.5 mt-1.5 border border-violet-200/50">${fmt(r.avg_ppic_score, 1)} Pts</div>
          </td>
          <td class="px-4 py-4 text-center">
            <div class="text-[13px] font-black text-violet-850">${fmt(r.avg_pch_score, 1)} Pts</div>
          </td>
          <td class="px-4 py-4 text-center">
            <div class="text-[13px] font-black text-violet-850">${fmt(r.avg_hse_score, 1)} Pts</div>
          </td>
          <td class="px-4 py-4 text-center">
            <span class="inline-block px-3 py-1.5 text-sm font-black rounded-lg" style="background-color: ${ac}15; color: ${ac}">
              ${fmt(r.avg_total_score, 1)}
            </span>
          </td>
          <td class="px-4 py-4 text-center">${gradeBadge(r.avg_grade)}</td>
        </tr>`;
    }

    const body = document.getElementById('evaluasi-modal-body');
    if (body) {
      // Build insight HTML from backend response
      const insight = res.insight || {};
      const insightHtml = `
        <div class="p-5 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-violet-50/40 flex flex-col gap-4">
          <div class="flex items-center gap-2.5">
            <span class="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
              <span class="material-symbols-outlined text-[20px]">auto_awesome</span>
            </span>
            <div>
              <span class="font-bold text-slate-800 text-sm">Smart Insight Analysis</span>
              <span class="text-[10px] text-slate-400 ml-2 bg-slate-100 px-2 py-0.5 rounded-full font-semibold border border-slate-200">Pseudo-AI</span>
            </div>
          </div>
          <div class="text-[13px] text-slate-700 space-y-3 leading-relaxed">
            <div class="flex gap-2.5 items-start">
              <span class="text-base mt-0.5 flex-shrink-0">📊</span>
              <span id="insight-ringkasan">${insight.ringkasan || '-'}</span>
            </div>
            <div class="flex gap-2.5 items-start">
              <span class="text-base mt-0.5 flex-shrink-0">⚠️</span>
              <span id="insight-anomali">${insight.anomali || '-'}</span>
            </div>
            <div class="flex gap-2.5 items-start">
              <span class="text-base mt-0.5 flex-shrink-0">💡</span>
              <span id="insight-rekomendasi">${insight.rekomendasi || '-'}</span>
            </div>
          </div>
        </div>`;

      body.innerHTML = `
        <div class="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span class="bg-slate-100 px-3 py-1.5 rounded-lg font-semibold border border-slate-200">Kode Vendor: <span class="text-slate-800">${kodeVendor}</span></span>
          <span class="bg-slate-100 px-3 py-1.5 rounded-lg font-semibold border border-slate-200">Kategori: <span class="text-slate-800">${res.jenis_bahan ?? '-'}</span></span>
          <span class="bg-violet-50 text-violet-800 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 border border-violet-200">
            <span class="material-symbols-outlined text-[16px]">event_repeat</span>
            Periode: ${formatPeriode(pAwal)} — ${formatPeriode(pAkhir)}
          </span>
        </div>

        <!-- Chart Section -->
        <div class="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm mb-5">
          <div class="flex items-center gap-2 mb-4">
            <span class="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-[20px]">monitoring</span>
            </span>
            <span class="font-bold text-slate-800 text-sm">Tren Performa Vendor</span>
          </div>
          <div class="relative" style="height: 320px">
            <canvas id="evaluasi-trend-chart"></canvas>
          </div>
        </div>

        <!-- Smart Insight Section -->
        ${insightHtml}

        <!-- Collapsible Data Table -->
        <div class="mt-5">
          <button id="toggle-detail-table" class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors text-sm font-semibold text-slate-700 group">
            <span class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-slate-500">table_chart</span>
              Lihat Detail Tabel Data Aktual
            </span>
            <span class="material-symbols-outlined text-[18px] text-slate-400 transition-transform duration-300 group-[.open]:rotate-180" id="toggle-icon">expand_more</span>
          </button>
          <div id="detail-table-wrapper" class="hidden mt-3 border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-fadeInUp">
            <div class="max-h-[45vh] overflow-y-auto">
              <table class="w-full text-left border-collapse text-sm">
                <thead class="sticky top-0 z-10 shadow-sm">
                  <tr class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[11px] font-black uppercase tracking-wider">
                    <th class="px-4 py-3.5 whitespace-nowrap border-r border-violet-500/30">Periode</th>
                    <th class="px-4 py-3.5 text-center whitespace-nowrap border-r border-violet-500/30 w-40">QC (Quality Control)</th>
                    <th class="px-4 py-3.5 text-center whitespace-nowrap border-r border-violet-500/30 w-36">PPIC (Delivery)</th>
                    <th class="px-4 py-3.5 text-center border-r border-violet-500/30">PCH (Purchasing)</th>
                    <th class="px-4 py-3.5 text-center border-r border-violet-500/30">HSE (Safety)</th>
                    <th class="px-4 py-3.5 text-center whitespace-nowrap border-r border-violet-500/30">Total Score</th>
                    <th class="px-4 py-3.5 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">${rowsHtml}</tbody>
                <tfoot>${footerHtml}</tfoot>
              </table>
            </div>
          </div>
        </div>`;

      // Toggle detail table visibility
      const toggleBtn = document.getElementById('toggle-detail-table');
      const tableWrapper = document.getElementById('detail-table-wrapper');
      if (toggleBtn && tableWrapper) {
        toggleBtn.addEventListener('click', () => {
          tableWrapper.classList.toggle('hidden');
          toggleBtn.classList.toggle('open');
        });
      }

      // Render Chart.js trend chart
      if (res.grafik?.length > 0 && typeof Chart !== 'undefined') {
        const ctx = document.getElementById('evaluasi-trend-chart')?.getContext('2d');
        if (ctx) {
          const labels = res.grafik.map(r => {
            const [y, m] = r.periode.split('-');
            const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
            return months[parseInt(m) - 1] + ' ' + y;
          });

          const datasets = [
            {
              label: 'Nilai QC',
              data: res.grafik.map(item => item.qc_raw),
              maxScore: 30,
              backgroundColor: 'rgba(54, 162, 235, 0.8)', // Biru
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            },
            {
              label: 'Nilai PPIC',
              data: res.grafik.map(item => item.ppic_raw),
              maxScore: 30,
              backgroundColor: 'rgba(255, 206, 86, 0.8)', // Kuning
              borderColor: 'rgba(255, 206, 86, 1)',
              borderWidth: 1
            },
            {
              label: 'Nilai PCH',
              data: res.grafik.map(item => item.pch_raw),
              maxScore: 25,
              backgroundColor: 'rgba(75, 192, 192, 0.8)', // Hijau Tosca
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1
            },
            {
              label: 'Nilai HSE',
              data: res.grafik.map(item => item.hse_raw),
              maxScore: 10,
              backgroundColor: 'rgba(255, 99, 132, 0.8)', // Merah Muda
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1
            }
          ];

          // Register datalabels plugin
          if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
          }

          new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'top',
                  labels: {
                    color: '#475569', // Slate-600 for light theme
                    font: { family: "'Inter', sans-serif", size: 11, weight: '600' }
                  }
                },
                datalabels: {
                  color: '#fff',
                  font: {
                    weight: 'bold',
                    size: 11
                  },
                  formatter: function(value) {
                    return value > 0 ? value : '';
                  }
                },
                tooltip: {
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  titleFont: { family: "'Inter', sans-serif", size: 13, weight: '700' },
                  bodyFont: { family: "'Inter', sans-serif", size: 12 },
                  padding: 12,
                  cornerRadius: 8,
                  callbacks: {
                    label: function(context) {
                      const label = context.dataset.label || '';
                      const val = context.raw;
                      const max = context.dataset.maxScore;
                      return ` ${label}: ${val}/${max} Pts`;
                    }
                  }
                }
              },
              scales: {
                x: {
                  stacked: true,
                  grid: { display: false },
                  ticks: { font: { family: "'Inter', sans-serif", size: 11, weight: '600' }, color: '#64748b' }
                },
                y: {
                  stacked: true,
                  beginAtZero: true,
                  max: 100,
                  grid: {
                    color: '#e2e8f0',
                    borderDash: [5, 5],
                    drawBorder: false
                  },
                  ticks: {
                    font: { family: "'Inter', sans-serif", size: 11 },
                    color: '#94a3b8',
                    stepSize: 20
                  }
                }
              }
            }
          });
        }
      }
    }
  } catch (err) {
    console.error('openEvaluasiDetailModal error:', err);
    const body = document.getElementById('evaluasi-modal-body');
    if (body) body.innerHTML = `<div class="py-12 text-center text-red-600">
      <span class="material-symbols-outlined text-[40px]">error</span><br>
      <span class="font-semibold">Gagal memuat detail evaluasi.</span><br>
      <span class="text-xs text-red-400">${err.message}</span>
    </div>`;
  }
}


// FITUR BARU: SEARCH, FILTER, SORT, EXPORT

function setupFiltersAndSearch() {
  const searchInput = document.getElementById('search-heatmap');
  const catSelect = document.getElementById('kategori-select');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      applyFiltersAndRender();
    });
  }

  if (catSelect) {
    catSelect.addEventListener('change', (e) => {
      categoryFilter = e.target.value;
      applyFiltersAndRender();
    });
  }
}

function setupSorting() {
  const sortTotal = document.getElementById('sort-total-score');
  const sortGrade = document.getElementById('sort-grade');
  const iconTotal = document.getElementById('icon-sort-score');
  const iconGrade = document.getElementById('icon-sort-grade');

  const sortEvalTotal = document.getElementById('sort-eval-total-score');
  const sortEvalGrade = document.getElementById('sort-eval-grade');
  const iconEvalTotal = document.getElementById('icon-sort-eval-score');
  const iconEvalGrade = document.getElementById('icon-sort-eval-grade');

  const resetIcons = () => {
    if (iconTotal) iconTotal.textContent = 'unfold_more';
    if (iconGrade) iconGrade.textContent = 'unfold_more';
    if (iconEvalTotal) iconEvalTotal.textContent = 'unfold_more';
    if (iconEvalGrade) iconEvalGrade.textContent = 'unfold_more';
  };

  const handleSort = (col, iconEl) => {
    if (currentSortCol === col) {
      currentSortAsc = !currentSortAsc;
    } else {
      currentSortCol = col;
      currentSortAsc = false; // default descending for score
    }
    
    resetIcons();
    if (iconEl) {
      iconEl.textContent = currentSortAsc ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
      iconEl.style.opacity = '1';
    }
    
    applyFiltersAndRender();
  };

  if (sortTotal) {
    sortTotal.addEventListener('click', () => handleSort('total_score', iconTotal));
  }
  
  if (sortGrade) {
    sortGrade.addEventListener('click', () => {
      // For grade, default ascending (A is better than C, alphabetically smaller)
      if (currentSortCol !== 'grade') {
        currentSortAsc = true; 
        currentSortCol = 'grade';
      } else {
        currentSortAsc = !currentSortAsc;
      }
      resetIcons();
      if (iconGrade) {
        iconGrade.textContent = currentSortAsc ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
        iconGrade.style.opacity = '1';
      }
      applyFiltersAndRender();
    });
  }

  // Bind Evaluasi Berkala Sorts
  if (sortEvalTotal) {
    sortEvalTotal.addEventListener('click', () => handleSort('total_score', iconEvalTotal));
  }

  if (sortEvalGrade) {
    sortEvalGrade.addEventListener('click', () => {
      if (currentSortCol !== 'grade') {
        currentSortAsc = true; 
        currentSortCol = 'grade';
      } else {
        currentSortAsc = !currentSortAsc;
      }
      resetIcons();
      if (iconEvalGrade) {
        iconEvalGrade.textContent = currentSortAsc ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
        iconEvalGrade.style.opacity = '1';
      }
      applyFiltersAndRender();
    });
  }
}

function setupExport() {
  const btnExport = document.getElementById('btn-export-excel');
  if (!btnExport) return;

  btnExport.addEventListener('click', async () => {
    let dataToExport = [];
    let filename = '';
    let title = '';
    let periodeStr = '';
    let headers = [];
    let rows = [];

    if (currentMode === 'monthly') {
      dataToExport = currentMonthlyData;
      if (dataToExport.length === 0) {
        alert('Tidak ada data rekap bulanan untuk diexport.');
        return;
      }

      filename = `Rekap_Vendor_${currentPeriode}.xlsx`;
      title = `REKAP BULANAN PENILAIAN VENDOR - PERIODE ${formatPeriode(currentPeriode).toUpperCase()}`;
      periodeStr = `Periode Penilaian: ${formatPeriode(currentPeriode)}`;
      headers = ['No', 'Kode Vendor', 'Nama Vendor', 'Kategori', 'Score QC', 'Score PPIC', 'Score PCH', 'Score HSE', 'Total Score', 'Grade'];
      
      rows = dataToExport.map((v, idx) => [
        idx + 1,
        v.kode_vendor || '-',
        v.nama_vendor || '-',
        v.jenis_bahan || '-',
        v.qc_score !== null && v.qc_score !== undefined ? parseFloat(v.qc_score).toFixed(1) : '0.0',
        v.ppic_score !== null && v.ppic_score !== undefined ? parseFloat(v.ppic_score).toFixed(1) : '0.0',
        v.pch_score !== null && v.pch_score !== undefined ? parseFloat(v.pch_score).toFixed(1) : '0.0',
        v.hse_score !== null && v.hse_score !== undefined ? parseFloat(v.hse_score).toFixed(1) : '0.0',
        v.total_score !== null && v.total_score !== undefined ? parseFloat(v.total_score).toFixed(1) : '0.0',
        v.grade || '-'
      ]);

    } else if (currentMode === 'evaluasi') {
      const activeData = currentEvaluasiData.filter(d => d.status === 'success' && d.rata_rata);
      
      // Terapkan filter dan sort yang sama persis
      let filtered = [...activeData];
      if (categoryFilter) {
        filtered = filtered.filter(v => v.jenis_bahan === categoryFilter);
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(v => 
          (v.nama_vendor && v.nama_vendor.toLowerCase().includes(q)) ||
          (v.kode_vendor && String(v.kode_vendor).toLowerCase().includes(q))
        );
      }
      if (currentSortCol) {
        filtered.sort((a, b) => {
          const rA = a.rata_rata || {};
          const rB = b.rata_rata || {};
          let valA, valB;
          if (currentSortCol === 'total_score') {
            valA = parseFloat(rA.avg_total_score) || 0;
            valB = parseFloat(rB.avg_total_score) || 0;
          } else if (currentSortCol === 'grade') {
            valA = rA.avg_grade || 'Z';
            valB = rB.avg_grade || 'Z';
          }
          if (valA < valB) return currentSortAsc ? -1 : 1;
          if (valA > valB) return currentSortAsc ? 1 : -1;
          return 0;
        });
      }

      dataToExport = filtered;
      if (dataToExport.length === 0) {
        alert('Tidak ada data evaluasi berkala untuk diexport.');
        return;
      }

      filename = `Evaluasi_Berkala_${currentEvaluasiPeriodeAwal}_sd_${currentEvaluasiPeriodeAkhir}.xlsx`;
      title = `EVALUASI BERKALA PENILAIAN VENDOR`;
      periodeStr = `Rentang Periode: ${formatPeriode(currentEvaluasiPeriodeAwal)} s/d ${formatPeriode(currentEvaluasiPeriodeAkhir)}`;
      headers = ['No', 'Kode Vendor', 'Nama Vendor', 'Kategori', 'Rerata QC', 'Rerata PPIC', 'Rerata PCH', 'Rerata HSE', 'Rerata Total', 'Avg Grade'];

      rows = dataToExport.map((d, idx) => {
        const r = d.rata_rata || {};
        return [
          idx + 1,
          d.kode_vendor || '-',
          d.nama_vendor || '-',
          d.jenis_bahan || '-',
          r.avg_qc_score !== null && r.avg_qc_score !== undefined ? parseFloat(r.avg_qc_score).toFixed(1) : '0.0',
          r.avg_ppic_score !== null && r.avg_ppic_score !== undefined ? parseFloat(r.avg_ppic_score).toFixed(1) : '0.0',
          r.avg_pch_score !== null && r.avg_pch_score !== undefined ? parseFloat(r.avg_pch_score).toFixed(1) : '0.0',
          r.avg_hse_score !== null && r.avg_hse_score !== undefined ? parseFloat(r.avg_hse_score).toFixed(1) : '0.0',
          r.avg_total_score !== null && r.avg_total_score !== undefined ? parseFloat(r.avg_total_score).toFixed(1) : '0.0',
          r.avg_grade || '-'
        ];
      });
    }

    const originalContent = btnExport.innerHTML;
    btnExport.disabled = true;
    btnExport.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin mr-1">autorenew</span><span>Mengekspor...</span>`;

    try {
      const response = await fetch(`${API_BASE_URL}/penilaian/export-excel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename,
          title,
          periode: periodeStr,
          headers,
          rows
        })
      });

      if (!response.ok) {
        throw new Error('Gagal mengekspor data dari server');
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

    } catch (err) {
      console.error('Export Error:', err);
      alert('Terjadi kesalahan saat mengekspor ke Excel: ' + err.message);
    } finally {
      btnExport.disabled = false;
      btnExport.innerHTML = originalContent;
    }
  });
}
