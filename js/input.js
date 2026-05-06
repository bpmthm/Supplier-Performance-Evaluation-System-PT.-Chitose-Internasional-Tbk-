/**
 * Input Page Integration - FULL UNLOCKED MODE
 * Smart Wizard untuk input penilaian supplier (Semua Divisi)
 */

let currentSupplier = null;
let currentPeriode = '';
let formData = {};
let isFetching = false; // Guard biar gak race condition

document.addEventListener('DOMContentLoaded', async () => {
  try {
    applyRoleAccess();
    forwardRoleToNavLinks();
    setupPeriodeDropdown();
    
    const suppliers = await getSuppliers();
    populateSupplierDropdown(suppliers);
    setupFormInputs();
    setupButtons();

  } catch (error) {
    console.error('Error initializing input page:', error);
  }
});

// --- Helper: Toggle loading state di form ---
function setLoadingState(loading) {
  isFetching = loading;
  const saveDraftBtn  = document.querySelector('[data-button="save-draft"]');
  const continueBtn   = document.querySelector('[data-button="continue"]');
  const supplierSelect = document.querySelector('[data-input="supplier-select"]');
  const periodeSelect  = document.querySelector('[data-input="periode-select"]');

  // Tombol & dropdown di-disable saat loading
  [saveDraftBtn, continueBtn, supplierSelect, periodeSelect].forEach(el => {
    if (el) el.disabled = loading;
  });

  // Tampilkan badge loading di semua kartu
  if (loading) {
    ['qc', 'ppic', 'pch', 'hse'].forEach(divisi => {
      const badge = document.querySelector(`[data-display="${divisi}-badge"]`);
      if (badge) {
        badge.textContent = 'Memuat...';
        badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-600 uppercase tracking-wide animate-pulse';
      }
    });
    // Kosongkan QTY SAP & tampilkan placeholder
    const qtyInput = document.querySelector('[data-input="qc-qty-terima"]');
    if (qtyInput) { qtyInput.value = ''; qtyInput.placeholder = 'Memuat dari SAP...'; }
  } else {
    const qtyInput = document.querySelector('[data-input="qc-qty-terima"]');
    if (qtyInput) qtyInput.placeholder = 'Loading SAP...';
  }
}

// --- FUNGSI: AUTO GENERATE PERIODE ---
function setupPeriodeDropdown() {
  const periodeSelect = document.querySelector('[data-input="periode-select"]');
  if (!periodeSelect) return;

  const today = new Date();
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  periodeSelect.innerHTML = '';

  for (let i = 0; i <= 5; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.dataset.label = label; // Simpan label asli buat di-restore nanti
    periodeSelect.appendChild(option);
  }

  // Default = bulan lalu
  periodeSelect.selectedIndex = 1;
  currentPeriode = periodeSelect.value;

  // Satu-satunya event listener untuk periode
  periodeSelect.addEventListener('change', async (e) => {
    if (isFetching) return;
    currentPeriode = e.target.value;
    updatePeriodeStatusBar(); // Update status bar langsung saat ganti
    if (currentSupplier) {
      await loadSupplierPenilaian(currentSupplier);
      await tarikQtyOtomatis();
    }
  });
}

/**
 * Setelah supplier dipilih, ambil semua periodenya dari DB
 * dan tandai mana yang sudah ada data vs masih kosong di dropdown.
 */
async function updatePeriodeIndicators(supplierId) {
  const periodeSelect = document.querySelector('[data-input="periode-select"]');
  if (!periodeSelect) return;

  // Reset semua label ke aslinya dulu
  Array.from(periodeSelect.options).forEach(opt => {
    if (opt.dataset.label) opt.textContent = opt.dataset.label;
  });
  updatePeriodeStatusBar('loading');

  if (!supplierId) {
    updatePeriodeStatusBar('no-supplier');
    return;
  }

  try {
    // Ambil semua penilaian untuk supplier ini (tanpa filter periode)
    const allPenilaian = await getPenilaian({ supplier_id: supplierId });
    const periodeDenganData = new Set(allPenilaian.map(p => p.periode));

    Array.from(periodeSelect.options).forEach(opt => {
      if (!opt.dataset.label) return; // Skip opsi kosong
      if (periodeDenganData.has(opt.value)) {
        opt.textContent = `✓ ${opt.dataset.label}`; // Ada data tersimpan
      } else {
        opt.textContent = `○ ${opt.dataset.label}`; // Belum ada data
      }
    });
  } catch (e) {
    // Gagal fetch → tetap tampilkan label asli tanpa indikator
  }

  updatePeriodeStatusBar();
}

