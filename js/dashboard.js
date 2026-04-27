/**
 * Dashboard Page Integration
 * Load data dari API dan populate halaman
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load suppliers untuk dropdown (jika ada)
    const suppliers = await getSuppliers();
    console.log(`Loaded ${suppliers.length} suppliers`);

    // Load dashboard summary (KPI)
    const summary = await getDashboardSummary();
    if (summary) {
      updateKPICards(summary);
    }

    // Load top performers untuk chart
    const topPerformers = await getTopPerformers(5);
    if (topPerformers.length > 0) {
      updateTopPerformersChart(topPerformers);
    }

    // Load heatmap untuk critical alerts
    const latestPeriode = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const heatmapData = await getHeatmapData(latestPeriode);
    if (heatmapData.length > 0) {
      updateCriticalAlerts(heatmapData);
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
});

/**
 * Update KPI Cards dengan data dari API
 */
function updateKPICards(summary) {
  // Total Suppliers
  const totalElement = document.querySelector('[data-kpi="total"]');
  if (totalElement) {
    totalElement.textContent = summary.total_suppliers || 0;
  }

  // Top Performers (Grade A)
  const topElement = document.querySelector('[data-kpi="top"]');
  if (topElement) {
    topElement.textContent = summary.grade_a || 0;
  }

  // Critical Suppliers (Grade C)
  const criticalElement = document.querySelector('[data-kpi="critical"]');
  if (criticalElement) {
    criticalElement.textContent = summary.grade_c || 0;
  }

  // Pending Input
  const pendingElement = document.querySelector('[data-kpi="pending"]');
  if (pendingElement) {
    pendingElement.textContent = summary.pending_input || 0;
  }
}

/**
 * Update Top Performers Chart
 */
function updateTopPerformersChart(topPerformers) {
  const container = document.querySelector('[data-chart="top-performers"]');
  if (!container) return;

  // Hapus rows lama
  const oldRows = container.querySelectorAll('[data-chart-row]');
  oldRows.forEach(row => row.remove());

  // Add new rows
  topPerformers.forEach((item, index) => {
    const percentage = (item.total_score / 130) * 100; // Max score 130
    const html = `
      <div data-chart-row="${index}">
        <div class="flex justify-between font-body-md text-body-md mb-1">
          <span class="text-on-surface font-semibold">${item.nama_vendor}</span>
          <span class="text-primary font-semibold">+${item.total_score} pts</span>
        </div>
        <div class="w-full bg-surface-container rounded-full h-2">
          <div class="bg-primary h-2 rounded-full" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
  });
}

/**
 * Update Critical Alerts Ticker
 */
function updateCriticalAlerts(heatmapData) {
  const criticalSuppliers = heatmapData.filter(item => item.grade === 'C');
  
  if (criticalSuppliers.length === 0) {
    // Semua OK
    document.querySelector('[data-alert="ticker"]').style.display = 'none';
    return;
  }

  const alertText = `CRITICAL ALERT: ${criticalSuppliers.length} Supplier(s) in Grade C (${criticalSuppliers.map(s => s.nama_vendor).join(', ')}). Immediate review required.`;
  
  const alertElement = document.querySelector('[data-alert="ticker-text"]');
  if (alertElement) {
    alertElement.textContent = alertText;
  }
}
