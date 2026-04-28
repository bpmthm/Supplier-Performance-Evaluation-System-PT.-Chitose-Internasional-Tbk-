/**
 * API Configuration & Functions
 * Frontend API integration dengan backend CodeIgniter
 */

const API_BASE_URL = 'http://localhost:8082/api';

async function getSuppliers() {
  try {
    const response = await fetch(`${API_BASE_URL}/supplier`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return [];
  }
}

async function getPenilaian(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.supplier_id) params.append('supplier_id', filters.supplier_id);
    if (filters.periode) params.append('periode', filters.periode);

    const url = `${API_BASE_URL}/penilaian${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching penilaian:', error);
    return [];
  }
}

// --- Fungsi Save Data Form (Pake jalur UPSERT) ---
async function savePenilaian(data) {
  try {
    const response = await fetch(`${API_BASE_URL}/penilaian/upsert`, {
      method: 'POST', // Selalu pake POST karena UPSERT yang ngurusin logic-nya di BE
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.messages?.error || err.message || `HTTP Error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving data:', error);
    throw error;
  }
}
// --- Fungsi Khusus Upload File PPIC ---
async function uploadPpicFile(file, supplierId, periode) {
  try {
    const formData = new FormData();
    formData.append('ppic_file', file);
    formData.append('supplier_id', supplierId);
    formData.append('periode', periode);

    // Kalo pake FormData, JANGAN set 'Content-Type' manual di headers.
    // Browser bakal otomatis ngeset jadi 'multipart/form-data' plus masukin boundary-nya.
    const response = await fetch(`${API_BASE_URL}/penilaian/upload-ppic`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.messages?.error || `HTTP Error ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error uploading PPIC:', error);
    throw error;
  }
}

// (Fungsi dashboard dan helper lainnya tetep biarin aja kayak punya lo)

// ============= DASHBOARD API CALLS =============

/**
 * Get dashboard summary (KPI stats)
 */
async function getDashboardSummary() {
  try {
    const response = await fetch(`${API_BASE_URL}/penilaian/summary/dashboard`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    return null;
  }
}

/**
 * Get heatmap data untuk master rekap
 */
async function getHeatmapData(periode = null) {
  try {
    const url = periode 
      ? `${API_BASE_URL}/penilaian/heatmap/data?periode=${periode}`
      : `${API_BASE_URL}/penilaian/heatmap/data`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    return [];
  }
}

/**
 * Get top performers untuk dashboard chart
 */
async function getTopPerformers(limit = 5) {
  try {
    const response = await fetch(`${API_BASE_URL}/penilaian/top-performers?limit=${limit}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching top performers:', error);
    return [];
  }
}

// ============= HELPER FUNCTIONS =============

/**
 * Format periode (YYYY-MM) ke display format
 */
function formatPeriode(periode) {
  const [year, month] = periode.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
}

/**
 * Get grade color
 */
function getGradeColor(grade) {
  if (grade === 'A') return '#4caf50'; // Green
  if (grade === 'B') return '#ff9800'; // Orange
  if (grade === 'C') return '#f44336'; // Red
  return '#999';
}

/**
 * Get grade label
 */
function getGradeLabel(grade) {
  if (grade === 'A') return 'Baik (A)';
  if (grade === 'B') return 'Cukup (B)';
  if (grade === 'C') return 'Kurang (C)';
  return 'N/A';
}
