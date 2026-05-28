## 📱 Responsive Design

- **Desktop**: Full layout dengan sidebar fixed (264px width).
- **Tablet**: Responsive grid layouts (penyesuaian margin dan padding agar tetap proporsional).
- **Mobile**: Sidebar hidden (menggunakan class `hidden md:flex`), diganti dengan hamburger menu atau bottom navigation.

## 🎨 Color System (Tailwind)

Menggunakan palet warna solid, bersih, dan kontras untuk kesan modern (berbasis Material Design 3):
- **Primary (Indigo)**: `indigo-900` (Gunakan untuk tombol aksi utama, state aktif, & highlight).
- **Secondary (Slate)**: `#64748B` / `slate-500` (Gunakan untuk teks sekunder, border netral, & ikon).
- **Tertiary (Gray)**: `#595c66` (Gunakan untuk elemen pendukung dan disable state).
- **Error (Red)**: `#ba1a1a` (Gunakan untuk alert, notifikasi error, & status reject).
- **Background**: `#F8FAFC` / `slate-50` (Warna dasar latar belakang aplikasi agar mata tidak cepat lelah).
- **Surface / Card**: `#FFFFFF` / `white` (Gunakan sebagai warna dasar form, modal, dan tabel).
 
## 📝 Typography & Iconography

- **Font Family**: Inter (Google Fonts) - Dipilih karena bersih, modern, dan highly legible untuk membaca data.
- **Icon Library**: Material Symbols Outlined (Google Fonts).
  - *Styling Rules*: Gunakan ketebalan tipis yang elegan (`FILL 0, wght 300, GRAD 0, opsz 24`).

## ✨ UI/UX Guidelines
- **Whitespace**: Berikan ruang yang lega pada elemen form dan tabel (contoh: `p-6` atau `p-8` pada *container* utama) agar antarmuka tidak terlihat sumpek.
- **Borders & Shadows**: Hindari shadow tebal. Gunakan kombinasi border tipis dan shadow halus (contoh: `border-slate-200 rounded-xl shadow-sm`) untuk *card*.
- **Micro-interactions**: Terapkan efek transisi pada setiap elemen interaktif.
  - *Button*: `hover:bg-indigo-700 transition-colors duration-200`
  - *Input Form*: `focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all`
  - *Table Row*: `hover:bg-slate-50 transition-colors cursor-pointer`
