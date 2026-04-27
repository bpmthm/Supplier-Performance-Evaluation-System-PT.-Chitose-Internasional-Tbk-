/**
 * Input Page Integration
 * Smart Wizard untuk input penilaian supplier
 */

let currentSupplier = null;
let currentPeriode = new Date().toISOString().slice(0, 7); // YYYY-MM
let formData = {};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load suppliers untuk dropdown
    const suppliers = await getSuppliers();
    populateSupplierDropdown(suppliers);

    // Setup form inputs
    setupFormInputs();

    // Setup button listeners
    setupButtons();
  } catch (error) {
    console.error('Error initializing input page:', error);
  }
});

/**
 * Populate supplier dropdown
 */
function populateSupplierDropdown(suppliers) {
  const select = document.querySelector('[data-input="supplier-select"]');
  if (!select) return;

  // Clear existing options
  select.innerHTML = '<option value="">Select Supplier...</option>';

  // Add supplier options
  suppliers.forEach(supplier => {
    const option = document.createElement('option');
    option.value = supplier.id;
    option.textContent = supplier.nama_vendor;
    select.appendChild(option);
  });

  // Handle change
  select.addEventListener('change', (e) => {
    currentSupplier = parseInt(e.target.value);
    loadSupplierPenilaian(currentSupplier);
  });
}

/**
 * Load existing penilaian untuk supplier & periode
 */
