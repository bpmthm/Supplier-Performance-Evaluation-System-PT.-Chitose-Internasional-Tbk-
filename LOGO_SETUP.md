# 📍 Panduan Setup Logo Chitose

## Langkah-Langkah untuk Menambahkan Logo Chitose

### 1️⃣ Persiapkan File Logo
- Pastikan Anda memiliki file logo Chitose bernama `logo_chitose.png`
- **Ukuran yang disarankan**: 256x256px atau lebih besar (akan di-scale menjadi 40x40px di sidebar)
- **Format**: PNG dengan background transparan direkomendasikan
- **Resolusi**: 72 DPI minimum

### 2️⃣ Letakkan Logo di Folder Assets
```
stitch_chitose_supplier_performance_dashboard/
└── assets/
    └── logo_chitose.png  ← Letakkan file logo di sini
```

### 3️⃣ Verifikasi Konfigurasi

Logo sudah dikonfigurasi di semua halaman dengan path relatif:
- `pages/dashboard.html` → `../assets/logo_chitose.png`
- `pages/input.html` → `../assets/logo_chitose.png`
- `pages/master-rekap.html` → `../assets/logo_chitose.png`

### 4️⃣ Struktur Logo di Sidebar

Setiap halaman memiliki logo Chitose di bagian atas sidebar:

```html
<div class="px-6 mb-8 flex items-center gap-3">
  <img alt="Chitose Logo" class="w-10 h-10 rounded bg-white p-1" src="../assets/logo_chitose.png"/>
  <div>
    <div class="text-lg font-black text-white uppercase tracking-wider">Supplier Portal</div>
    <div class="text-xs text-indigo-400">Chitose</div>
  </div>
</div>
```

**Styling Logo:**
- **Size**: 40x40px (w-10 h-10)
- **Background**: Putih (bg-white)
- **Padding**: 4px (p-1)
- **Border Radius**: Sedikit rounded (rounded)

## 📦 Struktur Aset yang Lengkap

Nantinya folder `assets/` akan berisi:

```
assets/
├── logo_chitose.png          # Logo utama Chitose
├── icons/                     # (opsional) Icon tambahan
└── images/                    # (opsional) Gambar lainnya
```

## ✅ Checklist Setup

- [ ] Siapkan file logo Chitose (logo_chitose.png)
- [ ] Copy file ke folder `stitch_chitose_supplier_performance_dashboard/assets/`
- [ ] Buka `pages/dashboard.html` di browser
- [ ] Verifikasi logo muncul di sidebar
- [ ] Test navigasi ke `pages/input.html`
- [ ] Test navigasi ke `pages/master-rekap.html`
- [ ] Verifikasi logo muncul di ketiga halaman

## 🎨 Tips Desain Logo

Untuk logo yang terlihat optimal di sidebar:
- **Color Scheme**: Sesuaikan dengan brand Chitose
- **Visibility**: Logo harus jelas pada background putih (p-1)
- **Simplicity**: Desain yang sederhana lebih cocok untuk ukuran kecil
- **Aspect Ratio**: Square (1:1) lebih ideal

## 🐛 Troubleshooting

**Logo tidak muncul?**
1. Verifikasi path file: `assets/logo_chitose.png`
2. Pastikan file sudah di-copy ke folder `assets/`
3. Periksa console browser untuk error message
4. Coba refresh halaman (Ctrl+F5)

**Logo terlihat pecah/blurry?**
1. Gunakan ukuran gambar minimal 256x256px
2. Export logo dalam format PNG dengan quality tinggi

**Logo terpotong?**
1. Pastikan logo memiliki padding dan tidak terlalu ketat di border
2. Ukuran canvas logo sebaiknya square (1:1)

---

**Catatan**: Semua halaman sudah siap dengan path yang benar. Hanya perlu menambahkan file logo_chitose.png ke folder assets untuk menyelesaikan setup.
