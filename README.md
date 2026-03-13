# E-VENT Frontend (PWA) 🚀

This is the user interface for **E-VENT**, a Progressive Web App (PWA) designed for smart event discovery and social coordination.

## 🏛️ System Architecture: The Orchestrator Model
This frontend is a **Thin Client**. It communicates exclusively with the **Python Orchestrator** to handle data and authentication.

---

## 🛠️ Tech Stack
- **Framework:** React.js (Vite)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Communication:** Python FastAPI (Orchestrator)

---

## 📋 Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/E-VENT-Tribe/event-frontend.git
cd event-frontend
```

### 2. Install Dependencies

Run this command to install all necessary packages for the frontend:

```bash
npm install
```

### 3. Environment Variables

Create a file named `.env.local` in the root directory for local development. This file is ignored by Git.

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_ENV=development
```

For deployment (e.g. Render, Vercel), set `VITE_API_BASE_URL` in your hosting provider’s environment settings to the URL of your **backend/orchestrator**, for example:

```env
VITE_API_BASE_URL=https://your-backend-service.onrender.com
VITE_ENV=production
```

### 4. Run Development Server

To start the local development environment:

```bash
npm run dev
```

The app will be available at:

```
http://localhost:5173
```

---

## 🛡️ DevOps & Workflow Guidelines

### 🌿 Branching Strategy

- `main`: Production-only  
- `develop`: Integration branch  
- `feat/*`: Individual feature branches  

### 🔎 Pull Requests

Direct pushes to `main` or `develop` are blocked.  
All code must be reviewed and approved before merging.

### ⚙️ CI/CD

- Merges to `develop` trigger the **Staging build**
- Merges to `main` trigger the **Production build**

---

## 📱 PWA & Production Testing

To test the Service Worker, offline mode, and PWA installation:

### Build the project

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

---

## 👥 The Tribe (Team Roles)

- **Product and Project Manager** Arda Arslan
- **Software Architect:** Sonia Mangane, Kaleb Teshale Gebretsadik 
- **Frontend Squad:** Khaoula Adouli, Rania Chafai, Nallamolu Harsha Gopal
- **Backend Squad/AI Squad:** Rajinish Chowdary Pothakamuri,  Relja Popovic
- **QA & test Squad:** Dharam Vishal, Shreyash Rameshbhai Hadiya
- **DevOps Engineer:** Sonia Mangane, Maksim Marnat

---

## 📬 Deployment Status

- **Staging Environment:** TBD  
- **Production Environment:** TBD  

---

© 2026 E-VENT Project Team


