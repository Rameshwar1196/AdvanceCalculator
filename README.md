# Advanced Multi-Service Calculator

This project is a Node.js microservices-based calculator platform with:

- A gateway service and web UI
- A compute service for math, scientific, conversion, and age calculations
- A history service backed by SQLite (local) or PostgreSQL (production)

## Services

- Gateway + UI: http://localhost:11000
- Compute API: http://localhost:12000
- History API: http://localhost:13000

## Project Structure

- services/gateway: Serves UI and proxies API calls to downstream services
- services/compute: Handles arithmetic, scientific, trigonometry, conversions, and age calculations
- services/history: Stores and returns calculation history using SQLite or PostgreSQL

## Requirements

- Node.js 14+
- npm

## Run Locally

Open three terminals:

1. Start Compute service

```bash
cd services/compute
npm install
npm start
```

2. Start History service

```bash
cd services/history
npm install
npm start
```

3. Start Gateway service

```bash
cd services/gateway
npm install
npm start
```

Then open http://localhost:11000 in your browser.

## Environment Variables

### Gateway

- PORT (default: 11000)
- COMPUTE_SERVICE_URL (default: http://localhost:12000)
- HISTORY_SERVICE_URL (default: http://localhost:13000)

### Compute

- PORT (default: 12000)

### History

- PORT (default: 13000)
- HISTORY_DB_CLIENT (`sqlite` or `postgres`)
- HISTORY_DB_PATH (default: services/history/history.db)
- DATABASE_URL (required when `HISTORY_DB_CLIENT=postgres`)
- PGSSL (`true`/`false`, optional; set to `true` for hosted PostgreSQL that requires SSL)

## API Endpoints

### Gateway

- GET /health
- POST /api/calculate
- POST /api/scientific
- POST /api/trigonometry
- POST /api/convert/temperature
- POST /api/convert/length
- POST /api/convert/weight
- POST /api/age-calculator
- GET /api/history

### Compute

- GET /health
- POST /compute
- POST /scientific
- POST /trigonometry
- POST /convert/temperature
- POST /convert/length
- POST /convert/weight
- POST /age-calculator

### History

- GET /health
- POST /history
- GET /history?limit=20

## Supported Operations

### Basic arithmetic

- add, subtract, multiply, divide, modulo, power

### Scientific

- sqrt, cbrt, square, cube, abs, log10, ln, exp, reciprocal

### Trigonometry

- sin, cos, tan, asin, acos, atan
- angleMode accepts degrees or radians (default: degrees)

### Temperature units

- celsius, fahrenheit, kelvin
- common aliases like c, f, deg C, deg F are accepted

### Length units

- mm, cm, dm, m, dam, hm, km, inch, foot/ft, yard/yd, mile

### Weight units

- ug, mcg, mg, cg, dg, g, dag, hg, kg, tonne/ton/t, oz, lb, stone

## Example Payloads

### Basic arithmetic

```json
{
  "a": 15,
  "b": 3,
  "operation": "power"
}
```

### Scientific

```json
{
  "value": 16,
  "operation": "sqrt"
}
```

### Trigonometry

```json
{
  "value": 45,
  "operation": "sin",
  "angleMode": "degrees"
}
```

### Temperature conversion

```json
{
  "value": 32,
  "fromUnit": "fahrenheit",
  "toUnit": "celsius"
}
```

### Age calculator

```json
{
  "birthDate": "1990-05-15"
}
```

## Notes on History Behavior

- The gateway saves history only for POST /api/calculate.
- The history service currently accepts only these operations: add, subtract, multiply, divide.
- If calculation succeeds but history save fails (for example, operation is modulo or power, or history service is unavailable), the gateway still returns the calculation result and includes a historyWarning field.

## Deploy Publicly (GitHub + Vercel)

This repository now includes:

- `vercel.json` to serve the UI from `services/gateway/public/index.html`
- `api/[...route].js` as a Vercel serverless API gateway for `/api/*`

The Vercel API gateway forwards requests to hosted compute/history services using environment variables.

### 1. Push to GitHub

From project root:

```bash
git init
git add .
git commit -m "Prepare Vercel deployment"
git branch -M main
git remote add origin https://github.com/<your-username>/AdvanceCalculator.git
git push -u origin main
```

If your repo is already connected, use:

```bash
git add .
git commit -m "Prepare Vercel deployment"
git push
```

### 2. Host Backend Services (Compute + History)

Deploy these folders to a Node host like Render or Railway:

- `services/compute`
- `services/history`

Use start command:

```bash
npm start
```

Set ports via platform defaults or `PORT` env var.

For production reliability, use managed PostgreSQL for history.
The history service now supports this natively using `HISTORY_DB_CLIENT=postgres` and `DATABASE_URL`.

### 2.1 Production Database Migration (Recommended)

1. Provision a managed PostgreSQL database (Neon, Supabase, Railway, Render, etc.).
2. Set `HISTORY_DB_CLIENT=postgres` on the history service.
3. Set `DATABASE_URL` to your PostgreSQL connection string.
4. If your provider requires SSL, set `PGSSL=true`.
5. Restart/redeploy history service.

The service auto-creates the `calculations` table at startup.
Local development can continue to use SQLite with:

- `HISTORY_DB_CLIENT=sqlite` (or unset)
- `HISTORY_DB_PATH` (optional custom file path)

### 3. Deploy Frontend + API Gateway on Vercel

1. Import this GitHub repository in Vercel.
2. Framework preset: Other.
3. Root directory: repository root.
4. Build command: leave empty.
5. Output directory: leave empty.
6. Add Environment Variables in Vercel project settings:
  - `COMPUTE_SERVICE_URL=https://<your-compute-service-url>`
  - `HISTORY_SERVICE_URL=https://<your-history-service-url>`
7. Deploy.

### 4. Verify Deployment

After deployment, test:

- `https://<your-vercel-app>/`
- `https://<your-vercel-app>/api/health`
- `https://<your-vercel-app>/api/convert/temperature` (POST)
- `https://<your-vercel-app>/api/trigonometry` (POST)
- `https://<your-vercel-app>/api/age-calculator` (POST)

### 5. Update and Re-Deploy

Every push to your connected GitHub branch triggers a new Vercel deployment.
