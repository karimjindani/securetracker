# Backup and Restore Runbook

## Scope

This runbook covers the Docker VM pilot deployment for PostgreSQL data, MinIO object storage, and host-managed configuration files.

## PostgreSQL Backup

Run from the deployment host:

```powershell
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U securetracker -d securetracker -Fc -f /tmp/securetracker.dump
docker compose -f docker-compose.prod.yml cp postgres:/tmp/securetracker.dump .\backups\securetracker.dump
```

Store the dump in encrypted backup storage.

## PostgreSQL Restore

Restore only during an approved maintenance window:

```powershell
docker compose -f docker-compose.prod.yml cp .\backups\securetracker.dump postgres:/tmp/securetracker.dump
docker compose -f docker-compose.prod.yml exec postgres pg_restore -U securetracker -d securetracker --clean --if-exists /tmp/securetracker.dump
```

After restore, validate backend health and login.

## MinIO Backup

Back up the Docker volume or mirror the bucket using the organization-approved object-storage tool. For the Docker volume baseline, stop writes before copying:

```powershell
docker compose -f docker-compose.prod.yml stop backend-api frontend
docker run --rm -v securetracker_minio-data:/data -v ${PWD}\backups:/backup alpine tar czf /backup/minio-data.tgz -C /data .
docker compose -f docker-compose.prod.yml start backend-api frontend
```

## MinIO Restore

Restore only with the application stopped:

```powershell
docker compose -f docker-compose.prod.yml stop backend-api frontend minio
docker run --rm -v securetracker_minio-data:/data -v ${PWD}\backups:/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/minio-data.tgz -C /data"
docker compose -f docker-compose.prod.yml up -d minio backend-api frontend
```

## Configuration Backup

Back up these host-managed files after every change:

- `.env.production`
- reverse proxy configuration
- TLS certificate references and renewal configuration
- `docker-compose.prod.yml` version used for deployment

## Restore Validation

- `docker compose -f docker-compose.prod.yml ps`
- backend `/health` returns `ok`
- frontend loads over HTTPS
- OIDC login succeeds
- a recent report file can be downloaded from MinIO
- audit search returns current records
