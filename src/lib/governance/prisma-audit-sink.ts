import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type { AuditEventInput, AuditEventRecord, AuditSink } from './audit';

export class PrismaAuditSink implements AuditSink {
  async write(event: AuditEventInput): Promise<AuditEventRecord> {
    const payload: Prisma.InputJsonObject = {
      ...(event.repositoryId !== undefined ? { repositoryId: event.repositoryId } : {}),
      ...(event.policyVersion !== undefined ? { policyVersion: event.policyVersion } : {}),
      ...(event.reasonCode !== undefined ? { reasonCode: event.reasonCode } : {}),
      ...(event.severity !== undefined ? { severity: event.severity } : {}),
      metadata: event.metadata ?? {},
    };

    const row = await prisma.auditEvent.create({
      data: {
        taskId: event.taskId,
        executionId: event.executionId,
        eventType: event.eventType,
        actorType: event.actorType,
        actorId: event.actorId,
        payload,
      },
    });

    return {
      ...event,
      id: row.id,
      createdAt: row.createdAt,
    };
  }
}
