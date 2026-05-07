import {
  Controller, Get, Post, Put, Delete, Query, Param, Body, Res,
  UseGuards, ParseIntPipe, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlatformService } from './platform.service';
import { CreatePlatformDto, UpdatePlatformDto, QueryPlatformDto } from './dto/platform.dto';
import type { Response } from 'express';
import * as XLSX from 'xlsx';

@Controller('platform')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PlatformController {
  constructor(private readonly service: PlatformService) {}

  @Get('page')
  @RequirePermission('platform:list')
  async findPage(@Query() query: QueryPlatformDto) {
    return this.service.findPage(query);
  }

  @Get('export')
  @RequirePermission('platform:export')
  async exportExcel(@Query() query: QueryPlatformDto, @Query('fields') fields: string | undefined, @Res() res: Response) {
    const data = await this.service.findAll(query);

    const fieldList = fields ? fields.split(',') : [
      'platformNo', 'platformName', 'websiteUrl', 'account', 'password',
      'hasCa', 'caExpireDate', 'caPassword',
      'contactName', 'contactPhone', 'remark', 'creatorName', 'createdAt',
    ];

    const headerMap: Record<string, string> = {
      platformNo: '业务编号',
      platformName: '平台名称', websiteUrl: '网址', account: '账户', password: '密码',
      hasCa: '是否办理CA', caExpireDate: 'CA到期时间', caPassword: 'CA密码',
      contactName: '联系人', contactPhone: '手机号', remark: '备注',
      creatorName: '录入人', createdAt: '录入时间',
    };

    const headers = fieldList.map((f) => headerMap[f] || f);
    const rows = data.map((item: any) =>
      fieldList.map((f) => {
        if (f === 'hasCa') return item[f] ? '是' : '否';
        return item[f] ?? '';
      }),
    );

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '注册平台');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const fileName = encodeURIComponent(`注册平台信息-${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`,
    });
    res.send(buf);
  }

  @Get(':id')
  @RequirePermission('platform:list')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  @Post()
  @RequirePermission('platform:create')
  async create(@Body() dto: CreatePlatformDto, @CurrentUser() user: { id: number }) {
    return this.service.create(dto, user.id);
  }

  @Post('import')
  @RequirePermission('platform:create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async importExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: { id: number }) {
    if (!file) throw new BadRequestException('请选择要导入的文件');

    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

    const headerMap: Record<string, string> = {
      '平台名称': 'platformName', '网址': 'websiteUrl', '账户': 'account', '密码': 'password',
      '是否办理CA': 'hasCa', 'CA到期时间': 'caExpireDate', 'CA密码': 'caPassword',
      '联系人': 'contactName', '手机号': 'contactPhone', '备注': 'remark',
    };

    const items: CreatePlatformDto[] = rows.map((row) => {
      const item: any = {};
      for (const [cn, en] of Object.entries(headerMap)) {
        if (row[cn] !== undefined) {
          if (en === 'hasCa') {
            item[en] = row[cn] === '是' || row[cn] === true || row[cn] === 'TRUE';
          } else {
            item[en] = String(row[cn] ?? '').trim() || null;
          }
        }
      }
      return item;
    });

    const result = await this.service.batchCreate(items, user.id);
    return { success: true, message: `成功导入 ${result.count} 条`, count: result.count };
  }

  @Put(':id')
  @RequirePermission('platform:update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlatformDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('platform:delete')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    await this.service.remove(id, user.id);
    return { success: true };
  }
}
