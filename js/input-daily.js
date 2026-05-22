/**
 * Input Daily QC JS
 * - Role protection (QC only)
 * - Fetch active supplier dropdown
 * - Live Autocomplete Material from SAP TBL_MATERIAL
 * - Submit form daily QC harian to MySQL t_qc_daily
 * - Show recent inputs history feed
 */

const urlParams = new URLSearchParams(window.location.search);
const activeRole = (urlParams.get('role') || '').toUpperCase();
const allowedRoles = ['QC'];

let selectedMaterial = null; // Cache chosen material

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
              Maaf, Anda tidak memiliki izin untuk melihat halaman ini. Akses ke halaman <strong>Input Daily QC</strong> secara eksklusif dibatasi untuk divisi <strong class="text-slate-700">Quality Control (QC)</strong>.
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

      // Reset nav styling
      const navDaily = document.getElementById('nav-daily');
      if (navDaily) {
        navDaily.className = "text-slate-400 hover:text-white mx-2 px-4 py-2 flex items-center gap-3 hover:bg-slate-800 transition-all duration-150 active:scale-95 origin-left";
      }

      // Tetap forward role ke nav links agar jika user klik link di sidebar parameter ?role= tidak hilang
      forwardRoleToNavLinks();
    });
    return;
  }
})();

document.addEventListener('DOMContentLoaded', async () => {
  if (!activeRole || !allowedRoles.includes(activeRole)) return;

  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('tanggal_terima');
  if (dateInput) dateInput.value = today;

  // Forward URL role parameters
  forwardRoleToNavLinks();

  // Load dropdown suppliers
  await loadSupplierDropdown();

  // Setup Live Material Search
  setupMaterialAutocomplete();

  // Load history list
  await loadRecentEntries();

  // Setup form submit
  setupFormSubmit();

  // Setup form reset
  setupFormReset();
});

/** Forward role parameter ke semua link sidebar */
function forwardRoleToNavLinks() {
  const links = document.querySelectorAll('#nav-links a');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href !== '#' && !href.includes('role=')) {
      const separator = href.includes('?') ? '&' : '?';
      link.setAttribute('href', `${href}${separator}role=${activeRole}`);
    }
  });
}

/** Populate supplier dropdown */
async function loadSupplierDropdown() {
  const select = document.getElementById('supplier_id');
  if (!select) return;

  try {
    const suppliers = await getSuppliers();
    select.innerHTML = '<option value="">Pilih Supplier...</option>';
    
    suppliers.forEach(s => {
      select.insertAdjacentHTML('beforeend', `
        <option value="${s.id}">${s.nama_vendor} (${s.kode_vendor})</option>
      `);
    });
  } catch (error) {
    console.error('Error loading suppliers dropdown:', error);
    select.innerHTML = '<option value="">Gagal memuat supplier</option>';
  }
}

/** Live material search autocomplete logic */
function setupMaterialAutocomplete() {
  const searchInput = document.getElementById('material_search');
  const wrapper = document.getElementById('autocomplete-wrapper');
  const preview = document.getElementById('material-preview');
  const clearBtn = document.getElementById('clear-material');

  if (!searchInput || !wrapper) return;

  let debounceTimer;

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    clearTimeout(debounceTimer);

    if (query.length < 2) {
      wrapper.innerHTML = '';
      wrapper.classList.add('hidden');
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const materials = await searchSapMaterials(query);
        renderAutocomplete(materials);
      } catch (error) {
        console.error('Error autocomplete materials:', error);
        wrapper.innerHTML = '<div class="p-3 text-red-500 text-xs">Gagal mencari material.</div>';
      }
    }, 300);
  });

  // Hide dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !wrapper.contains(e.target)) {
      wrapper.classList.add('hidden');
    }
  });

  // Clear component selection
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      selectedMaterial = null;
      document.getElementById('material_code').value = '';
      document.getElementById('material_desc').value = '';
      searchInput.value = '';
      searchInput.disabled = false;
      searchInput.required = true;
      preview.classList.add('hidden');
    });
  }
}

/** Render autocomplete dropdown results */
function renderAutocomplete(materials) {
  const wrapper = document.getElementById('autocomplete-wrapper');
  const searchInput = document.getElementById('material_search');
  const preview = document.getElementById('material-preview');
  const descPreview = document.getElementById('preview-desc');
  const codePreview = document.getElementById('preview-code');

  if (!wrapper) return;

  if (!materials || materials.length === 0) {
    wrapper.innerHTML = '<div class="p-3 text-slate-500 text-xs text-center">Komponen tidak ditemukan.</div>';
    wrapper.classList.remove('hidden');
    return;
  }

  wrapper.innerHTML = '';
  wrapper.classList.remove('hidden');

  materials.forEach(mat => {
    const code = mat.MATERIALCODE;
    const desc = mat.DESCRIPTION;

    const opt = document.createElement('div');
    opt.className = 'p-3 hover:bg-slate-50 cursor-pointer transition-colors flex flex-col';
    opt.innerHTML = `
      <span class="text-sm font-bold text-slate-700">${desc}</span>
      <span class="text-xs font-mono text-indigo-600 mt-0.5">${code}</span>
    `;

    opt.addEventListener('click', () => {
      // Set values
      selectedMaterial = { code, desc };
      document.getElementById('material_code').value = code;
      document.getElementById('material_desc').value = desc;

      // Lock search field
      searchInput.value = desc;
      searchInput.disabled = true;
      searchInput.required = false;

      // Show selection preview card
      descPreview.textContent = desc;
      codePreview.textContent = code;
      preview.classList.remove('hidden');

      // Hide dropdown
      wrapper.classList.add('hidden');
      wrapper.innerHTML = '';
    });

    wrapper.appendChild(opt);
  });
}

