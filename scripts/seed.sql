-- ============================================================================
-- Nature 等保测评平台 — 种子数据
-- 用法: pnpm db:seed（在 packages/server 目录下）
-- 本文件幂等，可重复执行（所有 INSERT 使用 ON CONFLICT DO NOTHING）
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. 触发器函数（Drizzle-kit 不管理触发器，需手动维护）
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有有 updated_at 列的表绑定触发器
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'updated_at'
        GROUP BY table_name
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- ============================================================================
-- 2. 系统角色
-- ============================================================================
INSERT INTO iam_role (role_code, role_name, description, enabled, system_flag) VALUES
    ('super_admin',              '超级管理员',           '系统全局管理角色，拥有所有权限',              TRUE, TRUE),
    ('sales',                    '销售',                '负责客户管理和合同创建',                     TRUE, TRUE),
    ('commercial',               '商务',                '负责合同归档',                               TRUE, TRUE),
    ('dept_manager',             '部门经理',            '负责合同审核、项目审核、最终审核',            TRUE, TRUE),
    ('project_manager',          '项目经理',            '负责项目管理和现场测评组织',                  TRUE, TRUE),
    ('assessor',                 '测评师',              '负责现场测评实施',                           TRUE, TRUE),
    ('police_register',          '公安登记专员',         '负责公安登记操作',                          TRUE, TRUE),
    ('tech_reviewer',            '整体技术审核员',       '负责整体技术审核',                          TRUE, TRUE),
    ('content_reviewer_tech',    '内容审核员（技术）',   '负责技术向内容审核',                        TRUE, TRUE),
    ('content_reviewer_mgmt',    '内容审核员（管理）',   '负责管理向内容审核',                        TRUE, TRUE),
    ('content_reviewer_network', '内容审核员（网络）',   '负责网络向内容审核',                        TRUE, TRUE),
    ('report_writer',            '报告编制员',          '负责报告编制和提交',                         TRUE, TRUE),
    ('report_assigner',          '报告分配人',          '负责审核测评成果并分配编制任务给编制人',       TRUE, TRUE),
    ('archiver',                 '归档员',              '负责材料归档',                               TRUE, TRUE),
    ('project_director',         '项目主管',            '负责项目登记审核、分配项目经理和测评师',       TRUE, TRUE),
    ('finance',                  '财务',                '负责合同回款管理',                           TRUE, TRUE)
ON CONFLICT (role_code) DO NOTHING;

-- ============================================================================
-- 3. 管理员账号（密码: admin123）
-- ============================================================================
INSERT INTO user_account (username, password_hash, display_name, enabled, source_type)
VALUES ('admin', '$2b$10$wsfd8pq2Dxak/BqjR9dEg.PBVFoS2pHO2qVujSgdnZCWjjxWEOFXW', '管理员', TRUE, 'LOCAL')
ON CONFLICT (username) DO NOTHING;

INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'super_admin', 0 FROM user_account WHERE username = 'admin'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. 权限定义
-- ============================================================================
INSERT INTO iam_permission (permission_code, permission_name, category, enabled, built_in) VALUES
    ('customer:list', '客户列表', 'CUSTOMER', TRUE, TRUE), ('customer:create', '创建客户', 'CUSTOMER', TRUE, TRUE),
    ('customer:update', '编辑客户', 'CUSTOMER', TRUE, TRUE), ('customer:delete', '删除客户', 'CUSTOMER', TRUE, TRUE),
    ('contract:list', '合同列表', 'CONTRACT', TRUE, TRUE), ('contract:create', '创建合同', 'CONTRACT', TRUE, TRUE),
    ('contract:update', '编辑合同', 'CONTRACT', TRUE, TRUE), ('contract:delete', '删除合同', 'CONTRACT', TRUE, TRUE),
    ('contract:review', '审核合同', 'CONTRACT', TRUE, TRUE), ('contract:archive', '归档合同', 'CONTRACT', TRUE, TRUE),
    ('contract:view_all', '查看所有合同详情', 'CONTRACT', TRUE, TRUE),
    ('contract:update_financial', '更新合同财务信息', 'CONTRACT', TRUE, TRUE),
    ('project:list', '项目列表', 'PROJECT', TRUE, TRUE), ('project:create', '创建项目登记', 'PROJECT', TRUE, TRUE),
    ('project:update', '编辑项目登记', 'PROJECT', TRUE, TRUE), ('project:delete', '删除项目登记', 'PROJECT', TRUE, TRUE),
    ('project:review', '审核项目登记', 'PROJECT', TRUE, TRUE), ('project:assign_team', '分配项目组', 'PROJECT', TRUE, TRUE),
    ('partner:list', '合作方列表', 'PARTNER', TRUE, TRUE), ('partner:create', '创建合作方', 'PARTNER', TRUE, TRUE),
    ('partner:update', '编辑合作方', 'PARTNER', TRUE, TRUE), ('partner:delete', '删除合作方', 'PARTNER', TRUE, TRUE),
    ('police:list', '公安登记列表', 'POLICE', TRUE, TRUE), ('police:create', '创建公安登记', 'POLICE', TRUE, TRUE),
    ('police:update', '编辑公安登记', 'POLICE', TRUE, TRUE), ('police:complete', '完成公安登记', 'POLICE', TRUE, TRUE),
    ('police:operate', '公安登记操作', 'POLICE', TRUE, TRUE),
    ('assessment:submit', '提交测评', 'ASSESSMENT', TRUE, TRUE), ('assessment:view', '查看测评', 'ASSESSMENT', TRUE, TRUE),
    ('assessment:start_qr', '发起质量审核', 'ASSESSMENT', TRUE, TRUE),
    ('quality_review:review', '质量审核操作', 'QUALITY_REVIEW', TRUE, TRUE),
    ('report:assign', '分配报告编制', 'REPORT', TRUE, TRUE), ('report:compile', '编制报告', 'REPORT', TRUE, TRUE),
    ('report:list', '报告列表', 'REPORT', TRUE, TRUE), ('report:review', '审核报告', 'REPORT', TRUE, TRUE),
    ('report:submit', '提交报告', 'REPORT', TRUE, TRUE), ('report:view', '查看报告', 'REPORT', TRUE, TRUE),
    ('archive:list', '归档列表', 'ARCHIVE', TRUE, TRUE), ('archive:submit', '提交材料归档', 'ARCHIVE', TRUE, TRUE),
    ('wf_task:view', '查看待办任务', 'WORKFLOW', TRUE, TRUE), ('wf_task:operate', '操作待办任务', 'WORKFLOW', TRUE, TRUE),
    ('user:list', '用户列表', 'IAM', TRUE, TRUE), ('user:create', '创建用户', 'IAM', TRUE, TRUE),
    ('user:update', '编辑用户', 'IAM', TRUE, TRUE), ('user:delete', '删除用户', 'IAM', TRUE, TRUE),
    ('user:manage', '用户管理', 'IAM', TRUE, TRUE), ('role:list', '角色列表', 'IAM', TRUE, TRUE),
    ('role:create', '创建角色', 'IAM', TRUE, TRUE), ('role:update', '编辑角色', 'IAM', TRUE, TRUE),
    ('role:delete', '删除角色', 'IAM', TRUE, TRUE), ('role:manage', '角色管理', 'IAM', TRUE, TRUE),
    ('resource:manage', '资源管理', 'IAM', TRUE, TRUE), ('department:manage', '部门管理', 'IAM', TRUE, TRUE),
    ('workflow:manage', '流程管理', 'IAM', TRUE, TRUE), ('audit:view', '审计日志查看', 'AUDIT', TRUE, TRUE),
    ('recycle:list', '回收站列表', 'IAM', TRUE, TRUE), ('recycle:restore', '回收站恢复', 'IAM', TRUE, TRUE),
    ('recycle:delete', '回收站删除', 'IAM', TRUE, TRUE), ('recycle:manage', '回收站管理', 'IAM', TRUE, TRUE)
ON CONFLICT (permission_code) DO NOTHING;