/** Tampilkan status bar kecil di bawah dropdown periode */
function updatePeriodeStatusBar(state = 'auto') {
  let bar = document.getElementById('periode-status-bar');
  if (!bar) return;

  if (state === 'loading') {
    bar.innerHTML = '<span class="text-blue-500">⟳ Memeriksa data...</span>';
    return;
  }
  if (state === 'no-supplier') {
    bar.innerHTML = '<span class="text-gray-400">— Pilih supplier dulu</span>';
    return;
  }

  // Auto: cek dari option yang sedang dipilih
  const periodeSelect = document.querySelector('[data-input="periode-select"]');
  if (!periodeSelect) return;
  const selected = periodeSelect.options[periodeSelect.selectedIndex];
  if (!selected || !selected.dataset.label) {
    bar.innerHTML = '';
    return;
  }

  if (selected.textContent.startsWith('✓')) {
    bar.innerHTML = '<span class="text-green-600 font-semibold">✓ Data tersimpan untuk periode ini</span>';
  } else if (selected.textContent.startsWith('○')) {
    bar.innerHTML = '<span class="text-amber-500 font-semibold">○ Belum ada data — form kosong, isi dari awal</span>';
  } else {
    bar.innerHTML = '<span class="text-gray-400">— Pilih supplier untuk melihat status</span>';
  }
}

function populateSupplierDropdown(suppliers) {
  const select = document.querySelector('[data-input="supplier-select"]');
  if (!select) return;

  // Event listener periode SUDAH ada di setupPeriodeDropdown() — tidak perlu duplikat

  select.innerHTML = '<option value="">Pilih Supplier...</option>';
  suppliers.forEach(supplier => {
    const option = document.createElement('option');
    option.value = supplier.id;
    option.dataset.kode = supplier.kode_vendor;
    option.textContent = `${supplier.kode_vendor} - ${supplier.nama_vendor}`;
    select.appendChild(option);
  });

  select.addEventListener('change', async (e) => {
    if (isFetching) return;
    currentSupplier = parseInt(e.target.value) || null;
    if (currentSupplier) {
      // Pertama: update indikator periode (fetch semua periode supplier ini)
      await updatePeriodeIndicators(currentSupplier);
      // Kedua: load data untuk supplier + periode yang aktif
      await loadSupplierPenilaian(currentSupplier);
      await tarikQtyOtomatis();
    } else {
      resetForm();
      updatePeriodeIndicators(null); // Reset indikator
    }
  });
}

async function loadSupplierPenilaian(supplierId) {
  setLoadingState(true);
  try {
    const penilaianList = await getPenilaian({
      supplier_id: supplierId,
      periode: currentPeriode
    });

    if (penilaianList.length > 0) {
      populateFormData(penilaianList[0]);
      formData = penilaianList[0];
    } else {
      resetForm();
      formData = { supplier_id: supplierId, periode: currentPeriode };
    }
  } catch (error) {
    console.error('Error loading supplier penilaian:', error);
  } finally {
    setLoadingState(false);
    updatePeriodeStatusBar(); // Perbarui status bar setelah data selesai dimuat
  }
}

