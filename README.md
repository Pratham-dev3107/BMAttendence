# 🏭 Kranti Attendance & Payroll System

Full-featured Smart Attendance & Automated Payroll System with QR scanning, role-based authentication, and Sunday-cut policy.

---

## 🔐 Login Credentials (User IDs)

| Role | Username | Password | Access Scope |
|---|---|---|---|
| **🛡️ Gatekeeper** | `guard` | `guard123` | High-speed QR scanner terminal only (no access to salary/rates) |
| **👑 Admin / Owner** | `admin` | `admin123` | Full control: attendance sheets, payroll, worker management, settings |

*(On the login screen, there are also **1-Click Demo Buttons** to sign in instantly!)*

---

## ⏰ Shift & Policy Rules Configured

1. **Shift Timings:** **8:30 AM – 5:00 PM** (8.5 Hours standard duration).
2. **Overtime (OT):** Any work completed past **5:00 PM (17:00)** is automatically recorded as Overtime hours.
3. **Sunday Deduction Policy:**
   - **Weekly Rule:** If a worker takes **3 offs in a single week**, that week's **Sunday is Cut** (Unpaid).
   - **Monthly Rule:** If a worker takes **4 or more offs in the month**, a minimum of **2 Sundays are Cut**.
   - The software computes these deductions automatically and reflects them in the Monthly Payroll Sheet and Excel download.

---

## 🚀 Quick Run (Local)

1. Double-click **`start.bat`** in the project folder.
2. Open in your browser: **[http://localhost:5000](http://localhost:5000)**
3. To open on Gatekeeper's mobile phone:
   - Click **"Connect Mobile"** at the top bar.
   - Scan the QR code or visit `http://<YOUR-IP>:5000` on the phone's browser.

---

## ☁️ Cloud Deployment Options (Vercel & Production)

### 1. Instant Demo on Vercel:
We have already configured `vercel.json` and `api/index.js` in the project root!
- Simply run:
  ```bash
  npx vercel
  ```
  or push this folder to GitHub and import into Vercel.
- It will give you a live **HTTPS** link (e.g. `https://kranti-attendance.vercel.app`).
- **Why HTTPS is critical:** Mobile browsers strictly require HTTPS to allow camera access for QR scanning on public networks!

### 2. Best Setup for Production:
- **Render.com / Railway.app (Recommended for standalone Node.js):**
  - Runs the full app with persistent storage 24/7.
- **Office Local Server (Recommended for zero cloud cost):**
  - Run on the gate/office PC. Works 100% offline even if internet goes down!
