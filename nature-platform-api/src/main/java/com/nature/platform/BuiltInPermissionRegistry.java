/**
 * @input AdminPermissionCodes and BusinessPermissionCodes constants
 * @output Built-in permission descriptor list used by startup auto-sync and manual sync APIs
 * @position IAM registry source of truth for system-owned permission metadata in Chinese
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class BuiltInPermissionRegistry {
  public List<BuiltInPermissionSpec> listAll() {
    return List.of(
        permission(AdminPermissionCodes.USER_MANAGE, "用户管理", "系统管理", "管理后台用户的创建、编辑与启停"),
        permission(AdminPermissionCodes.ROLE_MANAGE, "角色管理", "系统管理", "管理角色信息、角色用户与角色权限"),
        permission(AdminPermissionCodes.PERMISSION_VIEW, "权限管理", "系统管理", "查看并维护权限字典"),
        permission(AdminPermissionCodes.WORKFLOW_MANAGE, "流程定义管理", "系统管理", "维护流程节点定义元数据"),
        permission(AdminPermissionCodes.NODE_RULE_MANAGE, "节点规则管理", "系统管理", "维护节点安插人规则与角色绑定"),
        permission(AdminPermissionCodes.AUDIT_VIEW, "审计日志查看", "系统管理", "查看管理后台操作审计日志"),

        permission(BusinessPermissionCodes.CUSTOMER_VIEW, "客户查看", "业务流程", "查看客户列表与详情"),
        permission(BusinessPermissionCodes.CUSTOMER_CREATE, "客户新建", "业务流程", "创建客户记录"),
        permission(BusinessPermissionCodes.CUSTOMER_UPDATE, "客户编辑", "业务流程", "编辑客户记录"),
        permission(BusinessPermissionCodes.CUSTOMER_DELETE, "客户删除", "业务流程", "删除客户记录"),

        permission(BusinessPermissionCodes.CONTRACT_VIEW, "合同查看", "业务流程", "查看合同列表与详情"),
        permission(BusinessPermissionCodes.CONTRACT_CREATE, "合同新建", "业务流程", "创建合同记录"),
        permission(BusinessPermissionCodes.CONTRACT_UPDATE, "合同编辑", "业务流程", "编辑合同记录"),
        permission(BusinessPermissionCodes.CONTRACT_SUBMIT, "合同提审", "业务流程", "提交合同审核"),
        permission(BusinessPermissionCodes.CONTRACT_ARCHIVE, "合同归档", "业务流程", "归档审核通过的合同"),
        permission(BusinessPermissionCodes.CONTRACT_DELETE, "合同删除", "业务流程", "删除合同记录"),

        permission(BusinessPermissionCodes.PROJECT_REGISTER_VIEW, "项目登记查看", "业务流程", "查看项目登记列表与详情"),
        permission(BusinessPermissionCodes.PROJECT_REGISTER_CREATE, "项目登记新建", "业务流程", "创建项目登记"),
        permission(BusinessPermissionCodes.PROJECT_REGISTER_UPDATE, "项目登记编辑", "业务流程", "编辑项目登记"),
        permission(BusinessPermissionCodes.PROJECT_REGISTER_SUBMIT, "项目登记提审", "业务流程", "提交项目登记审核"),
        permission(BusinessPermissionCodes.PROJECT_REGISTER_DELETE, "项目登记删除", "业务流程", "删除项目登记"),
        permission(BusinessPermissionCodes.PROJECT_REGISTER_TRACE_VIEW, "项目轨迹查看", "业务流程", "查看项目流程轨迹"),

        permission(BusinessPermissionCodes.POLICE_REGISTER_VIEW, "公安登记查看", "业务流程", "查看公安登记列表与详情"),
        permission(BusinessPermissionCodes.POLICE_REGISTER_SAVE, "公安登记保存", "业务流程", "保存公安登记草稿"),
        permission(BusinessPermissionCodes.POLICE_REGISTER_SUBMIT, "公安登记提交", "业务流程", "提交公安登记流转"),

        permission(BusinessPermissionCodes.ON_SITE_ASSESSMENT_VIEW, "现场测评查看", "业务流程", "查看现场测评列表与详情"),
        permission(BusinessPermissionCodes.ON_SITE_ASSESSMENT_SAVE, "现场测评保存", "业务流程", "保存现场测评草稿"),
        permission(
            BusinessPermissionCodes.ON_SITE_ASSESSMENT_ASSIGN,
            "现场测评分配",
            "业务流程",
            "配置报告技术审核与内容审核（技术/管理/网络）分配"),
        permission(BusinessPermissionCodes.ON_SITE_ASSESSMENT_SUBMIT, "现场测评提交", "业务流程", "提交现场测评流转"),
        permission(
            BusinessPermissionCodes.ON_SITE_ASSESSMENT_CANDIDATE_VIEW,
            "现场测评候选池查看",
            "业务流程",
            "查看现场测评审核人候选池"),

        permission(BusinessPermissionCodes.QUALITY_REVIEW_VIEW, "质量审核查看", "业务流程", "查看质量审核列表与详情"),
        permission(
            BusinessPermissionCodes.QUALITY_REVIEW_CANDIDATE_VIEW,
            "质量审核候选池查看",
            "业务流程",
            "查看质量审核候选池"),
        permission(BusinessPermissionCodes.QUALITY_REVIEW_ASSIGN, "质量审核分配", "业务流程", "保存质量审核分配"),
        permission(BusinessPermissionCodes.QUALITY_REVIEW_SUBMIT, "质量审核提交", "业务流程", "提交质量审核阶段"),

        permission(BusinessPermissionCodes.REPORT_TECH_REVIEW_VIEW, "报告技术审核查看", "报告归档", "查看报告技术审核列表与详情"),
        permission(
            BusinessPermissionCodes.REPORT_TECH_REVIEW_CANDIDATE_VIEW,
            "报告技术审核候选池查看",
            "报告归档",
            "查看报告技术审核候选池"),
        permission(BusinessPermissionCodes.REPORT_TECH_REVIEW_SAVE, "报告技术审核保存", "报告归档", "保存报告技术审核配置"),

        permission(BusinessPermissionCodes.REPORT_CONTENT_REVIEW_VIEW, "报告内容审核查看", "报告归档", "查看报告内容审核列表与详情"),

        permission(BusinessPermissionCodes.REPORT_COMPILE_ASSIGNMENT_VIEW, "编制分配查看", "报告归档", "查看编制分配列表与详情"),
        permission(
            BusinessPermissionCodes.REPORT_COMPILE_ASSIGNMENT_CANDIDATE_VIEW,
            "编制分配候选池查看",
            "报告归档",
            "查看编制分配候选池"),
        permission(BusinessPermissionCodes.REPORT_COMPILE_ASSIGNMENT_SAVE, "编制分配保存", "报告归档", "保存编制分配配置"),
        permission(BusinessPermissionCodes.REPORT_COMPILE_ASSIGNMENT_SUBMIT, "编制分配提交", "报告归档", "提交编制分配阶段"),

        permission(BusinessPermissionCodes.REPORT_COMPILE_SUBMISSION_VIEW, "报告编制查看", "报告归档", "查看报告编制列表与详情"),
        permission(BusinessPermissionCodes.REPORT_COMPILE_SUBMISSION_SAVE, "报告编制保存", "报告归档", "保存报告编制草稿与上传信息"),
        permission(BusinessPermissionCodes.REPORT_COMPILE_SUBMISSION_SUBMIT, "报告编制提交", "报告归档", "提交报告编制阶段"),

        permission(BusinessPermissionCodes.REPORT_FINAL_REVIEW_VIEW, "最终审核查看", "报告归档", "查看最终审核列表与详情"),
        permission(
            BusinessPermissionCodes.REPORT_FINAL_REVIEW_CANDIDATE_VIEW,
            "最终审核候选池查看",
            "报告归档",
            "查看最终审核候选池"),
        permission(BusinessPermissionCodes.REPORT_FINAL_REVIEW_SAVE, "最终审核保存", "报告归档", "保存最终审核配置"),

        permission(BusinessPermissionCodes.MATERIAL_ARCHIVE_VIEW, "材料归档查看", "报告归档", "查看材料归档列表与详情"),
        permission(BusinessPermissionCodes.MATERIAL_ARCHIVE_SAVE, "材料归档保存", "报告归档", "保存材料归档草稿"),
        permission(BusinessPermissionCodes.MATERIAL_ARCHIVE_SUBMIT, "材料归档提交", "报告归档", "提交材料归档并完成闭环"),

        permission(BusinessPermissionCodes.WORKFLOW_TASK_VIEW, "待办审批查看", "流程审批", "查看待办审批任务列表"),
        permission(BusinessPermissionCodes.WORKFLOW_TASK_APPROVE, "待办审批通过", "流程审批", "执行待办审批通过操作"),
        permission(BusinessPermissionCodes.WORKFLOW_TASK_REJECT, "待办审批驳回", "流程审批", "执行待办审批驳回操作"));
  }

  private BuiltInPermissionSpec permission(
      String permissionCode, String permissionName, String category, String description) {
    return new BuiltInPermissionSpec(permissionCode, permissionName, category, description);
  }
}
