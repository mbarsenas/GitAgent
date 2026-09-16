import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type { AuditEventInput, AuditEventRecord, AuditSink } from './audit';

export class PrismaAuditSink implements AuditSink {
  async write(event: AuditEventInput): Promise<AuditEventRecord> {
    const row = await prisma.auditEvent.create({
      data: {
        taskId: event.taskId,
        executionId: event.executionId,
        eventType: event.eventType,
        actorType: event.actorType,
        actorId: event.actorId,
        payload: {
          repositoryId: event.repositoryId,
          policyVersion: event.policyVersion,
          reasonCode: event.reasonCode,
          severity: event.severity,
          metadata: event.metadata ?? {},
        } satisfies Prisma.InputJsonValue,
      },
    });

    return {
      ...event,
      id: row.id,
      createdAt: row.createdAt,
    };
  }
}
