/**
 * Master Vendor Page
 * - Role protection (PCH only)
 * - Tabel semua vendor (termasuk non-aktif)
 * - Toggle status aktif/non-aktif vendor
 * - Search/filter vendor
 */

const activeRole = getActiveRole();
const allowedRoles = ['PCH'];

let allVendors = []; // Cache data vendor
let filteredVendors = []; // Cache setelah filter status & search
let currentVendorPage = 1;
const vendorsPerPage = 10;
let currentStatusFilter = 'ALL'; // 'ALL' | 'ACTIVE' | 'INACTIVE'

// ---- IIFE: Role check SEBELUM DOM selesai ----
(function enforceRoleAccess() {
  if (!activeRole || !allowedRoles.includes(activeRole)) {
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
              Maaf, Anda tidak memiliki izin untuk melihat halaman ini. Akses ke <strong>Master Vendor</strong> secara eksklusif dibatasi untuk divisi <strong class="text-slate-700">Purchasing (PCH)</strong>.
            </p>
            
            <a href="dashboard.html" 
               class="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 text-white font-semibold rounded-2xl overflow-hidden shadow-xl shadow-slate-900/20 hover:shadow-slate-900/30 transition-all duration-300 hover:-translate-y-1">
              <div class="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span class="material-symbols-outlined text-[20px] relative z-10 transition-transform duration-300 group-hover:-translate-x-1">arrow_back</span>
              <span class="relative z-10">Kembali ke Dashboard</span>
            </a>
          </div>
        `;
      }

      // Reset nav styling
      const navVendor = document.getElementById('nav-vendor');
      if (navVendor) {
        navVendor.className = "text-slate-400 hover:text-white mx-2 px-4 py-2 flex items-center gap-3 hover:bg-slate-800 transition-all duration-150 active:scale-95 origin-left";
      }

      // Tetap forward role ke nav links agar jika user klik link di sidebar parameter ?role= tidak hilang
      forwardRoleToNavLinks();
    });
    return;
  }
})();

document.addEventListener('DOMContentLoaded', async () => {
  // Jika role tidak diizinkan, halaman sudah diganti, hentikan
  if (!activeRole || !allowedRoles.includes(activeRole)) return;

  // Forward role ke semua nav links
  forwardRoleToNavLinks();

  // Setup search
  setupSearch();

  // Setup stat card clicks
  setupStatCards();

  // Load data vendor
  await loadVendorData();
});

/** Forward role parameter ke semua link sidebar */
function forwardRoleToNavLinks() {
  const links = document.querySelectorAll('#nav-links a');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href !== '#') {
      link.setAttribute('href', href.split('?')[0]);
    }
  });
}

/** Setup stat card filters */
function setupStatCards() {
  const cardActive = document.getElementById('stat-active')?.parentElement;
  const cardInactive = document.getElementById('stat-inactive')?.parentElement;
  const cardTotal = document.getElementById('stat-total')?.parentElement;

  const resetCardStyles = () => {
    [cardActive, cardInactive, cardTotal].forEach(c => {
      if (c) {
        c.classList.remove('ring-2', 'ring-primary', 'shadow-md');
        c.classList.add('cursor-pointer', 'hover:shadow-md', 'transition-all');
      }
    });
  };

  const applyCardStyle = (card) => {
    if (card) card.classList.add('ring-2', 'ring-primary', 'shadow-md');
  };

  resetCardStyles();
  if (cardTotal) applyCardStyle(cardTotal);

  if (cardTotal) {
    cardTotal.addEventListener('click', () => {
      currentStatusFilter = 'ALL';
      resetCardStyles();
      applyCardStyle(cardTotal);
      applyFiltersAndPaginate();
    });
  }

  if (cardActive) {
    cardActive.addEventListener('click', () => {
      currentStatusFilter = 'ACTIVE';
      resetCardStyles();
      applyCardStyle(cardActive);
      applyFiltersAndPaginate();
    });
  }

  if (cardInactive) {
    cardInactive.addEventListener('click', () => {
      currentStatusFilter = 'INACTIVE';
      resetCardStyles();
      applyCardStyle(cardInactive);
      applyFiltersAndPaginate();
    });
  }
}

/** Setup search/filter vendor */
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      applyFiltersAndPaginate();
    }, 300);
  });
}

/** Filter and Paginate Data */
function applyFiltersAndPaginate() {
  const searchInput = document.getElementById('search-input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  filteredVendors = allVendors.filter(v => {
    // 1. Status filter
    const isActive = parseInt(v.is_active) === 1;
    if (currentStatusFilter === 'ACTIVE' && !isActive) return false;
    if (currentStatusFilter === 'INACTIVE' && isActive) return false;

    // 2. Search query
    if (query) {
      const matchKode = (v.kode_vendor || '').toLowerCase().includes(query);
      const matchNama = (v.nama_vendor || '').toLowerCase().includes(query);
      const matchKategori = (v.jenis_bahan || '').toLowerCase().includes(query);
      if (!matchKode && !matchNama && !matchKategori) return false;
    }

    return true;
  });

  // Reset ke page 1 jika filter berubah
  currentVendorPage = 1;
  renderPagination();
}

/** Load semua vendor data dari API */
async function loadVendorData() {
  try {
    allVendors = await getAllSuppliers();
    applyFiltersAndPaginate();
    updateStats();
  } catch (error) {
    console.error('Error loading vendor data:', error);
    const tbody = document.getElementById('vendor-tbody');
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-sm py-10 text-center text-red-500">
          <div class="flex flex-col items-center gap-3">
            <span class="material-symbols-outlined text-[36px]">error</span>
            <span class="text-sm">Gagal memuat data vendor. Silakan refresh halaman.</span>
          </div>
        </td>
      </tr>
    `;
  }
}

/** Render tabel vendor */
function renderTable(data) {
  const tbody = document.getElementById('vendor-tbody');
  const count = document.getElementById('record-count');

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-sm py-10 text-center text-on-surface-variant">
          <div class="flex flex-col items-center gap-3">
            <span class="material-symbols-outlined text-[36px] text-slate-300">search_off</span>
            <span class="text-sm">Tidak ada vendor ditemukan.</span>
          </div>
        </td>
      </tr>
    `;
    if (count) count.textContent = 'Tidak ada data vendor.';
    return;
  }

  tbody.innerHTML = '';
  data.forEach((vendor, index) => {
    const isActive = parseInt(vendor.is_active) === 1;
    const statusBadge = isActive
      ? `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-lg border border-green-200">
           <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
           Aktif
         </span>`
      : `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200">
           <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">cancel</span>
           Non-Aktif
         </span>`;

    const toggleBtn = isActive
      ? `<button onclick="handleToggle(${vendor.id})" class="toggle-btn ml-2 inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg border border-red-200 hover:border-red-300 cursor-pointer">
           <span class="material-symbols-outlined text-[14px]">block</span>
           Nonaktifkan
         </button>`
      : `<button onclick="handleToggle(${vendor.id})" class="toggle-btn ml-2 inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 text-xs font-semibold rounded-lg border border-green-200 hover:border-green-300 cursor-pointer">
           <span class="material-symbols-outlined text-[14px]">check</span>
           Aktifkan
         </button>`;

    const rowOpacity = isActive ? '' : 'opacity-60';

    tbody.insertAdjacentHTML('beforeend', `
      <tr class="hover:bg-slate-50 transition-colors ${rowOpacity}" data-vendor-id="${vendor.id}">
        <td class="px-sm py-4 text-center text-on-surface-variant text-sm">${index + 1}</td>
        <td class="px-sm py-4">
          <span class="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-mono font-semibold rounded-md border border-slate-200">${vendor.kode_vendor || '-'}</span>
        </td>
        <td class="px-sm py-4 font-semibold">${vendor.nama_vendor || '-'}</td>
        <td class="px-sm py-4 text-on-surface-variant text-sm">${vendor.jenis_bahan || '-'}</td>
        <td class="px-sm py-4 text-center">
          <div class="flex items-center justify-center flex-wrap gap-1">
            ${statusBadge}
            ${toggleBtn}
          </div>
        </td>
      </tr>
    `);
  });

  if (count) count.textContent = `Menampilkan ${data.length} vendor.`;
}

/** Update stat cards */
function updateStats() {
  const total = allVendors.length;
  const active = allVendors.filter(v => parseInt(v.is_active) === 1).length;
  const inactive = total - active;

  const elTotal = document.getElementById('stat-total');
  const elActive = document.getElementById('stat-active');
  const elInactive = document.getElementById('stat-inactive');

  if (elTotal) elTotal.textContent = total;
  if (elActive) elActive.textContent = active;
  if (elInactive) elInactive.textContent = inactive;
}

/** Handle toggle vendor status */
async function handleToggle(vendorId) {
  const vendor = allVendors.find(v => v.id == vendorId);
  if (!vendor) return;

  const isActive = parseInt(vendor.is_active) === 1;
  const action = isActive ? 'menonaktifkan' : 'mengaktifkan';
  const confirmed = confirm(`Apakah Anda yakin ingin ${action} vendor "${vendor.nama_vendor}"?`);
  if (!confirmed) return;

  try {
    // Disable tombol sementara
    const row = document.querySelector(`tr[data-vendor-id="${vendorId}"]`);
    const btn = row?.querySelector('.toggle-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined text-[14px] animate-spin">autorenew</span> Proses...';
    }

    const result = await toggleVendorStatus(vendorId);
    
    if (result && result.status === 'success') {
      // Update cache lokal
      vendor.is_active = result.is_active;
      
      // Re-render
      applyFiltersAndPaginate();
      updateStats();
      
      showToast(`Vendor "${vendor.nama_vendor}" berhasil di-${result.is_active == 1 ? 'aktifkan' : 'nonaktifkan'}.`, result.is_active == 1 ? 'success' : 'warning');
    }
  } catch (error) {
    console.error('Toggle error:', error);
    showToast('Gagal mengubah status vendor: ' + error.message, 'error');
    // Re-render untuk reset tombol
    applyFiltersAndPaginate();
  }
}

/** Toast notification */
function showToast(message, type = 'success') {
  // Remove existing toast
  document.querySelectorAll('.toast-notification').forEach(t => t.remove());

  const colors = {
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600',
  };

  const icons = {
    success: 'check_circle',
    warning: 'warning',
    error: 'error',
  };

  const toast = document.createElement('div');
  toast.className = `toast-notification fixed bottom-6 right-6 z-[9999] ${colors[type] || colors.success} text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fadeInUp text-sm font-medium max-w-md`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">${icons[type] || icons.success}</span>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/** 
 * Fungsi Pagination untuk Master Vendor
 */
function renderPagination() {
  const totalVendors = filteredVendors.length;
  const totalPages = Math.ceil(totalVendors / vendorsPerPage) || 1;
  
  if (currentVendorPage > totalPages) currentVendorPage = totalPages;
  if (currentVendorPage < 1) currentVendorPage = 1;

  // Render Table Slice
  const startIdx = (currentVendorPage - 1) * vendorsPerPage;
  const endIdx = startIdx + vendorsPerPage;
  const paginatedData = filteredVendors.slice(startIdx, endIdx);
  
  // Custom render Table for Pagination to keep numbering consistent
  renderTablePaginated(paginatedData, startIdx);

  // Update UI Elements
  const countEl = document.getElementById('record-count');
  const paginationContainer = document.getElementById('pagination-container');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');
  const pageNumbersEl = document.getElementById('page-numbers');

  if (totalVendors === 0) {
    if (countEl) countEl.textContent = 'Tidak ada data vendor.';
    if (paginationContainer) paginationContainer.style.display = 'none';
    return;
  }

  if (countEl) {
    countEl.textContent = `Menampilkan ${startIdx + 1} - ${Math.min(endIdx, totalVendors)} dari total ${totalVendors} vendor`;
  }

  if (paginationContainer) {
    paginationContainer.style.display = totalPages > 1 ? 'flex' : 'none';
  }

  if (btnPrev) {
    btnPrev.disabled = currentVendorPage === 1;
    btnPrev.onclick = () => {
      if (currentVendorPage > 1) {
        currentVendorPage--;
        renderPagination();
      }
    };
  }

  if (btnNext) {
    btnNext.disabled = currentVendorPage === totalPages;
    btnNext.onclick = () => {
      if (currentVendorPage < totalPages) {
        currentVendorPage++;
        renderPagination();
      }
    };
  }

  // Generate Page Numbers (Simple: all pages, assuming < 20 pages. Can be optimized later)
  if (pageNumbersEl) {
    pageNumbersEl.innerHTML = '';
    
    // Logic for ellipses if many pages
    let startPage = Math.max(1, currentVendorPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
      pageNumbersEl.insertAdjacentHTML('beforeend', `<span class="px-1 text-slate-400">...</span>`);
    }

    for (let i = startPage; i <= endPage; i++) {
      const btn = document.createElement('button');
      btn.className = `w-8 h-8 flex items-center justify-center rounded-md font-medium text-sm transition-colors ${
        i === currentVendorPage 
          ? 'bg-primary text-white shadow-sm' 
          : 'bg-transparent text-slate-600 hover:bg-slate-100'
      }`;
      btn.textContent = i;
      btn.onclick = () => {
        currentVendorPage = i;
        renderPagination();
      };
      pageNumbersEl.appendChild(btn);
    }

    if (endPage < totalPages) {
      pageNumbersEl.insertAdjacentHTML('beforeend', `<span class="px-1 text-slate-400">...</span>`);
    }
  }
}

/** Render tabel vendor dengan index pagination */
function renderTablePaginated(data, startIdx) {
  const tbody = document.getElementById('vendor-tbody');

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-sm py-10 text-center text-on-surface-variant">
          <div class="flex flex-col items-center gap-3">
            <span class="material-symbols-outlined text-[36px] text-slate-300">search_off</span>
            <span class="text-sm">Tidak ada vendor ditemukan.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  data.forEach((vendor, index) => {
    const isActive = parseInt(vendor.is_active) === 1;
    const statusBadge = isActive
      ? `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-lg border border-green-200">
           <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
           Aktif
         </span>`
      : `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200">
           <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">cancel</span>
           Non-Aktif
         </span>`;

    const toggleBtn = isActive
      ? `<button onclick="handleToggle(${vendor.id})" class="toggle-btn ml-2 inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg border border-red-200 hover:border-red-300 cursor-pointer">
           <span class="material-symbols-outlined text-[14px]">block</span>
           Nonaktifkan
         </button>`
      : `<button onclick="handleToggle(${vendor.id})" class="toggle-btn ml-2 inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 text-xs font-semibold rounded-lg border border-green-200 hover:border-green-300 cursor-pointer">
           <span class="material-symbols-outlined text-[14px]">check</span>
           Aktifkan
         </button>`;

    const rowOpacity = isActive ? '' : 'opacity-60';

    tbody.insertAdjacentHTML('beforeend', `
      <tr class="hover:bg-slate-50 transition-colors ${rowOpacity}" data-vendor-id="${vendor.id}">
        <td class="px-sm py-4 text-center text-on-surface-variant text-sm">${startIdx + index + 1}</td>
        <td class="px-sm py-4">
          <span class="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-mono font-semibold rounded-md border border-slate-200">${vendor.kode_vendor || '-'}</span>
        </td>
        <td class="px-sm py-4 font-semibold">${vendor.nama_vendor || '-'}</td>
        <td class="px-sm py-4 text-on-surface-variant text-sm">${vendor.jenis_bahan || '-'}</td>
        <td class="px-sm py-4 text-center">
          <div class="flex items-center justify-center flex-wrap gap-1">
            ${statusBadge}
            ${toggleBtn}
          </div>
        </td>
      </tr>
    `);
  });
}
