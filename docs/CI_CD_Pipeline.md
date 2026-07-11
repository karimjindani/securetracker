# CI/CD Pipeline

## CI

The GitHub Actions workflow is `.github/workflows/ci.yml`.

Required stages:

```text
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run build
```

## Regression Gate

Starting in `v0.3.1`, local/dev regression is available through Playwright:

```text
npm run test:e2e
npm run test:regression
```

These are documented local gates for now. They should be added to CI once ephemeral PostgreSQL, Keycloak, MinIO, SMTP, backend, and frontend services are provisioned inside the workflow.

Starting in `v0.4.0`, regression also covers engagement initiation, scoping finalization, NBP-only closure, and Paysys Go-Live transition checks.

Starting in `v0.5.0`, regression also covers report upload/download, protected PDF detection, report upload RBAC, and report cleanup/reset behavior.

## Security Scanning

Security scanning is targeted for a later hardening baseline:

- Dependency scan
- Secret scan
- SAST scan
- Container image scan

Until then, the local lint step blocks obvious secret logging patterns.

## CD Target

Production deployment is not implemented in `v0.1.0`. Future image publishing should tag images with both version and git SHA.
