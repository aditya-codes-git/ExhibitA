ALTER TABLE "exhibita"."EvidenceCase" ADD COLUMN "agentRunStatus" VARCHAR(40);

ALTER TABLE "exhibita"."EvidenceCase" ADD CONSTRAINT "EvidenceCase_agent_run_status" CHECK (
    "agentRunStatus" IS NULL OR "agentRunStatus" IN ('READY', 'RUNNING', 'CHECKOUT_READY', 'FAILED')
);

CREATE TABLE "exhibita"."EvidenceEvent" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "externalEventId" VARCHAR(120) NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    CONSTRAINT "EvidenceEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EvidenceEvent_source" CHECK ("source" IN ('AGENT_MODEL', 'DEMO_STORE', 'EXHIBITA_TOOL')),
    CONSTRAINT "EvidenceEvent_kind" CHECK ("kind" IN ('TOOL_REQUEST', 'TOOL_RESULT'))
);

CREATE UNIQUE INDEX "EvidenceEvent_orderId_source_externalEventId_key"
  ON "exhibita"."EvidenceEvent"("orderId", "source", "externalEventId");
CREATE INDEX "EvidenceEvent_orderId_occurredAt_recordedAt_idx"
  ON "exhibita"."EvidenceEvent"("orderId", "occurredAt", "recordedAt");
ALTER TABLE "exhibita"."EvidenceEvent" ADD CONSTRAINT "EvidenceEvent_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "exhibita"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

REVOKE ALL ON TABLE "exhibita"."EvidenceEvent" FROM PUBLIC, anon, authenticated;
ALTER TABLE "exhibita"."EvidenceEvent" ENABLE ROW LEVEL SECURITY;