-- ============================================================================
-- 5. 角色→权限映射
-- ============================================================================
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
    ('super_admin','customer:list'),('super_admin','customer:create'),('super_admin','customer:update'),('super_admin','customer:delete'),('super_admin','contract:list'),('super_admin','contract:create'),('super_admin','contract:update'),('super_admin','contract:delete'),('super_admin','contract:review'),('super_admin','contract:archive'),('super_admin','contract:view_all'),('super_admin','partner:list'),('super_admin','partner:create'),('super_admin','partner:update'),('super_admin','partner:delete'),('super_admin','project:list'),('super_admin','project:create'),('super_admin','project:update'),('super_admin','project:delete'),('super_admin','project:review'),('super_admin','project:assign_team'),('super_admin','police:list'),('super_admin','police:create'),('super_admin','police:update'),('super_admin','police:complete'),('super_admin','police:operate'),('super_admin','assessment:submit'),('super_admin','assessment:view'),('super_admin','assessment:start_qr'),('super_admin','quality_review:review'),('super_admin','report:assign'),('super_admin','report:compile'),('super_admin','report:list'),('super_admin','report:review'),('super_admin','report:submit'),('super_admin','report:view'),('super_admin','archive:list'),('super_admin','archive:submit'),('super_admin','user:list'),('super_admin','user:create'),('super_admin','user:update'),('super_admin','user:delete'),('super_admin','user:manage'),('super_admin','role:list'),('super_admin','role:create'),('super_admin','role:update'),('super_admin','role:delete'),('super_admin','role:manage'),('super_admin','resource:manage'),('super_admin','department:manage'),('super_admin','workflow:manage'),('super_admin','audit:view'),('super_admin','recycle:list'),('super_admin','recycle:restore'),('super_admin','recycle:delete'),('super_admin','recycle:manage'),('super_admin','wf_task:view'),('super_admin','wf_task:operate'),
    ('sales','customer:list'),('sales','customer:create'),('sales','customer:update'),('sales','contract:list'),('sales','contract:create'),('sales','contract:update'),('sales','contract:delete'),('sales','partner:list'),('sales','partner:create'),('sales','partner:update'),('sales','partner:delete'),('sales','project:list'),('sales','project:create'),('sales','project:update'),('sales','project:delete'),('sales','archive:list'),('sales','archive:submit'),('sales','user:list'),('sales','wf_task:view'),
    ('commercial','customer:list'),('commercial','contract:list'),('commercial','contract:archive'),('commercial','contract:view_all'),('commercial','contract:update'),('commercial','project:list'),('commercial','wf_task:view'),('commercial','wf_task:operate'),
    ('dept_manager','customer:list'),('dept_manager','contract:list'),('dept_manager','contract:view_all'),('dept_manager','project:list'),('dept_manager','project:review'),('dept_manager','project:assign_team'),('dept_manager','assessment:view'),('dept_manager','report:assign'),('dept_manager','report:list'),('dept_manager','report:view'),('dept_manager','report:review'),('dept_manager','archive:list'),('dept_manager','archive:submit'),('dept_manager','user:list'),('dept_manager','wf_task:view'),('dept_manager','wf_task:operate'),
    ('project_manager','customer:list'),('project_manager','contract:list'),('project_manager','project:list'),('project_manager','assessment:submit'),('project_manager','assessment:view'),('project_manager','assessment:start_qr'),('project_manager','report:assign'),('project_manager','report:list'),('project_manager','report:view'),('project_manager','archive:list'),('project_manager','archive:submit'),('project_manager','wf_task:view'),('project_manager','wf_task:operate'),
    ('assessor','customer:list'),('assessor','contract:list'),('assessor','project:list'),('assessor','assessment:submit'),('assessor','assessment:view'),('assessor','report:list'),('assessor','report:view'),('assessor','wf_task:view'),('assessor','wf_task:operate'),
    ('police_register','customer:list'),('police_register','contract:list'),('police_register','project:list'),('police_register','police:list'),('police_register','police:create'),('police_register','police:update'),('police_register','police:complete'),('police_register','police:operate'),('police_register','wf_task:view'),('police_register','wf_task:operate'),
    ('tech_reviewer','customer:list'),('tech_reviewer','contract:list'),('tech_reviewer','project:list'),('tech_reviewer','quality_review:review'),('tech_reviewer','report:list'),('tech_reviewer','report:view'),('tech_reviewer','wf_task:view'),('tech_reviewer','wf_task:operate'),
    ('content_reviewer_tech','customer:list'),('content_reviewer_tech','contract:list'),('content_reviewer_tech','project:list'),('content_reviewer_tech','quality_review:review'),('content_reviewer_tech','wf_task:view'),('content_reviewer_tech','wf_task:operate'),
    ('content_reviewer_mgmt','customer:list'),('content_reviewer_mgmt','contract:list'),('content_reviewer_mgmt','project:list'),('content_reviewer_mgmt','quality_review:review'),('content_reviewer_mgmt','assessment:view'),('content_reviewer_mgmt','wf_task:view'),('content_reviewer_mgmt','wf_task:operate'),
    ('content_reviewer_network','customer:list'),('content_reviewer_network','contract:list'),('content_reviewer_network','project:list'),('content_reviewer_network','quality_review:review'),('content_reviewer_network','assessment:view'),('content_reviewer_network','wf_task:view'),('content_reviewer_network','wf_task:operate'),
    ('report_writer','customer:list'),('report_writer','contract:list'),('report_writer','project:list'),('report_writer','assessment:view'),('report_writer','report:compile'),('report_writer','report:list'),('report_writer','report:submit'),('report_writer','report:view'),('report_writer','wf_task:view'),('report_writer','wf_task:operate'),
    ('report_assigner','customer:list'),('report_assigner','contract:list'),('report_assigner','project:list'),('report_assigner','assessment:view'),('report_assigner','report:assign'),('report_assigner','report:list'),('report_assigner','report:view'),('report_assigner','wf_task:view'),('report_assigner','wf_task:operate'),
    ('archiver','customer:list'),('archiver','contract:list'),('archiver','contract:view_all'),('archiver','project:list'),('archiver','archive:list'),('archiver','archive:submit'),('archiver','wf_task:view'),('archiver','wf_task:operate'),
    ('project_director','customer:list'),('project_director','contract:list'),('project_director','project:list'),('project_director','project:review'),('project_director','project:assign_team'),('project_director','wf_task:view'),('project_director','wf_task:operate'),
    ('finance','contract:list'),('finance','contract:update_financial'),('finance','wf_task:view')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. 前端资源/菜单
