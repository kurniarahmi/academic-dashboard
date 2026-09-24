# 📊 Academic Intelligence Suite

Sebuah dashboard analitik interaktif bergaya Looker Studio yang dibangun menggunakan **Next.js**. Dashboard ini dirancang untuk Institutional Research Office guna memantau performa akademik, kebiasaan belajar, dan segmentasi demografi siswa. 

Data pada dashboard ini terhubung secara *real-time* ke dataset CSV dari Google Spreadsheet, memastikan metrik yang ditampilkan selalu up-to-date tanpa memerlukan database terpisah.

## 🌐 Live Preview
**Akses dashboard secara langsung di sini:**  
👉 **[Lihat Live Dashboard](https://academic-dashboard-sage.vercel.app/)**

## ✨ Fitur Utama

* **🔄 Live Data Connector:** Menarik data secara dinamis dari *published* CSV Google Sheets menggunakan PapaParse.
* **🎛️ Dynamic Global Filtering:** Filter interaktif (berdasarkan Gender, Final Grade, Internet Access, dan Part-Time Job) yang langsung mengubah kalkulasi KPI, grafik, dan tabel secara instan.
* **📈 Interactive Data Visualization:** Render grafik performa tinggi (Scatter Plots, Bar Charts) menggunakan Recharts, lengkap dengan *trendline* dan *custom tooltip*.
* **🎨 Modern Looker Studio UI:** Desain antarmuka profesional yang bersih dan responsif menggunakan Tailwind CSS v4, lengkap dengan animasi transisi yang *smooth*.

## 📂 Struktur Halaman Dashboard

Dashboard ini terbagi menjadi 4 modul analitik utama:

1. **Overview (`/`)**
   Ringkasan metrik level eksekutif (KPI) seperti total siswa, rata-rata nilai, kehadiran, dan jam belajar. Dilengkapi dengan grafik distribusi nilai dasar dan perbandingan gender.
   
2. **Academic Performance (`/academic`)**
   Berfokus pada perkembangan siswa (*grade progression*). Menampilkan analisis regresi linear (nilai sebelumnya vs ujian akhir), matriks mobilitas nilai, dan Tabel Peringatan Dini (*Early Warning*) untuk mengidentifikasi siswa yang berisiko.

3. **Learning Habits (`/habits`)**
   Analisis gaya hidup siswa. Menampilkan kurva *sweet spot* korelasi jam tidur dengan nilai, dampak jam belajar, serta perbandingan metrik antara siswa yang bekerja paruh waktu atau aktif di ekstrakurikuler.

4. **Student Segmentation (`/segmentation`)**
   Fokus pada ekuitas dan demografi. Membedah pengaruh tingkat pendidikan orang tua, membagi siswa ke dalam 4 Kuadran Persona (cth: *High Resource*, *Resilient*, *At-Risk*), dan profil risiko pembagian digital (*digital divide*).

## 🛠️ Teknologi yang Digunakan

* **Framework:** Next.js (App Router) & React
* **Styling:** Tailwind CSS 
* **Charts:** Recharts
* **Data Parsing:** PapaParse
* **Deployment:** Vercel

---
*Developed for Institutional Research & Student Affairs Executive Registry.*