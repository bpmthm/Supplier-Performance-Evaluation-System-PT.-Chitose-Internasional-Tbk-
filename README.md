# Chitose Supplier Performance Dashboard

## 📁 Struktur Folder yang Terorganisir

```
stitch_chitose_supplier_performance_dashboard/
├── assets/                    # Folder untuk aset (logo, gambar, dll)
│   └── logo_chitose.png      # Logo Chitose yang ditampilkan di sidebar
├── components/                # Folder untuk komponen reusable
│   └── sidebar.html          # Komponen sidebar yang dapat digunakan di semua halaman
├── pages/                      # Folder untuk halaman utama aplikasi
│   ├── dashboard.html        # Dashboard - Overview supplier health
│   ├── input.html           # Smart Wizard - Input data kualitas
│   └── master-rekap.html    # Master Rekap - Heatmap performa supplier
├── industrial_supplier_portal/
│   └── DESIGN.md            # File dokumentasi desain
├── dashboard_supplier_health_command_center_modern_refinement/
│   └── code.html            # File original dashboard
├── master_rekap_the_interactive_heatmap_clean_theme/
│   └── code.html            # File original master rekap
└── smart_wizard_modern_unified_design/
    └── code.html            # File original smart wizard
```

## 🎨 Fitur Utama

### 1. **Sidebar Konsisten**
- Logo Chitose (`logo_chitose.png`) di bagian atas sidebar
- Navigasi yang sama di semua halaman: Dashboard, Input, Master Rekap
- Design modern dengan tema dark (slate-900)
- Responsive dan mobile-friendly

### 2. **Halaman-Halaman**

#### Dashboard (`pages/dashboard.html`)
- Overview supplier health dengan KPI cards
- Division Performance radar chart
- Top 5 Score Increases bar chart
- Critical alerts ticker
- Active page indicator: Dashboard

#### Input (`pages/input.html`)
- Smart Wizard untuk input data kualitas
- Stepper component untuk progress tracking
- Quality Control Assessment form
- Locked divisions preview
- Active page indicator: Input

#### Master Rekap (`pages/master-rekap.html`)
- Interactive heatmap dengan supplier performance metrics
- Tabel komprehensif dengan quality score, delivery time, cost efficiency
- Color-coded performance indicators
- Search dan filter functionality
- Pagination untuk data supplier
- Active page indicator: Master Rekap

## 🎯 Perbaikan Struktur

1. **Modularitas**: Aset dan komponen dipisahkan ke folder khusus
2. **Konsistensi**: Semua halaman menggunakan sidebar dan topbar yang sama
3. **Branding**: Logo Chitose ditampilkan di sidebar setiap halaman
4. **Navigasi**: Links di sidebar functional dan menghubungkan antar halaman
5. **Design System**: Menggunakan Tailwind CSS dengan color system yang konsisten

## 🚀 Cara Menggunakan

1. **Letakkan logo** `logo_chitose.png` di folder `assets/`
2. **Akses halaman** melalui folder `pages/`:
   - `pages/dashboard.html` - Halaman dashboard
   - `pages/input.html` - Halaman smart wizard
   - `pages/master-rekap.html` - Halaman master rekap

## 📱 Responsive Design

- Desktop: Full layout dengan sidebar fixed (264px width)
- Tablet: Responsive grid layouts
- Mobile: Sidebar hidden (use `hidden md:flex` class)

## 🎨 Color System

Menggunakan Material Design 3 color system:
- **Primary**: #434fc6 (Indigo)
- **Secondary**: #4e6073 (Slate)
- **Tertiary**: #595c66 (Gray)
- **Error**: #ba1a1a (Red)
- **Background**: #f7fafc (Light blue-gray)

## 📝 Font

- **Font Family**: Inter (Google Fonts)
- **Icon Library**: Material Symbols Outlined (Google Fonts)

---

**Dibuat pada**: April 2026
**Last Updated**: Dengan sidebar Chitose yang terstruktur
