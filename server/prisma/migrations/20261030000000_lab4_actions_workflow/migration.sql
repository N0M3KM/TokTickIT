-- CreateEnum
CREATE TYPE "public"."ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ActionEventType" AS ENUM ('CREATE', 'EDIT', 'STATUS');

-- CreateEnum
CREATE TYPE "public"."WorkflowEventKind" AS ENUM ('OWNER', 'PRIORITY', 'STATUS', 'REQUESTER_INDICATION');

-- AlterTable
ALTER TABLE "public"."Ticket" ADD COLUMN     "reopenedAt" TIMESTAMPTZ(3),
ADD COLUMN     "resolutionTimeEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resolvedAt" TIMESTAMPTZ(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "public"."ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actionAt" TIMESTAMPTZ(3) NOT NULL,
    "description" TEXT NOT NULL,
    "result" TEXT,
    "performedById" INTEGER NOT NULL,
    "assigneeId" INTEGER NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "attachmentNotes" TEXT,
    "status" "public"."ActionStatus" NOT NULL DEFAULT 'PLANNED',
    "cancellationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "requestFingerprint" TEXT NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ActionRevision" (
    "id" SERIAL NOT NULL,
    "actionId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "editorId" INTEGER NOT NULL,
    "eventType" "public"."ActionEventType" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TicketWorkflowEvent" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "kind" "public"."WorkflowEventKind" NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketWorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_actionAt_id_idx" ON "public"."ActionTaken"("ticketId", "actionAt", "id");

-- CreateIndex
CREATE INDEX "ActionTaken_assigneeId_status_actionAt_id_idx" ON "public"."ActionTaken"("assigneeId", "status", "actionAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ActionTaken_performedById_ticketId_idempotencyKey_key" ON "public"."ActionTaken"("performedById", "ticketId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ActionRevision_actionId_createdAt_id_idx" ON "public"."ActionRevision"("actionId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ActionRevision_actionId_version_key" ON "public"."ActionRevision"("actionId", "version");

-- CreateIndex
CREATE INDEX "TicketWorkflowEvent_ticketId_createdAt_id_idx" ON "public"."TicketWorkflowEvent"("ticketId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Ticket_requesterId_currentStatus_idx" ON "public"."Ticket"("requesterId", "currentStatus");

-- CreateIndex
CREATE INDEX "Ticket_requesterId_updatedAt_id_idx" ON "public"."Ticket"("requesterId", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "Ticket_currentStatus_resolvedAt_id_idx" ON "public"."Ticket"("currentStatus", "resolvedAt", "id");

-- CreateIndex
CREATE INDEX "Ticket_updatedAt_id_idx" ON "public"."Ticket"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "Ticket_ticketOwnerId_currentStatus_idx" ON "public"."Ticket"("ticketOwnerId", "currentStatus");

-- AddForeignKey
ALTER TABLE "public"."ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionTaken" ADD CONSTRAINT "ActionTaken_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionRevision" ADD CONSTRAINT "ActionRevision_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "public"."ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionRevision" ADD CONSTRAINT "ActionRevision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketWorkflowEvent" ADD CONSTRAINT "TicketWorkflowEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketWorkflowEvent" ADD CONSTRAINT "TicketWorkflowEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve legacy UTC timestamp interpretation; these are estimates, not new events.
UPDATE "public"."Ticket"
SET "resolvedAt" = "updatedAt" AT TIME ZONE 'UTC', "resolutionTimeEstimated" = true
WHERE "currentStatus" IN ('RESOLVED', 'CLOSED');

ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_version_positive" CHECK ("version" > 0);
ALTER TABLE "public"."ActionTaken" ADD CONSTRAINT "ActionTaken_version_positive" CHECK ("version" > 0);
ALTER TABLE "public"."ActionRevision" ADD CONSTRAINT "ActionRevision_version_positive" CHECK ("version" > 0);
ALTER TABLE "public"."ActionTaken"
  ADD CONSTRAINT "ActionTaken_description_valid" CHECK (char_length("description") <= 2000 AND "description" ~ '[^[:space:]]'),
  ADD CONSTRAINT "ActionTaken_result_bounded" CHECK ("result" IS NULL OR char_length("result") <= 2000),
  ADD CONSTRAINT "ActionTaken_followup_valid" CHECK (
    ("followUpRequired" AND "followUpNote" IS NOT NULL AND char_length("followUpNote") <= 2000 AND "followUpNote" ~ '[^[:space:]]')
    OR (NOT "followUpRequired" AND "followUpNote" IS NULL)),
  ADD CONSTRAINT "ActionTaken_attachment_bounded" CHECK ("attachmentNotes" IS NULL OR char_length("attachmentNotes") <= 1000),
  ADD CONSTRAINT "ActionTaken_completion_valid" CHECK ("status" <> 'COMPLETED' OR
    ("result" IS NOT NULL AND "result" ~ '[^[:space:]]' AND NOT "followUpRequired")),
  ADD CONSTRAINT "ActionTaken_cancellation_valid" CHECK (
    ("status" = 'CANCELLED' AND "cancellationReason" IS NOT NULL AND char_length("cancellationReason") <= 500 AND "cancellationReason" ~ '[^[:space:]]')
    OR ("status" <> 'CANCELLED' AND "cancellationReason" IS NULL));

-- New audit records are append-only, including accidental direct UPDATE/DELETE.
CREATE FUNCTION "public"."reject_lab4_audit_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit history is append-only';
END;
$$;
CREATE TRIGGER "ActionRevision_append_only" BEFORE UPDATE OR DELETE ON "public"."ActionRevision"
FOR EACH ROW EXECUTE FUNCTION "public"."reject_lab4_audit_mutation"();
CREATE TRIGGER "TicketWorkflowEvent_append_only" BEFORE UPDATE OR DELETE ON "public"."TicketWorkflowEvent"
FOR EACH ROW EXECUTE FUNCTION "public"."reject_lab4_audit_mutation"();
