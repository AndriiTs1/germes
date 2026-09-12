# Germes

Germes is a custom ERP/CRM platform for a trading and import business.
The system is being built around one core principle: business data is entered once and then reused across departments without duplication in spreadsheets, messengers, or disconnected tools.

## Current scope

The current foundation includes:

- responsive Command Center dashboard
- sales and customer domain models
- suppliers and procurement foundation
- warehouses, batches, stock movements, and reservations
- sales orders
- receivables and payables
- role-based data model
- Prisma migrations and demo seed data
- PostgreSQL database integration

Planned modules include document workflows, interdepartmental requests and approvals, payment calendar, deeper profitability analytics, bank/accounting integrations, and additional automation.

## Tech stack

- Next.js 16
- React
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Prisma 7
- PostgreSQL
- Supabase for hosted PostgreSQL
- Lucide icons
- Geist font

## Project structure

```text
app/
  page.tsx
  globals.css

components/
  dashboard/
    analytics/
    operations/
  ui/

lib/

prisma/
  migrations/
  schema.prisma
  seed.ts

prisma7.config.ts
components.json
```

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/AndriiTs1/germes.git
cd germes
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file:

```env
DATABASE_URL="your-runtime-postgresql-connection-string"
DIRECT_URL="your-direct-postgresql-connection-string"
```

- `DATABASE_URL` is intended for the application/runtime connection.
- `DIRECT_URL` is used by Prisma CLI operations and migrations.

Never commit `.env` or real credentials to Git.

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Apply database migrations

For local/development environments:

```bash
npx prisma migrate dev
```

For deployment environments:

```bash
npx prisma migrate deploy
```

### 6. Seed demo data

```bash
npx tsx prisma/seed.ts
```

### 7. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

Before committing changes, run:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

The current baseline has been verified with:

- TypeScript: no errors
- ESLint: no errors or warnings
- Next.js production build: successful

## Responsive dashboard

The Command Center has been manually verified at representative desktop, tablet, and mobile CSS viewport sizes, including:

- 1440×900
- 1280×800
- 1024×768
- 834×1194
- 390×844
- 320×700

The layout adapts from a permanent desktop sidebar to a mobile/tablet drawer and uses dedicated ultra-narrow layouts where business data would otherwise become truncated.

## Database architecture

The current data model includes:

- users and roles
- products
- warehouses
- batches
- stock movements
- stock reservations
- customers
- suppliers
- sales orders and order items
- receivables
- payables

Inventory follows the core relationship:

```text
Product → Batch → StockMovement → Warehouse
```

Reservations are modeled separately from physical stock movements.

## Development notes

- Prisma CLI uses `DIRECT_URL`.
- Runtime database access should use the appropriate application connection string.
- Generated Prisma client files are not committed.
- Local AI/tooling directories are ignored by Git.
- Sensitive environment files are ignored by Git.
- Do not use `npm audit fix --force` without reviewing dependency impact.

## Repository

GitHub: [AndriiTs1/germes](https://github.com/AndriiTs1/germes)

## Status

Germes is under active development. The current repository contains the ERP foundation, database schema/migrations, demo seed data, and the responsive Command Center interface.
