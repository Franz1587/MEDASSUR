# CourtEVA+ Backend (NestJS + PostgreSQL + Prisma)

## Prerequisites

PostgreSQL runs as a **portable, no-admin-required** install (winget/the
official installer need Administrator rights, which weren't available on
the dev machine this was built on) — binaries were extracted from EDB's
zip distribution to `../../pgsql-portable` (a sibling of the repo root,
untracked by git) instead of `Program Files`, and the server runs as a
plain user process rather than a Windows service.

### Start PostgreSQL (once per reboot)

```powershell
cd "<repo-root>/../pgsql-portable"
./pgsql/bin/pg_ctl.exe -D ./data -l ./pg_log.txt -o "-p 5433" start
```

Stop it with `./pgsql/bin/pg_ctl.exe -D ./data stop`.

If setting this up fresh on another machine, either install PostgreSQL
normally (as Administrator) and skip the portable dance entirely, or
download `postgresql-<version>-windows-x64-binaries.zip` from
get.enterprisedb.com, extract it, then run `initdb` once to create the
`data` directory before the `pg_ctl start` command above.

## Setup

```bash
npm install
cp .env.example .env   # then edit DATABASE_URL/JWT_SECRET if needed
npx prisma migrate dev
npx prisma db seed
npm run dev             # http://localhost:3001/api
```

## Demo credentials

Every seeded user (mirrors the frontend's 19-role picker in
`src/auth/mockUsers.ts`) shares the same password:

```
password: courteva2024
```

e.g. `POST /api/auth/login { "email": "a.bengono@courteva.cm", "password": "courteva2024" }`

## Status

Clients and Compagnies are fully wired end-to-end (frontend → real API →
Postgres, including create/update/delete). Every other domain
(Contrats, Sinistres, Devis, Santé, Commissions, Trésorerie,
Recouvrement, CRM, IARD, Vie, Flotte, Comptabilité, GED, …) has a real
NestJS module + Prisma-backed read endpoint and seeded data, but the
frontend still reads them from `src/data/mock/*.ts` — swap each
`src/services/<domain>.service.ts` to call `http.get(...)` the same way
`clients.service.ts` does, one domain at a time.