-- ============================================================================
INSERT INTO iam_resource (resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description) VALUES
    ('group.overview','总览','GROUP',NULL,NULL,'DataBoard',10,TRUE,TRUE,'总览分组'),
    ('group.business','业务流程','GROUP',NULL,NULL,'OfficeBuilding',20,TRUE,TRUE,'业务流程分组'),
    ('group.report','报告与归档','GROUP',NULL,NULL,'Tickets',30,TRUE,TRUE,'报告与归档分组'),
    ('group.finance','财务管理','GROUP',NULL,NULL,'Money',35,TRUE,TRUE,'财务管理分组'),
    ('group.system','系统管理','GROUP',NULL,NULL,'Setting',40,TRUE,TRUE,'系统管理分组'),
    ('page.dashboard','仪表盘','PAGE','group.overview','/dashboard','DataBoard',100,TRUE,TRUE,'系统首页'),
    ('page.workflow','待办审批','PAGE','group.overview','/workflow','List',110,TRUE,TRUE,'流程审批任务中心'),
    ('page.customers','客户管理','PAGE','group.business','/customers','User',200,TRUE,TRUE,'客户信息维护'),
    ('page.contracts','合同管理','PAGE','group.business','/contracts','Document',210,TRUE,TRUE,'合同登记与归档'),
    ('page.project-registers','项目登记','PAGE','group.business','/project-registers','Management',220,TRUE,TRUE,'项目登记管理'),
    ('page.police-registers','公安登记','PAGE','group.business','/police-registers','OfficeBuilding',230,TRUE,TRUE,'公安登记页面'),
    ('page.on-site-assessments','现场测评','PAGE','group.business','/on-site-assessments','Connection',240,TRUE,TRUE,'现场测评页面'),
    ('page.quality-reviews','质量审核','PAGE','group.business','/quality-reviews','CircleCheck',250,TRUE,TRUE,'质量审核页面'),
    ('page.report-assignments','编制分配','PAGE','group.report','/report-assignments','Tickets',300,TRUE,TRUE,'报告编制分配'),
    ('page.report-compile','报告编制','PAGE','group.report','/report-compile','EditPen',310,TRUE,TRUE,'报告编制与提交'),
    ('page.report-reviews','报告审核','PAGE','group.report','/report-reviews','CircleCheck',320,TRUE,TRUE,'报告终审'),
    ('page.material-archives','材料归档','PAGE','group.report','/material-archives','FolderChecked',330,TRUE,TRUE,'材料归档'),
    ('page.contract-finance','合同财务','PAGE','group.finance','/finance/contract','Money',350,TRUE,TRUE,'合同回款管理'),
    ('page.admin-users','用户管理','PAGE','group.system','/admin/users','User',400,TRUE,TRUE,'后台用户管理'),
    ('page.admin-roles','角色管理','PAGE','group.system','/admin/roles','Management',410,TRUE,TRUE,'后台角色管理'),
    ('page.admin-resources','资源管理','PAGE','group.system','/admin/resources','Checked',420,TRUE,TRUE,'后台资源管理'),
    ('page.admin-departments','部门管理','PAGE','group.system','/admin/departments','OfficeBuilding',425,TRUE,TRUE,'部门管理'),
    ('page.admin-workflow','流程管理','PAGE','group.system','/admin/workflow','Connection',430,TRUE,TRUE,'流程定义与节点规则'),
    ('page.admin-audit-logs','审计日志','PAGE','group.system','/admin/audit-logs','List',440,TRUE,TRUE,'审计日志查询'),
    ('page.recycle-bin','回收站','PAGE','group.system','/admin/recycle-bin','Delete',450,TRUE,TRUE,'回收站')
