# BookSlot Backend

Appointment booking API built with NestJS, TypeScript, Prisma, and PostgreSQL.

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 14+ running locally (or a connection string)

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd bookslot-backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/bookslot"
JWT_SECRET="any-long-random-string-minimum-32-chars"
JWT_EXPIRES_IN="7d"
PORT=3000
```

### 3. Set up the database

```bash
# Create database
createdb bookslot   # or use your PostgreSQL client

# Run migrations and generate Prisma client
npx prisma migrate dev
npx prisma generate
```

### 4. Run the server

```bash
npm run start:dev
```

API is available at `http://localhost:3000/api/v1`.

---

## Running Tests

```bash
npm run test
```

Tests are located in `src/bookings/bookings.service.spec.ts`. They use mocked Prisma — no database required.

---

## API Overview

| Auth | Endpoint |
|---|---|
| Register owner | POST /api/v1/auth/owner/register |
| Login owner | POST /api/v1/auth/owner/login |
| Register customer | POST /api/v1/auth/customer/register |
| Login customer | POST /api/v1/auth/customer/login |

| Owners (Bearer OWNER token) | Endpoint |
|---|---|
| Get profile | GET /api/v1/owners/me |
| Update profile | PATCH /api/v1/owners/me |

| Services | Endpoint |
|---|---|
| Browse (public) | GET /api/v1/services/public |
| Detail (public) | GET /api/v1/services/public/:id |
| Create | POST /api/v1/services |
| List own | GET /api/v1/services |
| Update own | PATCH /api/v1/services/:id |
| Delete own | DELETE /api/v1/services/:id |

| Availability | Endpoint |
|---|---|
| View (public) | GET /api/v1/availability/public/:ownerId |
| Set day | PUT /api/v1/availability/MONDAY |
| Remove day | DELETE /api/v1/availability/MONDAY |

| Bookings | Endpoint |
|---|---|
| Available slots | GET /api/v1/bookings/slots?serviceId=&date=YYYY-MM-DD |
| Book a slot | POST /api/v1/bookings |
| My bookings | GET /api/v1/bookings/my |
| Cancel | PATCH /api/v1/bookings/:id/cancel |
| Owner bookings | GET /api/v1/bookings/owner |
| Update status | PATCH /api/v1/bookings/:id/status |

---

## Project Structure

```
src/
├── auth/           # JWT auth, guards, strategies
├── owners/         # Owner profile management
├── services/       # Service CRUD
├── availability/   # Weekly availability schedule
├── bookings/       # Slot logic, booking CRUD
├── prisma/         # Database client (global)
└── common/         # Global exception filter
```
