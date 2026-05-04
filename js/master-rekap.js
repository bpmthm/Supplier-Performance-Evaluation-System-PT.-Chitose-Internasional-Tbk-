/**
 * Master Rekap Page
 * - Role protection (PCH / MANAGER / BOD / ADMIN only)
 * - Periode dropdown auto-generated
 * - Tabel di-populate dari API backend
 */

const urlParams   = new URLSearchParams(window.location.search);
const activeRole  = (urlParams.get('role') || '').toUpperCase();
const allowedRoles = ['PCH', 'MANAGER', 'BOD', 'ADMIN'];

let currentPeriode = '';

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

  // Pasang role ke semua nav links agar tidak hilang saat berpindah halaman
  forwardRoleToNavLinks();

  // Build periode dropdown
  setupPeriodeDropdown();

  // Load data heatmap pertama kali
  await loadHeatmapData();
});

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

/** Fetch data dari API dan render tabel */
async function loadHeatmapData() {
  showLoading(true);
  try {
    const data = await getHeatmapData(currentPeriode);
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
    // 4. Warna Background berdasarkan SKOR POIN
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

    // 1 & 2 & 3. Format Teks
    const qcText = item.qc_ng_percent !== null ? `${item.qc_ng_percent}% (${item.qc_score ?? 0} Poin)` : '-';
    const ppicText = item.ppic_ot_percent !== null ? `${item.ppic_ot_percent}% (${item.ppic_score ?? 0} Poin)` : '-';
    const pchText = `${item.pch_score ?? 0} Poin`;
    const hseText = `${item.hse_score ?? 0} Poin`;

    // 5. Total dan Grade
    const totalColor = getScoreColor(item.total_score ?? 0, 100);
    let gradeBadge = '-';
    if (item.grade === 'A') gradeBadge = `<span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-md border border-green-200">A</span>`;
    else if (item.grade === 'B') gradeBadge = `<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-md border border-yellow-200">B</span>`;
    else if (item.grade === 'C') gradeBadge = `<span class="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-md border border-red-200">C</span>`;

    const rowClass = 'hover:bg-slate-50 transition-colors cursor-pointer group border-l-4 border-l-slate-300';

    tbody.insertAdjacentHTML('beforeend', `
      <tr data-row-id="${item.id}" class="${rowClass}">
        <td class="px-sm py-4 text-center">
          <span class="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors">chevron_right</span>
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

  if (count) count.textContent = `Menampilkan ${data.length} supplier untuk periode ${formatPeriode(currentPeriode)}.`;
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