ON CONFLICT (resource_key) DO NOTHING;

-- 7. 角色→资源映射
INSERT INTO iam_role_resource (role_code, resource_key) SELECT 'super_admin', resource_key FROM iam_resource WHERE enabled = TRUE ON CONFLICT DO NOTHING;
INSERT INTO iam_role_resource (role_code, resource_key) SELECT role_code, 'page.dashboard' FROM iam_role WHERE role_code != 'super_admin' AND enabled = TRUE ON CONFLICT DO NOTHING;
INSERT INTO iam_role_resource (role_code, resource_key) VALUES
    ('sales','group.overview'),('sales','group.business'),('sales','page.workflow'),('sales','page.customers'),('sales','page.contracts'),('sales','page.project-registers'),
    ('commercial','group.overview'),('commercial','group.business'),('commercial','page.workflow'),('commercial','page.customers'),('commercial','page.contracts'),('commercial','page.project-registers'),
    ('police_register','group.overview'),('police_register','group.business'),('police_register','page.workflow'),('police_register','page.police-registers'),
    ('project_manager','group.overview'),('project_manager','group.business'),('project_manager','page.workflow'),('project_manager','page.customers'),('project_manager','page.project-registers'),('project_manager','page.on-site-assessments'),
    ('assessor','group.overview'),('assessor','group.business'),('assessor','page.workflow'),('assessor','page.on-site-assessments'),
    ('tech_reviewer','group.overview'),('tech_reviewer','group.business'),('tech_reviewer','page.workflow'),('tech_reviewer','page.quality-reviews'),
    ('content_reviewer_tech','group.overview'),('content_reviewer_tech','group.business'),('content_reviewer_tech','page.workflow'),('content_reviewer_tech','page.quality-reviews'),
    ('content_reviewer_mgmt','group.overview'),('content_reviewer_mgmt','group.business'),('content_reviewer_mgmt','page.workflow'),('content_reviewer_mgmt','page.quality-reviews'),
    ('content_reviewer_network','group.overview'),('content_reviewer_network','group.business'),('content_reviewer_network','page.workflow'),('content_reviewer_network','page.quality-reviews'),
    ('report_writer','group.overview'),('report_writer','group.report'),('report_writer','page.workflow'),('report_writer','page.report-compile'),
    ('dept_manager','group.overview'),('dept_manager','group.business'),('dept_manager','group.report'),('dept_manager','page.workflow'),('dept_manager','page.contracts'),('dept_manager','page.project-registers'),('dept_manager','page.report-assignments'),('dept_manager','page.report-reviews'),('dept_manager','page.material-archives'),
    ('project_director','group.overview'),('project_director','group.business'),('project_director','page.workflow'),('project_director','page.customers'),('project_director','page.contracts'),('project_director','page.project-registers'),
    ('finance','group.overview'),('finance','group.finance'),('finance','page.workflow'),('finance','page.contract-finance')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. 合同工作流
