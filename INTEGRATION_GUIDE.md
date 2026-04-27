# 🔗 Frontend-Backend Integration Guide

## ✅ Status Backend

- ✅ **Penilaian API** - Fully functional dengan CRUD operations
- ✅ **Database** - 168 penilaian records (42 suppliers × 4 bulan)
- ✅ **CORS** - Enabled untuk frontend
- ✅ **Custom Endpoints** - Dashboard summary, heatmap, top performers
- ✅ **Scoring Logic** - Automatic calculation of QC, PPIC, PCH, HSE scores

---

## 🎯 API Endpoints Available

### Supplier Endpoints
```
GET  /api/supplier              - Get all 42 suppliers
GET  /api/supplier/:id          - Get detail 1 supplier
POST /api/supplier              - Create supplier
PATCH /api/supplier/:id         - Update supplier
DELETE /api/supplier/:id        - Delete supplier
```

### Penilaian Endpoints
```
GET  /api/penilaian             - Get all penilaian (dengan filter optional)
GET  /api/penilaian?supplier_id=1&periode=2026-04  - Filter by supplier & periode
GET  /api/penilaian/:id         - Get detail 1 penilaian
POST /api/penilaian             - Create penilaian (UPSERT logic)
PATCH /api/penilaian/:id        - Update penilaian
DELETE /api/penilaian/:id       - Delete penilaian
```

### Custom Endpoints
```
GET  /api/penilaian/summary/dashboard      - Get KPI stats
GET  /api/penilaian/heatmap/data?periode=2026-04  - Get heatmap data untuk master rekap
GET  /api/penilaian/top-performers?limit=5 - Get top 5 performers
```

---

## 📝 Frontend Integration Steps

### Step 1: Include JavaScript Files

Di setiap HTML file (dashboard.html, input.html, master-rekap.html), tambahkan di `</head>` section:

```html
<script src="../js/api.js"></script>
</head>
<body>
  <!-- HTML content -->
  
  <!-- Add these scripts sebelum </body> closing tag -->
  <script src="../js/dashboard.js"></script>    <!-- untuk dashboard.html -->
  <script src="../js/master-rekap.js"></script>  <!-- untuk master-rekap.html -->
  <script src="../js/input.js"></script>        <!-- untuk input.html -->
</body>
```

### Step 2: Add Data Attributes untuk Dashboard

**dashboard.html** - Update KPI cards dengan data attributes:

```html
<!-- KPI 1: Total Supplier -->
<h3 class="font-headline-xl text-headline-xl text-on-surface" data-kpi="total">142</h3>

<!-- KPI 2: Top Performer -->
<h3 class="font-headline-xl text-headline-xl text-on-surface" data-kpi="top">38</h3>

<!-- KPI 3: Critical Supplier -->
<h3 class="font-headline-xl text-headline-xl text-error" data-kpi="critical">12</h3>

<!-- KPI 4: Pending Input -->
<h3 class="font-headline-xl text-headline-xl text-on-surface" data-kpi="pending">8</h3>
```

**Top 5 Chart Container:**

```html
<div data-chart="top-performers">
  <!-- Rows akan di-generate oleh dashboard.js -->
</div>
```

**Alert Ticker:**

```html
<div data-alert="ticker">
  <div class="font-body-md text-body-md text-on-error-container font-semibold truncate" data-alert="ticker-text">
    CRITICAL ALERT: {alert text akan di-update oleh JS}
  </div>
</div>
```

### Step 3: Add Data Attributes untuk Master Rekap

**master-rekap.html** - Update periode dropdown:

```html
<select class="border border-outline-variant rounded-md..." data-select="periode">
  <option>Desember 2026</option>
  <option value="2026-04">April 2026</option>
  <!-- dst -->
</select>
```

**Update table:**

```html
<table data-table="heatmap">
  <thead>
    <!-- thead tetap sama -->
  </thead>
  <tbody>
    <!-- tbody akan di-populate oleh master-rekap.js -->
  </tbody>
</table>
```

### Step 4: Add Data Attributes untuk Input Form

**input.html** - Update form inputs dengan data attributes:

