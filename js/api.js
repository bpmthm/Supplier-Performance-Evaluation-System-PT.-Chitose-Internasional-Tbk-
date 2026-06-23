// --- KONFIGURASI URL ---
const PORTAL_CI3_URL = 'http://localhost:8080';
const API_BASE_URL   = 'http://localhost:8084/api';

// Helper to remove a query parameter from the URL address bar cleanly
function cleanUrlParameter(paramName) {
  const url = new URL(window.location.href);
  url.searchParams.delete(paramName);
  if (paramName === 'role') {
    url.searchParams.delete('nik');
  }
  window.history.replaceState({}, document.title, url.pathname + url.search);
}

// --- SISTEM GATEKEEPER (PENAHAN AKSES) ---
// Handles ?token= capture, ?role= → JWT exchange, and final redirect check
function checkGatekeeper() {
    const urlParams = new URLSearchParams(window.location.search);

    // 1. Jika ada ?token= langsung dari portal CI3, simpan dan bersihkan URL
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
        localStorage.setItem('jwt_token', tokenFromUrl);
        cleanUrlParameter('token');
    }

    // 2. Jika ada ?role= (legacy flow dari portal), tukar ke JWT dulu
    const roleParam = urlParams.get('role');
    if (roleParam && !tokenFromUrl) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `${API_BASE_URL}/auth/generate-token?role=${roleParam}`, false);
            xhr.send();
            if (xhr.status === 200) {
                const res = JSON.parse(xhr.responseText);
                if (res && res.token) {
                    localStorage.setItem('jwt_token', res.token);
                }
            }
        } catch (e) {
            console.error('Failed to exchange role for JWT token:', e);
        }
        cleanUrlParameter('role');
    }

    // 3. Final check — tendang jika tetap tidak ada token atau token kadaluarsa
    const currentToken = localStorage.getItem('jwt_token');
    let isTokenValid = false;
    if (currentToken) {
        const decoded = parseJwt(currentToken);
        if (decoded && decoded.exp && (decoded.exp * 1000 > Date.now())) {
            isTokenValid = true;
        } else {
            localStorage.removeItem('jwt_token');
        }
    }

    if (!isTokenValid) {
        console.warn("Akses ditolak: Autentikasi tidak valid atau expired. Mengalihkan ke Portal Utama...");
        window.location.href = PORTAL_CI3_URL;
    }
}

// Jalankan gatekeeper secara otomatis saat file dimuat
checkGatekeeper();

// ==========================================
// SECURITY CORE: JWT & AUTHENTICATION LAYER
// ==========================================

// Parse base64url encoded JWT token payload
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Retrieve active role decoded from valid stored JWT
function getActiveRole() {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    const decoded = parseJwt(token);
    if (decoded && decoded.role && (decoded.exp * 1000 > Date.now())) {
      return decoded.role.toUpperCase();
    }
  }
  return 'GUEST';
}