// Fungsi narik QTY dari SAP (silent fail kalo SAP tidak tersedia)
async function tarikQtyOtomatis() {

  const select = document.querySelector('[data-input="supplier-select"]');
  if (!select || select.selectedIndex <= 0) return;

  const selectedOption = select.options[select.selectedIndex];
  const kodeVendor = selectedOption.dataset.kode;
  const periode = document.querySelector('[data-input="periode-select"]').value;

  if (!kodeVendor || !periode) return;

  const sapData = await getQtyDariSAP(kodeVendor, periode);

  // Kalo SAP tidak tersedia atau data null, diam aja — user isi manual
  if (!sapData || sapData.sap_available === false || sapData.total_qty === null) return;

  if (sapData.status === 200) {
    const qtyInput = document.querySelector('[data-input="qc-qty-terima"]');
    if (qtyInput) {
      qtyInput.value = sapData.total_qty;
      const event = new Event('input');
      qtyInput.dispatchEvent(event);
      // Efek visual biar user tau angkanya keisi otomatis
      qtyInput.classList.add('bg-green-100', 'transition-colors', 'duration-500');
      setTimeout(() => qtyInput.classList.remove('bg-green-100'), 1500);
    }
  }
}

function setupFormInputs() {
  // 1. QC Inputs (Qty Kirim & Reject logic)
  const qcTerima = document.querySelector('[data-input="qc-qty-terima"]');
  const qcReject = document.querySelector('[data-input="qc-qty-reject"]');
  
  const calculateNG = () => {
    const terima = parseFloat(qcTerima?.value) || 0;
    const reject = parseFloat(qcReject?.value) || 0;
    const total = terima + reject;
    
    formData.qc_qty_terima = terima;
    formData.qc_qty_reject = reject;

    if (total > 0) {
      const ng = (reject / total) * 100;
      formData.qc_ng_percent = parseFloat(ng.toFixed(2));
      document.querySelector('[data-display="qc-ng-percent"]').value = `${formData.qc_ng_percent}%`;
    } else {
      formData.qc_ng_percent = null;
      document.querySelector('[data-display="qc-ng-percent"]').value = `0.00%`;
    }
    updateFormFeedback();
  };

  if (qcTerima) qcTerima.addEventListener('input', calculateNG);
  if (qcReject) qcReject.addEventListener('input', calculateNG);

  // 2. PPIC Input (File Upload Setup)
  const dropZone = document.getElementById('ppic-drop-zone');
  const fileInput = document.getElementById('ppic-file-input');
  const filePreview = document.getElementById('ppic-file-preview');
  const fileNameDisplay = document.getElementById('ppic-file-name');
  const fileSizeDisplay = document.getElementById('ppic-file-size');
  const fileRemoveBtn = document.getElementById('ppic-file-remove');

  if (dropZone && fileInput) {
    // Kalo drop zone diklik, buka folder komputer
    dropZone.addEventListener('click', () => fileInput.click());

    // Efek visual pas file di-drag ke atas area
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-primary', 'bg-primary-fixed/20');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-primary', 'bg-primary-fixed/20');
    });

    // Tangkep file pas di-drop
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-primary', 'bg-primary-fixed/20');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        handleFileSelection(fileInput.files[0]);
      }
    });

    // Tangkep file pas diklik biasa
    fileInput.addEventListener('change', function() {
      if (this.files.length) handleFileSelection(this.files[0]);
    });

    // Tombol X buat batalin file
    fileRemoveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.value = '';
      formData.ppic_file = null;
      dropZone.classList.remove('hidden');
      filePreview.classList.add('hidden');
      updateBadgePpic(formData.ppic_ot_percent ?? null, formData.ppic_score ?? 0); // Kembali ke status DB
    });

    // Fungsi ngurusin UI pas file masuk
    function handleFileSelection(file) {
      // Validasi ekstensi
      if (!file.name.match(/\.(xlsx|csv)$/i)) {
        alert('Cuma nerima file Excel (.xlsx atau .csv) ya Pi!');
        return;
      }
      
      formData.ppic_file = file; // Simpen file buat dikirim ke BE nanti
      
      // Update UI Preview
      fileNameDisplay.textContent = file.name;
      fileSizeDisplay.textContent = (file.size / 1024).toFixed(1) + ' KB';
      
      dropZone.classList.add('hidden');
      filePreview.classList.remove('hidden');

      // Trigger updateBadgePpic — dia akan deteksi formData.ppic_file dan tampilkan 'File Siap'
      updateBadgePpic(formData.ppic_ot_percent ?? null, formData.ppic_score ?? 0);
    }
  }

  // 3. Radio Buttons (PCH & HSE)
  const radioGroups = ['pch_harga', 'pch_moq', 'pch_pelayanan', 'hse_uji_emisi', 'hse_apd'];
  radioGroups.forEach(name => {
    document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
      radio.addEventListener('change', (e) => {
        formData[name] = e.target.value;
        updateFormFeedback();
      });
    });
  });
}

