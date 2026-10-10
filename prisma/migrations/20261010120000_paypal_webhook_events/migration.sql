CREATE TABLE "exhibita"."PayPalWebhookEvent" (
    "id" UUID NOT NULL,
    "paypalEventId" VARCHAR(120) NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "resourceType" VARCHAR(80) NOT NULL,
    "resourceId" VARCHAR(120) NOT NULL,
    "paypalOrderId" VARCHAR(64),
    "orderId" UUID,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    CONSTRAINT "PayPalWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayPalWebhookEvent_paypalEventId_key"
  ON "exhibita"."PayPalWebhookEvent"("paypalEventId");
CREATE INDEX "PayPalWebhookEvent_orderId_occurredAt_recordedAt_idx"
  ON "exhibita"."PayPalWebhookEvent"("orderId", "occurredAt", "recordedAt");
ALTER TABLE "exhibita"."PayPalWebhookEvent" ADD CONSTRAINT "PayPalWebhookEvent_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "exhibita"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "exhibita"."EvidenceEvent" DROP CONSTRAINT "EvidenceEvent_source";
ALTER TABLE "exhibita"."EvidenceEvent" ADD CONSTRAINT "EvidenceEvent_source" CHECK (
    "source" IN ('AGENT_MODEL', 'DEMO_STORE', 'EXHIBITA_TOOL', 'PAYPAL')
);
ALTER TABLE "exhibita"."EvidenceEvent" DROP CONSTRAINT "EvidenceEvent_kind";
ALTER TABLE "exhibita"."EvidenceEvent" ADD CONSTRAINT "EvidenceEvent_kind" CHECK (
    "kind" IN ('TOOL_REQUEST', 'TOOL_RESULT', 'PAYPAL_WEBHOOK')
);

REVOKE ALL ON TABLE "exhibita"."PayPalWebhookEvent" FROM PUBLIC, anon, authenticated;
ALTER TABLE "exhibita"."PayPalWebhookEvent" ENABLE ROW LEVEL SECURITY;