// Transparently intercept window.fetch to inject Authorization Bearer headers
const originalFetch = window.fetch;
window.fetch = async function (resource, options = {}) {
  const token = localStorage.getItem('jwt_token');
  const urlStr = typeof resource === 'string' ? resource : resource.url;
  
  if (token && urlStr && urlStr.includes(API_BASE_URL)) {
    options.headers = options.headers || {};
    if (options.headers instanceof Headers) {
      if (!options.headers.has('Authorization')) {
        options.headers.set('Authorization', `Bearer ${token}`);
      }
    } else if (Array.isArray(options.headers)) {
      const hasAuth = options.headers.some(h => h[0].toLowerCase() === 'authorization');
      if (!hasAuth) {
        options.headers.push(['Authorization', `Bearer ${token}`]);
      }
    } else {
      const keys = Object.keys(options.headers).map(k => k.toLowerCase());
      if (!keys.includes('authorization')) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  }
  return originalFetch(resource, options);
};


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
 * Get ALL suppliers (termasuk yang non-aktif)
 * Dipakai oleh halaman Master Vendor
 */
async function getAllSuppliers() {
  try {
    const response = await fetch(`${API_BASE_URL}/supplier/all`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching all suppliers:', error);
    return [];
  }
}

/**
 * Toggle status aktif/non-aktif vendor
 * @param {number} id - ID vendor di database
 */
async function toggleVendorStatus(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/supplier/toggle-status/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.messages?.error || err.message || `HTTP Error ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error toggling vendor status:', error);
    throw error;
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

// Endpoint khusus buat narik QTY dari SAP
async function getQtyDariSAP(kodeVendor, periode) {
  try {
    // Di input.html, format periode itu "YYYY-MM" (contoh: 2026-03), kita pecah dulu
    const [tahun, bulan] = periode.split('-');

    // Nembak ke endpoint CI4
    const url = `${API_BASE_URL}/supplier/get-qty?kode_vendor=${kodeVendor}&bulan=${bulan}&tahun=${tahun}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();

  } catch (error) {
    console.error('Gagal narik QTY dari SAP:', error);
    return null;
  }
}

/**
 * Ambil detail evaluasi berkala per vendor dalam rentang periode.
 * Endpoint: GET /api/penilaian/evaluasi/detail
 * @param {string} kodeVendor  - Kode vendor (e.g. "1003107")
 * @param {string} periodeAwal - Format YYYY-MM (e.g. "2025-07")
 * @param {string} periodeAkhir - Format YYYY-MM (e.g. "2025-12")
 * @returns {Promise<Object>} { status, nama_vendor, jenis_bahan, data_aktual, rata_rata }
 */
async function getDetailEvaluasi(kodeVendor, periodeAwal, periodeAkhir) {
  const params = new URLSearchParams({
    kode_vendor: kodeVendor,
    periode_awal: periodeAwal,
    periode_akhir: periodeAkhir,
  });
  const url = `${API_BASE_URL}/penilaian/evaluasi/detail?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.messages?.error || err.message || `HTTP ${response.status}`);
  }
  return await response.json();
}

/**
 * Ambil analisis performa vendor (kelebihan, kelemahan, rekomendasi)
 * @param {number} supplierId - ID supplier di database
 * @param {string} periode - Periode (YYYY-MM)
 */
async function getAnalisisPerforma(supplierId, periode) {
  try {
    const response = await fetch(`${API_BASE_URL}/penilaian/analisis/${supplierId}?periode=${periode}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching performance analysis:', error);
    return {
      status: 'error',
      strengths: [],
      weaknesses: [],
      recommendation: 'Gagal mengambil analisis performa dari server.'
    };
  }
}

/**
 * Get all Qc Daily entries
 */
async function getQcDailyList() {
  try {
    const response = await fetch(`${API_BASE_URL}/qc-daily`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching QC daily list:', error);
    return [];
  }
}

/**
 * Save a new daily QC entry
 */
async function saveQcDaily(data) {
  try {
    const formData = new URLSearchParams();
    for (const key in data) {
      formData.append(key, data[key]);
    }

    const response = await fetch(`${API_BASE_URL}/qc-daily`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.messages?.error || err.message || `HTTP Error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving daily QC:', error);
    throw error;
  }
}

/**
 * Search SAP materials
 */
async function searchSapMaterials(query) {
  try {
    const response = await fetch(`${API_BASE_URL}/sap/materials?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error searching SAP materials:', error);
    return [];
  }
}

// --- FUNGSI LOGOUT GLOBAL ---
function logout() {
    const performLogout = () => {
        // Hapus token dari penyimpanan lokal
        localStorage.removeItem('jwt_token');
        
        // Tendang balik ke Portal Utama CI3
        window.location.href = PORTAL_CI3_URL;
    };

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Keluar dari Portal?',
            text: "Sesi Anda akan diakhiri.",
            icon: 'warning',
            showCancelButton: true,
            // 1. Matiin styling bawaan Swal! Ini kuncinya
            buttonsStyling: false, 
            
            // 2. Suntik class Tailwind ke elemen-elemen Swal
            customClass: {
                popup: 'rounded-2xl shadow-xl border border-gray-100 bg-white p-6', // Bikin kotak lebih smooth
                title: 'text-xl font-semibold text-gray-800 mt-2',
                htmlContainer: 'text-sm text-gray-500 mt-1',
                actions: 'flex gap-3 mt-6 w-full justify-center', // Jarak antar tombol
                
                // Desain tombol Batal (Minimalis abu-abu)
                cancelButton: 'px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200',
                
                // Desain tombol Keluar (Merah solid tapi elegan)
                confirmButton: 'px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200'
            },
            
            // 3. Animasi muncul yang lebih asik (opsional, manfaatin class bawaan Animate.css atau Tailwind lo)
            showClass: {
                popup: 'animate__animated animate__fadeInUp animate__faster' // Kalau lo pake Animate.css
                // atau pake class Tailwind lo: 'animate-fadeInUp'
            },
            hideClass: {
                popup: 'animate__animated animate__fadeOutDown animate__faster'
            },
            
            confirmButtonText: 'Ya, Keluar!',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                performLogout();
            }
        });
    } else {
        if (confirm('Keluar dari Portal? Sesi Anda akan diakhiri.')) {
            performLogout();
        }
    }
}