function setupButtons() {
  const saveBtn = document.querySelector('[data-button="save-draft"]');
  if (saveBtn) saveBtn.addEventListener('click', saveDraft);

  const continueBtn = document.querySelector('[data-button="continue"]');
  if (continueBtn) continueBtn.addEventListener('click', submitPenilaian); 
}

function updateFormFeedback() {
  // --- Calculate QC (Maks 30) ---
  const ng = formData.qc_ng_percent;
  let qcScore = 0;
  if (ng !== undefined && ng !== null) {
    if (ng < 0.5) qcScore = 30; 
    else if (ng < 1.0) qcScore = 15; 
    else qcScore = 10;
  }
  formData.qc_score = qcScore;

  // --- Calculate PPIC (Maks 30) ---
  const ot = formData.ppic_ot_percent;
  let ppicScore = 0;
  if (ot !== undefined && ot !== null) {
    if (ot >= 90) ppicScore = 30; 
    else if (ot >= 71) ppicScore = 15; 
    else ppicScore = 10;
  }
  formData.ppic_score = ppicScore;

  // --- Calculate PCH (Maks 30) ---
  let pchScore = 0;
  if (formData.pch_harga === 'BAIK') pchScore += 10; else if (formData.pch_harga === 'CUKUP') pchScore += 5; else if (formData.pch_harga === 'KURANG') pchScore += 3;
  if (formData.pch_moq === 'BAIK') pchScore += 10; else if (formData.pch_moq === 'CUKUP') pchScore += 5; else if (formData.pch_moq === 'KURANG') pchScore += 3;
  if (formData.pch_pelayanan === 'BAIK') pchScore += 5; else if (formData.pch_pelayanan === 'CUKUP') pchScore += 3; else if (formData.pch_pelayanan === 'KURANG') pchScore += 1;
  formData.pch_score = pchScore;

  // --- Calculate HSE (Maks 10) ---
  let hseScore = 0;
  if (formData.hse_uji_emisi === 'BAIK') hseScore += 5; else if (formData.hse_uji_emisi === 'CUKUP') hseScore += 3; else if (formData.hse_uji_emisi === 'KURANG') hseScore += 1;
  if (formData.hse_apd === 'BAIK') hseScore += 5; else if (formData.hse_apd === 'CUKUP') hseScore += 3; else if (formData.hse_apd === 'KURANG') hseScore += 1;
  formData.hse_score = hseScore;

  // --- UPDATE TOTAL & GRADE ---
  const total = qcScore + ppicScore + pchScore + hseScore;
  const grade = total >= 90 ? 'A' : (total >= 70 ? 'B' : 'C');
  
  // Custom Grade Label biar orang ga kaget kalo divisi lain belom isi
  let gradeText = grade;
  let isiDivisi = 0;
  if (ng !== null && ng !== undefined) isiDivisi++;
  if (ot !== null && ot !== undefined) isiDivisi++;
  if (pchScore > 0) isiDivisi++;
  if (hseScore > 0) isiDivisi++;

  if (isiDivisi > 0 && isiDivisi < 4) gradeText = `${grade} (Belum Lengkap)`;

  const scoreDisplay = document.querySelector('[data-display="running-score"]');
  if (scoreDisplay) scoreDisplay.textContent = total;
  const gradeDisplay = document.querySelector('[data-display="running-grade"]');
  if (gradeDisplay) gradeDisplay.textContent = gradeText;

  // --- UPDATE BADGES (UI) ---
  updateBadge('qc', ng, qcScore, 30);
  updateBadgePpic(ot, ppicScore); // PPIC punya logic badge sendiri
  updateBadge('pch', (formData.pch_harga || formData.pch_moq || formData.pch_pelayanan || formData.pch_top) ? 'isi' : null, pchScore, 25);
  updateBadge('hse', (formData.hse_uji_emisi || formData.hse_apd) ? 'isi' : null, formData.hse_score, 10);
}

