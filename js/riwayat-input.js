/**
 * Riwayat Input QC - JavaScript
 * Fixes: correct API field names, stats cards, NG rate column,
 *        interactive detail panel, smooth animations.
 */

let filteredData = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 25;
let currentPagination = { total: 0, limit: ITEMS_PER_PAGE, page: 1, total_pages: 1 };

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    setDefaultMonthFilter();
    await fetchRiwayatData();
    setupEventListeners();
});

// Set filter bulan ke bulan berjalan secara default
function setDefaultMonthFilter() {
    const filterBulan = document.getElementById('filter-bulan');
    if (!filterBulan) return;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    filterBulan.value = `${yyyy}-${mm}`;
}

// ─── API Fetch ─────────────────────────────────────────────────────────────────
async function fetchRiwayatData() {
    showLoadingState();
    try {
        const keyword = (document.getElementById('search-input')?.value || '').trim();
        const bulan   = document.getElementById('filter-bulan')?.value || '';
        
        const params = new URLSearchParams({
            page: currentPage,
            limit: ITEMS_PER_PAGE,
            search: keyword,
            bulan: bulan
        });

        const response = await fetch(`${API_BASE_URL}/qc-daily?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        filteredData = result.data || [];
        currentPagination = result.pagination || { total: 0, limit: ITEMS_PER_PAGE, page: 1, total_pages: 1 };
        const stats = result.stats || { total_penerimaan: 0, qty_masuk: 0, qty_reject: 0, ng_rate: 0 };

        updateStats(stats);
        renderTable();

    } catch (error) {
        console.error('Gagal menarik data riwayat:', error);
        showErrorState(error.message);
    }
}

// ─── Field Name Helpers (sesuai kolom t_qc_daily + JOIN m_supplier) ──────────
function getSupplierName(item) {
    return item.nama_vendor   // ← dari JOIN m_supplier s ON q.supplier_id = s.id
        || item.nama_supplier
        || item.vendor_name
        || '-';
}

function getKodeVendor(item) {
    return item.kode_vendor || '-';
}

function getMaterialDesc(item) {
    return item.material_desc  // ← kolom t_qc_daily
        || item.nama_komponen
        || item.material_name
        || '-';
}

function getMaterialCode(item) {
    return item.material_code || '-';
}

function getTanggal(item) {
    return item.tanggal_terima  // ← kolom t_qc_daily
        || item.tgl_terima
        || item.tanggal
        || item.created_at
        || '';
}

function calcNgRate(item) {
    const masuk  = parseInt(item.qty_masuk  || 0);
    const reject = parseInt(item.qty_reject || 0);
    if (masuk <= 0) return 0;
    return (reject / masuk) * 100;
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────
function updateStats(stats) {
    const total   = stats.total_penerimaan || 0;
    const qtyIn   = stats.qty_masuk || 0;
    const qtyRej  = stats.qty_reject || 0;
    const ngRate  = (stats.ng_rate || 0).toFixed(2);

    animateCounter('stat-total-penerimaan', total);
    animateCounter('stat-qty-masuk', qtyIn);
    animateCounter('stat-qty-reject', qtyRej);
    document.getElementById('stat-ng-rate').textContent = `${ngRate}%`;

    // Warnai card NG Rate sesuai ambang batas
    const ngEl = document.getElementById('stat-ng-rate');
    if (ngEl) {
        const rate = parseFloat(ngRate);
        ngEl.className = 'text-2xl font-black mt-1 ' + (rate > 5 ? 'text-rose-600' : rate > 2 ? 'text-amber-500' : 'text-emerald-600');
    }
}

function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const start    = 0;
    const duration = 600;
    const step     = (target - start) / (duration / 16);
    let   current  = start;
    const timer    = setInterval(() => {
        current += step;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = Math.floor(current).toLocaleString('id-ID');
    }, 16);
}

// ─── Filter ───────────────────────────────────────────────────────────────────
function setupEventListeners() {
    document.getElementById('search-input')?.addEventListener('input', debounce(applyFilters, 200));
    document.getElementById('filter-bulan')?.addEventListener('change', applyFilters);
}

function applyFilters() {
    currentPage = 1;
    fetchRiwayatData();
}

function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ─── Table Render ─────────────────────────────────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const pageItems = filteredData;

    if (pageItems.length === 0) {
        tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center py-20">
                <div class="flex flex-col items-center gap-3 text-slate-400">
                    <span class="material-symbols-outlined text-[48px] opacity-40">inbox</span>
                    <p class="text-sm font-semibold">Tidak ada data ditemukan</p>
                    <p class="text-xs">Coba ubah filter pencarian atau bulan</p>
                </div>
            </td>
        </tr>`;
        updatePaginationInfo(0, 0, 0);
        document.getElementById('pagination-container').innerHTML = '';
        return;
    }

    pageItems.forEach((item, idx) => {
        const supplierName = getSupplierName(item);
        const kodeVendor   = getKodeVendor(item);
        const komponenName = getMaterialDesc(item);
        const materialCode = getMaterialCode(item);
        const tglTerima    = getTanggal(item);
        const noSj         = item.no_surat_jalan || '-';
        const qtyMasuk     = parseInt(item.qty_masuk  || 0);
        const qtyReject    = parseInt(item.qty_reject || 0);
        const ngRate       = calcNgRate(item);
        const ketText      = item.keterangan || '';

        // NG Rate Badge
        let ngBadgeClass, ngLabel;
        if (ngRate === 0) {
            ngBadgeClass = 'bg-emerald-100 text-emerald-700';
            ngLabel = '0.00%';
        } else if (ngRate <= 5) {
            ngBadgeClass = 'bg-amber-100 text-amber-700';
            ngLabel = `${ngRate.toFixed(2)}%`;
        } else {
            ngBadgeClass = 'bg-rose-100 text-rose-700';
            ngLabel = `${ngRate.toFixed(2)}%`;
        }

        // Keterangan truncation
        const ketDisplay = ketText.length > 30
            ? `<span class="truncate block max-w-[160px]" title="${ketText}">${ketText.substring(0, 30)}…</span>`
            : (ketText || '<span class="text-slate-300">—</span>');

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-indigo-50/30 transition-colors cursor-pointer border-b border-slate-100 last:border-0 group';
        tr.innerHTML = `
            <td class="px-5 py-3.5">
                <div class="font-semibold text-slate-800 text-sm leading-tight">${supplierName}</div>
                <div class="text-[10px] text-slate-400 font-mono mt-0.5">${kodeVendor}</div>
            </td>
            <td class="px-5 py-3.5 font-mono text-xs text-slate-600">${noSj}</td>
            <td class="px-5 py-3.5">
                <div class="text-sm text-slate-700 leading-tight">${komponenName}</div>
                <div class="text-[10px] text-slate-400 font-mono mt-0.5">${materialCode}</div>
            </td>
            <td class="px-5 py-3.5 text-center">
                <span class="font-bold text-emerald-600 text-sm">${qtyMasuk.toLocaleString('id-ID')}</span>
            </td>
            <td class="px-5 py-3.5 text-center">
                <span class="font-bold text-rose-500 text-sm">${qtyReject.toLocaleString('id-ID')}</span>
            </td>
            <td class="px-5 py-3.5 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${ngBadgeClass}">${ngLabel}</span>
            </td>
            <td class="px-5 py-3.5 text-xs text-slate-500">${formatDate(tglTerima)}</td>
            <td class="px-5 py-3.5 text-xs text-slate-500 max-w-[180px] whitespace-normal">${ketDisplay}</td>
            <td class="px-4 py-3 whitespace-nowrap text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="editRecord(${item.id})" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-md transition-colors" title="Edit">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onclick="deleteRecord(${item.id})" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-md transition-colors" title="Hapus">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            </td>
        `;

        // Row click → open detail panel
        tr.addEventListener('click', () => {
            // Deselect all rows
            document.querySelectorAll('#table-body tr').forEach(r => r.classList.remove('row-selected'));
            tr.classList.add('row-selected');
            openDetailPanel(item);
        });

        tbody.appendChild(tr);
    });

    const startIdx = (currentPagination.page - 1) * currentPagination.limit + 1;
    const endIdx   = startIdx + pageItems.length - 1;
    updatePaginationInfo(pageItems.length > 0 ? startIdx : 0, endIdx, currentPagination.total);
    renderPaginationControls();
}

// ─── Detail Slide-over Panel ──────────────────────────────────────────────────
function openDetailPanel(item) {
    const panel    = document.getElementById('detail-panel');
    const backdrop = document.getElementById('detail-backdrop');
    if (!panel || !backdrop) return;

    const supplierName = getSupplierName(item);
    const kodeVendor   = getKodeVendor(item);
    const komponenName = getMaterialDesc(item);
    const materialCode = getMaterialCode(item);
    const tglTerima    = getTanggal(item);
    const noSj         = item.no_surat_jalan || '-';
    const qtyMasuk     = parseInt(item.qty_masuk  || 0);
    const qtyReject    = parseInt(item.qty_reject || 0);
    const ngRate       = calcNgRate(item);
    const ketText      = item.keterangan || 'Tidak ada keterangan tambahan.';

    // Fill panel fields
    setText('detail-no-sj-title',      `SJ: ${noSj}`);
    setText('detail-supplier-name',    supplierName);
    setText('detail-supplier-kode',    kodeVendor);
    setText('detail-no-sj',            noSj);
    setText('detail-material-desc',    komponenName);
    setText('detail-material-code',    materialCode);
    setText('detail-tgl-terima',       formatDate(tglTerima));
    setText('detail-qty-masuk',        qtyMasuk.toLocaleString('id-ID'));
    setText('detail-qty-reject',       qtyReject.toLocaleString('id-ID'));
    setText('detail-keterangan',       ketText);

    // NG Rate bar
    const ngRateEl  = document.getElementById('detail-ng-rate');
    const ngBarEl   = document.getElementById('detail-ng-bar');
    const ngStatusEl = document.getElementById('detail-ng-status');
    if (ngRateEl) ngRateEl.textContent = `${ngRate.toFixed(2)}%`;
    if (ngBarEl) {
        const barWidth = Math.min(ngRate, 100);
        let barColor;
        if (ngRate === 0)      barColor = '#10b981'; // emerald
        else if (ngRate <= 5)  barColor = '#f59e0b'; // amber
        else                   barColor = '#ef4444'; // rose
        setTimeout(() => {
            ngBarEl.style.width = `${barWidth}%`;
            ngBarEl.style.backgroundColor = barColor;
        }, 80);
    }
    if (ngStatusEl) {
        if (ngRate === 0)      ngStatusEl.textContent = '✓ Tidak ada reject pada penerimaan ini';
        else if (ngRate <= 5)  ngStatusEl.textContent = `⚠ NG Rate ${ngRate.toFixed(2)}% — masih dalam toleransi (≤ 5%)`;
        else                   ngStatusEl.textContent = `✗ NG Rate ${ngRate.toFixed(2)}% — melebihi batas toleransi 5%!`;
        ngStatusEl.className = `text-[11px] font-semibold ${ngRate > 5 ? 'text-rose-500' : ngRate > 0 ? 'text-amber-500' : 'text-emerald-600'}`;
    }

    // Show panel & backdrop
    const panelBackdrop = document.getElementById('detail-backdrop');
    panelBackdrop.classList.add('open');
    panel.classList.add('open');
}

function closeDetailPanel() {
    const panel    = document.getElementById('detail-panel');
    const backdrop = document.getElementById('detail-backdrop');
    if (!panel || !backdrop) return;

    panel.classList.remove('open');
    backdrop.classList.remove('open');

    // Reset NG bar width so it animates fresh next time
    const ngBarEl = document.getElementById('detail-ng-bar');
    if (ngBarEl) ngBarEl.style.width = '0%';

    setTimeout(() => {
        // Deselect all rows
        document.querySelectorAll('#table-body tr').forEach(r => r.classList.remove('row-selected'));
    }, 300);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ─── Loading / Error States ───────────────────────────────────────────────────
function showLoadingState() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = `
    <tr>
        <td colspan="8" class="text-center py-20">
            <div class="flex flex-col items-center gap-3 text-slate-400">
                <span class="material-symbols-outlined text-[40px] text-indigo-400 animate-spin">autorenew</span>
                <p class="text-sm font-semibold text-slate-500">Memuat data riwayat input QC...</p>
            </div>
        </td>
    </tr>`;
}

function showErrorState(message) {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = `
    <tr>
        <td colspan="8" class="text-center py-20">
            <div class="flex flex-col items-center gap-3">
                <span class="material-symbols-outlined text-[48px] text-rose-400">error_outline</span>
                <p class="text-sm font-bold text-slate-700">Gagal memuat data</p>
                <p class="text-xs text-slate-400 max-w-sm text-center">${message}</p>
                <button onclick="fetchRiwayatData()" class="mt-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[14px]">refresh</span> Coba Lagi
                </button>
            </div>
        </td>
    </tr>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        // tanggal_terima dari DB bisa dalam format 'YYYY-MM-DD'
        const [year, month, day] = dateStr.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
    } catch {
        return dateStr;
    }
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function updatePaginationInfo(start, end, total) {
    const el = document.getElementById('page-info');
    if (el) el.textContent = `Menampilkan ${start.toLocaleString('id-ID')} – ${end.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} data`;
}

function renderPaginationControls() {
    const container  = document.getElementById('pagination-container');
    if (!container) return;
    container.innerHTML = '';
    const totalPages = currentPagination.total_pages || 1;
    if (totalPages <= 1) return;

    container.appendChild(createPageBtn('chevron_left', currentPage - 1, currentPage === 1, false, true));

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            container.appendChild(createPageBtn(String(i), i, false, i === currentPage));
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            const dots = document.createElement('span');
            dots.className = 'px-2 py-1 text-slate-400 text-sm select-none';
            dots.textContent = '…';
            container.appendChild(dots);
        }
    }

    container.appendChild(createPageBtn('chevron_right', currentPage + 1, currentPage === totalPages, false, true));
}

function createPageBtn(text, targetPage, isDisabled, isActive = false, isIcon = false) {
    const btn = document.createElement('button');
    if (isIcon) {
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px] leading-none">${text}</span>`;
    } else {
        btn.textContent = text;
    }
    btn.className = `min-w-[32px] h-8 px-2 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center ${
        isActive
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
    } ${isDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`;

    if (!isDisabled && !isActive) {
        btn.onclick = () => {
            currentPage = targetPage;
            fetchRiwayatData();
            document.getElementById('table-body')?.closest('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' });
        };
    }
    return btn;
}