// Automatically attach logout click handler using event delegation
document.addEventListener('click', (e) => {
    const logoutBtn = e.target.closest('#btn-logout');
    if (logoutBtn) {
        e.preventDefault();
        logout();
    }
});

// ==========================================
// MODULAR UI LOADER (SIDEBAR & NAVBAR)
// ==========================================

// --- MESIN PEMANGGIL SIDEBAR ---
async function loadSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) return; 

    try {
        // Path pake ../ biar keluar dulu dari folder js/ atau pages/
        const response = await fetch('../components/sidebar.html');
        container.innerHTML = await response.text();

        // Otomatis nyalain class "active" sesuai halaman
        const currentPage = window.location.pathname.split("/").pop();
        const navLinks = container.querySelectorAll('.spe-nav-item');
        
        navLinks.forEach(link => {
            link.classList.remove('active'); 
            const href = link.getAttribute('href');
            if (href && href.includes(currentPage)) {
                link.classList.add('active');
            }
        });

    } catch (error) {
        console.error('Gagal memuat sidebar:', error);
    }
}

// --- MESIN PEMANGGIL NAVBAR ---
async function loadNavbar() {
    const container = document.getElementById('navbar-container');
    if (!container) return;

    try {
        const response = await fetch('../components/navbar.html');
        container.innerHTML = await response.text();

        // Otomatis ubah Judul Header sesuai halaman
        const pageTitle = document.getElementById('header-title');
        const path = window.location.pathname;
        
        if (path.includes('dashboard')) pageTitle.innerText = 'Dashboard';
        else if (path.includes('input-daily')) pageTitle.innerText = 'Input Daily QC';
        else if (path.includes('input')) pageTitle.innerText = 'Input Penilaian';
        else if (path.includes('master-rekap')) pageTitle.innerText = 'Master Rekap';
        else if (path.includes('master-vendor')) pageTitle.innerText = 'Master Vendor';
        else if (path.includes('riwayat-input')) pageTitle.innerText = 'Riwayat Input';

        // Panggil ulang fungsi nampilin Role biar chip "Memuat..." berubah
        if (typeof getActiveRole === 'function') {
            const roleChip = document.getElementById('role-chip');
            if (roleChip) {
                const role = getActiveRole();
                roleChip.innerText = role;
                
                // Styling warna chip sesuai role
                const roleStyle = {
                    QC: ['rgba(34,197,94,.1)', '#16a34a'],
                    PPIC: ['rgba(245,158,11,.1)', '#b45309'],
                    PCH: ['rgba(91,106,248,.1)', '#4338ca'],
                    HSE: ['rgba(239,68,68,.1)', '#dc2626']
                };
                if (roleStyle[role]) {
                    roleChip.style.background = roleStyle[role][0];
                    roleChip.style.color = roleStyle[role][1];
                }
            }
        }
        // --- LOGIC TOGGLE SIDEBAR ---
        const btnToggle = document.getElementById('btn-toggle-sidebar');
        if (btnToggle) {
            btnToggle.addEventListener('click', () => {
                const sidebar = document.querySelector('.spe-sidebar');
                const wrapper = document.querySelector('.spe-wrapper');
                
                if (sidebar && wrapper) {
                    sidebar.classList.toggle('minimized');
                    wrapper.classList.toggle('expanded');
                }
            });
        }

    } catch (error) {
        console.error('Gagal memuat navbar:', error);
    }
}

// --- JALANKAN MESIN SAAT HALAMAN DIBUKA ---
document.addEventListener('DOMContentLoaded', () => {
    loadSidebar();
    loadNavbar();
});
