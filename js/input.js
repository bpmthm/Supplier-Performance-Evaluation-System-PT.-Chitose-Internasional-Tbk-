/**
 * Input Page Integration
 * Smart Wizard untuk input penilaian supplier
 */

let currentSupplier = null;
let currentPeriode = new Date().toISOString().slice(0, 7); // YYYY-MM
let formData = {};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Tarik data supplier dari BE
    const suppliers = await getSuppliers();
    
    // 2. Isi ke Dropdown HTML
    populateSupplierDropdown(suppliers);
    setupFormInputs();
    setupButtons();
  } catch (error) {
    console.error('Error initializing input page:', error);
  }
});

function populateSupplierDropdown(suppliers) {
  const select = document.querySelector('[data-input="supplier-select"]');
  const periodeInput = document.querySelector('[data-input="periode-select"]');
  
  if (!select) return;

  // Set default periode
  if (periodeInput) {
    periodeInput.value = currentPeriode;
    periodeInput.addEventListener('change', (e) => {
      currentPeriode = e.target.value;
      if (currentSupplier) loadSupplierPenilaian(currentSupplier);
    });
  }

  // Isi Dropdown
  select.innerHTML = '<option value="">Pilih Supplier...</option>';
  suppliers.forEach(supplier => {
    const option = document.createElement('option');
    option.value = supplier.id;
    option.textContent = `${supplier.kode_vendor} - ${supplier.nama_vendor}`;
    select.appendChild(option);
  });

  // Pas supplier diganti, tarik datanya
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
  const qcInput = document.querySelector('[data-input="qc-ng"]');
  if (qcInput) {
    qcInput.addEventListener('input', (e) => {
      const val = e.target.value;
      formData.qc_ng_percent = val === '' ? null : parseFloat(val);
      updateFormFeedback();
    });
  }
}

function setupButtons() {
  const saveBtn = document.querySelector('[data-button="save-draft"]');
  if (saveBtn) saveBtn.addEventListener('click', saveDraft);

  const continueBtn = document.querySelector('[data-button="continue"]');
  // BUG FIXED: Tadi lo nulis savePenilaian di sini
  if (continueBtn) continueBtn.addEventListener('click', submitPenilaian); 
}

function updateFormFeedback() {
  // Biarkan Model Backend yang ngitung akurat, FE cuma buat preview sementara
  const ng = formData.qc_ng_percent;
  let qcScore = 0;
  
  if (ng !== undefined && ng !== null) {
    if (ng <= 0.5) qcScore = 30;
    else if (ng <= 1.0) qcScore = 25;
    else if (ng <= 2.0) qcScore = 20;
    else qcScore = 10;
  }
  
  formData.qc_score = qcScore;

  const total = qcScore + (formData.ppic_score || 0) + (formData.pch_score || 0) + (formData.hse_score || 0);
  const grade = total >= 100 ? 'A' : (total >= 70 ? 'B' : 'C');

  const scoreDisplay = document.querySelector('[data-display="running-score"]');
  if (scoreDisplay) scoreDisplay.textContent = total;

  const gradeDisplay = document.querySelector('[data-display="running-grade"]');
  if (gradeDisplay) gradeDisplay.textContent = grade;

  const qcBadge = document.querySelector('[data-display="qc-badge"]');
  if (qcBadge) {
    if (ng === null || ng === undefined) {
      qcBadge.innerHTML = `<span class="material-symbols-outlined text-[16px]">info</span> Menunggu Input...`;
      qcBadge.style.backgroundColor = '#e0e3e5';
      qcBadge.style.color = '#454653';
    } else {
      qcBadge.innerHTML = `<span class="material-symbols-outlined text-[16px]">check_circle</span> ${qcScore} Poin`;
      qcBadge.style.backgroundColor = qcScore >= 25 ? '#e6f4ea' : '#fce8e6';
      qcBadge.style.color = qcScore >= 25 ? '#137333' : '#c5221f';
    }
  }
}

async function saveDraft() {
  if (!currentSupplier) return alert('Pilih supplier dulu!');
  formData.status_final = 'DRAFT';
  
  try {
    const result = await savePenilaian(formData);
    if (result) alert('Draft berhasil disimpan!');
  } catch (error) {
    alert('Gagal simpan: ' + error.message);
  }
}

async function submitPenilaian() {
  if (!currentSupplier) return alert('Pilih supplier dulu!');
  formData.status_final = 'SUBMITTED';
  
  try {
    const result = await savePenilaian(formData);
    if (result) {
      alert('Data QC berhasil dikirim ke Database!');
      loadSupplierPenilaian(currentSupplier); // Reload data dari BE
    }
  } catch (error) {
    alert('Gagal submit: ' + error.message);
  }
}

function populateFormData(penilaian) {
  const qcInput = document.querySelector('[data-input="qc-ng"]');
  if (qcInput) {
    qcInput.value = penilaian.qc_ng_percent !== null && penilaian.qc_ng_percent !== undefined ? penilaian.qc_ng_percent : '';
  }
  updateFormFeedback();
}

function resetForm() {
  const qcInput = document.querySelector('[data-input="qc-ng"]');
  if (qcInput) qcInput.value = '';
  
  formData = {
    supplier_id: currentSupplier,
    periode: currentPeriode
  };
  updateFormFeedback();
}