-- Lab 3 Auth Foundation Migration
-- Adds: UserRole enum, TicketStatus expansion, User model, PublicComment, InternalNote
-- Migrates: DevRequester → User, Ticket.requesterId FK, adds itPriority/ticketOwnerId/requesterResolvedAt
-- Drops: DevRequester table

-- ============================================================
-- 1. Create new enums
-- ============================================================

CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- Expand TicketStatus (was only 'NEW')
ALTER TYPE "TicketStatus" ADD VALUE 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';

-- ============================================================
-- 2. Create User table
-- ============================================================

CREATE TABLE "User" (
    "id"                 SERIAL         NOT NULL,
    "name"               TEXT           NOT NULL,
    "email"              TEXT           NOT NULL,
    "passwordHash"       TEXT           NOT NULL,
    "role"               "UserRole"     NOT NULL,
    "isActive"           BOOLEAN        NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN        NOT NULL DEFAULT true,
    "createdAt"          TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)   NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx"    ON "User"("email");
CREATE INDEX "User_role_idx"     ON "User"("role");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- ============================================================
-- 3. Migrate DevRequester rows → User (role = REQUESTER)
--    Initial password hash = bcrypt("Change@123", 12)
--    mustChangePassword = true for all migrated users
-- ============================================================

INSERT INTO "User" ("name", "email", "passwordHash", "role", "isActive", "mustChangePassword", "createdAt", "updatedAt")
SELECT
    "name",
    "email",
    -- bcrypt hash of "Change@123" with cost 12 (pre-computed for migration)
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8.Lz8P3GZkqGPkS2PuW',
    'REQUESTER'::"UserRole",
    "isActive",
    true,
    "createdAt",
    "updatedAt"
FROM "DevRequester";

-- ============================================================
-- 4. Add new columns to Ticket
-- ============================================================

ALTER TABLE "Ticket"
    ADD COLUMN "ticketOwnerId"       INTEGER,
    ADD COLUMN "itPriority"          "Priority" NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN "requesterResolvedAt" TIMESTAMP(3);

-- Copy requestedPriority → itPriority for existing tickets
UPDATE "Ticket" SET "itPriority" = "requestedPriority";

-- ============================================================
-- 5. Re-point Ticket.requesterId FK from DevRequester → User
--    Map: DevRequester.id matches the insertion order above,
--    so User rows have the same id values (SERIAL restarts from 1).
--    We verify by matching email.
-- ============================================================

-- Drop the old FK constraint
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_requesterId_fkey";

-- Update requesterId to point to the new User id (matched by email)
UPDATE "Ticket" t
SET "requesterId" = u."id"
FROM "DevRequester" dr
JOIN "User" u ON u."email" = dr."email"
WHERE t."requesterId" = dr."id";

-- Add new FK to User
ALTER TABLE "Ticket"
    ADD CONSTRAINT "Ticket_requesterId_fkey"
        FOREIGN KEY ("requesterId") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add FK for ticketOwnerId
ALTER TABLE "Ticket"
    ADD CONSTRAINT "Ticket_ticketOwnerId_fkey"
        FOREIGN KEY ("ticketOwnerId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Ticket_ticketOwnerId_idx" ON "Ticket"("ticketOwnerId");
CREATE INDEX "Ticket_itPriority_idx"    ON "Ticket"("itPriority");

-- ============================================================
-- 6. Create PublicComment table
-- ============================================================

CREATE TABLE "PublicComment" (
    "id"        SERIAL       NOT NULL,
    "ticketId"  INTEGER      NOT NULL,
    "authorId"  INTEGER      NOT NULL,
    "content"   TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublicComment_ticketId_idx" ON "PublicComment"("ticketId");

ALTER TABLE "PublicComment"
    ADD CONSTRAINT "PublicComment_ticketId_fkey"
        FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicComment"
    ADD CONSTRAINT "PublicComment_authorId_fkey"
        FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 7. Create InternalNote table
-- ============================================================

CREATE TABLE "InternalNote" (
    "id"        SERIAL       NOT NULL,
    "ticketId"  INTEGER      NOT NULL,
    "authorId"  INTEGER      NOT NULL,
    "content"   TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InternalNote_ticketId_idx" ON "InternalNote"("ticketId");

ALTER TABLE "InternalNote"
    ADD CONSTRAINT "InternalNote_ticketId_fkey"
        FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalNote"
    ADD CONSTRAINT "InternalNote_authorId_fkey"
        FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 8. Drop DevRequester (no longer needed after migration)
-- ============================================================

ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_requesterId_fkey";
-- Re-add the correct FK that now points to User (done in step 5, so this is idempotent)
ALTER TABLE "Ticket"
    ADD CONSTRAINT "Ticket_requesterId_fkey"
        FOREIGN KEY ("requesterId") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "DevRequester";
