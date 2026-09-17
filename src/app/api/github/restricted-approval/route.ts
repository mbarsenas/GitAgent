import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.taskId || !body.humanActorId || !body.decision) return NextResponse.json({ ok: false, error: 'taskId, humanActorId, and decision are required.' }, { status: 400 });
    if (body.decision !== 'APPROVE' && body.decision !== 'REJECT') return NextResponse.json({ ok: false, error: 'decision must be APPROVE or REJECT.' }, { status: 400 });
    const task = await prisma.task.findUnique({ where: { id: body.taskId }, include: { approvals: true } });
    if (!task) return NextResponse.json({ ok: false, error: 'Task not found.' }, { status: 404 });
    const human = await prisma.user.findUnique({ where: { id: body.humanActorId } });
    if (!human) return NextResponse.json({ ok: false, error: 'Human actor not found.' }, { status: 403 });
    const approval = task.approvals.find((item) => item.action === 'restricted.execute' && item.status === 'PENDING');
    if (!approval) return NextResponse.json({ ok: false, error: 'No pending restricted execution approval found.' }, { status: 409 });
    const approved = body.decision === 'APPROVE';
    const updated = await prisma.approval.update({ where: { id: approval.id }, data: { status: approved ? 'APPROVED' : 'REJECTED', actorId: human.id, decidedAt: new Date(), reason: body.reason ?? null } });
    await prisma.task.update({ where: { id: task.id }, data: { status: approved ? 'QUEUED' : 'CANCELLED' } });
    await prisma.auditEvent.create({ data: { taskId: task.id, eventType: approved ? 'restricted.execution.approved' : 'restricted.execution.rejected', actorType: 'human', actorId: human.id, payload: { approvalId: updated.id, reason: body.reason ?? null, policyVersion: '2026-09-16.1' } } });
    return NextResponse.json({ ok: true, taskId: task.id, approvalId: updated.id, decision: approved ? 'APPROVED' : 'REJECTED', taskStatus: approved ? 'QUEUED' : 'CANCELLED', approvedByUserId: human.id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
