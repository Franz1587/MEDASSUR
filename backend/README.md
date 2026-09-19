# MedAssur Backend (NestJS + PostgreSQL + Prisma)

## Prerequisites

PostgreSQL runs as a local Windows service (`postgresql-x64-18`) listening
on port 5432. Make sure the service is started (`Get-Service postgresql-x64-18`)
before running migrations or starting the API.

## Setup

```bash
npm install
cp .env.example .env   # then edit DATABASE_URL/JWT_SECRET if needed
npx prisma migrate dev
npx prisma db seed
npm run dev             # http://localhost:3001/api
```

## Demo credentials

Every seeded user (mirrors the frontend's role picker in
`src/auth/mockUsers.ts`) shares the same password:

```
password: medassur2024
```

e.g. `POST /api/auth/login { "email": "a.bengono@medassur.ga", "password": "medassur2024" }`

## Status

MedAssur is scoped to health insurance only. All business domains are
wired end-to-end (frontend → real API → Postgres): Clients, Compagnies
and Contrats have full CRUD; Devis, Renouvellements, Avenants,
Résiliations, Sinistres, Santé, Commissions, Trésorerie, Recouvrement,
CRM, Comptabilité and GED are read-backed. The backend returns
normalized relational data (ids + nested client/compagnie/contrat
objects); each frontend `src/services/<domain>.service.ts` maps that
into the denormalized display shape the views already expect (see
`src/lib/decimal.ts` for the Decimal→number conversion, and any
`src/services/*.service.ts` for the mapping pattern).

Dashboard, Rapports and Admin stay on `src/data/mock/*.ts` — they're BI
aggregates / admin concepts with no backend model yet. The AI assistant
stays mocked by explicit product decision (`src/services/ai.service.ts`
is the seam for wiring a real model later).
