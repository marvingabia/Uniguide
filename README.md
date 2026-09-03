# GuidanceConnect — MinSU Bongabong Campus

**Mindoro State University Bongabong Campus**  
**Online Guidance Management System**

A modern, secure, and responsive web-based system for digitizing the process of requesting **Certificates of Good Moral Character** at MinSU Bongabong Campus.

---

## 🎯 Project Overview

This system allows students to:
- Submit Good Moral Certificate requests online
- Pay electronically via GCash/LandBank
- Receive approval notifications from the Guidance Office
- Track their application status in real-time

Three User Roles:
1. **Student** — Apply, pay, and track requests
2. **Cashier** — Verify payments and issue official receipts
3. **Guidance Administrator** — Approve, process, and release certificates

---

## 🚀 Features

### Student Module
- ✅ Dashboard with request tracking
- ✅ Online Good Moral Request Form
- ✅ Electronic payment submission (GCash/LandBank QR codes)
- ✅ Real-time notifications
- ✅ Announcement viewing
- ✅ Appointment booking
- ✅ Application status tracking

### Cashier Module
- ✅ Payment verification dashboard
- ✅ Official receipt generation
- ✅ Daily collections report
- ✅ Payment history
- ✅ Screenshot/reference number review
- ✅ Accept/reject payment workflow

### Guidance Administrator Module
- ✅ Request processing dashboard
- ✅ Approve/reject applications
- ✅ Certificate release management
- ✅ Announcements management
- ✅ Appointment management
- ✅ User management (create staff accounts)
- ✅ Reports generation (daily/monthly/yearly)

---

## 🛠 Technology Stack

**Frontend**
- HTML5, CSS3, TailwindCSS
- Handlebars (`.xian` template files)

**Backend**
- Node.js (ES6 Modules)
- Express.js
- Sequelize ORM

**Database**
- MySQL

**Authentication**
- bcrypt (password hashing)
- express-session (session management)
- Role-based access control

**File Upload**
- Multer (payment screenshots, receipts)

---

## 📂 Database Tables

- `users` — All users (students, cashiers, guidance)
- `applications` — Good Moral Certificate requests
- `payments` — Embedded in applications
- `receipts` — Embedded in applications
- `notifications` — Real-time user notifications
- `announcements` — System-wide announcements
- `appointments` — Student appointment requests

---

## 📊 Application Workflow

```
Step 1: Student logs in
Step 2: Student fills out Good Moral Request Form
Step 3: Student submits request → status: pending
Step 4: System notifies cashier
Step 5: Student pays (GCash/LandBank)
Step 6: Student uploads payment screenshot + reference number → status: payment_submitted
Step 7: Cashier verifies payment → status: payment_verified
Step 8: Cashier generates Official Receipt (OR) → status: receipt_issued
Step 9: System notifies Guidance Administrator
Step 10: Guidance Administrator processes request → status: approved
Step 11: Guidance Administrator releases certificate → status: released
Step 12: Student receives notification: "Certificate ready for release"
Step 13: Student claims certificate at Guidance Office
```

---

## 🔧 Installation & Setup

### 1. Clone the repository
```bash
git clone <repo-url>
cd guidance
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create `.env` file:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=guidance
DB_PORT=3306
SESSION_SECRET=minsu-guidance-secret-change-this
PORT=3000
```

### 4. Create database
```bash
node --env-file=.env -e "import { syncDB } from './models/index.js'; await syncDB(); process.exit(0);"
```

### 5. Start the server
```bash
npm run dev    # Development (with nodemon)
npm start      # Production
```

### 6. Access the system
```
http://localhost:3000
```

---

## 👥 Default User Accounts

After installation, create admin accounts manually via the `/register` page or through the Guidance dashboard.

**Sample Login:**
- **Email:** student@minsu.edu.ph  
- **Password:** password123

---

## 📸 Screenshots

Place MinSU Bongabong Campus image at:
```
public/uploads/campus.jpg
```

This image is used as the login/register page background.

---

## 📋 Status Flow

| Status               | Description                                    |
|----------------------|------------------------------------------------|
| `pending`            | Waiting for student payment                    |
| `payment_submitted`  | Payment screenshot uploaded, awaiting cashier  |
| `payment_verified`   | Cashier verified payment                       |
| `receipt_issued`     | Official receipt generated                     |
| `approved`           | Guidance approved request                      |
| `released`           | Certificate ready for student claim            |
| `rejected`           | Application rejected (with remarks)            |

---

## 🔐 Security Features

- ✅ Password hashing with bcrypt
- ✅ Session-based authentication
- ✅ Role-based access control (RBAC)
- ✅ SQL injection protection (Sequelize ORM)
- ✅ File upload validation (5MB limit)

---

## 📁 Project Structure

```
guidance/
├── controllers/         # Business logic
│   ├── authController.js
│   ├── studentController.js
│   ├── cashierController.js
│   └── guidanceController.js
├── models/              # Database models
│   ├── User.js
│   ├── Application.js
│   ├── Announcement.js
│   ├── Appointment.js
│   ├── Notification.js
│   └── index.js
├── routes/              # API routes
│   └── index.js
├── views/               # Handlebars templates (.xian files)
│   ├── student/
│   ├── cashier/
│   ├── guidance/
│   └── partials/
├── middleware/          # Auth middleware
│   └── auth.js
├── utils/               # Helper functions
│   └── notifications.js
├── public/              # Static assets
│   └── uploads/         # Payment screenshots, receipts
├── .env                 # Environment variables (DO NOT COMMIT)
├── index.js             # Server entry point
├── package.json         # Dependencies
└── README.md            # This file
```

---

## 🚨 Important Notes

1. **QR Codes:** Add actual GCash and LandBank QR code images to the payment page
2. **MinSU Campus Image:** Place the campus photo at `public/uploads/campus.jpg`
3. **Database:** Ensure MySQL is running before starting the server
4. **Session Secret:** Change `SESSION_SECRET` in `.env` for production

---

## 📞 Support

**Target Institution:**  
Mindoro State University — Bongabong Campus  
Guidance Office

For issues or questions, contact the Guidance Office Administrator.

---

## 📜 License

This system is developed exclusively for **Mindoro State University — Bongabong Campus** and is not licensed for external use.

---

**Developed with ❤️ for MinSU Bongabong Campus Guidance Office**
