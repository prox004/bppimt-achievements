# BPPIMT Achievements Portal 🎓

A modern, secure Next.js web application engineered exclusively for BPPIMT students to upload, organize, and manage their academic and extra-curricular achievements. 

The application features advanced cloud-native document routing leveraging **Firebase**, automated spreadsheet appending via the **Google Sheets API**, and secure file hosting through **Cloudinary**.

---

## 🚀 Features

*   **Firebase Google Auth:** Strict login constraints ensuring only verified `@bppimt.ac.in` email addresses can access the portal.
*   **Intelligent Auto-Fill:** Student profiles (Name, Roll, Department, Year) are securely stored in Firestore and instantly auto-filled upon returning to the site.
*   **Past Submissions Dashboard:** A responsive, swipe-friendly Carousel UI seamlessly rendering all historic certificate submissions on the student dashboard.
*   **Dynamic Cloudinary Routing:** Direct API streaming of certificate uploads (`PDF`/`Image`) into secure, dynamically generated Cloudinary subfolders mapped cleanly to the student's name.
*   **Google Sheets Automation:** Natively interfaces with a mapped Service Account to append live records exactly matching physical Google Sheet tabs (e.g. `2024-25`), and automatically triggers internal Sheet Alphabetization to visually group students.
*   **Admin Dashboard:** Dedicated protected route (`/admin`) capable of sweeping user subcollections, live data tabular filtering, Department metric visualizations, and 1-click `.csv` bulk exports.

---

## 💻 Tech Stack

*   **Framework:** Next.js 16 (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS v4 & Lucide React
*   **Database:** Firebase Firestore (NoSQL Subcollections)
*   **Authentication:** Firebase Auth
*   **Storage APIs:** Cloudinary v2 & Google APIs (`googleapis`)

---

## 🛠️ Local Development

### 1. Clone the Repository
```bash
git clone https://github.com/prox004/bppimt-achievements.git
cd bppimt-achievements
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory. You must supply the physical Service Account JSON strings, the Cloudinary Tokens, and the Firebase configuration:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="..."

# Google Drive and Sheets Service Account Keys
GOOGLE_CLIENT_EMAIL="..."
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID="..."

# Cloudinary Environment Variables
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

### 3. Run the Development Server
Start the Turbopack server:
```bash
npm run dev
```
Navigate to `http://localhost:3000` to interact with the application locally!

---

## 🔒 Security Posture

*   All high-privilege keys (RSA Private Keys & Cloudinary Secrets) strictly omit `NEXT_PUBLIC_` rendering them heavily encrypted and explicitly unreadable by client browsers.
*   `.gitignore` actively intercepts all hidden API caching profiles to prevent cloud leakage.
*   Active Regex filtering during Cloudinary buffer uploads to eradicate potential Directory Traversal attacks.
*   Strict `match /users/{userId}` Firestore Security Rules denying standard user Read/Writes.
