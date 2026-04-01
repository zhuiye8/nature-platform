import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('workflow')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('start')
  @RequirePermission('wf_task:operate')
  async startInstance(
    @Body()
    body: {
      defKey: string;
      bizType: string;
      bizId: number;
      variables?: Record<string, any>;
    },
    @CurrentUser() user: { id: number },
  ) {
    return this.workflowService.startInstance(
      body.defKey,
      body.bizType,
      body.bizId,
      user.id,
      body.variables,
    );
  }

  @Post('signal')
  @RequirePermission('wf_task:operate')
  async signal(
    @Body()
    body: {
      instanceId: number;
      taskId: number;
      action: string;
      remark?: string | null;
      opinionText?: string;
      attachmentIds?: number[];
      extraData?: Record<string, any>;
    },
    @CurrentUser() user: { id: number },
  ) {
    // Merge opinionText/attachmentIds into extraData
    const extraData = {
      ...body.extraData,
      ...(body.opinionText ? { opinionText: body.opinionText } : {}),
      ...(body.attachmentIds ? { attachmentIds: body.attachmentIds } : {}),
    };
    return this.workflowService.signal(
      body.instanceId,
      body.taskId,
      body.action,
      body.remark ?? null,
      user.id,
      Object.keys(extraData).length > 0 ? extraData : undefined,
    );
  }

  @Get('my-tasks')
  @RequirePermission('wf_task:view')
  async getMyTasks(
    @CurrentUser() user: { id: number },
    @Query('status') status?: string,
  ) {
    return this.workflowService.getMyTasks(user.id, status);
  }

  @Get('my-tasks/count')
  @RequirePermission('wf_task:view')
  async getMyTaskCount(@CurrentUser() user: { id: number }) {
    return this.workflowService.getMyTaskCount(user.id);
  }

  @Get('task/:taskId')
  @RequirePermission('wf_task:view')
  async getTaskDetail(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.workflowService.getTaskDetail(taskId);
  }

  @Get('instance/:id')
  @RequirePermission('wf_task:view')
  async getInstanceDetail(@Param('id', ParseIntPipe) id: number) {
    return this.workflowService.getInstanceDetail(id);
  }

  @Get('instance/biz/:bizType/:bizId')
  @RequirePermission('wf_task:view')
  async getInstanceByBiz(
    @Param('bizType') bizType: string,
    @Param('bizId', ParseIntPipe) bizId: number,
  ) {
    return this.workflowService.getInstanceByBiz(bizType, bizId);
  }

  @Post('resubmit/:instanceId')
  @RequirePermission('wf_task:operate')
  async resubmit(
    @Param('instanceId', ParseIntPipe) instanceId: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.workflowService.resubmitFromRectification(instanceId, user.id);
  }
}
