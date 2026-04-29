import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  contract,
  projectRegister,
  projectMember,
  projectSystemItem,
} from '../../database/schema/business';

interface WorkflowNodeCompletedEvent {
  bizType: string;
  bizId: number;
  instanceId: number;
  nodeKey: string;
  event: string;
  operatorId: number;
  extraData?: Record<string, any>;
}

@Injectable()
export class ProjectListener {
  private readonly logger = new Logger(ProjectListener.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('workflow.node.completed')
  async handleNodeCompleted(payload: WorkflowNodeCompletedEvent) {
    if (payload.bizType !== 'PROJECT_REGISTER') return;

    // ── DEPT_REVIEW (部门经理确认) ──
    // 部门经理通过/驳回 — 只确认，不分配人员
    if (payload.nodeKey === 'DEPT_REVIEW') {
      if (payload.event === 'REJECT') {
        this.logger.log(
          `Project #${payload.bizId} dept review rejected — updating status`,
        );
        await this.db
          .update(projectRegister)
          .set({ status: 'REJECTED', updatedAt: new Date() })
          .where(eq(projectRegister.id, payload.bizId));
      }
      // APPROVE: workflow moves to DIRECTOR_REVIEW; no business state change here
      return;
    }

    // ── DIRECTOR_REVIEW (项目主管审核并分配) ──
    if (payload.nodeKey === 'DIRECTOR_REVIEW') {
      if (payload.event === 'APPROVE') {
        this.logger.log(
          `Project #${payload.bizId} director review approved — updating status + assigning members`,
        );
        const pmUserId: number | undefined = payload.extraData?.pmUserId;
        const assessorUserIds: number[] =
          payload.extraData?.assessorUserIds ?? [];

        // Atomicity: status flip + system_no generation + PM/assessor
        // insertion MUST succeed together. Without this transaction a
        // partial failure (e.g. serial increment race, unique conflict)
        // would leave the project as APPROVED but with no members
        // assigned — undetectable from the UI.
        await this.db.transaction(async (tx) => {
          await tx
            .update(projectRegister)
            .set({ status: 'APPROVED', updatedAt: new Date() })
            .where(eq(projectRegister.id, payload.bizId));

          await this.generateSystemNumbers(tx, payload.bizId);

          // 幂等性保护: 事件可能被重复触发（EventEmitter 重投/重启等），
          // INSERT 前先 SELECT 检查是否已存在 ACTIVE 成员；存在则跳过，
          // 防止 DIRECTOR_REVIEW 被多次 APPROVE 时插入重复 project_member 行。
          // (project_member 表无唯一约束，必须代码层去重)
          const existingMembers = await tx
            .select({ userId: projectMember.userId, roleType: projectMember.roleType })
            .from(projectMember)
            .where(
              and(
                eq(projectMember.projectId, payload.bizId),
                eq(projectMember.status, 'ACTIVE'),
              ),
            );
          const existingKeys = new Set(
            existingMembers.map((m) => `${m.userId}:${m.roleType}`),
          );

          // Insert PM from extraData (from senior/middle assessor pool)
          if (pmUserId && !existingKeys.has(`${pmUserId}:PM`)) {
            this.logger.log(`Assigning PM #${pmUserId} to project #${payload.bizId}`);
            await tx.insert(projectMember).values({
              projectId: payload.bizId,
              userId: pmUserId,
              roleType: 'PM',
              assignedBy: payload.operatorId,
              assignedAt: new Date(),
            });
          }

          // Insert assessors from extraData (multi-select from all 3 levels)
          if (assessorUserIds.length > 0) {
            this.logger.log(
              `Assigning ${assessorUserIds.length} assessor(s) to project #${payload.bizId}`,
            );
            for (const userId of assessorUserIds) {
              // Skip duplicate if PM is also selected as assessor
              if (userId === pmUserId) continue;
              if (existingKeys.has(`${userId}:ASSESSOR`)) continue;
              await tx.insert(projectMember).values({
                projectId: payload.bizId,
                userId,
                roleType: 'ASSESSOR',
                assignedBy: payload.operatorId,
                assignedAt: new Date(),
              });
            }
          }
        });

        // 事务已 commit，emit 事件让 notification.listener 给新成员发
        // "你被指派为项目经理/测评师" 通知。事件与事务解耦，单独发送失败
        // 不会回滚已写入的 project_member。
        const assignments: { userId: number; roleType: 'PM' | 'ASSESSOR' }[] = [];
        if (pmUserId) assignments.push({ userId: pmUserId, roleType: 'PM' });
        for (const userId of assessorUserIds) {
          if (userId === pmUserId) continue;
          assignments.push({ userId, roleType: 'ASSESSOR' });
        }
        if (assignments.length > 0) {
          this.eventEmitter.emit('project.member.assigned', {
            projectId: payload.bizId,
            assignments,
            assignedBy: payload.operatorId,
          });
        }
      } else if (payload.event === 'REJECT') {
        this.logger.log(
          `Project #${payload.bizId} director review rejected — updating status`,
        );
        await this.db
          .update(projectRegister)
          .set({ status: 'REJECTED', updatedAt: new Date() })
          .where(eq(projectRegister.id, payload.bizId));
      }
    }
  }

  /**
   * Generate system_no for each system item of an approved project.
   * Format: {contractNo}-{yearShort}{seq:02d}   e.g. YZDZR-DBCP-26-0001-2601
   * Counter scope: (contract_id, year_short) — multiple project registrations
   * on the same contract/year share the same counter (no.02, 03, 04…).
   * Different years start from 01 again.
   *
   * Runs inside the caller's transaction (tx) so serial increments and
   * system_no writes either all commit or all roll back together.
   */
  private async generateSystemNumbers(
    tx: DrizzleDB,
    projectRegisterId: number,
  ): Promise<void> {
    // 1. Fetch contract info + contract year
    const projRows = await tx
      .select({
        contractId: projectRegister.contractId,
        contractYear: projectRegister.contractYear,
      })
      .from(projectRegister)
      .where(eq(projectRegister.id, projectRegisterId))
      .limit(1);
    const proj = projRows[0];
    if (!proj) return;

    const contractRows = await tx
      .select({ contractNo: contract.contractNo })
      .from(contract)
      .where(eq(contract.id, proj.contractId))
      .limit(1);
    const contractNo = contractRows[0]?.contractNo;
    if (!contractNo) {
      this.logger.warn(
        `Project #${projectRegisterId}: contract has no contract_no, skipping system_no generation`,
      );
      return;
    }

    // Use current calendar year (not the selected service year)
    const yearShort = String(new Date().getFullYear()).slice(-2);

    // 2. Fetch all system items (by sort_order) that don't yet have a system_no
    const items = await tx
      .select({
        id: projectSystemItem.id,
        sortOrder: projectSystemItem.sortOrder,
      })
      .from(projectSystemItem)
      .where(
        and(
          eq(projectSystemItem.projectRegisterId, projectRegisterId),
          eq(projectSystemItem.deleted, false),
        ),
      )
      .orderBy(projectSystemItem.sortOrder);

    if (items.length === 0) return;

    // 3. For each item, atomically bump counter and assign system_no
    for (const item of items) {
      // Atomic UPSERT increment (same pattern as contract_serial)
      const seqResult = await tx.execute(sql`
        INSERT INTO project_system_serial (contract_id, year_short, next_seq)
        VALUES (${proj.contractId}, ${yearShort}, 1)
        ON CONFLICT (contract_id, year_short)
        DO UPDATE SET next_seq = project_system_serial.next_seq + 1,
                      updated_at = NOW()
        RETURNING next_seq
      `);

      const seq = (seqResult as any)[0]?.next_seq as number;
      const systemNo = `${contractNo}-${yearShort}${String(seq).padStart(2, '0')}`;

      await tx
        .update(projectSystemItem)
        .set({ systemNo, updatedAt: new Date() })
        .where(eq(projectSystemItem.id, item.id));
    }

    this.logger.log(
      `Generated system_no for ${items.length} items of project #${projectRegisterId}`,
    );
  }
}