```html
<!-- Supplier Selector -->
<select data-input="supplier-select">
  <option>Select Supplier...</option>
  <!-- Options akan di-populate oleh input.js -->
</select>

<!-- QC Input -->
<input data-input="qc-ng" placeholder="0.0" type="text" />

<!-- QC Feedback Badge -->
<div data-display="qc-badge">30 Poin - BAIK</div>

<!-- PPIC Input -->
<input data-input="ppic-ot" placeholder="92.5" type="text" />

<!-- Purchasing Selects -->
<select data-input="pch-harga">
  <option>BAIK</option>
  <option>CUKUP</option>
  <option>KURANG</option>
</select>

<select data-input="pch-moq">
  <option>BAIK</option>
  <option>CUKUP</option>
  <option>KURANG</option>
</select>

<select data-input="pch-top">
  <option>BAIK</option>
  <option>CUKUP</option>
  <option>KURANG</option>
</select>

<select data-input="pch-pelayanan">
  <option>BAIK</option>
  <option>CUKUP</option>
  <option>KURANG</option>
</select>

<!-- HSE Selects -->
<select data-input="hse-uji-emisi">
  <option>BAIK</option>
  <option>CUKUP</option>
  <option>KURANG</option>
</select>

<select data-input="hse-apd">
  <option>BAIK</option>
  <option>CUKUP</option>
  <option>KURANG</option>
</select>

<!-- Running Score Display -->
<span data-display="running-score">0</span>

<!-- Running Grade Display -->
<span data-display="running-grade">-</span>

<!-- Buttons -->
<button data-button="save-draft">Save Draft</button>
<button data-button="continue">Continue</button>
```

---

## 🧪 Testing API

### Test Supplier API
```bash
curl http://localhost:8082/api/supplier | jq 'length'
# Output: 42
```

### Test Penilaian API
```bash
curl http://localhost:8082/api/penilaian | jq 'length'
# Output: 168
```

### Test Dashboard Summary
```bash
curl http://localhost:8082/api/penilaian/summary/dashboard | jq .
# Output: {
#   "total_suppliers": 42,
#   "grade_a": 10,
#   "grade_c": 8,
#   "pending_input": 5
# }
```

### Test Heatmap Data
```bash
curl http://localhost:8082/api/penilaian/heatmap/data?periode=2026-04 | jq 'length'
# Output: 42
```

### Test Top Performers
```bash
curl http://localhost:8082/api/penilaian/top-performers | jq 'length'
# Output: 5
```

### Test Filtering
```bash
curl "http://localhost:8082/api/penilaian?supplier_id=1&periode=2026-04" | jq .
# Output: [{ supplier penilaian data }]
```

---

## 📊 Database Schema

### m_supplier (42 records)
```sql
id, kode_vendor, nama_vendor, jenis_bahan
```

### t_penilaian (168 records)
```sql
id, supplier_id, periode,
qc_ng_percent, qc_score,
ppic_ot_percent, ppic_score,
pch_harga, pch_moq, pch_top, pch_pelayanan, pch_score,
hse_uji_emisi, hse_apd, hse_score,
total_score, grade, status_final,
created_at, updated_at
```

---

## 🔧 Scoring Logic

### QC Score (Max 30)
- ≤0.5% NG → 30 poin (BAIK)
- ≤1.0% NG → 25 poin (BAIK)
- ≤2.0% NG → 20 poin (CUKUP)
- ≤5.0% NG → 15 poin (CUKUP)
- \>5.0% NG → 10 poin (KURANG)

### PPIC Score (Max 30)
- ≥95% On-Time → 30 poin (BAIK)
- ≥90% On-Time → 25 poin (BAIK)
- ≥85% On-Time → 20 poin (CUKUP)
- ≥80% On-Time → 15 poin (CUKUP)
- \<80% On-Time → 10 poin (KURANG)

### Purchasing Score (Max 40)
- Per kriteria (Harga, MOQ, TOP, Pelayanan):
  - BAIK = 3 pts × weight (2)
  - CUKUP = 2 pts × weight (2)
  - KURANG = 1 pt × weight (2)

### HSE Score (Max 30)
- Per kriteria (Uji Emisi, APD):
  - BAIK = 3 pts × weight (5)
  - CUKUP = 2 pts × weight (5)
  - KURANG = 1 pt × weight (5)

### Total Score & Grade (Max 130)
- **Grade A**: Total ≥ 100
- **Grade B**: Total 70-99
- **Grade C**: Total < 70

---

## 🚀 Next Steps

1. ✅ Backend API endpoints dan database ready
2. ✅ Frontend JS files dengan API integration
3. 📝 Update HTML files dengan data attributes
4. 🧪 Test semua endpoints
5. 🎨 Fine-tune UI/UX berdasarkan real data
6. 📱 Responsive design testing
7. 🔒 Security & authentication implementation

---

## 📞 Support

Untuk pertanyaan atau issues:
- Backend API: `/api` endpoints
- Frontend JS: `../js/` folder
- Database: `db_evaluasi_pemasok`

