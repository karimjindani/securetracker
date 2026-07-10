# Deployment Guide

## v0.1.0 Local Development

Copy environment defaults:

```powershell
Copy-Item .env.example .env
```

Install dependencies:

```powershell
npm.cmd install
```

Generate the Prisma client:

```powershell
npm.cmd run db:generate
```

Start local infrastructure:

```powershell
docker compose up postgres keycloak minio smtp-test-service
```

Start the backend:

```powershell
npm.cmd run dev:backend
```

Start the frontend:

```powershell
npm.cmd run dev:frontend
```

## Services

| Service | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend health | `http://localhost:3000/health` |
| Keycloak | `http://localhost:8080` |
| MinIO console | `http://localhost:9001` |
| SMTP test UI | `http://localhost:8025` |

## Secrets

Do not commit `.env` files. Use `.env.example` only for safe local defaults.
