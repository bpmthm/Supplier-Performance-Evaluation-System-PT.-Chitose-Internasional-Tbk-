# 🚀 Quick Start Guide

## ⚡ 30 Detik Setup

### Step 1: Tambah Logo
```
1. Siapkan file: logo_chitose.png (256x256px PNG)
2. Copy ke: assets/logo_chitose.png
```

### Step 2: Buka Browser
```
1. Buka file: index.html
2. Atau langsung: pages/dashboard.html
```

### Step 3: Selesai! ✅
- Logo otomatis muncul di sidebar
- Navigasi antar halaman sudah berfungsi
- Semua halaman konsisten dengan sidebar Chitose

---

## 📁 File Structure Overview

```
✅ assets/              → Logo dan gambar
✅ components/         → Sidebar reusable component
✅ pages/              → 3 halaman utama
✅ index.html          → Home page
```

---

## 🔗 Links Penting

| File | Deskripsi |
|------|-----------|
| **index.html** | Start here! Dashboard dengan semua navigasi |
| **pages/dashboard.html** | Dashboard utama |
| **pages/input.html** | Smart Wizard input form |
| **pages/master-rekap.html** | Master rekap heatmap |
| **README.md** | Dokumentasi lengkap |
| **LOGO_SETUP.md** | Panduan logo setup |

---

## ✨ Sidebar Features

- ✅ Logo Chitose di top
- ✅ Navigasi 3 halaman
- ✅ Active page highlight
- ✅ Support & Logout links
- ✅ Dark theme modern
- ✅ Responsive (desktop only)

---

## 🎨 3 Halaman yang Tersedia

| Halaman | Fitur | Status |
|---------|-------|--------|
| **Dashboard** | KPI + Charts | ✅ Ready |
| **Smart Wizard** | Form + Stepper | ✅ Ready |
| **Master Rekap** | Heatmap Table | ✅ Ready |

---

## 📝 Customization Tips

### Ubah Nama Perusahaan
Edit semua file HTML, ganti:
- "Supplier Portal" → nama Anda
- "Chitose" → nama perusahaan

### Ubah Logo
- Replace: `assets/logo_chitose.png`
- Ukuran: 40x40px (akan di-scale otomatis)

### Ubah Warna
- Primary: `#434fc6` → warna pilihan
- Sidebar: `bg-slate-900` → warna pilihan

---

## ❓ FAQ

**Q: Bagaimana jika logo tidak muncul?**
A: Pastikan file sudah di-copy ke `assets/logo_chitose.png`

**Q: Bisa ubah warna sidebar?**
A: Ya, edit class `bg-slate-900` menjadi warna lain

**Q: Bisa tambah halaman baru?**
A: Ya, copy salah satu file HTML di folder `pages` dan update links

**Q: Perlu backend/database?**
A: Tidak! Ini 100% static HTML + CSS

---

## 🔄 Navigation Tips

- Sidebar aktif di desktop, hidden di mobile
- Semua links relative (bisa dipindahkan folder asal struktur sama)
- Active page auto-highlight dengan color indigo-600

---

**Siap dimulai?** → Buka `index.html` sekarang! 🎉
