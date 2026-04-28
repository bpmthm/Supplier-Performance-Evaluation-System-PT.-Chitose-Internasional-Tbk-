/**
 * Input Page Integration - FULL UNLOCKED MODE
 * Smart Wizard untuk input penilaian supplier (Semua Divisi)
 */

let currentSupplier = null;
let currentPeriode = ''; // Dikosongin dulu, nanti diisi otomatis
let formData = {};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    setupPeriodeDropdown(); 
    
    const suppliers = await getSuppliers();
    populateSupplierDropdown(suppliers);
    setupFormInputs();
    setupButtons();

  } catch (error) {
    console.error('Error initializing input page:', error);
  }
});

// --- FUNGSI BARU: AUTO GENERATE PERIODE ---
function setupPeriodeDropdown() {
  const periodeSelect = document.querySelector('[data-input="periode-select"]');
  if (!periodeSelect) return;

  const today = new Date();
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  periodeSelect.innerHTML = ''; // Bersihin isi dropdown

  // Bikin opsi buat 6 bulan ke belakang secara otomatis
  for (let i = 0; i <= 5; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    periodeSelect.appendChild(option);
  }

  // Default pilih bulan KEMARIN (Index 1) karena orang biasanya ngisi data bulan lalu
  periodeSelect.selectedIndex = 1;
  currentPeriode = periodeSelect.value;

  // Kalo bulannya diganti manual, tarik ulang data dari Backend
  periodeSelect.addEventListener('change', (e) => {
    currentPeriode = e.target.value;
    if (currentSupplier) loadSupplierPenilaian(currentSupplier);
  });
}

function populateSupplierDropdown(suppliers) {
  const select = document.querySelector('[data-input="supplier-select"]');
  const periodeInput = document.querySelector('[data-input="periode-select"]');
  
  if (!select) return;

  if (periodeInput) {
    periodeInput.value = currentPeriode;
    periodeInput.addEventListener('change', (e) => {
      currentPeriode = e.target.value;
      if (currentSupplier) loadSupplierPenilaian(currentSupplier);
    });
  }

  select.innerHTML = '<option value="">Pilih Supplier...</option>';
  suppliers.forEach(supplier => {
    const option = document.createElement('option');
    option.value = supplier.id;
    option.textContent = `${supplier.kode_vendor} - ${supplier.nama_vendor}`;
    select.appendChild(option);
  });

  select.addEventListener('change', (e) => {
    currentSupplier = parseInt(e.target.value);
    if (currentSupplier) {
      loadSupplierPenilaian(currentSupplier);
    } else {
      resetForm();
    }
  });
}

async function loadSupplierPenilaian(supplierId) {
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
      formData = {
        supplier_id: supplierId,
        periode: currentPeriode
      };
    }
  } catch (error) {
    console.error('Error loading supplier penilaian:', error);
  }
}

function setupFormInputs() {
  // 1. QC Inputs (Qty Kirim & Reject logic)
  const qcKirim = document.querySelector('[data-input="qc-qty-kirim"]');
  const qcReject = document.querySelector('[data-input="qc-qty-reject"]');
  
  const calculateNG = () => {
    const kirim = parseFloat(qcKirim.value) || 0;
    const reject = parseFloat(qcReject.value) || 0;
    
    if (kirim > 0) {
      const ng = (reject / kirim) * 100;
      formData.qc_ng_percent = parseFloat(ng.toFixed(2));
      document.querySelector('[data-display="qc-ng-text"]').textContent = `${formData.qc_ng_percent}%`;
    } else {
      formData.qc_ng_percent = null;
      document.querySelector('[data-display="qc-ng-text"]').textContent = `0.00%`;
    }
    updateFormFeedback();
  };

  if (qcKirim) qcKirim.addEventListener('input', calculateNG);
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
      e.stopPropagation(); // Biar gak ngetrigger klik dropzone
      fileInput.value = '';
      formData.ppic_file = null; // Hapus dari memori
      dropZone.classList.remove('hidden');
      filePreview.classList.add('hidden');
      updateBadge('ppic', null, 0, 30);
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
      
      // Kasih sinyal ke badge kalo file udah siap
      const badge = document.querySelector('[data-display="ppic-badge"]');
      if (badge) {
        badge.textContent = "FILE SIAP";
        badge.className = "px-3 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wide";
      }
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
  // Default nilai TOP = 5 jika ada form Purchasing yang diisi
  if (formData.pch_harga || formData.pch_moq || formData.pch_pelayanan) pchScore += 5;
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

  // --- UPDATE BADGES (UI) - MAX SCORE DISESUAIKAN ---
  updateBadge('qc', ng, qcScore, 30);
  updateBadge('ppic', ot, ppicScore, 30);
  updateBadge('pch', (formData.pch_harga || formData.pch_moq || formData.pch_pelayanan) ? 'isi' : null, pchScore, 30);
  updateBadge('hse', (formData.hse_uji_emisi || formData.hse_apd) ? 'isi' : null, hseScore, 10);
}

