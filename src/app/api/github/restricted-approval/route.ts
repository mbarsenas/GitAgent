import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if ((!body.approvalId && !body.taskId) || !body.humanActorId || !body.decision) return NextResponse.json({ ok: false, error: 'approvalId (or taskId), humanActorId, and decision are required.' }, { status: 400 });
    if (body.decision !== 'APPROVE' && body.decision !== 'REJECT') return NextResponse.json({ ok: false, error: 'decision must be APPROVE or REJECT.' }, { status: 400 });
    const human = await prisma.user.findUnique({ where: { id: body.humanActorId } });
    if (!human) return NextResponse.json({ ok: false, error: 'Human actor not found.' }, { status: 403 });
    const approval = body.approvalId
      ? await prisma.approval.findUnique({ where: { id: body.approvalId }, include: { task: true } })
      : await prisma.approval.findFirst({ where: { taskId: body.taskId, action: 'restricted.execute', status: 'PENDING' }, include: { task: true }, orderBy: { requestedAt: 'desc' } });
    if (!approval) return NextResponse.json({ ok: false, error: 'Restricted execution approval not found.' }, { status: 404 });
    if (approval.action !== 'restricted.execute') return NextResponse.json({ ok: false, error: 'Approval is not for restricted execution.' }, { status: 409 });
    if (approval.status !== 'PENDING') return NextResponse.json({ ok: false, error: `Approval has already been decided: ${approval.status}.` }, { status: 409 });
    if (body.taskId && approval.taskId !== body.taskId) return NextResponse.json({ ok: false, error: 'approvalId does not belong to taskId.' }, { status: 409 });
    const approved = body.decision === 'APPROVE';
    const updated = await prisma.approval.update({ where: { id: approval.id }, data: { status: approved ? 'APPROVED' : 'REJECTED', actorId: human.id, decidedAt: new Date(), reason: body.reason ?? null } });
    await prisma.task.update({ where: { id: approval.taskId }, data: { status: approved ? 'QUEUED' : 'CANCELLED' } });
    await prisma.auditEvent.create({ data: { taskId: approval.taskId, eventType: approved ? 'restricted.execution.approved' : 'restricted.execution.rejected', actorType: 'human', actorId: human.id, payload: { approvalId: updated.id, reason: body.reason ?? null, policyVersion: '2026-09-16.1' } } });
    return NextResponse.json({ ok: true, taskId: approval.taskId, approvalId: updated.id, decision: approved ? 'APPROVED' : 'REJECTED', taskStatus: approved ? 'QUEUED' : 'CANCELLED', approvedByUserId: human.id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