function updateBadge(divisi, checkVar, score, maxScore) {
  const badge = document.querySelector(`[data-display="${divisi}-badge"]`);
  if (!badge) return;

  if (checkVar === null || checkVar === undefined) {
    badge.textContent = 'Menunggu Input...';
    badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-surface-variant text-on-surface-variant uppercase tracking-wide';
  } else {
    if (divisi === 'qc') {
      badge.textContent = `NG: ${parseFloat(checkVar).toFixed(2)}%`;
    } else {
      badge.textContent = `${score} / ${maxScore} POIN`;
    }
    const pct = score / maxScore;
    if (pct >= 0.8) badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-800 uppercase tracking-wide';
    else if (pct >= 0.6) badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-800 uppercase tracking-wide';
    else badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 uppercase tracking-wide';
  }
}

/** Badge khusus PPIC: tampilkan nilai OT% dari DB, atau status file jika belum submit */
function updateBadgePpic(ot, ppicScore) {
  const badge = document.querySelector('[data-display="ppic-badge"]');
  if (!badge) return;

  if (formData.ppic_file) {
    // File sudah dipilih tapi belum disubmit
    badge.textContent = 'File Siap — Submit untuk Proses';
    badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wide';
    return;
  }

  if (ot === null || ot === undefined) {
    badge.textContent = 'Menunggu File...';
    badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-surface-variant text-on-surface-variant uppercase tracking-wide';
    return;
  }

  // Data tersimpan dari DB — tampilkan OT% saja
  badge.textContent = `OT: ${parseFloat(ot).toFixed(2)}%`;
  const pct = parseFloat(ot) / 100;
  if (pct >= 0.8) badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-800 uppercase tracking-wide';
  else if (pct >= 0.6) badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-800 uppercase tracking-wide';
  else badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 uppercase tracking-wide';
}

function applyRoleAccess() {
  const urlParams = new URLSearchParams(window.location.search);
  const activeRole = urlParams.get('role');

  if (!activeRole || activeRole === 'GUEST') return;

  const sections = document.querySelectorAll('h3');
  sections.forEach(h3 => {
    const title = h3.textContent.trim();
    const card = h3.closest('.bg-surface-container-lowest');
    if (!card) return;

    if (title.includes('QC') && activeRole !== 'QC') {
      card.style.opacity = '0.5';
      card.style.pointerEvents = 'none';
    }
    if (title.includes('PPIC') && activeRole !== 'PPIC') {
      card.style.opacity = '0.5';
      card.style.pointerEvents = 'none';
    }
    if (title.includes('Purchasing') && activeRole !== 'PCH') {
      card.style.opacity = '0.5';
      card.style.pointerEvents = 'none';
    }
    if (title.includes('Health') && activeRole !== 'HSE') {
      card.style.opacity = '0.5';
      card.style.pointerEvents = 'none';
    }
  });
}

