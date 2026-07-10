# Version Baseline

## v0.1.0 - Scaffold and Dev Platform

Status: Implemented on feature branch

Baseline contents:

- Monorepo scaffold with frontend, backend, shared package, and Prisma schema.
- Docker Compose development services for PostgreSQL, Keycloak, MinIO, SMTP test service, and backend API.
- CI workflow with `db:generate`, `typecheck`, `lint`, `test`, and `build` stages.
- Initial frontend shell and backend health endpoint.
- Cleaned documentation baseline removing obsolete NBP initial-scope governance and formal scope document artifacts.

Documentation references:

- `docs/plans/v0.1.0-implementation-plan.md`
- `docs/Deployment.md`
- `docs/CI_CD_Pipeline.md`
- `docs/Source_Control_Policy.md`
- `docs/testing/v0.1.0-test-results.md`
- `docs/user-guides/v0.1.0-user-guide.md`

Code reference:

- Branch: `feat/v0.1.0-scaffold`
- Version: `0.1.0`

## v0.2.0 - Authentication, Organizations, Users, RBAC

Status: Implemented on feature branch

Baseline contents:

- Keycloak development realm import with local demo users.
- JWT validation and `/me` profile mapping.
- Backend RBAC guards and role decorators.
- Organizations and users APIs with audit records for writes.
- Frontend Keycloak login/logout shell and role-aware navigation.

Documentation references:

- `docs/plans/v0.2.0-auth-rbac-plan.md`
- `docs/testing/v0.2.0-test-results.md`
- `docs/user-guides/v0.2.0-auth-rbac-user-guide.md`

Code reference:

- Branch: `feat/v0.2.0-auth-rbac`
- Version: `0.2.0`