async function loadSupplierPenilaian(supplierId) {
  try {
    const penilaianList = await getPenilaian({
      supplier_id: supplierId,
      periode: currentPeriode
    });

    if (penilaianList.length > 0) {
      const penilaian = penilaianList[0];
      populateFormData(penilaian);
      formData = penilaian;
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

/**
 * Setup form input listeners
 */
function setupFormInputs() {
  // QC Input
  const qcInput = document.querySelector('[data-input="qc-ng"]');
  if (qcInput) {
    qcInput.addEventListener('input', (e) => {
      const ngPercent = parseFloat(e.target.value) || 0;
      formData.qc_ng_percent = ngPercent;
      formData.qc_score = calculateQCScore(ngPercent);
      updateFormFeedback();
    });
  }

  // PPIC Input
  const ppicInput = document.querySelector('[data-input="ppic-ot"]');
  if (ppicInput) {
    ppicInput.addEventListener('input', (e) => {
      const otPercent = parseFloat(e.target.value) || 0;
      formData.ppic_ot_percent = otPercent;
      formData.ppic_score = calculatePPICScore(otPercent);
      updateFormFeedback();
    });
  }

  // Purchasing inputs
  ['harga', 'moq', 'top', 'pelayanan'].forEach(field => {
    const select = document.querySelector(`[data-input="pch-${field}"]`);
    if (select) {
      select.addEventListener('change', (e) => {
        formData[`pch_${field}`] = e.target.value;
        updateFormFeedback();
      });
    }
  });

  // HSE inputs
  ['uji-emisi', 'apd'].forEach(field => {
    const select = document.querySelector(`[data-input="hse-${field}"]`);
    if (select) {
      select.addEventListener('change', (e) => {
        formData[`hse_${field.replace('-', '_')}`] = e.target.value;
        updateFormFeedback();
      });
    }
  });
}

/**
 * Setup button listeners
 */
function setupButtons() {
  const saveBtn = document.querySelector('[data-button="save-draft"]');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveDraft);
  }

  const continueBtn = document.querySelector('[data-button="continue"]');
  if (continueBtn) {
    continueBtn.addEventListener('click', savePenilaian);
  }
}

/**
 * Update form feedback (score display, grade, etc)
 */
function updateFormFeedback() {
  // Calculate all scores
  if (formData.qc_ng_percent !== undefined) {
    formData.qc_score = calculateQCScore(formData.qc_ng_percent);
  }
  if (formData.ppic_ot_percent !== undefined) {
    formData.ppic_score = calculatePPICScore(formData.ppic_ot_percent);
  }
  
  formData.pch_score = calculatePCHScore(
    formData.pch_harga,
    formData.pch_moq,
    formData.pch_top,
    formData.pch_pelayanan
  );

  formData.hse_score = calculateHSEScore(
    formData.hse_uji_emisi,
    formData.hse_apd
  );

  // Calculate total
  const total = (formData.qc_score || 0) + (formData.ppic_score || 0) + 
                (formData.pch_score || 0) + (formData.hse_score || 0);
  
  const grade = total >= 100 ? 'A' : (total >= 70 ? 'B' : 'C');
  
  formData.total_score = total;
  formData.grade = grade;

  // Update display
  const scoreDisplay = document.querySelector('[data-display="running-score"]');
  if (scoreDisplay) scoreDisplay.textContent = total;

  const gradeDisplay = document.querySelector('[data-display="running-grade"]');
  if (gradeDisplay) gradeDisplay.textContent = grade;

  // Update QC feedback badge
  const qcBadge = document.querySelector('[data-display="qc-badge"]');
  if (qcBadge) {
    const scoreLabel = getQCScoreLabel(formData.qc_score || 0);
    qcBadge.textContent = `${formData.qc_score || 0} Poin - ${scoreLabel}`;
  }
}

/**
 * Save as draft (PATCH if exists, POST if new)
 */
async function saveDraft() {
  if (!currentSupplier) {
    alert('Please select a supplier');
    return;
  }

  formData.status_final = 'DRAFT';
  
  try {
    const result = await savePenilaian(formData);
    if (result) {
      alert('Penilaian saved as draft');
      formData = result.data || formData;
    }
  } catch (error) {
    alert('Error saving draft: ' + error.message);
  }
}

/**
 * Submit penilaian
 */
async function submitPenilaian() {
  if (!currentSupplier) {
    alert('Please select a supplier');
    return;
  }

  formData.status_final = 'SUBMITTED';
  
  try {
    const result = await savePenilaian(formData);
    if (result) {
      alert('Penilaian submitted successfully');
      resetForm();
    }
  } catch (error) {
    alert('Error submitting penilaian: ' + error.message);
  }
}

/**
 * Populate form dengan existing data
 */
function populateFormData(penilaian) {
  Object.keys(penilaian).forEach(key => {
    const input = document.querySelector(`[data-input="${key}"]`);
    if (input) {
      if (input.tagName === 'SELECT') {
        input.value = penilaian[key];
      } else {
        input.value = penilaian[key];
      }
    }
  });

  updateFormFeedback();
}

/**
 * Reset form
 */
function resetForm() {
  const inputs = document.querySelectorAll('[data-input]');
  inputs.forEach(input => {
    if (input.tagName === 'SELECT') {
      input.value = '';
    } else {
      input.value = '';
    }
  });

  formData = {
    supplier_id: currentSupplier,
    periode: currentPeriode
  };

  updateFormFeedback();
}

// ============= SCORING FUNCTIONS =============

function calculateQCScore(ngPercent) {
  if (ngPercent <= 0.5) return 30;
  if (ngPercent <= 1.0) return 25;
  if (ngPercent <= 2.0) return 20;
  if (ngPercent <= 5.0) return 15;
  return 10;
}

function calculatePPICScore(otPercent) {
  if (otPercent >= 95) return 30;
  if (otPercent >= 90) return 25;
  if (otPercent >= 85) return 20;
  if (otPercent >= 80) return 15;
  return 10;
}

function calculatePCHScore(harga, moq, top, pelayanan) {
  let score = 0;
  score += (harga === 'BAIK' ? 3 : (harga === 'CUKUP' ? 2 : 1)) * 2;
  score += (moq === 'BAIK' ? 3 : (moq === 'CUKUP' ? 2 : 1)) * 2;
  score += (top === 'BAIK' ? 3 : (top === 'CUKUP' ? 2 : 1)) * 2;
  score += (pelayanan === 'BAIK' ? 3 : (pelayanan === 'CUKUP' ? 2 : 1)) * 2;
  return Math.min(score, 40);
}

function calculateHSEScore(ujiEmisi, apd) {
  let score = 0;
  score += (ujiEmisi === 'BAIK' ? 3 : (ujiEmisi === 'CUKUP' ? 2 : 1)) * 5;
  score += (apd === 'BAIK' ? 3 : (apd === 'CUKUP' ? 2 : 1)) * 5;
  return Math.min(score, 30);
}

function getQCScoreLabel(score) {
  if (score >= 25) return 'BAIK';
  if (score >= 20) return 'CUKUP';
  return 'KURANG';
}