function filterPayloadByRole(data) {
  const urlParams = new URLSearchParams(window.location.search);
  const activeRole = urlParams.get('role');

  if (!activeRole || activeRole === 'GUEST') return data;

  const filtered = { 
    supplier_id: data.supplier_id, 
    periode: data.periode, 
    status_final: data.status_final 
  };

  if (activeRole === 'QC') {
    if (data.qc_qty_terima !== undefined) filtered.qc_qty_terima = data.qc_qty_terima;
    if (data.qc_qty_reject !== undefined) filtered.qc_qty_reject = data.qc_qty_reject;
    if (data.qc_ng_percent !== undefined) filtered.qc_ng_percent = data.qc_ng_percent;
    if (data.qc_score !== undefined) filtered.qc_score = data.qc_score;
  } else if (activeRole === 'PPIC') {
    if (data.ppic_ot_percent !== undefined) filtered.ppic_ot_percent = data.ppic_ot_percent;
    if (data.ppic_score !== undefined) filtered.ppic_score = data.ppic_score;
  } else if (activeRole === 'PCH') {
    ['pch_harga', 'pch_moq', 'pch_pelayanan', 'pch_top', 'pch_score'].forEach(key => {
      if (data[key] !== undefined) filtered[key] = data[key];
    });
  } else if (activeRole === 'HSE') {
    ['hse_uji_emisi', 'hse_apd', 'hse_score'].forEach(key => {
      if (data[key] !== undefined) filtered[key] = data[key];
    });
  }

  return filtered;
}

async function saveDraft() {
  if (!currentSupplier) {
    showToast('Pilih supplier dulu sebelum menyimpan draft.', 'warning');
    return;
  }
  
  const dataToSave = filterPayloadByRole({ ...formData, status_final: 'DRAFT' });
  try {
    const result = await savePenilaian(dataToSave);
    if (result) showToast('Draft berhasil disimpan!', 'success');
  } catch (error) { showToast('Gagal menyimpan draft: ' + error.message, 'error'); }
}

async function submitPenilaian() {
  if (!currentSupplier) {
    showToast('Pilih supplier dulu sebelum submit.', 'warning');
    return;
  }

  let ppicResult = null;

  try {
    // 1. Upload file PPIC dulu jika ada
    if (formData.ppic_file) {
      ppicResult = await uploadPpicFile(formData.ppic_file, currentSupplier, currentPeriode);
    }

    // 2. Siapin payload — hapus file object, set status SUBMITTED
    let dataToSave = { ...formData };
    delete dataToSave.ppic_file;
    dataToSave.status_final = 'SUBMITTED';

    // Jika PPIC diupload via file, jangan timpa skor PPIC dari Excel dengan nilai form kosong
    if (formData.ppic_file) {
      delete dataToSave.ppic_ot_percent;
      delete dataToSave.ppic_score;
    }

    dataToSave = filterPayloadByRole(dataToSave);

    // 3. Simpan semua divisi ke DB
    const result = await savePenilaian(dataToSave);

    if (result) {
      // Reset UI upload
      const fileRemoveBtn = document.getElementById('ppic-file-remove');
      if (fileRemoveBtn) fileRemoveBtn.click();

      // Refresh indikator periode dan reload form dari DB
      await updatePeriodeIndicators(currentSupplier);
      await loadSupplierPenilaian(currentSupplier);

      // Tampilkan modal hasil submit
      showSubmitModal(ppicResult);
    }
  } catch (error) {
    showToast('Gagal submit: ' + error.message, 'error');
  }
}

function populateFormData(penilaian) {
  // QTY terima dan reject
  const qcTerimaEl = document.querySelector('[data-input="qc-qty-terima"]');
  const qcRejectEl = document.querySelector('[data-input="qc-qty-reject"]');
  if (qcTerimaEl) qcTerimaEl.value = penilaian.qc_qty_terima !== null ? penilaian.qc_qty_terima : '';
  if (qcRejectEl) qcRejectEl.value = penilaian.qc_qty_reject !== null ? penilaian.qc_qty_reject : '';
  
  formData.qc_qty_terima = penilaian.qc_qty_terima !== null ? parseFloat(penilaian.qc_qty_terima) : null;
  formData.qc_qty_reject = penilaian.qc_qty_reject !== null ? parseFloat(penilaian.qc_qty_reject) : null;
  formData.qc_ng_percent = penilaian.qc_ng_percent !== null ? parseFloat(penilaian.qc_ng_percent) : null;
  
  if (formData.qc_ng_percent !== null) {
    document.querySelector('[data-display="qc-ng-percent"]').value = `${formData.qc_ng_percent}%`;
  } else {
    document.querySelector('[data-display="qc-ng-percent"]').value = '0.00%';
  }

  // PPIC — selector disesuaikan dengan HTML (data-input="ppic-ot-percent")
  const ppicInput = document.querySelector('[data-input="ppic-ot-percent"]');
  if (ppicInput) ppicInput.value = penilaian.ppic_ot_percent !== null ? penilaian.ppic_ot_percent : '';
  formData.ppic_ot_percent = penilaian.ppic_ot_percent !== null ? parseFloat(penilaian.ppic_ot_percent) : null;

  // Radio Buttons (termasuk pch_top yang sebelumnya tidak di-restore)
  const radioGroups = ['pch_harga', 'pch_moq', 'pch_top', 'pch_pelayanan', 'hse_uji_emisi', 'hse_apd'];
  radioGroups.forEach(name => {
    formData[name] = penilaian[name] || null;
    const radios = document.querySelectorAll(`input[name="${name}"]`);
    radios.forEach(r => { r.checked = (r.value === penilaian[name]); });
  });

  updateFormFeedback();
}

