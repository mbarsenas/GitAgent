import { PrismaAuditSink } from './prisma-audit-sink';
import { enforceCapability, type EnforcementRequest } from './enforcement';

const auditSink = new PrismaAuditSink();

export async function enforcePersistedCapability(request: EnforcementRequest) {
  return enforceCapability(request, auditSink);
}
