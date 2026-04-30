# DOTT - Full Stack Run Guide

## Apps

```text
DOTT/
|-- backend/   Python FastAPI API      (port 8080)
|-- customer/  Customer web app        (port 3001)
|-- vendor/    Vendor web app          (port 3002)
|-- rider/     Rider web app           (port 3003)
|-- admin/     Admin web app           (port 3004)
```

## First-Time Setup

Create local env files from the examples:

```bash
copy backend\.env.example backend\.env
copy customer\.env.example customer\.env
copy vendor\.env.example vendor\.env
copy rider\.env.example rider\.env
copy admin\.env.example admin\.env
```

## Backend Setup

Core backend only:

```bash
cd backend
install_backend.bat --core-only
start_backend.bat
```

Full backend with AI image-processing features:

```bash
cd backend
install_backend.bat
start_backend.bat
```

Backend URLs:

- API: `http://localhost:8080`
- Docs: `http://localhost:8080/docs`

Backend setup files:

- `backend/requirements-core.txt` -> required API/runtime packages
- `backend/requirements-ai.txt` -> AI/image-processing packages
- `backend/requirements.txt` -> installs both sets together
- `backend/install_backend.bat` -> one-click backend installer
- `backend/start_backend.bat` -> one-click backend launcher

## Frontend Setup

Customer:

```bash
cd customer
npm install
npm run dev
```

Vendor:

```bash
cd vendor
npm install
npm run dev
```

Rider:

```bash
cd rider
npm install
npm run dev
```

Admin:

```bash
cd admin
npm install
npm run dev
```

## Mobile Testing On Same Wi-Fi

Start each frontend like this:

```bash
cd customer
npm run dev -- --host 0.0.0.0

cd ../vendor
npm run dev -- --host 0.0.0.0

cd ../rider
npm run dev -- --host 0.0.0.0

cd ../admin
npm run dev -- --host 0.0.0.0

cd ../backend
start_backend.bat
```

Find your laptop IP:

```bash
ipconfig
```

Then open on mobile:

- `http://<LAPTOP_IP>:3001` customer
- `http://<LAPTOP_IP>:3002` vendor
- `http://<LAPTOP_IP>:3003` rider
- `http://<LAPTOP_IP>:3004` admin

## Backend Notes

- `python main.py` now starts without auto-reload by default.
- On Windows, use `start_backend.bat` for the most stable startup.
- If you want reload for development:

```bash
cd backend
set DOTT_BACKEND_RELOAD=1
python main.py
```

## Production Checklist

Before live deployment:

1. Replace SQLite with PostgreSQL or MySQL.
2. Set a strong `SECRET_KEY`.
3. Set real `CORS_ORIGINS`.
4. Connect a real OTP provider.
5. Add real Firebase service-account JSON if using FCM.
6. Add AI/image service keys if you want premium cleanup.
7. Put the backend behind HTTPS and a real domain.

## Feature Notes

- Vendor AI auto-fill depends on the AI dependency set in `requirements-ai.txt`.
- Free TOTP authenticator login is supported.
- Push notifications require Firebase setup.