function resetForm() {
  document.querySelectorAll('input[type="number"]').forEach(input => input.value = '');
  document.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
  const qcNgDisplay = document.querySelector('[data-display="qc-ng-percent"]');
  if (qcNgDisplay) qcNgDisplay.value = `0.00%`;
  
  formData = { supplier_id: currentSupplier, periode: currentPeriode };
  updateFormFeedback();
}

// ============================================================
// MODAL & TOAST FUNCTIONS
// ============================================================

/**
 * Tampilkan modal ringkasan setelah submit berhasil.
 * @param {object|null} ppicResult - Response dari uploadPpicFile (null jika tidak ada file)
 */
function showSubmitModal(ppicResult = null) {
  const modal = document.getElementById('submit-modal');
  if (!modal) return;

  // --- Nama supplier dari dropdown ---
  const supplierSelect = document.querySelector('[data-input="supplier-select"]');
  const selectedOption = supplierSelect?.options[supplierSelect.selectedIndex];
  const supplierText   = selectedOption?.textContent?.trim() || '—';
  const [kode, ...namaParts] = supplierText.split(' - ');
  const namaDB = namaParts.join(' - ');

  // --- Nama vendor dari Excel (jika ada PPIC result) ---
  const namaExcel = ppicResult?.excel_nama_vendor || null;
  const kodeExcel = ppicResult?.excel_kode_vendor  || null;

  document.getElementById('modal-supplier-name').textContent = namaExcel || namaDB || '—';
  document.getElementById('modal-supplier-kode').textContent = kodeExcel
    ? `Kode: ${kodeExcel} — ditemukan di Excel`
    : `Kode: ${kode?.trim() || '—'}`;
  document.getElementById('modal-periode').textContent = formatPeriode(currentPeriode);

  // --- Skor breakdown ---
  const qcScore   = formData.qc_score   ?? 0;
  const ppicScore = formData.ppic_score  ?? 0;
  const pchScore  = formData.pch_score   ?? 0;
  const hseScore  = formData.hse_score   ?? 0;
  const total     = qcScore + ppicScore + pchScore + hseScore;
  const grade     = total >= 90 ? 'A' : (total >= 70 ? 'B' : 'C');

  // PPIC detail dari Excel result
  let ppicDetail = '';
  if (ppicResult) {
    if (ppicResult.tidak_ada_po) {
      ppicDetail = '<span class="text-amber-600 text-[10px] font-semibold ml-1">(Tidak ada PO)</span>';
    } else {
      ppicDetail = `<span class="text-slate-400 text-[10px] ml-1">OT: ${ppicResult.score_percent?.toFixed(2)}%</span>`;
    }
  }

  const ng = formData.qc_ng_percent;
  let qcDetail = '';
  if (ng !== undefined && ng !== null) {
    qcDetail = `<span class="text-slate-400 text-[10px] ml-1">NG: ${parseFloat(ng).toFixed(2)}%</span>`;
  }

  const rows = [
    { label: 'Quality Control (QC)', icon: 'analytics',       color: 'blue',   score: qcScore,   max: 30, detail: qcDetail },
    { label: 'PPIC / Delivery',       icon: 'inventory_2',     color: 'amber',  score: ppicScore, max: 30, detail: ppicDetail },
    { label: 'Purchasing',            icon: 'payments',        color: 'emerald',score: pchScore,  max: 30, detail: '' },
    { label: 'Health & Safety',       icon: 'health_and_safety',color: 'rose',  score: formData.hse_score ?? 0,  max: 10, detail: '' },
  ];

  const breakdownEl = document.getElementById('modal-breakdown');
  breakdownEl.innerHTML = rows.map(r => {
    // Khusus PPIC dan QC tidak tampilkan nilai poin dan bar, hanya persentase (detail)
    if (r.label === 'PPIC / Delivery' || r.label === 'Quality Control (QC)') {
      return `
      <div class="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
        <span class="material-symbols-outlined text-${r.color}-500 text-[18px]" style="font-variation-settings:'FILL' 1">${r.icon}</span>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs font-semibold text-slate-700">${r.label}${r.detail}</span>
          </div>
        </div>
      </div>`;
    }

    // Untuk divisi lain, tampilkan score dan bar
    const pct = r.max > 0 ? r.score / r.max : 0;
    const barColor = pct >= 0.8 ? '#22c55e' : (pct >= 0.6 ? '#f59e0b' : '#ef4444');
    const barWidth = Math.round(pct * 100);
    return `
      <div class="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
        <span class="material-symbols-outlined text-${r.color}-500 text-[18px]" style="font-variation-settings:'FILL' 1">${r.icon}</span>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs font-semibold text-slate-700">${r.label}${r.detail}</span>
            <span class="text-xs font-bold text-slate-800">${r.score} / ${r.max}</span>
          </div>
          <div class="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all" style="width:${barWidth}%; background:${barColor};"></div>
          </div>
        </div>
      </div>`;
  }).join('');

  document.getElementById('modal-total').textContent = total;
  document.getElementById('modal-grade-badge').textContent = grade;

  // Warna grade di badge
  const gradeColors = { A: '#22c55e', B: '#f59e0b', C: '#ef4444' };
  document.getElementById('modal-grade-badge').style.background = gradeColors[grade] || '#64748b';

  modal.classList.remove('hidden');
}