-- ============================================================================
INSERT INTO wf_definition (def_key, version, def_name, description, status) VALUES ('CONTRACT_FLOW', 1, '合同流程', '合同创建 → 合同审核 → 合同归档', 'ACTIVE') ON CONFLICT DO NOTHING;

INSERT INTO wf_node (definition_id, node_key, node_name, node_type, node_order, config) SELECT id, 'CONTRACT_CREATE', '合同创建', 'SIMPLE', 10, NULL FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1 ON CONFLICT DO NOTHING;
INSERT INTO wf_node (definition_id, node_key, node_name, node_type, node_order, config) SELECT id, 'CONTRACT_REVIEW', '合同审核', 'REVIEW', 20, '{"reject_target":"CONTRACT_CREATE"}'::JSONB FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1 ON CONFLICT DO NOTHING;
INSERT INTO wf_node (definition_id, node_key, node_name, node_type, node_order, config) SELECT id, 'CONTRACT_AUTO_NUMBER', '自动编号', 'AUTO', 25, '{"handler":"generateContractNo"}'::JSONB FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1 ON CONFLICT DO NOTHING;
INSERT INTO wf_node (definition_id, node_key, node_name, node_type, node_order, config) SELECT id, 'CONTRACT_ARCHIVE', '合同归档', 'SIMPLE', 30, '{"assignMode":"pool"}'::JSONB FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1 ON CONFLICT DO NOTHING;

INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, priority) SELECT id, v.f, v.t, v.e, v.p FROM wf_definition, (VALUES ('','CONTRACT_CREATE','AUTO',0),('CONTRACT_CREATE','CONTRACT_REVIEW','SUBMIT',0),('CONTRACT_REVIEW','CONTRACT_AUTO_NUMBER','APPROVE',0),('CONTRACT_AUTO_NUMBER','CONTRACT_ARCHIVE','AUTO',0),('CONTRACT_REVIEW','CONTRACT_CREATE','REJECT',0),('CONTRACT_ARCHIVE','','SUBMIT',0)) AS v(f,t,e,p) WHERE def_key = 'CONTRACT_FLOW' AND version = 1 ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. 项目测评工作流
-- ============================================================================
INSERT INTO wf_definition (def_key, version, def_name, description, status) VALUES ('PROJECT_ASSESSMENT_FLOW', 1, '项目测评流程', '项目登记 → 项目审核 → 公安登记 → 现场测评 → 质量审核 → 报告编制 → 材料归档', 'ACTIVE') ON CONFLICT DO NOTHING;

