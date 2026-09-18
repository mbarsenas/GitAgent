import type { Prisma } from "@prisma/client";

export type AuditActorType = "human" | "implementation-agent" | "review-agent" | "policy-engine" | "system";

export type AuditEventInput = {
  eventType: string;
  actorType: AuditActorType;
  actorId: string;
  repositoryId?: string;
  taskId?: string;
  executionId?: string;
  policyVersion?: string;
  reasonCode?: string;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  metadata?: Prisma.InputJsonObject;
};

export type AuditEventRecord = AuditEventInput & {
  id: string;
  createdAt: Date;
};

export interface AuditSink {
  write(event: AuditEventInput): Promise<AuditEventRecord>;
}

export class InMemoryAuditSink implements AuditSink {
  private readonly events: AuditEventRecord[] = [];

  async write(event: AuditEventInput): Promise<AuditEventRecord> {
    const record: AuditEventRecord = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    this.events.push(record);
    return record;
  }

  list(): readonly AuditEventRecord[] {
    return this.events;
  }
}
