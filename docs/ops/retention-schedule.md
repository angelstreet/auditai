# Scheduling the retention worker (FR-09)

The worker (`services/ai/src/retentionWorker.ts`) erases every pseudonym whose respondent badges are
all past `retention_at`, using the same SQL function as the admin right-to-erasure action
(ADR 0020). It is idempotent, so run it as often as you like; **daily** is enough.

Entry point: `pnpm retention:run` (one pass, reads `DATABASE_URL`). Keep the URL in an
environment file that is not in the repository.

## systemd timer

`/etc/systemd/system/auditai-retention.service`

```ini
[Unit]
Description=auditai retention worker (FR-09)

[Service]
Type=oneshot
WorkingDirectory=/opt/auditai
EnvironmentFile=/etc/auditai/retention.env   # DATABASE_URL=...
ExecStart=/usr/bin/env pnpm retention:run
```

`/etc/systemd/system/auditai-retention.timer`

```ini
[Unit]
Description=Daily auditai retention run

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

Enable with `systemctl enable --now auditai-retention.timer`.

## cron

```cron
15 3 * * * cd /opt/auditai && set -a && . /etc/auditai/retention.env && pnpm retention:run
```

## docker compose

The `retention` service in `docker-compose.yml` loops in-process every
`RETENTION_INTERVAL_SECONDS` (default 86400). Alternatively drop `restart`/the variable and run
`docker compose run --rm retention` from the host timer.

## Verify

`pnpm retention:run` prints `retention tenants=N purged=M`. `pnpm m15:smoke` seeds an expired
pseudonym with a full submission chain and checks that nothing carrying it remains.
