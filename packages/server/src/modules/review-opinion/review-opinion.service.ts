import { Inject, Injectable } from '@nestjs/common';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  reviewOpinion,
  reviewOpinionTemplate,
  type NewReviewOpinion,
} from '../../database/schema/review-opinion';
import { wfInstance } from '../../database/schema/workflow';
import { userAccount } from '../../database/schema/user';

export interface RecordOpinionDto {
  projectRegisterId: number;
  roundNo: number;
  nodeKey: string;
  slotKey?: string | null;
  actionType: string;
  opinionText?: string | null;
  attachmentIds?: number[] | null;
  operatorId: number;
}

@Injectable()
export class ReviewOpinionService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async recordOpinion(dto: RecordOpinionDto) {
    const values: NewReviewOpinion = {
      projectRegisterId: dto.projectRegisterId,
      roundNo: dto.roundNo,
      nodeKey: dto.nodeKey,
      slotKey: dto.slotKey ?? null,
      actionType: dto.actionType,
      opinionText: dto.opinionText ?? null,
      attachmentIds: dto.attachmentIds ?? null,
      operatorId: dto.operatorId,
    };
    const [row] = await this.db.insert(reviewOpinion).values(values).returning();
    return row;
  }

  async listByProject(projectRegisterId: number) {
    const rows = await this.db
      .select({
        id: reviewOpinion.id,
        projectRegisterId: reviewOpinion.projectRegisterId,
        roundNo: reviewOpinion.roundNo,
        nodeKey: reviewOpinion.nodeKey,
        slotKey: reviewOpinion.slotKey,
        actionType: reviewOpinion.actionType,
        opinionText: reviewOpinion.opinionText,
        attachmentIds: reviewOpinion.attachmentIds,
        operatorId: reviewOpinion.operatorId,
        operatorName: userAccount.displayName,
        createdAt: reviewOpinion.createdAt,
      })
      .from(reviewOpinion)
      .leftJoin(userAccount, eq(reviewOpinion.operatorId, userAccount.id))
      .where(eq(reviewOpinion.projectRegisterId, projectRegisterId))
      .orderBy(asc(reviewOpinion.roundNo), asc(reviewOpinion.createdAt));

    return rows;
  }

  async getCurrentRound(projectRegisterId: number): Promise<number> {
    const rows = await this.db
      .select({ roundNo: wfInstance.roundNo })
      .from(wfInstance)
      .where(
        and(
          eq(wfInstance.bizType, 'PROJECT_REGISTER'),
          eq(wfInstance.bizId, projectRegisterId),
        ),
      )
      .limit(1);

    return rows.length > 0 ? rows[0].roundNo : 1;
  }

  async getTemplates(
    nodeKey: string,
    slotKey?: string | null,
    actionType?: string,
  ) {
    const conditions = [eq(reviewOpinionTemplate.nodeKey, nodeKey)];

    if (slotKey) {
      conditions.push(eq(reviewOpinionTemplate.slotKey, slotKey));
    } else {
      conditions.push(isNull(reviewOpinionTemplate.slotKey));
    }

    if (actionType) {
      conditions.push(eq(reviewOpinionTemplate.actionType, actionType));
    }

    return this.db
      .select()
      .from(reviewOpinionTemplate)
      .where(and(...conditions))
      .orderBy(asc(reviewOpinionTemplate.sortOrder));
  }
}