/** Load recent entries history feed */
async function loadRecentEntries() {
  const panel = document.getElementById('recent-entries');
  if (!panel) return;

  try {
    const list = await getQcDailyList();
    if (!list || list.length === 0) {
      panel.innerHTML = `
        <div class="text-center py-8 text-slate-400 text-xs">
          <span class="material-symbols-outlined text-[32px] text-slate-300 mb-1">inbox</span>
          <div>Belum ada transaksi harian dicatat.</div>
        </div>
      `;
      return;
    }

    panel.innerHTML = '';
    // Show top 10 recent
    list.slice(0, 10).forEach(item => {
      const dateFormatted = new Date(item.tanggal_terima).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      const rejectBadge = parseInt(item.qty_reject) > 0
        ? `<span class="px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-bold text-[10px] border border-red-100">${item.qty_reject} Reject</span>`
        : `<span class="px-1.5 py-0.5 bg-green-50 text-green-600 rounded font-bold text-[10px] border border-green-100">0 Reject</span>`;

      panel.insertAdjacentHTML('beforeend', `
        <div class="py-3 flex flex-col gap-1 text-xs">
          <div class="flex justify-between items-center">
            <span class="font-bold text-slate-800">${item.no_surat_jalan}</span>
            <span class="text-slate-400 font-medium">${dateFormatted}</span>
          </div>
          <div class="text-slate-500 font-medium">${item.nama_vendor || 'Unknown Vendor'}</div>
          <div class="text-slate-700 font-semibold mt-0.5">${item.material_desc} (${item.material_code})</div>
          <div class="flex items-center gap-2 mt-1">
            <span class="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-bold text-[10px] border border-slate-200">${item.qty_masuk} Pcs</span>
            ${rejectBadge}
          </div>
          ${item.keterangan ? `<div class="text-[10px] italic text-slate-400 mt-1">Catatan: "${item.keterangan}"</div>` : ''}
        </div>
      `);
    });

  } catch (error) {
    console.error('Error loading daily history:', error);
    panel.innerHTML = '<div class="text-center py-6 text-red-500 text-xs">Gagal memuat riwayat.</div>';
  }
}

/** Setup form submit process */
function setupFormSubmit() {
  const form = document.getElementById('daily-qc-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validasi material terpilih
    if (!selectedMaterial) {
      showToast('Harap cari dan pilih material dari SAP terlebih dahulu!', 'error');
      return;
    }

    const tgl = document.getElementById('tanggal_terima').value;
    const supp = document.getElementById('supplier_id').value;
    const sj = document.getElementById('no_surat_jalan').value.trim();
    const masuk = parseInt(document.getElementById('qty_masuk').value);
    const reject = parseInt(document.getElementById('qty_reject').value);
    const ket = document.getElementById('keterangan').value.trim();

    if (isNaN(masuk) || masuk < 0) {
      showToast('Jumlah Masuk tidak boleh kosong atau negatif!', 'error');
      return;
    }
    if (isNaN(reject) || reject < 0) {
      showToast('Qty Reject tidak boleh kosong atau negatif!', 'error');
      return;
    }

    // Set button loading
    const btn = document.getElementById('btn-submit');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[16px] inline-block align-middle">autorenew</span> Menyimpan...';

    try {
      const payload = {
        tanggal_terima: tgl,
        supplier_id: supp,
        no_surat_jalan: sj,
        material_code: selectedMaterial.code,
        material_desc: selectedMaterial.desc,
        qty_masuk: masuk,
        qty_reject: reject,
        keterangan: ket
      };

      const result = await saveQcDaily(payload);

      if (result && result.status === 'success') {
        showToast('Transaksi daily QC berhasil disimpan ke database MySQL!', 'success');
        
        // Reset form
        document.getElementById('clear-material').click();
        form.reset();
        
        // Reset tanggal ke hari ini
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('tanggal_terima').value = today;

        // Reload history feed
        await loadRecentEntries();
      } else {
        throw new Error(result.message || 'Error occurred');
      }
    } catch (error) {
      console.error('Submit daily QC error:', error);
      showToast('Gagal menyimpan transaksi: ' + error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
}

/** Form reset logic */
function setupFormReset() {
  const resetBtn = document.getElementById('btn-reset');
  if (!resetBtn) return;

  resetBtn.addEventListener('click', () => {
    const form = document.getElementById('daily-qc-form');
    if (form) {
      form.reset();
      const clearBtn = document.getElementById('clear-material');
      if (clearBtn && selectedMaterial) clearBtn.click();
      
      const today = new Date().toISOString().split('T')[0];
      const dateInput = document.getElementById('tanggal_terima');
      if (dateInput) dateInput.value = today;

      showToast('Form berhasil di-reset.', 'warning');
    }
  });
}

/** Toast notifications helper */
function showToast(message, type = 'success') {
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
