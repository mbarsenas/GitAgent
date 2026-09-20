import { prisma } from '@/lib/db/prisma';

export type AuditTimelineItem = {
  id: string;
  eventType: string;
  actorType: string;
  actorId: string | null;
  createdAt: Date;
  taskId: string | null;
  executionId: string | null;
  payload: unknown;
};

export async function listAuditTimeline(userId: string, limit = 50): Promise<AuditTimelineItem[]> {
  return prisma.auditEvent.findMany({
    where: { task: { repository: { userId } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      eventType: true,
      actorType: true,
      actorId: true,
      createdAt: true,
      taskId: true,
      executionId: true,
      payload: true,
    },
  });
}
