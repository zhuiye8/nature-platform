import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
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

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
        await this.db
          .update(projectRegister)
          .set({ status: 'APPROVED', updatedAt: new Date() })
          .where(eq(projectRegister.id, payload.bizId));

        // Generate system_no for each project_system_item
        await this.generateSystemNumbers(payload.bizId);

        // Insert PM from extraData (from senior/middle assessor pool)
        const pmUserId: number | undefined = payload.extraData?.pmUserId;
        if (pmUserId) {
          this.logger.log(`Assigning PM #${pmUserId} to project #${payload.bizId}`);
          await this.db.insert(projectMember).values({
            projectId: payload.bizId,
            userId: pmUserId,
            roleType: 'PM',
            assignedBy: payload.operatorId,
            assignedAt: new Date(),
          });
        }

        // Insert assessors from extraData (multi-select from all 3 levels)
        const assessorUserIds: number[] =
          payload.extraData?.assessorUserIds ?? [];
        if (assessorUserIds.length > 0) {
          this.logger.log(
            `Assigning ${assessorUserIds.length} assessor(s) to project #${payload.bizId}`,
          );
          for (const userId of assessorUserIds) {
            // Skip duplicate if PM is also selected as assessor
            if (userId === pmUserId) continue;
            await this.db.insert(projectMember).values({
              projectId: payload.bizId,
              userId,
              roleType: 'ASSESSOR',
              assignedBy: payload.operatorId,
              assignedAt: new Date(),
            });
          }
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
   */
  private async generateSystemNumbers(projectRegisterId: number): Promise<void> {
    // 1. Fetch contract info + contract year
    const projRows = await this.db
      .select({
        contractId: projectRegister.contractId,
        contractYear: projectRegister.contractYear,
      })
      .from(projectRegister)
      .where(eq(projectRegister.id, projectRegisterId))
      .limit(1);
    const proj = projRows[0];
    if (!proj) return;

    const contractRows = await this.db
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
    const items = await this.db
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
      const seqResult = await this.db.execute(sql`
        INSERT INTO project_system_serial (contract_id, year_short, next_seq)
        VALUES (${proj.contractId}, ${yearShort}, 1)
        ON CONFLICT (contract_id, year_short)
        DO UPDATE SET next_seq = project_system_serial.next_seq + 1,
                      updated_at = NOW()
        RETURNING next_seq
      `);

      const seq = (seqResult as any)[0]?.next_seq as number;
      const systemNo = `${contractNo}-${yearShort}${String(seq).padStart(2, '0')}`;

      await this.db
        .update(projectSystemItem)
        .set({ systemNo, updatedAt: new Date() })
        .where(eq(projectSystemItem.id, item.id));
    }

    this.logger.log(
      `Generated system_no for ${items.length} items of project #${projectRegisterId}`,
    );
  }
}
