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

## Security Scanning

Security scanning is targeted for a later hardening baseline:

- Dependency scan
- Secret scan
- SAST scan
- Container image scan

Until then, the local lint step blocks obvious secret logging patterns.

## CD Target

Production deployment is not implemented in `v0.1.0`. Future image publishing should tag images with both version and git SHA.
