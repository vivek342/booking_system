# BookSlot — System Design Document

## 1. Database Schema

### Tables

#### `BusinessOwner`
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, default uuid() | |
| email | String | UNIQUE, NOT NULL | Login identifier |
| password | String | NOT NULL | bcrypt hashed |
| name | String | NOT NULL | Owner's name |
| businessName | String | NOT NULL | Displayed publicly |
| phone | String | nullable | Optional contact |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | auto-updated | |

#### `Customer`
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, default uuid() | |
| email | String | UNIQUE, NOT NULL | Login identifier |
| password | String | NOT NULL | bcrypt hashed |
| name | String | NOT NULL | |
| phone | String | nullable | |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | auto-updated | |

#### `Service`
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| ownerId | UUID | FK → BusinessOwner | |
| name | String | NOT NULL | e.g. "Haircut" |
| description | String | nullable | |
| durationMin | Int | NOT NULL, min 5 | Duration in minutes |
| price | Decimal(10,2) | NOT NULL, min 0 | |
| isActive | Boolean | default true | Soft delete flag |
| createdAt | DateTime | | |
| updatedAt | DateTime | | |

Index on `(ownerId)` for fast lookups by owner.

#### `Availability`
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| ownerId | UUID | FK → BusinessOwner | |
| dayOfWeek | DayOfWeek enum | NOT NULL | MONDAY…SUNDAY |
| startTime | String | NOT NULL | "HH:mm" format |
| endTime | String | NOT NULL | "HH:mm" format |
| createdAt | DateTime | | |
| updatedAt | DateTime | | |

Unique constraint on `(ownerId, dayOfWeek)` — one time window per day per business.

#### `Booking`
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| serviceId | UUID | FK → Service | |
| customerId | UUID | FK → Customer | |
| date | Date | NOT NULL | @db.Date — date only |
| startTime | String | NOT NULL | "HH:mm" |
| endTime | String | NOT NULL | "HH:mm" — pre-computed |
| status | BookingStatus enum | default CONFIRMED | |
| notes | String | nullable | Customer notes |
| createdAt | DateTime | | |
| updatedAt | DateTime | | |

Indexes on `(serviceId, date)` for fast slot conflict queries, and `(customerId)` for customer history.

### Why This Structure

**Separate BusinessOwner and Customer tables** — not a single User table with a role column. They have entirely different relationships (owners have Services and Availabilities; customers have Bookings). Merging them would create nullable columns, complicate FK design, and obscure intent. The role is encoded in the JWT, not in a shared table.

**Availability stores weekly template, not specific dates** — businesses define standing hours by day of week. Computing specific date availability on the fly from this template is O(1). Pre-generating date-specific slots would create millions of rows and require maintenance on schedule changes.

**Slots are NOT stored** — they are computed on the fly from Availability + Service duration. Only actual bookings are stored. This avoids stale pre-generated slots when duration or hours change.

**Booking stores both startTime and endTime** — endTime is computed (startTime + durationMin) at booking creation and persisted. This means rendering a booking detail never requires re-fetching the service. If a service's duration later changes, historical bookings are unaffected.

**Soft delete for Services** — setting `isActive = false` rather than deleting preserves historical booking records and foreign key integrity.

---

## 2. API Surface

All endpoints are prefixed with `/api/v1`.

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/owner/register | Public | Register a business owner |
| POST | /auth/owner/login | Public | Login as business owner, receive JWT |
| POST | /auth/customer/register | Public | Register a customer |
| POST | /auth/customer/login | Public | Login as customer, receive JWT |

### Business Owners
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /owners/me | OWNER | Get own profile |
| PATCH | /owners/me | OWNER | Update own profile |

### Services
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /services/public | Public | Browse all active services (filter ?ownerId=) |
| GET | /services/public/:id | Public | View a single active service |
| POST | /services | OWNER | Create a new service |
| GET | /services | OWNER | List own services (including inactive) |
| GET | /services/:id | OWNER | Get own service detail |
| PATCH | /services/:id | OWNER | Update own service |
| DELETE | /services/:id | OWNER | Soft-delete own service |

### Availability
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /availability/public/:ownerId | Public | View a business's availability |
| GET | /availability | OWNER | View own weekly availability |
| PUT | /availability/:day | OWNER | Set/update availability for a day (e.g. /availability/MONDAY) |
| DELETE | /availability/:day | OWNER | Remove availability for a day |

### Bookings
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /bookings/slots?serviceId=&date= | Public | Get available slots for a service on a date |
| POST | /bookings | CUSTOMER | Book a slot |
| GET | /bookings/my | CUSTOMER | Get own booking history |
| PATCH | /bookings/:id/cancel | CUSTOMER | Cancel own booking |
| GET | /bookings/owner?status= | OWNER | View all bookings for own services |
| PATCH | /bookings/:id/status | OWNER | Mark booking as COMPLETED or NO_SHOW |

---

## 3. Auth Design

**Two separate user types** — BusinessOwner and Customer — stored in separate tables with separate registration and login endpoints.