INSERT INTO wf_node (definition_id, node_key, node_name, node_type, node_order, config) SELECT d.id, v.node_key, v.node_name, v.node_type, v.node_order, v.config::JSONB FROM wf_definition d, (VALUES ('PROJECT_REGISTER','项目登记申请','SIMPLE',10,NULL),('PROJECT_REVIEW','审核项目登记','REVIEW',20,'{"reject_target":"PROJECT_REGISTER"}'),('POLICE_REGISTER','公安登记','SIMPLE',30,'{"assignMode":"pool"}'),('ON_SITE_ASSESSMENT','现场测评实施','MULTI_ASSIGNEE',40,'{"source":"project_member","role_types":["PM","ASSESSOR"]}'),('TECH_REVIEW','技术审核','REVIEW',50,'{"reject_target":"ON_SITE_ASSESSMENT"}'),('CONTENT_REVIEW','内容审核','PARALLEL_REVIEW',55,'{"slots":["CONTENT_A","CONTENT_B","CONTENT_C"]}'),('REPORT_ASSIGN','报告编制任务分配','REVIEW',58,NULL),('REPORT_COMPILE','报告编制上传','REVIEW',60,NULL),('FINAL_REVIEW','最终审核','REVIEW',70,'{"reject_action":"ADJUST","reject_target":"ON_SITE_ASSESSMENT"}'),('MATERIAL_ARCHIVE','材料归档','SIMPLE',90,'{"assignMode":"pool"}')) AS v(node_key,node_name,node_type,node_order,config) WHERE d.def_key = 'PROJECT_ASSESSMENT_FLOW' AND d.status = 'ACTIVE' ON CONFLICT DO NOTHING;

INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, guard_expr, priority) SELECT d.id, v.from_key, v.to_key, v.event, v.guard, v.priority FROM wf_definition d, (VALUES ('','PROJECT_REGISTER','AUTO',NULL,0),('PROJECT_REGISTER','PROJECT_REVIEW','SUBMIT',NULL,0),('PROJECT_REVIEW','POLICE_REGISTER','APPROVE',NULL,0),('PROJECT_REVIEW','PROJECT_REGISTER','REJECT',NULL,0),('POLICE_REGISTER','ON_SITE_ASSESSMENT','SUBMIT',NULL,0),('ON_SITE_ASSESSMENT','TECH_REVIEW','ALL_COMPLETE',NULL,0),('ON_SITE_ASSESSMENT','REPORT_ASSIGN','ALL_COMPLETE','skip_to_final',10),('TECH_REVIEW','CONTENT_REVIEW','APPROVE',NULL,0),('TECH_REVIEW','ON_SITE_ASSESSMENT','REJECT',NULL,0),('CONTENT_REVIEW','REPORT_ASSIGN','ALL_APPROVED',NULL,0),('CONTENT_REVIEW','ON_SITE_ASSESSMENT','ANY_REJECTED',NULL,0),('REPORT_ASSIGN','REPORT_COMPILE','APPROVE',NULL,0),('REPORT_ASSIGN','ON_SITE_ASSESSMENT','REJECT',NULL,0),('REPORT_COMPILE','FINAL_REVIEW','APPROVE',NULL,0),('FINAL_REVIEW','MATERIAL_ARCHIVE','APPROVE',NULL,0),('FINAL_REVIEW','ON_SITE_ASSESSMENT','ADJUST',NULL,0),('MATERIAL_ARCHIVE','','SUBMIT',NULL,0)) AS v(from_key,to_key,event,guard,priority) WHERE d.def_key = 'PROJECT_ASSESSMENT_FLOW' AND d.status = 'ACTIVE' ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. 任务分配规则
-- ============================================================================
INSERT INTO wf_assignment_rule (node_key, slot_key, slot_label, role_code, avoidance_rule, priority) VALUES
    ('CONTRACT_REVIEW','REVIEWER','合同审核人','dept_manager','NONE',5),('CONTRACT_REVIEW','REVIEWER','合同审核人','super_admin','NONE',99),
    ('CONTRACT_ARCHIVE','ARCHIVER','合同归档人','commercial','NONE',10),('CONTRACT_ARCHIVE','ARCHIVER','合同归档人','super_admin','NONE',99),
    ('PROJECT_REVIEW','REVIEWER','项目审核人','project_director','NONE',10),('PROJECT_REVIEW','REVIEWER','项目审核人','super_admin','NONE',99),
    ('POLICE_REGISTER','OPERATOR','公安登记人','police_register','NONE',10),('POLICE_REGISTER','OPERATOR','公安登记人','super_admin','NONE',99),
    ('TECH_REVIEW','TECH','技术审核','tech_reviewer','SAME_PROJECT',10),('TECH_REVIEW','TECH','技术审核','super_admin','SAME_PROJECT',99),
    ('CONTENT_REVIEW','CONTENT_A','内容审核（技术）','content_reviewer_tech','SAME_PROJECT',10),('CONTENT_REVIEW','CONTENT_A','内容审核（技术）','super_admin','SAME_PROJECT',99),
    ('CONTENT_REVIEW','CONTENT_B','内容审核（管理）','content_reviewer_mgmt','SAME_PROJECT',10),('CONTENT_REVIEW','CONTENT_B','内容审核（管理）','super_admin','SAME_PROJECT',99),
    ('CONTENT_REVIEW','CONTENT_C','内容审核（网络）','content_reviewer_network','SAME_PROJECT',10),('CONTENT_REVIEW','CONTENT_C','内容审核（网络）','super_admin','SAME_PROJECT',99),
    ('REPORT_ASSIGN','ASSIGNER','报告分配人','report_assigner','NONE',10),('REPORT_ASSIGN','ASSIGNER','报告分配人','super_admin','NONE',99),
    ('REPORT_COMPILE','WRITER','报告编制人','report_writer','NONE',10),('REPORT_COMPILE','WRITER','报告编制人','super_admin','NONE',99),
    ('FINAL_REVIEW','REVIEWER','最终审核人','dept_manager','NONE',10),('FINAL_REVIEW','REVIEWER','最终审核人','super_admin','NONE',99),
    ('MATERIAL_ARCHIVE','ARCHIVER','材料归档人','archiver','NONE',10),('MATERIAL_ARCHIVE','ARCHIVER','材料归档人','project_manager','NONE',5),
    ('MATERIAL_ARCHIVE','ARCHIVER','材料归档人','sales','NONE',5),('MATERIAL_ARCHIVE','ARCHIVER','材料归档人','dept_manager','NONE',5),
    ('MATERIAL_ARCHIVE','ARCHIVER','材料归档人','super_admin','NONE',0)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 11. 审核意见模板