// FITUR CRUD (EDIT & DELETE) QC DAILY

// FUNGSI DELETE
window.deleteRecord = async function(id) {
    const result = await Swal.fire({
        title: 'Yakin mau hapus?',
        text: "Data yang dihapus tidak bisa dikembalikan!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`${API_BASE_URL}/qc-daily/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error('Gagal menghapus data');

            Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success');
            await fetchRiwayatData(); // Otomatis refresh tabel
        } catch (error) {
            console.error(error);
            Swal.fire('Error!', 'Terjadi kesalahan saat menghapus data.', 'error');
        }
    }
};

// FUNGSI MUNCULIN MODAL EDIT
window.editRecord = function(id) {
    const data = allData.find(item => item.id == id);
    if (!data) return;

    document.getElementById('edit_id').value = data.id;
    document.getElementById('edit_supplier_id').value = data.supplier_id;
    document.getElementById('edit_tanggal').value = data.tanggal_terima;
    document.getElementById('edit_sj').value = data.no_surat_jalan;
    document.getElementById('edit_mat_code').value = data.material_code;
    document.getElementById('edit_mat_desc').value = data.material_desc;
    document.getElementById('edit_qty_masuk').value = data.qty_masuk;
    document.getElementById('edit_qty_reject').value = data.qty_reject;

    document.getElementById('editModal').classList.remove('hidden');
};

