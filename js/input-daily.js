/**
 * Input Daily QC JS
 * - Role protection (QC only)
 * - Fetch active supplier dropdown
 * - Live Autocomplete Material from SAP TBL_MATERIAL
 * - Submit form daily QC harian to MySQL t_qc_daily
 * - Show recent inputs history feed
 */

const hasAccess = guardPage(['QC'], 'Input Daily QC');

let selectedMaterial = null; // Cache chosen material
let allSuppliers    = [];    // Cache supplier list

document.addEventListener('DOMContentLoaded', async () => {
  if (!activeRole || !allowedRoles.includes(activeRole)) return;

  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('tanggal_terima');
  if (dateInput) dateInput.value = today;

  // Forward URL role parameters
  forwardRoleToNavLinks();

  // Load & setup supplier search
  await setupSupplierSearch();

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
    if (href && href !== '#') {
      link.setAttribute('href', href.split('?')[0]);
    }
  });
}

/** Supplier live search (replaces static <select>) */
async function setupSupplierSearch() {
  const input      = document.getElementById('supplier-search-input');
  const resultBox  = document.getElementById('supplier-results');
  const clearBtn   = document.getElementById('btn-clear-supplier');
  const searchIcon = document.getElementById('supplier-search-icon');
  const hiddenId   = document.getElementById('supplier_id');

  if (!input || !resultBox) return;

  try {
    allSuppliers = await getSuppliers();
  } catch (e) {
    console.error('Error loading suppliers:', e);
  }

  function showResults(keyword) {
    resultBox.innerHTML = '';
    if (keyword.length < 2) { resultBox.classList.remove('open'); return; }

    const filtered = allSuppliers.filter(s =>
      s.nama_vendor.toLowerCase().includes(keyword.toLowerCase()) ||
      s.kode_vendor.toLowerCase().includes(keyword.toLowerCase())
    );

    if (filtered.length === 0) {
      resultBox.innerHTML = `<li style="padding:10px 14px;font-size:12.5px;color:#94a3b8;text-align:center">Supplier tidak ditemukan</li>`;
    } else {
      filtered.forEach(s => {
        const li = document.createElement('li');
        li.className = 'supplier-item';
        li.innerHTML = `
          <div style="font-size:12.5px;font-weight:700;color:#1e293b">${s.nama_vendor}</div>
          <div style="font-size:11px;font-family:monospace;color:#5b6af8;margin-top:1px">${s.kode_vendor}</div>
        `;
        li.style.listStyle = 'none';
        li.onclick = () => selectSupplier(s);
        resultBox.appendChild(li);
      });
    }
    resultBox.classList.add('open');
  }

  function selectSupplier(s) {
    hiddenId.value       = s.id;
    input.value          = `${s.kode_vendor} — ${s.nama_vendor}`;
    resultBox.classList.remove('open');
    if (clearBtn)   { clearBtn.style.display = 'flex'; }
    if (searchIcon) { searchIcon.style.display = 'none'; }
  }

  function clearSupplier() {
    hiddenId.value = '';
    input.value    = '';
    resultBox.classList.remove('open');
    if (clearBtn)   { clearBtn.style.display = 'none'; }
    if (searchIcon) { searchIcon.style.display = ''; }
  }

  input.addEventListener('input', e => {
    const kw = e.target.value.trim();
    if (kw === '') { clearSupplier(); } else { showResults(kw); }
  });

  input.addEventListener('focus', e => {
    const kw = e.target.value.trim();
    if (kw.length >= 2 && !hiddenId.value) showResults(kw);
  });

  if (clearBtn) clearBtn.addEventListener('click', clearSupplier);

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !resultBox.contains(e.target) && e.target !== clearBtn) {
      resultBox.classList.remove('open');
      // Restore display if partially typed but not selected
      if (!hiddenId.value && input.value.trim()) clearSupplier();
    }
  });
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
      setMaterialSearchIcon('search');
      return;
    }

    debounceTimer = setTimeout(async () => {
      setMaterialSearchIcon('spinner'); // show spinner while fetching
      try {
        const materials = await searchSapMaterials(query);
        renderAutocomplete(materials);
      } catch (error) {
        console.error('Error autocomplete materials:', error);
        wrapper.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:#ef4444;text-align:center">Gagal mencari material.</div>';
        wrapper.classList.remove('hidden');
      } finally {
        setMaterialSearchIcon('search'); // restore icon after done
      }
    }, 300);
  });

  /** Toggle material search icon between 'search' and animated spinner */
  function setMaterialSearchIcon(state) {
    const icon = document.getElementById('material-search-icon');
    if (!icon) return;
    if (state === 'spinner') {
      icon.textContent = 'autorenew';
      icon.classList.add('icon-spinning');
      icon.style.color = '#5b6af8';
    } else {
      icon.textContent = 'search';
      icon.classList.remove('icon-spinning');
      icon.style.color = '#94a3b8';
    }
  }

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

    // Set button loading — disable + spinner + grey state
    const btn = document.getElementById('btn-submit');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.style.background = '#64748b';
    btn.style.boxShadow = 'none';
    btn.style.transform = 'none';
    btn.innerHTML = `
      <span class="material-symbols-outlined icon-spinning" style="font-size:16px">autorenew</span>
      Menyimpan...
    `;
    window._submitOriginalHTML = originalHTML;

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
      btn.style.background = '#212d95';
      btn.style.boxShadow = '0 4px 12px rgba(91,106,248,.3)';
      btn.innerHTML = window._submitOriginalHTML || '<span class="material-symbols-outlined" style="font-size:16px">save</span> Simpan Transaksi Harian';
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

      // Clear supplier search
      const suppInput  = document.getElementById('supplier-search-input');
      const suppHidden = document.getElementById('supplier_id');
      const suppClear  = document.getElementById('btn-clear-supplier');
      const suppIcon   = document.getElementById('supplier-search-icon');
      if (suppInput)  { suppInput.value  = ''; suppInput.disabled = false; }
      if (suppHidden) suppHidden.value = '';
      if (suppClear)  suppClear.style.display = 'none';
      if (suppIcon)   suppIcon.style.display  = '';

      // Clear material
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
