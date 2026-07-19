# CI/CD Pipeline

## Current Documentation Note

The CI/CD pipeline supports the `v0.18.9` SecureTracker software baseline. Current product architecture and data model references are maintained in [`Product_Architecture.md`](Product_Architecture.md), [`Data_Model.md`](Data_Model.md), and [`Data_Dictionary.md`](Data_Dictionary.md).

## CI

The GitHub Actions workflow is `.github/workflows/ci.yml`.

Required stages:

```text
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high
docker compose config --quiet
docker compose -f docker-compose.prod.yml config --quiet
docker build --target backend
docker build --target frontend
```

## Regression Gate

Starting in `v0.3.1`, local/dev regression is available through Playwright:

```text
npm run test:e2e
npm run test:regression
```

These remain local/dev gates until ephemeral PostgreSQL, Keycloak, MinIO, SMTP, backend, and frontend services are provisioned inside the workflow.

Starting in `v0.4.0`, regression also covers engagement initiation, scoping finalization, NBP-only closure, and Paysys Go-Live transition checks.

Starting in `v0.5.0`, regression also covers report upload/download, protected PDF detection, report upload RBAC, and report cleanup/reset behavior.

Starting in `v0.6.0`, regression also covers finding creation, assignment, evidence upload, failed revalidation, refix, and passed revalidation.

Starting in `v0.11.3`, regression also covers Organizations/Users data visibility, risk acceptance approval/rejection, dashboard metrics, audit search, and audit CSV export.

## Security Scanning

Starting in `v0.18.8`, CI includes:

- Dependency audit with `npm audit --audit-level=high`.
- Gitleaks secret scanning.
- Backend and frontend Docker image builds.
- A non-blocking Trivy scan for the backend image.

The lint step continues to block obvious secret logging patterns.

## CD Target

The `v0.18.8` deployment target is a Docker VM pilot using `docker-compose.prod.yml`. Future image publishing should tag images with both version and git SHA.
