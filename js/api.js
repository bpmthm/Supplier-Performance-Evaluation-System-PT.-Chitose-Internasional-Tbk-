/**
 * API Configuration & Functions
 * Frontend API integration dengan backend CodeIgniter
 */

// Config
const API_BASE_URL = 'http://localhost:8082/api';

// ============= SUPPLIER API CALLS =============

/**
 * Get semua supplier
 */
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

/**
 * Get detail 1 supplier by ID
 */
async function getSupplierById(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/supplier/${id}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching supplier ${id}:`, error);
    return null;
  }
}

// ============= PENILAIAN API CALLS =============

/**
 * Get semua penilaian (dengan optional filter)
 */
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

/**
 * Get detail 1 penilaian by ID
 */
async function getPenilaianById(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/penilaian/${id}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching penilaian ${id}:`, error);
    return null;
  }
}

/**
 * Create/Save penilaian baru (atau UPSERT jika sudah ada)
 */
async function savePenilaian(data) {
  try {
    const response = await fetch(`${API_BASE_URL}/penilaian`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    console.log('Penilaian saved:', result);
    return result;
  } catch (error) {
    console.error('Error saving penilaian:', error);
    return null;
  }
}

/**
 * Update penilaian by ID
 */
async function updatePenilaian(id, data) {
  try {
    const response = await fetch(`${API_BASE_URL}/penilaian/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Error updating penilaian ${id}:`, error);
    return null;
  }
}

/**
 * Delete penilaian by ID
 */
async function deletePenilaian(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/penilaian/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Error deleting penilaian ${id}:`, error);
    return null;
  }
}

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
