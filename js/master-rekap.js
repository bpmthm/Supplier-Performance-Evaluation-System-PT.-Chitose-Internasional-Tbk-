/**
 * Master Rekap Page Integration
 * Load heatmap data dari API dan populate tabel
 */

let currentPeriode = new Date().toISOString().slice(0, 7); // Default: current month (YYYY-MM)

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load periode dropdown
    const periodSelect = document.querySelector('[data-select="periode"]');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        currentPeriode = e.target.value;
        loadHeatmapData();
      });
    }

    // Load initial heatmap data
    await loadHeatmapData();
  } catch (error) {
    console.error('Error loading master rekap:', error);
  }
});

/**
 * Load dan display heatmap data
 */
async function loadHeatmapData() {
  try {
    const heatmapData = await getHeatmapData(currentPeriode);
    if (heatmapData.length > 0) {
      updateHeatmapTable(heatmapData);
    }
  } catch (error) {
    console.error('Error loading heatmap:', error);
  }
}

/**
 * Update heatmap table dengan data dari API
 */
function updateHeatmapTable(heatmapData) {
  const tbody = document.querySelector('[data-table="heatmap"] tbody');
  if (!tbody) return;

  // Hapus rows lama
  const oldRows = tbody.querySelectorAll('tr[data-row-id]');
  oldRows.forEach(row => row.remove());

  // Add new rows
  heatmapData.forEach((item, index) => {
    const rowClass = getRowClass(item.grade);
    const gradeColor = getGradeColor(item.grade);
    const qualityColor = getScoreColor(item.qc_score, 30);
    const deliveryColor = getScoreColor(item.ppic_score, 30);
    const costColor = getScoreColor(item.pch_score, 40);

    const html = `
      <tr data-row-id="${item.id}" class="${rowClass}">
        <td class="px-sm py-4 text-center">
          <span class="material-symbols-outlined text-outline-variant">chevron_right</span>
        </td>
        <td class="px-sm py-4 font-semibold">${item.nama_vendor}</td>
        <td class="px-sm py-4">${item.jenis_bahan}</td>
        <td class="px-sm py-4 text-center">
          <div class="inline-flex items-center justify-center w-8 h-8 rounded-full text-on-surface-container font-medium" style="background-color: ${qualityColor}; color: white;">
            ${item.qc_score}
          </div>
        </td>
        <td class="px-sm py-4 text-center">
          <div class="inline-flex items-center justify-center w-8 h-8 rounded-full text-on-surface-container font-medium" style="background-color: ${deliveryColor}; color: white;">
            ${item.ppic_score}
          </div>
        </td>
        <td class="px-sm py-4 text-center">
          <div class="inline-flex items-center justify-center w-8 h-8 rounded-full text-on-surface-container font-medium" style="background-color: ${costColor}; color: white;">
            ${item.pch_score}
          </div>
        </td>
        <td class="px-sm py-4 text-right">
          <div class="flex items-center justify-end space-x-2">
            <span class="font-headline-md text-headline-md text-on-surface">${item.total_score}</span>
            <span class="material-symbols-outlined text-[20px]" style="color: ${gradeColor};">
              ${item.grade === 'A' ? 'trending_up' : item.grade === 'B' ? 'remove' : 'trending_down'}
            </span>
          </div>
        </td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', html);
  });
}

/**
 * Get row CSS class berdasarkan grade
 */
function getRowClass(grade) {
  if (grade === 'A') return 'bg-secondary-container/20 hover:bg-secondary-container/40 transition-colors cursor-pointer group';
  if (grade === 'B') return 'bg-yellow-50/40 hover:bg-yellow-100/60 transition-colors cursor-pointer group';
  if (grade === 'C') return 'bg-error-container/20 hover:bg-error-container/30 transition-colors cursor-pointer border-l-4 border-l-error';
  return '';
}

/**
 * Get score color gradient berdasarkan value & max
 */
function getScoreColor(value, max) {
  const percentage = (value / max) * 100;
  
  if (percentage >= 80) return '#4caf50'; // Green (Baik)
  if (percentage >= 60) return '#ff9800'; // Orange (Cukup)
  return '#f44336'; // Red (Kurang)
}