-- ============================================================================
INSERT INTO review_opinion_template (node_key, slot_key, action_type, template_text, sort_order) VALUES
    ('TECH_REVIEW',NULL,'APPROVE','技术审核通过，符合要求',10),('TECH_REVIEW',NULL,'REVIEW','技术审核复核，请修改后重新提交',20),
    ('CONTENT_REVIEW','CONTENT_A','APPROVE','内容（技术）审核通过，符合要求',30),('CONTENT_REVIEW','CONTENT_A','REVIEW','内容（技术）审核复核，请修改后重新提交',40),
    ('CONTENT_REVIEW','CONTENT_B','APPROVE','内容（管理）审核通过，符合要求',50),('CONTENT_REVIEW','CONTENT_B','REVIEW','内容（管理）审核复核，请修改后重新提交',60),
    ('CONTENT_REVIEW','CONTENT_C','APPROVE','内容（网络）审核通过，符合要求',70),('CONTENT_REVIEW','CONTENT_C','REVIEW','内容（网络）审核复核，请修改后重新提交',80),
    ('REPORT_COMPILE',NULL,'APPROVE','报告编制完成，提交最终审核',90),('REPORT_COMPILE',NULL,'REVIEW','报告编制复核，测评成果存在问题，请修改后重新提交',100),
    ('FINAL_REVIEW',NULL,'APPROVE','最终审核通过，符合要求',110),('FINAL_REVIEW',NULL,'REVIEW','最终审核复核，请修改后重新提交',120),
    ('FINAL_REVIEW',NULL,'REJECT','最终审核驳回，流程需从技术审核重新开始',130),
    ('REPORT_ASSIGN',NULL,'APPROVE','测评成果审核通过，分配编制任务',140),('REPORT_ASSIGN',NULL,'REVIEW','测评成果存在问题，请修改后重新提交',150)
ON CONFLICT DO NOTHING;

COMMIT;
