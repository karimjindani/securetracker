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

Apply the local development schema and seed the validation baseline:

```powershell
npm.cmd run reset:seeded
```

Start the full containerized application:

```powershell
docker compose up -d
```

The Compose stack includes PostgreSQL, Keycloak, MinIO, Mailpit, backend API, and the Nginx-served frontend.

Notification email delivery uses the SMTP settings in `.env.example`. Local Compose points the backend to the `smtp-test-service` Mailpit container, and delivered messages can be reviewed in the SMTP test UI.

The seeded baseline includes 3 workflow-party organizations, 7 users, 25 applications, and 50 annual Whitebox engagements for frontend validation.

For local source-level development, backend and frontend can still be started separately:

```powershell
npm.cmd run dev:backend
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

# v0.3.1 External Ops Console and Regression

The Ops Console is a host-run local tool outside the SecureTracker application containers. Start it from the repository root:

```powershell
npm.cmd run ops
```

Regression commands:

```powershell
npm.cmd run test:e2e
npm.cmd run test:regression
npm.cmd run test:data:cleanup
npm.cmd run reset:seeded
```

Open the Ops Console at:

```text
http://127.0.0.1:3300
```

If `OPS_CONSOLE_TOKEN` is configured, enter that token in the console header. The main SecureTracker application does not expose `/ops`.

# v0.4.0 Engagement and Scoping

After `npm.cmd run db:push` and `npm.cmd run db:seed` or `npm.cmd run reset:seeded`, authenticated users can access:

- Frontend engagement list at `/engagements`
- Frontend engagement detail at `/engagements/:id`
- Backend engagement APIs at `/engagements`
- Backend scoping APIs at `/engagements/:id/scoping-records` and `/scoping-records/:id/finalize`

The seeded baseline now includes demo users, three applications, five engagements, and scoping records for regression. Seeded test account summaries contain no passwords.

NBP initial scope approval is not required. Bank/NBP attendance remains optional for the first Paysys-Apprise initiation meeting.

# v0.5.0 Report Repository

MinIO remains part of the Compose stack and is required for report upload, view, and download.

Relevant local defaults:

- API MinIO endpoint: `MINIO_ENDPOINT=minio`
- API MinIO port: `MINIO_PORT=9000`
- Bucket: `MINIO_BUCKET=vapt-tracker`
- MinIO console: `http://localhost:9001`

The backend creates the local bucket if it is missing. Uploaded PDFs are stored unchanged in MinIO. PDF passwords are never stored, logged, or sent to the backend for validation.

Report APIs:

- `GET /engagements/:id/reports`
- `POST /engagements/:id/reports`
- `GET /reports/:id`
- `POST /reports/:id/versions`
- `GET /reports/:id/versions/:versionId/view`
- `GET /reports/:id/versions/:versionId/download`
