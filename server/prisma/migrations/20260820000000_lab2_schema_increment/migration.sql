-- Lab 2 schema increment: add DevRequester, RelatedSystem, Ticket, Attachment
-- and extend Category with isActive.

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW');

-- AlterTable: add isActive to existing Category
ALTER TABLE "Category" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: RelatedSystem
CREATE TABLE "RelatedSystem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "RelatedSystem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RelatedSystem_name_key" ON "RelatedSystem"("name");

-- CreateTable: DevRequester
CREATE TABLE "DevRequester" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DevRequester_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DevRequester_email_key" ON "DevRequester"("email");
CREATE INDEX "DevRequester_isActive_idx" ON "DevRequester"("isActive");

-- CreateTable: Ticket
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "relatedSystemId" INTEGER,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requestedPriority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "currentStatus" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "ticketDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");
CREATE INDEX "Ticket_requesterId_idx" ON "Ticket"("requesterId");
CREATE INDEX "Ticket_ticketNumber_idx" ON "Ticket"("ticketNumber");
CREATE INDEX "Ticket_currentStatus_idx" ON "Ticket"("currentStatus");
CREATE INDEX "Ticket_requestedPriority_idx" ON "Ticket"("requestedPriority");
CREATE INDEX "Ticket_categoryId_idx" ON "Ticket"("categoryId");
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");

-- AddForeignKey: Ticket -> DevRequester
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "DevRequester"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Ticket -> Category
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Ticket -> RelatedSystem
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_relatedSystemId_fkey"
    FOREIGN KEY ("relatedSystemId") REFERENCES "RelatedSystem"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: Attachment
CREATE TABLE "Attachment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Attachment_storageFilename_key" ON "Attachment"("storageFilename");
CREATE INDEX "Attachment_ticketId_idx" ON "Attachment"("ticketId");
CREATE INDEX "Attachment_removedAt_idx" ON "Attachment"("removedAt");

-- AddForeignKey: Attachment -> Ticket
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
