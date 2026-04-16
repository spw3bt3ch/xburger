# XBurger E-Commerce Platform

A stunning, mobile-first static e-commerce application built for XBurger in Lagos, Nigeria. This platform provides a rich frontend user experience and an autonomous client-side administrative backend.

## Features

### 🍔 Frontend Experience (Customer Facing)
- **Modern UI/UX**: Built entirely on HTML, vanilla JS, and Tailwind CSS (via CDN) for zero-latency, high-performance load times.
- **Dynamic Menu Grid**: Connects fluidly with the admin dashboard to reflect live pricing and newly added product items without manual code redeployments.
- **Smart Cart System**: Integrated floating cart with real-time checkout computations to handle item additions, subtractions, and free delivery thresholds.
- **Paystack Inline Integration**: Checkout flow natively pops up a secured Paystack Payment modal, passing the exact dynamically calculated total in Kobo. Requires users' Name, Email, Phone, and Address before processing.

### 🔒 Admin Dashboard
*Accessible by default via `/admin/index.html`*
- **Offline Backend Engine**: Powered by `sql.js` (SQLite in WebAssembly) saving exclusively to browser `localStorage`. No physical backend server required.
- **Order Management**: Real-time view of placed orders via the website showing user delivery instructions, statuses, and live totals. 
- **Product Menu Manager**: Fully functional `+ Add Product` modal. Add featured image links, update item names, categories, and inject live price adjustments onto the main site automatically.
- **Rating Tracker**: Manually add or edit simulated positive experiences for social proof on the frontend.

---

## 🛠 Tech Stack
- **HTML5** & **Vanilla Javascript**
- **Tailwind CSS**
- **Paystack Pop (v1)** for inline checkout processing
- **sql.js (SQLite WebAssembly)** for admin data persistence

## 🚀 Deployment Instructions

This project requires exactly **zero configuration** to deploy! Because there is no Node/Python backend, you can host this code perfectly on **Vercel**, **Netlify**, or **Github Pages**.

### Vercel Deployment (Recommended)
You can deploy directly to Vercel via their Dashboard Interface.

1. Create a Vercel account and navigate to your [Dashboard](https://vercel.com/dashboard).
2. Click **Add New** -> **Project**.
3. Upload this entire `xburger` folder directly into Vercel using the **Upload a Folder** interface.
4. Hit deploy!

A `vercel.json` file has already been pre-configured to ensure clean routing (e.g. `yourdomain.com/admin` serving `/admin/index.html`) and proper cache control for instant updates.

> **Note:** The Admin Dashboard databases are completely isolated to the webmaster’s localized browser (`localStorage`). It interacts strictly with the frontend via localized sync states. If the cache is cleared, data safely unmounts until reconstructed.