function updateBadge(divisi, checkVar, score, maxScore) {
  const badge = document.querySelector(`[data-display="${divisi}-badge"]`);
  if (!badge) return;

  if (checkVar === null || checkVar === undefined) {
    badge.textContent = "Menunggu Input...";
    badge.className = "px-3 py-1 rounded-full text-[11px] font-bold bg-surface-variant text-on-surface-variant uppercase tracking-wide";
  } else {
    badge.textContent = `${score} / ${maxScore} Poin`;
    const percentage = score / maxScore;
    if (percentage >= 0.8) badge.className = "px-3 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-800 uppercase tracking-wide";
    else if (percentage >= 0.6) badge.className = "px-3 py-1 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-800 uppercase tracking-wide";
    else badge.className = "px-3 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 uppercase tracking-wide";
  }
}

async function saveDraft() {
  if (!currentSupplier) return alert('Pilih supplier dulu, Pi!');
  formData.status_final = 'DRAFT';
  try {
    const result = await savePenilaian(formData);
    if (result) alert('Semua data berhasil disimpen ke Draft!');
  } catch (error) { alert('Gagal simpen: ' + error.message); }
}

async function submitPenilaian() {
  if (!currentSupplier) return alert('Pilih supplier dulu, Pi!');
  
  try {
    let uploadSuccessMsg = '';

    // 1. Cek apakah ada file PPIC yang di-drag & drop
    if (formData.ppic_file) {
      const resultPpic = await uploadPpicFile(formData.ppic_file, currentSupplier, currentPeriode);
      if (resultPpic) {
        uploadSuccessMsg = `\n✅ File PPIC diproses! (${resultPpic.message})`;
      }
    }

    // 2. Siapin data buat divisi lain (QC, PCH, HSE)
    const dataToSave = { ...formData };
    delete dataToSave.ppic_file; // Hapus file dari JSON biar backend gak bingung
    dataToSave.status_final = 'SUBMITTED';

    // Kalau tadi udah upload PPIC, kita hapus variabel PPIC dari JSON 
    // biar pas nge-save divisi lain, skor PPIC dari Excel gak ketimpa jadi 0.
    if (formData.ppic_file) {
        delete dataToSave.ppic_ot_percent;
        delete dataToSave.ppic_score;
    }

    // 3. Simpan data divisi lainnya
    const result = await savePenilaian(dataToSave);
    
    if (result) {
      alert(`Mantap! Data berhasil dikirim ke Database!${uploadSuccessMsg}`);
      
      // Reset form dan reload data terbaru dari Backend (biar skor PPIC dari excel muncul)
      const fileRemoveBtn = document.getElementById('ppic-file-remove');
      if(fileRemoveBtn) fileRemoveBtn.click(); // Reset UI upload
      
      loadSupplierPenilaian(currentSupplier);
    }
  } catch (error) { 
    alert('Gagal submit: ' + error.message); 
  }
}

function populateFormData(penilaian) {
  document.querySelector('[data-input="qc-qty-kirim"]').value = '';
  document.querySelector('[data-input="qc-qty-reject"]').value = '';
  formData.qc_ng_percent = penilaian.qc_ng_percent !== null ? parseFloat(penilaian.qc_ng_percent) : null;
  
  if (formData.qc_ng_percent !== null) {
    document.querySelector('[data-display="qc-ng-text"]').textContent = `${formData.qc_ng_percent}% (Data Tersimpan)`;
  }

  const ppicInput = document.querySelector('[data-input="ppic-ot"]');
  if (ppicInput) ppicInput.value = penilaian.ppic_ot_percent !== null ? penilaian.ppic_ot_percent : '';
  formData.ppic_ot_percent = penilaian.ppic_ot_percent !== null ? parseFloat(penilaian.ppic_ot_percent) : null;

  // Radio Buttons
  const radioGroups = ['pch_harga', 'pch_moq', 'pch_pelayanan', 'hse_uji_emisi', 'hse_apd'];
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
  document.querySelector('[data-display="qc-ng-text"]').textContent = `0.00%`;
  
  formData = { supplier_id: currentSupplier, periode: currentPeriode };
  updateFormFeedback();
}