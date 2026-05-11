import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, and, or, ne, desc, isNull, inArray, count } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  wfDefinition,
  wfNode,
  wfInstance,
  wfTask,
  wfActionLog,
  wfTransition,
  wfAssignmentRule,
} from '../../database/schema/workflow';
import { contract, contractGroup, projectRegister, projectMember } from '../../database/schema/business';
import { reviewOpinion } from '../../database/schema/review-opinion';
import { compileReportFile } from '../../database/schema/assessment-file';
import { userRole } from '../../database/schema/iam';
import { NodeHandler, NodeContext } from './handlers/handler.interface';
import { SimpleHandler } from './handlers/simple.handler';
import { ReviewHandler } from './handlers/review.handler';
import { ParallelReviewHandler } from './handlers/parallel-review.handler';
import { MultiAssigneeHandler } from './handlers/multi-assignee.handler';
import { AutoHandler } from './handlers/auto.handler';
import { TransitionResolver } from './transition.resolver';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  private readonly handlers: Map<string, NodeHandler>;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly transitionResolver: TransitionResolver,
    private readonly eventEmitter: EventEmitter2,
    simpleHandler: SimpleHandler,
    reviewHandler: ReviewHandler,
    parallelReviewHandler: ParallelReviewHandler,
    multiAssigneeHandler: MultiAssigneeHandler,
    autoHandler: AutoHandler,
  ) {
    this.handlers = new Map<string, NodeHandler>([
      ['SIMPLE', simpleHandler],
      ['REVIEW', reviewHandler],
      ['PARALLEL_REVIEW', parallelReviewHandler],
      ['MULTI_ASSIGNEE', multiAssigneeHandler],
      ['AUTO', autoHandler],
    ]);
  }

  // ---------------------------------------------------------------------------
  // Start a new workflow instance
  // ---------------------------------------------------------------------------
  async startInstance(
    defKey: string,
    bizType: string,
    bizId: number,
    startedBy: number,
    variables?: Record<string, any>,
  ) {
    return this.db.transaction(async (tx) => {
      // 1. Find active definition
      const defs = await tx
        .select()
        .from(wfDefinition)
        .where(
          and(
            eq(wfDefinition.defKey, defKey),
            eq(wfDefinition.status, 'ACTIVE'),
          ),
        )
        .orderBy(desc(wfDefinition.version))
        .limit(1);

      const def = defs[0];
      if (!def) {
        throw new NotFoundException(
          `No active workflow definition found for key "${defKey}"`,
        );
      }

      // 2. Find the first node via the START transition (from_node_key = '')
      const startTransitions = await tx
        .select()
        .from(wfTransition)
        .where(
          and(
            eq(wfTransition.definitionId, def.id),
            eq(wfTransition.fromNodeKey, ''),
          ),
        )
        .orderBy(desc(wfTransition.priority))
        .limit(1);

      const startTransition = startTransitions[0];
      if (!startTransition) {
        throw new BadRequestException(
          `Definition "${defKey}" has no start transition (from_node_key = "")`,
        );
      }

      const firstNodeKey = startTransition.toNodeKey;

      // 3. Create instance
      const instances = await tx
        .insert(wfInstance)
        .values({
          definitionId: def.id,
          bizType,
          bizId,
          currentNode: firstNodeKey,
          status: 'RUNNING',
          startedBy,
          variables: variables ?? null,
        })
        .returning();

      const instance = instances[0];

      // 4. Get first node definition
      const nodeDef = await this.loadNodeDef(tx, def.id, firstNodeKey);

      // 5. Get handler and enter node
      const handler = this.getHandler(nodeDef.nodeType);
      const ctx: NodeContext = {
        db: tx as unknown as DrizzleDB,
        instance,
        nodeDef,
        currentUserId: startedBy,
      };

      await handler.onEnter(ctx);

      // 5b. Emit task.created events for newly created tasks
      await this.emitTaskCreatedEvents(
        tx as unknown as DrizzleDB,
        instance,
        nodeDef,
      );

      // 6. Log START action
      await tx.insert(wfActionLog).values({
        instanceId: instance.id,
        nodeKey: firstNodeKey,
        action: 'START',
        fromNode: '',
        toNode: firstNodeKey,
        operatorId: startedBy,
      });

      // 7. If auto node, immediately advance
      if (nodeDef.nodeType === 'AUTO') {
        await this.advanceFromAutoNode(tx as unknown as DrizzleDB, instance, nodeDef, startedBy);
      }

      // Return fresh instance
      const result = await tx
        .select()
        .from(wfInstance)
        .where(eq(wfInstance.id, instance.id))
        .limit(1);

      return result[0];
    });
  }

  // ---------------------------------------------------------------------------
  // Update instance variables (shallow merge)
  //
  // Used by business layer to inject fresh context before signaling a resume.
  // Example: project.service re-queries contract archiveStatus before
  // re-submitting a rejected project registration, then patches the workflow
  // variables so that ReviewHandler.onEnter picks up the latest reviewer role.
  // ---------------------------------------------------------------------------
  async updateVariables(
    instanceId: number,
    patch: Record<string, any>,
  ): Promise<void> {
    const rows = await this.db
      .select({ variables: wfInstance.variables })
      .from(wfInstance)
      .where(eq(wfInstance.id, instanceId))
      .limit(1);

    if (!rows[0]) {
      throw new NotFoundException(`Instance #${instanceId} not found`);
    }

    const currentVars =
      (rows[0].variables as Record<string, any> | null) ?? {};

    await this.db
      .update(wfInstance)
      .set({
        variables: { ...currentVars, ...patch },
        updatedAt: new Date(),
      })
      .where(eq(wfInstance.id, instanceId));
  }

  // ---------------------------------------------------------------------------
  // Signal: perform a task action
  // ---------------------------------------------------------------------------
  async signal(
    instanceId: number,
    taskId: number,
    action: string,
    remark: string | null,
    operatorId: number,
    extraData?: Record<string, any>,
  ) {
    return this.db.transaction(async (tx) => {
      const txDb = tx as unknown as DrizzleDB;

      // 1. Load instance
      const instances = await tx
        .select()
        .from(wfInstance)
        .where(eq(wfInstance.id, instanceId))
        .limit(1);

      const instance = instances[0];
      if (!instance) {
        throw new NotFoundException(`Instance #${instanceId} not found`);
      }
      if (instance.status !== 'RUNNING') {
        throw new BadRequestException(
          `Instance #${instanceId} is not running (status: ${instance.status})`,
        );
      }

      // 2. Load task
      const tasks = await tx
        .select()
        .from(wfTask)
        .where(eq(wfTask.id, taskId))
        .limit(1);

      const task = tasks[0];
      if (!task) {
        throw new NotFoundException(`Task #${taskId} not found`);
      }
      if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') {
        throw new BadRequestException(
          `Task #${taskId} cannot be actioned (status: ${task.status})`,
        );
      }
      // 3. Load current node definition (before assignee check, need node type)
      const nodeDef = await this.loadNodeDef(
        tx,
        instance.definitionId,
        instance.currentNode,
      );

      // Assignee check:
      // - SIMPLE/AUTO nodes: skip check (business operations, any authorized user can signal)
      // - REVIEW/PARALLEL_REVIEW: strict check (only assignee or super_admin)
      // - assigneeId null: allow anyone
      const isStrictNode = ['REVIEW', 'PARALLEL_REVIEW'].includes(nodeDef.nodeType);
      if (isStrictNode && task.assigneeId && task.assigneeId !== operatorId) {
        const adminRoles = await tx
          .select()
          .from(userRole)
          .where(
            and(
              eq(userRole.userId, operatorId),
              eq(userRole.roleCode, 'super_admin'),
            ),
          )
          .limit(1);
        if (adminRoles.length === 0) {
          throw new BadRequestException(
            `Task #${taskId} is not assigned to user #${operatorId}`,
          );
        }
      }

      // 4. Get handler
      const handler = this.getHandler(nodeDef.nodeType);
      const ctx: NodeContext = {
        db: txDb,
        instance,
        nodeDef,
        currentUserId: operatorId,
      };

      // 4b. REPORT_COMPILE APPROVE: require compile report file uploaded
      if (
        instance.currentNode === 'REPORT_COMPILE' &&
        action === 'APPROVE' &&
        instance.bizType === 'PROJECT_REGISTER'
      ) {
        const files = await tx
          .select({ id: compileReportFile.id })
          .from(compileReportFile)
          .where(
            and(
              eq(compileReportFile.projectRegisterId, instance.bizId),
              isNull(compileReportFile.deletedAt),
            ),
          )
          .limit(1);
        if (files.length === 0) {
          throw new BadRequestException('请先上传编制报告后再提交');
        }
      }

      // 5. Execute task action
      const isNodeComplete = await handler.onTaskAction(
        ctx,
        taskId,
        action,
        remark,
      );

      // 6. Log action
      await tx.insert(wfActionLog).values({
        instanceId: instance.id,
        taskId,
        nodeKey: instance.currentNode,
        action,
        operatorId,
        remark,
      });

      // 6b. Record review opinion if opinionText provided
      if (extraData?.opinionText && instance.bizType === 'PROJECT_REGISTER') {
        await tx.insert(reviewOpinion).values({
          projectRegisterId: instance.bizId,
          roundNo: instance.roundNo,
          nodeKey: instance.currentNode,
          slotKey: task.slotKey ?? null,
          actionType: action,
          opinionText: extraData.opinionText,
          attachmentIds: extraData.attachmentIds ?? null,
          operatorId,
        });
      }

      // 7. If node is not complete, return early
      if (!isNodeComplete) {
        // FINAL_REVIEW REVIEW: roll back to REPORT_COMPILE (report needs revision, not assessment)
        if (instance.currentNode === 'FINAL_REVIEW' && action === 'REVIEW') {
          // Cancel the PENDING_RECTIFICATION task (set by handler)
          await tx
            .update(wfTask)
            .set({ status: 'CANCELLED', updatedAt: new Date() })
            .where(
              and(
                eq(wfTask.instanceId, instance.id),
                eq(wfTask.nodeKey, 'FINAL_REVIEW'),
                eq(wfTask.status, 'PENDING_RECTIFICATION'),
              ),
            );

          // Roll back to REPORT_COMPILE
          const targetNode = 'REPORT_COMPILE';
          await tx
            .update(wfInstance)
            .set({ currentNode: targetNode, updatedAt: new Date() })
            .where(eq(wfInstance.id, instance.id));

          // Create new REPORT_COMPILE task
          const compileNodeDef = await this.loadNodeDef(tx, instance.definitionId, targetNode);
          const compileHandler = this.getHandler(compileNodeDef.nodeType);
          const refreshed = await this.loadInstance(tx, instance.id);
          const compileCtx: NodeContext = {
            db: txDb,
            instance: refreshed,
            nodeDef: compileNodeDef,
            currentUserId: operatorId,
          };
          await compileHandler.onEnter(compileCtx);

          // ──────────────────────────────────────────────────────────────────
          // 修复: 把新建的 REPORT_COMPILE task 的 assignee 改回"原编制人"。
          //
          // compileHandler.onEnter 走规则表 (assignment.service.resolveAssignee)
          // 会选 sort_order 最小的 report_writer 用户 — 固定回到同一个人
          // (实际是 luyuxin)。但业务本意是"让原编制人修改报告"，原编制人
          // 已在 REPORT_ASSIGN 阶段写入 project_member (roleType='REPORT_WRITER')。
          // 这里读出来覆盖 assignee，保证复核后任务仍分配给原编制人。
          // 若 project_member 里没有 REPORT_WRITER (异常情况)，保留
          // onEnter 的规则表默认分配作为兜底，避免 task 无人领。
          // ──────────────────────────────────────────────────────────────────
          if (instance.bizType === 'PROJECT_REGISTER') {
            const writerRows = await tx
              .select({ userId: projectMember.userId })
              .from(projectMember)
              .where(
                and(
                  eq(projectMember.projectId, instance.bizId),
                  eq(projectMember.roleType, 'REPORT_WRITER'),
                  eq(projectMember.status, 'ACTIVE'),
                ),
              )
              .limit(1);

            if (writerRows.length > 0) {
              await tx
                .update(wfTask)
                .set({ assigneeId: writerRows[0].userId })
                .where(
                  and(
                    eq(wfTask.instanceId, instance.id),
                    eq(wfTask.nodeKey, 'REPORT_COMPILE'),
                    eq(wfTask.status, 'PENDING'),
                  ),
                );
              this.logger.log(
                `FINAL_REVIEW REVIEW: restored REPORT_COMPILE assignee to original writer #${writerRows[0].userId} (project #${instance.bizId})`,
              );
            } else {
              this.logger.warn(
                `FINAL_REVIEW REVIEW: no REPORT_WRITER in project_member for project #${instance.bizId}, keeping rule-table default assignee`,
              );
            }
          }

          // Emit task.created for notification
          await this.emitTaskCreatedEvents(txDb, refreshed, compileNodeDef);

          // Log
          await tx.insert(wfActionLog).values({
            instanceId: instance.id,
            nodeKey: 'FINAL_REVIEW',
            action: 'REVIEW_TO_COMPILE',
            fromNode: 'FINAL_REVIEW',
            toNode: targetNode,
            operatorId,
            remark,
          });

          this.logger.log(
            `Instance #${instance.id} FINAL_REVIEW reviewed, rolled back to REPORT_COMPILE`,
          );

          // Emit event for notification listener
          this.eventEmitter.emit('workflow.task.review', {
            instanceId: instance.id,
            taskId,
            nodeKey: instance.currentNode,
            bizType: instance.bizType,
            bizId: instance.bizId,
            operatorId,
            remark,
          });

          return this.loadInstance(tx, instanceId);
        }

        // Other REVIEW actions: notify PM for rectification
        if (action === 'REVIEW') {
          this.eventEmitter.emit('workflow.task.review', {
            instanceId: instance.id,
            taskId,
            nodeKey: instance.currentNode,
            bizType: instance.bizType,
            bizId: instance.bizId,
            operatorId,
            remark,
          });
        }
        return this.loadInstance(tx, instanceId);
      }

      // 8. Node is complete — resolve transition and advance
      const event = await handler.resolveCompletionEvent(ctx);

      // FINAL_REVIEW REJECT 由 assessment.listener.ts 处理（调 rejectToAssessment 跳到 ON_SITE_ASSESSMENT）。
      // 这里只 emit 事件让 listener 接管，不能走 advanceToNextNode —— transition 表里
      // FINAL_REVIEW 没有 REJECT 路径，调 advanceToNextNode 会把 instance 标为 COMPLETED 退出流程。
      if (instance.currentNode === 'FINAL_REVIEW' && event === 'REJECT') {
        this.eventEmitter.emit('workflow.node.completed', {
          bizType: instance.bizType,
          bizId: instance.bizId,
          instanceId: instance.id,
          nodeKey: instance.currentNode,
          event,
          operatorId,
          remark,
          extraData,
        });
        return this.loadInstance(tx, instanceId);
      }

      // 把 signal(remark) 入参一路传给 advanceToNextNode → emit 'workflow.node.completed'
      // 让 notification.listener 能拿到审核意见拼接到通知 content
      await this.advanceToNextNode(txDb, instance, nodeDef, event, operatorId, remark, extraData);

      return this.loadInstance(tx, instanceId);
    });
  }

  // ---------------------------------------------------------------------------
  // My tasks
  // ---------------------------------------------------------------------------
  // Nodes that should NOT appear in the todo center (user initiates via business page)
  private readonly HIDDEN_NODES = new Set([
    'CONTRACT_CREATE',
    'PROJECT_REGISTER',
  ]);

  async getMyTasks(userId: number, status?: string) {
    const taskStatus = status || 'PENDING';

    // Get user's role codes for pool task matching
    const userRoles = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, userId));
    const roleCodes = userRoles.map((r) => r.roleCode);
    const isSuperAdmin = roleCodes.includes('super_admin');

    // Get pool-eligible node keys based on user's roles
    // chairman 不在任何 wf_assignment_rule 中 → poolNodeKeys=[] → 只看 assigneeId=自己的任务
    // (chairman 全只读: 业务列表能看全部, 但待办中心只看真分配给他的, 避免被无关任务淹没)
    let poolNodeKeys: string[] = [];
    if (!isSuperAdmin && roleCodes.length > 0) {
      const poolRules = await this.db
        .select({ nodeKey: wfAssignmentRule.nodeKey })
        .from(wfAssignmentRule)
        .where(inArray(wfAssignmentRule.roleCode, roleCodes));
      poolNodeKeys = [...new Set(poolRules.map((r) => r.nodeKey))];
    }

    // PENDING 任务 visibility: assigneeId 匹配 OR 池任务 + 角色匹配
    const pendingVisibility = isSuperAdmin
      ? or(eq(wfTask.assigneeId, userId), isNull(wfTask.assigneeId))!
      : poolNodeKeys.length > 0
        ? or(
            eq(wfTask.assigneeId, userId),
            and(isNull(wfTask.assigneeId), inArray(wfTask.nodeKey, poolNodeKeys)),
          )!
        : eq(wfTask.assigneeId, userId);

    const pendingClause = and(eq(wfTask.status, 'PENDING'), pendingVisibility)!;

    // PENDING_RECTIFICATION 任务: 仅 PM 看自己项目的整改任务
    // (待整改任务的 task.assigneeId 是审核人, 不是 PM, 所以要按 wf_instance.bizId 反查 PM)
    let rectificationClause: ReturnType<typeof and> | null = null;
    if (taskStatus === 'PENDING') {
      const pmProjects = await this.db
        .select({ projectId: projectMember.projectId })
        .from(projectMember)
        .where(
          and(
            eq(projectMember.userId, userId),
            eq(projectMember.roleType, 'PM'),
            eq(projectMember.status, 'ACTIVE'),
          ),
        );
      const pmProjectIds = pmProjects.map((p) => p.projectId);
      if (pmProjectIds.length > 0) {
        const pmInstances = await this.db
          .select({ id: wfInstance.id })
          .from(wfInstance)
          .where(
            and(
              eq(wfInstance.bizType, 'PROJECT_REGISTER'),
              inArray(wfInstance.bizId, pmProjectIds),
            ),
          );
        const pmInstanceIds = pmInstances.map((i) => i.id);
        if (pmInstanceIds.length > 0) {
          rectificationClause = and(
            eq(wfTask.status, 'PENDING_RECTIFICATION'),
            inArray(wfTask.instanceId, pmInstanceIds),
          );
        }
      }
    }

    // Final WHERE:
    //   PENDING + visibility   OR   PENDING_RECTIFICATION + PM 项目 (如有)
    // 非 PENDING 查询 (e.g. 历史) 走原 statusFilter
    const conditions = [
      taskStatus === 'PENDING'
        ? rectificationClause
          ? or(pendingClause, rectificationClause)!
          : pendingClause
        : and(eq(wfTask.status, taskStatus), pendingVisibility)!,
    ];

    const rows = await this.db
      .select({
        id: wfTask.id,
        instanceId: wfTask.instanceId,
        nodeKey: wfTask.nodeKey,
        slotKey: wfTask.slotKey,
        assigneeId: wfTask.assigneeId,
        status: wfTask.status,
        result: wfTask.result,
        remark: wfTask.remark,
        createdAt: wfTask.createdAt,
        bizType: wfInstance.bizType,
        bizId: wfInstance.bizId,
        currentNode: wfInstance.currentNode,
        variables: wfInstance.variables,
      })
      .from(wfTask)
      .innerJoin(wfInstance, eq(wfTask.instanceId, wfInstance.id))
      .where(and(...conditions))
      .orderBy(wfTask.createdAt);

    // ── Pool role filter ──────────────────────────────────────────────
    // For variable-driven pool nodes the same nodeKey can be shared by
    // multiple roles (CONTRACT_REVIEW — reviewer role picked at
    // submit-time via variables.reviewerRoleCode). The SQL above returns
    // ALL pool tasks where the user's role appears in wf_assignment_rule
    // for that nodeKey, but we must further narrow: only show pool tasks
    // whose variables.reviewerRoleCode matches one of the current user's
    // roles.
    //
    // DEPT_REVIEW / DIRECTOR_REVIEW use a hardcoded role mapping in
    // review.handler.ts (NODE_POOL_ROLE) rather than variables, so they
    // don't need this filter.
    const POOL_FILTERED_NODES = new Set(['CONTRACT_REVIEW']);

    const filteredRows = isSuperAdmin
      ? rows
      : rows.filter((row) => {
          // Single-assign tasks (assigneeId set) always pass — the SQL
          // already ensured assigneeId === userId.
          if (row.assigneeId !== null) return true;

          // Only filter pool tasks on variable-driven nodes
          if (!POOL_FILTERED_NODES.has(row.nodeKey)) return true;

          const vars = (row.variables as Record<string, any>) || {};
          const targetRole = vars.reviewerRoleCode as string | undefined;

          // No target role in variables → legacy task, let it through
          if (!targetRole) return true;

          // Check if the current user actually has the target role
          return roleCodes.includes(targetRole);
        });

    // Enrich with node display name, node type, and business name
    const enriched = await Promise.all(
      filteredRows
        .filter((row) => !this.HIDDEN_NODES.has(row.nodeKey))
        .map(async (row) => {
          // Get node display name + node type
          const nodeDefs = await this.db
            .select({
              nodeName: wfNode.nodeName,
              nodeType: wfNode.nodeType,
            })
            .from(wfNode)
            .innerJoin(wfDefinition, eq(wfNode.definitionId, wfDefinition.id))
            .innerJoin(wfInstance, eq(wfInstance.definitionId, wfDefinition.id))
            .where(
              and(
                eq(wfInstance.bizType, row.bizType),
                eq(wfInstance.bizId, row.bizId),
                eq(wfNode.nodeKey, row.nodeKey),
              ),
            )
            .limit(1);

          // Get business name based on bizType
          //
          // For contracts we prefer the group-scoped label "合同组名称(合同分类)"
          // because the individual contractName / contractNo may be empty or
          // look cryptic to a dept_manager reviewing the task. Fallbacks are
          // applied in order: group+category → group only → contractName → id.
          let bizName = '';
          if (row.bizType === 'CONTRACT') {
            const contracts = await this.db
              .select({
                contractName: contract.contractName,
                contractCategory: contract.contractCategory,
                groupName: contractGroup.groupName,
              })
              .from(contract)
              .leftJoin(
                contractGroup,
                eq(contract.groupId, contractGroup.id),
              )
              .where(eq(contract.id, row.bizId))
              .limit(1);

            const c = contracts[0];
            if (c?.groupName && c.contractCategory) {
              bizName = `${c.groupName}(${c.contractCategory})`;
            } else if (c?.groupName) {
              bizName = c.groupName;
            } else if (c?.contractName) {
              bizName = c.contractName;
            } else {
              bizName = `合同 #${row.bizId}`;
            }
          } else if (row.bizType === 'PROJECT_REGISTER') {
            const projects = await this.db
              .select({ applicationName: projectRegister.applicationName })
              .from(projectRegister)
              .where(eq(projectRegister.id, row.bizId))
              .limit(1);
            bizName = projects[0]?.applicationName ?? '';
          }

          return {
            ...row,
            nodeName: nodeDefs[0]?.nodeName ?? row.nodeKey,
            nodeType: nodeDefs[0]?.nodeType ?? 'SIMPLE',
            bizName,
          };
        }),
    );

    return enriched;
  }

  async getMyTaskCount(userId: number) {
    const result = await this.db
      .select({ total: count() })
      .from(wfTask)
      .where(and(eq(wfTask.assigneeId, userId), eq(wfTask.status, 'PENDING')));
    return result[0]?.total ?? 0;
  }

  async getInstanceByBiz(bizType: string, bizId: number) {
    // 同一业务对象理论上只应有一条实例；若历史数据出现重复，
    // 优先返回最新创建的（id 最大）那条，避免旧的 COMPLETED 实例误导业务判断
    const instances = await this.db
      .select()
      .from(wfInstance)
      .where(and(eq(wfInstance.bizType, bizType), eq(wfInstance.bizId, bizId)))
      .orderBy(desc(wfInstance.id))
      .limit(1);
    const instance = instances[0];
    if (!instance) return null;

    const [tasks, logs] = await Promise.all([
      this.db.select().from(wfTask).where(eq(wfTask.instanceId, instance.id)),
      this.db
        .select()
        .from(wfActionLog)
        .where(eq(wfActionLog.instanceId, instance.id))
        .orderBy(wfActionLog.createdAt),
    ]);
    return { instance, tasks, logs };
  }

  // ---------------------------------------------------------------------------
  // Task detail (single task + its instance context)
  // ---------------------------------------------------------------------------
  async getTaskDetail(taskId: number) {
    const taskRows = await this.db
      .select()
      .from(wfTask)
      .where(eq(wfTask.id, taskId));

    if (taskRows.length === 0) {
      throw new NotFoundException(`Task #${taskId} not found`);
    }

    const task = taskRows[0];
    const instanceDetail = await this.getInstanceDetail(task.instanceId);

    // Get node name
    const nodeRows = await this.db
      .select({ nodeName: wfNode.nodeName })
      .from(wfNode)
      .where(
        and(
          eq(wfNode.definitionId, instanceDetail.instance.definitionId),
          eq(wfNode.nodeKey, task.nodeKey),
        ),
      );

    return {
      ...task,
      nodeName: nodeRows[0]?.nodeName ?? task.nodeKey,
      instance: instanceDetail,
    };
  }

  // ---------------------------------------------------------------------------
  // Instance detail
  // ---------------------------------------------------------------------------
  async getInstanceDetail(instanceId: number) {
    const instances = await this.db
      .select()
      .from(wfInstance)
      .where(eq(wfInstance.id, instanceId))
      .limit(1);

    const instance = instances[0];
    if (!instance) {
      throw new NotFoundException(`Instance #${instanceId} not found`);
    }

    const [tasks, logs] = await Promise.all([
      this.db
        .select()
        .from(wfTask)
        .where(eq(wfTask.instanceId, instanceId)),
      this.db
        .select()
        .from(wfActionLog)
        .where(eq(wfActionLog.instanceId, instanceId))
        .orderBy(wfActionLog.createdAt),
    ]);

    return { instance, tasks, logs };
  }

  // ---------------------------------------------------------------------------
  // Resubmit from rectification — PM resets PENDING_RECTIFICATION tasks to PENDING
  // ---------------------------------------------------------------------------
  async resubmitFromRectification(instanceId: number, userId: number) {
    return this.db.transaction(async (tx) => {
      // 1. Load instance
      const instances = await tx
        .select()
        .from(wfInstance)
        .where(eq(wfInstance.id, instanceId))
        .limit(1);

      const instance = instances[0];
      if (!instance) {
        throw new NotFoundException(`Instance #${instanceId} not found`);
      }
      if (instance.status !== 'RUNNING') {
        throw new BadRequestException(`Instance #${instanceId} is not running`);
      }

      // 2. Find all PENDING_RECTIFICATION tasks for the current node
      const rectTasks = await tx
        .select()
        .from(wfTask)
        .where(
          and(
            eq(wfTask.instanceId, instanceId),
            eq(wfTask.nodeKey, instance.currentNode),
            eq(wfTask.status, 'PENDING_RECTIFICATION'),
          ),
        );

      if (rectTasks.length === 0) {
        throw new BadRequestException(
          'No tasks in PENDING_RECTIFICATION status for current node',
        );
      }

      // 3. Reset all to PENDING
      await tx
        .update(wfTask)
        .set({
          status: 'PENDING',
          result: null,
          remark: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(wfTask.instanceId, instanceId),
            eq(wfTask.nodeKey, instance.currentNode),
            eq(wfTask.status, 'PENDING_RECTIFICATION'),
          ),
        );

      // 4. Log RESUBMIT action
      await tx.insert(wfActionLog).values({
        instanceId,
        nodeKey: instance.currentNode,
        action: 'RESUBMIT',
        operatorId: userId,
        remark: '项目经理重新提交整改',
      });

      // 5. Emit event for notifications
      this.eventEmitter.emit('workflow.task.resubmitted', {
        instanceId,
        nodeKey: instance.currentNode,
        bizType: instance.bizType,
        bizId: instance.bizId,
        operatorId: userId,
        taskIds: rectTasks.map((t) => t.id),
        assigneeIds: rectTasks
          .map((t) => t.assigneeId)
          .filter((id): id is number => id != null),
      });

      return { success: true };
    });
  }

  // ---------------------------------------------------------------------------
  // Reject to assessment — FINAL_REVIEW REJECT rolls back to ON_SITE_ASSESSMENT
  // Preserves all historical task records from previous rounds
  // ---------------------------------------------------------------------------
  async rejectToAssessment(
    instanceId: number,
    userId: number,
    remark: string,
  ) {
    return this.db.transaction(async (tx) => {
      const txDb = tx as unknown as DrizzleDB;

      const instances = await tx
        .select()
        .from(wfInstance)
        .where(eq(wfInstance.id, instanceId))
        .limit(1);

      const instance = instances[0];
      if (!instance) {
        throw new NotFoundException(`Instance #${instanceId} not found`);
      }

      // Increment roundNo
      const newRoundNo = instance.roundNo + 1;

      // Only cancel PENDING/PENDING_RECTIFICATION tasks (preserve COMPLETED history)
      await tx
        .update(wfTask)
        .set({ status: 'CANCELLED', updatedAt: new Date() })
        .where(
          and(
            eq(wfTask.instanceId, instanceId),
            inArray(wfTask.status, ['PENDING', 'PENDING_RECTIFICATION']),
          ),
        );

      // Update instance: roundNo+1, currentNode = ON_SITE_ASSESSMENT
      const targetNode = 'ON_SITE_ASSESSMENT';
      await tx
        .update(wfInstance)
        .set({
          roundNo: newRoundNo,
          currentNode: targetNode,
          updatedAt: new Date(),
        })
        .where(eq(wfInstance.id, instanceId));

      // Load ON_SITE_ASSESSMENT node definition and enter (MULTI_ASSIGNEE handler)
      const nodeDef = await this.loadNodeDef(
        tx,
        instance.definitionId,
        targetNode,
      );
      const handler = this.getHandler(nodeDef.nodeType);

      const refreshed = await this.loadInstance(tx, instanceId);
      const ctx: NodeContext = {
        db: txDb,
        instance: refreshed,
        nodeDef,
        currentUserId: userId,
      };

      await handler.onEnter(ctx);

      // Emit task.created events (notify PM + assessors)
      await this.emitTaskCreatedEvents(txDb, refreshed, nodeDef);

      // Log
      await tx.insert(wfActionLog).values({
        instanceId,
        nodeKey: 'FINAL_REVIEW',
        action: 'REJECT_TO_ASSESSMENT',
        fromNode: 'FINAL_REVIEW',
        toNode: targetNode,
        operatorId: userId,
        remark,
      });

      this.logger.log(
        `Instance #${instanceId} rejected from FINAL_REVIEW to ON_SITE_ASSESSMENT (round ${newRoundNo})`,
      );

      return refreshed;
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getHandler(nodeType: string): NodeHandler {
    const handler = this.handlers.get(nodeType);
    if (!handler) {
      throw new BadRequestException(`Unknown node type: ${nodeType}`);
    }
    return handler;
  }

  private async loadNodeDef(db: any, definitionId: number, nodeKey: string) {
    const nodes = await db
      .select()
      .from(wfNode)
      .where(
        and(
          eq(wfNode.definitionId, definitionId),
          eq(wfNode.nodeKey, nodeKey),
        ),
      )
      .limit(1);

    const nodeDef = nodes[0];
    if (!nodeDef) {
      throw new NotFoundException(
        `Node "${nodeKey}" not found in definition #${definitionId}`,
      );
    }
    return nodeDef;
  }

  private async loadInstance(db: any, instanceId: number) {
    const rows = await db
      .select()
      .from(wfInstance)
      .where(eq(wfInstance.id, instanceId))
      .limit(1);

    return rows[0];
  }

  /**
   * Advance from the current completed node to the next node.
   * Handles auto-node chaining recursively.
   */
  private async advanceToNextNode(
    db: DrizzleDB,
    instance: typeof wfInstance.$inferSelect,
    fromNodeDef: typeof wfNode.$inferSelect,
    event: string,
    operatorId: number,
    remark?: string | null,
    extraData?: Record<string, any>,
  ): Promise<void> {
    // Emit node-completed event for listeners (includes remark + extraData)
    // remark 来自审核人在 TaskDetail.vue 那个 textarea 填的"审核意见"，
    // 由 signal(dto.remark) 一路传到这里。listener 用它拼接到通知 content。
    this.eventEmitter.emit('workflow.node.completed', {
      bizType: instance.bizType,
      bizId: instance.bizId,
      instanceId: instance.id,
      nodeKey: fromNodeDef.nodeKey,
      event,
      operatorId,
      remark,
      extraData,
    });

    const transition = await this.transitionResolver.resolve(
      instance.definitionId,
      fromNodeDef.nodeKey,
      event,
      instance,
    );

    if (!transition) {
      // No transition — mark instance completed
      await (db as any)
        .update(wfInstance)
        .set({
          status: 'COMPLETED',
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(wfInstance.id, instance.id));

      await (db as any).insert(wfActionLog).values({
        instanceId: instance.id,
        nodeKey: fromNodeDef.nodeKey,
        action: 'COMPLETE',
        fromNode: fromNodeDef.nodeKey,
        toNode: '',
        operatorId,
      });

      this.logger.log(`Instance #${instance.id} completed`);
      return;
    }

    const nextNodeKey = transition.toNodeKey;

    // Empty toNodeKey means END — mark instance completed
    if (!nextNodeKey) {
      await (db as any)
        .update(wfInstance)
        .set({
          status: 'COMPLETED',
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(wfInstance.id, instance.id));

      await (db as any).insert(wfActionLog).values({
        instanceId: instance.id,
        nodeKey: fromNodeDef.nodeKey,
        action: 'COMPLETE',
        fromNode: fromNodeDef.nodeKey,
        toNode: '',
        operatorId,
      });

      this.logger.log(`Instance #${instance.id} completed (end transition)`);
      return;
    }

    // Update instance current_node
    await (db as any)
      .update(wfInstance)
      .set({
        currentNode: nextNodeKey,
        updatedAt: new Date(),
      })
      .where(eq(wfInstance.id, instance.id));

    // Log transition
    await (db as any).insert(wfActionLog).values({
      instanceId: instance.id,
      nodeKey: nextNodeKey,
      action: 'TRANSITION',
      fromNode: fromNodeDef.nodeKey,
      toNode: nextNodeKey,
      operatorId,
    });

    // Load next node and enter
    const nextNodeDef = await this.loadNodeDef(
      db,
      instance.definitionId,
      nextNodeKey,
    );

    const handler = this.getHandler(nextNodeDef.nodeType);

    // Refresh instance for context
    const refreshed = await this.loadInstance(db, instance.id);

    const ctx: NodeContext = {
      db,
      instance: refreshed,
      nodeDef: nextNodeDef,
      currentUserId: operatorId,
    };

    await handler.onEnter(ctx);

    // Emit task.created events for newly created tasks
    await this.emitTaskCreatedEvents(db, refreshed, nextNodeDef);

    // If next node is AUTO, immediately advance again
    if (nextNodeDef.nodeType === 'AUTO') {
      await this.advanceFromAutoNode(db, refreshed, nextNodeDef, operatorId);
    }
  }

  /**
   * Advance from an AUTO node (no tasks, resolves immediately).
   */
  private async advanceFromAutoNode(
    db: DrizzleDB,
    instance: typeof wfInstance.$inferSelect,
    nodeDef: typeof wfNode.$inferSelect,
    operatorId: number,
  ): Promise<void> {
    const handler = this.getHandler('AUTO');
    const ctx: NodeContext = {
      db,
      instance,
      nodeDef,
      currentUserId: operatorId,
    };

    const event = await handler.resolveCompletionEvent(ctx);
    // AUTO 节点无人工操作，没有审核 remark，传 null
    await this.advanceToNextNode(db, instance, nodeDef, event, operatorId, null);
  }

  /**
   * Emit 'workflow.task.created' for each PENDING task created during onEnter.
   */
  private async emitTaskCreatedEvents(
    db: DrizzleDB,
    instance: typeof wfInstance.$inferSelect,
    nodeDef: typeof wfNode.$inferSelect,
  ) {
    const pendingTasks = await (db as any)
      .select()
      .from(wfTask)
      .where(
        and(
          eq(wfTask.instanceId, instance.id),
          eq(wfTask.nodeKey, nodeDef.nodeKey),
          eq(wfTask.status, 'PENDING'),
        ),
      );

    for (const task of pendingTasks) {
      this.eventEmitter.emit('workflow.task.created', {
        taskId: task.id,
        assigneeId: task.assigneeId,
        instanceId: instance.id,
        nodeKey: nodeDef.nodeKey,
        nodeName: nodeDef.nodeName,
        bizType: instance.bizType,
        bizId: instance.bizId,
      });
    }
  }
}