**Single JWT strategy** — both user types share the same JWT mechanism. The token payload contains `{ sub: userId, role: 'OWNER' | 'CUSTOMER' }`.

**Guard stack on protected routes**:
1. `JwtAuthGuard` (extends Passport `AuthGuard('jwt')`) — validates the Bearer token and sets `req.user = { userId, role }` from the payload.
2. `RolesGuard` — reads the `@Roles()` decorator on the route handler and checks `req.user.role` matches.

Routes that require role-based access always use `@UseGuards(JwtAuthGuard, RolesGuard)` together. Public routes use no guards at all.

**Passwords** are hashed with `bcrypt` (10 salt rounds) before storage. The raw password is never returned in any response.

**Tokens expire in 7 days** (configurable via `JWT_EXPIRES_IN` in `.env`).

---

## 4. Edge Cases

| Case | Handling |
|---|---|
| **Double-booking same slot** | `createBooking` runs in a `Serializable` Prisma transaction. Inside the transaction it checks for an existing non-cancelled booking. If found, throws `ConflictException (409)`. Serializable isolation prevents phantom reads from two concurrent requests both seeing an empty slot. |
| **Booking in the past** | Validated before any DB call. If `date < today` (UTC midnight), throw `BadRequestException (400)`. |
| **Querying slots for past date** | `getAvailableSlots` rejects past dates with `BadRequestException`. |
| **Booking on a day the business is closed** | `createBooking` looks up the owner's availability for that day of week. If none found, throws `BadRequestException`. |
| **startTime outside business hours** | Validated against availability window. Throws `BadRequestException` if `startTime < startTime` or `startTime + durationMin > endTime`. |
| **startTime not on a valid slot boundary** | e.g. if slots run every 60 min from 09:00, submitting 09:30 is rejected. The check is `(startMins - availStartMins) % durationMin !== 0`. |
| **Cancelling a COMPLETED or NO_SHOW booking** | `cancelBooking` checks `status === CONFIRMED`. Any other status throws `BadRequestException`. |
| **Cancelling a past booking** | Even if status is CONFIRMED, cancelling a past date is rejected with `BadRequestException`. |
| **Customer cancels another customer's booking** | `cancelBooking` compares `booking.customerId !== customerId`. Throws `ForbiddenException (403)`. |
| **Owner deletes service with active bookings** | `remove()` counts upcoming CONFIRMED bookings. If > 0, throws `BadRequestException` with the count. Owner must cancel them first. |
| **Owner updates another owner's bookings** | `updateBookingStatus` checks `booking.service.ownerId !== ownerId`. Throws `ForbiddenException`. |
| **Owner marks already-completed booking** | `updateBookingStatus` checks `status === CONFIRMED`. Throws `BadRequestException` if not. |
| **Deleting availability with future bookings on that day** | `remove()` (Availability) fetches upcoming bookings for that day of week across all services. Throws `BadRequestException` if conflicts exist. |
| **Invalid date format** | `@IsDateString()` DTO validator rejects non-YYYY-MM-DD strings before hitting the service. |
| **Invalid time format** | `@Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)` DTO validator rejects malformed times. |
| **Setting startTime >= endTime for availability** | `AvailabilityService.upsert()` validates this. Throws `BadRequestException`. |
| **Accessing inactive service** | All customer-facing service lookups use `isActive: true`. Returns `NotFoundException`. |
| **UUID format violations** | `ParseUUIDPipe` on all `:id` and `:ownerId` params rejects non-UUID strings automatically. |
| **Unknown request body fields** | Global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` strips and rejects unknown fields. |

---

## 5. Assumptions

| Ambiguity | Decision |
|---|---|
| **Do owners and customers share an email namespace?** | No. A person can register as both an owner and a customer with the same email. The tables are independent. The JWT role distinguishes their session. |
| **Are slots fixed-interval or free-form?** | Fixed-interval. Slots are generated at exact multiples of `durationMin` from `availabilityStartTime`. This matches how salons and clinics actually work (e.g. appointments at 9:00, 9:30, 10:00). |
| **Can an owner take bookings on the same day as a holiday or one-off closure?** | Out of scope. The brief only mentions weekly availability. Date-specific overrides (holidays, closures) are documented as a future enhancement. |
| **Can a customer re-book a cancelled slot?** | Yes. A cancelled booking frees the slot. The conflict check uses `status NOT IN [CANCELLED]`, so the slot is available again. |
| **What currency is price in?** | Not specified. Price is stored as `Decimal(10,2)` — a raw number. Currency display is a frontend concern. |
| **Can a business owner have multiple services with different durations?** | Yes. Availability is shared at the owner level; services have individual durations. Slot generation uses the requested service's duration. |
| **How far in advance can customers book?** | No limit specified. The only constraint is the date must not be in the past. |
| **Can an owner see bookings from the past?** | Yes. `getOwnerBookings` returns all bookings (past and upcoming) ordered by date ascending. Filtering by status or date range can be added as query params in future. |
