import { Injectable, Logger } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { NodeHandler, NodeContext } from './handler.interface';
import { DrizzleDB } from '../../../database/database.module';
import {
  contract,
  contractSystemItem,
  customer,
} from '../../../database/schema/business';

@Injectable()
export class AutoHandler implements NodeHandler {
  private readonly logger = new Logger(AutoHandler.name);

  async onEnter(ctx: NodeContext): Promise<void> {
    const config = ctx.nodeDef.config as Record<string, any> | null;
    const handlerName = config?.handler ?? 'NOOP';

    this.logger.log(
      `Auto node "${ctx.nodeDef.nodeKey}" executing handler: ${handlerName}` +
        ` (instance #${ctx.instance.id})`,
    );

    if (handlerName === 'generateContractNo') {
      await this.generateContractNo(ctx.db, ctx.instance.bizId);
    }
  }

  async onTaskAction(
    _ctx: NodeContext,
    _taskId: number,
    _action: string,
    _remark: string | null,
  ): Promise<boolean> {
    // Auto nodes have no tasks, this should never be called.
    return true;
  }

  async resolveCompletionEvent(_ctx: NodeContext): Promise<string> {
    return 'AUTO';
  }

  // ---------------------------------------------------------------------------
  // Service content code mapping
  // ---------------------------------------------------------------------------
  private static readonly SERVICE_CONTENT_CODES: Record<string, string> = {
    '等级保护测评': 'DBCP',
    '等保（综合）': 'DBZH',
    '安全咨询': 'AQZX',
    '渗透测试': 'STCS',
    '风险评估': 'FXPG',
    '其他': 'QT',
  };

  private getServiceContentCode(serviceContent: string | null): string {
    if (!serviceContent) return 'QT';
    return AutoHandler.SERVICE_CONTENT_CODES[serviceContent] ?? 'QT';
  }

  // ---------------------------------------------------------------------------
  // Contract number generation: YZDZR-{code}-{yy}-{seq:04d}
  // Per service content, per year, separate counters
  // ---------------------------------------------------------------------------
  private async generateContractNo(db: DrizzleDB, contractId: number) {
    // Get service content from contract
    const rows = await db
      .select({ serviceContent: contract.serviceContent })
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    const serviceContent = rows[0]?.serviceContent ?? null;
    const code = this.getServiceContentCode(serviceContent);
    const currentYear = new Date().getFullYear();
    const yearShort = String(currentYear).slice(-2);

    // UPSERT contract_serial with composite key (year + code)
    const seqResult = await db.execute(sql`
      INSERT INTO contract_serial (serial_year, service_content_code, next_seq)
      VALUES (${currentYear}, ${code}, 1)
      ON CONFLICT (serial_year, service_content_code)
      DO UPDATE SET next_seq = contract_serial.next_seq + 1,
                    updated_at = NOW()
      RETURNING next_seq
    `);

    const seq = (seqResult as any)[0]?.next_seq as number;
    const contractNo = `YZDZR-${code}-${yearShort}-${String(seq).padStart(4, '0')}`;

    // Build contract name
    const contractName = await this.buildContractName(db, contractId);

    await db
      .update(contract)
      .set({
        contractNo,
        contractName,
        updatedAt: new Date(),
      })
      .where(eq(contract.id, contractId));

    this.logger.log(
      `Generated contract number "${contractNo}" and name "${contractName}" for contract #${contractId}`,
    );
  }

  private async buildContractName(db: DrizzleDB, contractId: number): Promise<string> {
    // Get contract with customer name
    const rows = await db
      .select({
        customerId: contract.customerId,
        serviceYears: contract.serviceYears,
        customerName: customer.fullName,
      })
      .from(contract)
      .leftJoin(customer, eq(contract.customerId, customer.id))
      .where(eq(contract.id, contractId))
      .limit(1);

    const row = rows[0];
    if (!row) return '';

    const customerName = row.customerName ?? '';

    // Get system items
    const items = await db
      .select({
        systemName: contractSystemItem.systemName,
        systemLevel: contractSystemItem.systemLevel,
      })
      .from(contractSystemItem)
      .where(
        and(
          eq(contractSystemItem.contractId, contractId),
          eq(contractSystemItem.deleted, false),
        ),
      )
      .orderBy(contractSystemItem.sortOrder);

    // System display
    let systemDisplay = '';
    if (items.length <= 3) {
      systemDisplay = items.map((i) => i.systemName).join('、');
    } else {
      // Group by level and show level + count
      const levelMap = new Map<number, number>();
      for (const item of items) {
        levelMap.set(item.systemLevel, (levelMap.get(item.systemLevel) ?? 0) + 1);
      }
      const parts: string[] = [];
      for (const [level, cnt] of Array.from(levelMap.entries()).sort((a, b) => a[0] - b[0])) {
        parts.push(`${level}级${cnt}个`);
      }
      systemDisplay = parts.join('');
    }

    // Year display
    const serviceYears = (row.serviceYears ?? []) as number[];
    const yearDisplay = this.formatYearDisplay(serviceYears);

    return [customerName, systemDisplay, yearDisplay].filter(Boolean).join('-');
  }

  private formatYearDisplay(years: number[]): string {
    if (!years || years.length === 0) return '';

    const sorted = [...years].sort((a, b) => a - b);

    // Check if consecutive
    let isConsecutive = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        isConsecutive = false;
        break;
      }
    }

    return sorted.join('、');
  }
}
