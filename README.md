# MEDASSUR+

Plateforme SaaS de courtage et gestion d'assurance santé — Gabon.

## Architecture

- **Frontend** : React + Vite + TypeScript + Tailwind/shadcn, dans `src/`
- **Backend** : NestJS + Prisma + PostgreSQL, dans `backend/`
- **Mobile** : Expo (React Native), dans `mobile/`

## Démarrage local

```bash
# Backend
cd backend && npm install && npx prisma generate && npm run start:dev

# Frontend
npm install && npm run dev

# Mobile
cd mobile && npm install && npx expo start
```

## Déploiement

Coolify sur VPS Hostinger (`medassur.cloud`).  
Voir la documentation interne pour les variables d'environnement.
