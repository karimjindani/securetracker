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

Apply the local development schema and seed reference organizations:

```powershell
npm.cmd run db:push
npm.cmd run db:seed
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
| Keycloak | `http://localhost:18080` |
| MinIO console | `http://localhost:9001` |
| SMTP test UI | `http://localhost:8025` |

## Keycloak Development Realm

The local Keycloak service imports:

```text
docker/keycloak/securetracker-realm.json
```

The realm name is `securetracker` and the public frontend client is `securetracker-web`.

## Secrets

Do not commit `.env` files. Use `.env.example` only for safe local defaults.
# v0.3.0 Local Feature Notes

After the local stack is running, authenticated users can access:

- Frontend application inventory at `/applications`
- Frontend VAPT calendar at `/calendar`
- Backend application APIs at `/applications`
- Backend calendar APIs at `/calendar`

Calendar entries created in `v0.3.0` are stored as `PLANNED` VAPT engagements. No additional environment variables are required beyond the `v0.2.0` authentication configuration.