function closeSubmitModal() {
  const modal = document.getElementById('submit-modal');
  if (modal) modal.classList.add('hidden');
}

// Tutup modal jika klik backdrop
document.addEventListener('click', (e) => {
  const modal = document.getElementById('submit-modal');
  if (modal && e.target === modal) closeSubmitModal();
});

/**
 * Toast notifikasi ringan untuk draft save, warning, error.
 * @param {string} message
 * @param {'success'|'warning'|'error'} type
 */
function showToast(message, type = 'success') {
  const colors = {
    success: 'bg-green-600',
    warning: 'bg-amber-500',
    error:   'bg-red-600',
  };
  const icons = { success: 'check_circle', warning: 'warning', error: 'error' };

  const toast = document.createElement('div');
  toast.className = `fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-semibold ${colors[type]} animate-fadeInUp`;
  toast.innerHTML = `<span class="material-symbols-outlined text-[20px]" style="font-variation-settings:'FILL' 1">${icons[type]}</span>${message}`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

/** Forward ?role= ke semua link navbar */
function forwardRoleToNavLinks() {
  const urlParams  = new URLSearchParams(window.location.search);
  const activeRole = urlParams.get('role') || 'GUEST';
  
  const navDashboard = document.getElementById('nav-dashboard');
  const navInput     = document.getElementById('nav-input');
  const navRekap     = document.getElementById('nav-rekap');

  if (navDashboard) navDashboard.href = `./dashboard.html?role=${activeRole}`;
  if (navInput)     navInput.href     = `./input.html?role=${activeRole}`;
  if (navRekap)     navRekap.href     = `./master-rekap.html?role=${activeRole}`;
}