// FUNGSI TUTUP MODAL
window.closeEditModal = function() {
    document.getElementById('editModal').classList.add('hidden');
};

// FUNGSI SUBMIT FORM EDIT (PUT)
window.submitEditForm = async function(e) {
    e.preventDefault();
    
    const btnSave = document.getElementById('btnSaveEdit');
    const originalText = btnSave.innerHTML;
    btnSave.disabled = true;
    btnSave.innerHTML = `<span class="material-symbols-outlined animate-spin text-[18px]">autorenew</span> Menyimpan...`;

    const id = document.getElementById('edit_id').value;
    
    const payload = {
        tanggal_terima: document.getElementById('edit_tanggal').value,
        supplier_id: document.getElementById('edit_supplier_id').value,
        no_surat_jalan: document.getElementById('edit_sj').value,
        material_code: document.getElementById('edit_mat_code').value,
        material_desc: document.getElementById('edit_mat_desc').value,
        qty_masuk: document.getElementById('edit_qty_masuk').value,
        qty_reject: document.getElementById('edit_qty_reject').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/qc-daily/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Gagal update data');

        closeEditModal();
        Swal.fire('Berhasil!', 'Data berhasil diupdate.', 'success');
        await fetchRiwayatData(); // Otomatis refresh tabel
    } catch (error) {
        console.error(error);
        Swal.fire('Error!', 'Gagal menyimpan perubahan.', 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = originalText;
    }
};

// Expose globals for inline HTML onclick
window.closeDetailPanel = closeDetailPanel;
window.openDetailPanel  = openDetailPanel;
window.fetchRiwayatData = fetchRiwayatData;