# Source Control Policy

## Branching

SecureTracker uses trunk-based development.

- `main` must remain releasable.
- Work happens on short-lived branches.
- Branch names follow `<type>/vX.Y.Z-<slug>`.

Examples:

```text
feat/v0.1.0-scaffold
fix/v0.2.0-rbac-guard
docs/v0.3.0-calendar-guide
```

## Commits

Use Conventional Commits. Versioned baseline changes include the version in the subject or trailer.

Example:

```text
feat(platform): add v0.1.0 scaffold
```

## Pull Requests

- Every implementation change should land through a PR.
- CI must pass before merge.
- At least one review is required before merging to `main`.
- Do not force-push or delete `main`.
