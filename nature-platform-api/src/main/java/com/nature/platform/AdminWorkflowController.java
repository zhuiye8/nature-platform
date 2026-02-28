/**
 * @input AdminAccessService guard, WorkflowConfigService operations, and authentication principal
 * @output /api/v1/admin/workflow endpoints for definition/node-rule management and role options
 * @position Admin HTTP adapter for workflow governance configuration
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/workflow")
public class AdminWorkflowController {
  private final AdminAccessService adminAccessService;
  private final WorkflowConfigService workflowConfigService;

  public AdminWorkflowController(
      AdminAccessService adminAccessService, WorkflowConfigService workflowConfigService) {
    this.adminAccessService = adminAccessService;
    this.workflowConfigService = workflowConfigService;
  }

  @GetMapping("/definitions")
  public ApiResponse<List<WorkflowDefinitionRecord>> definitions(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.WORKFLOW_MANAGE);
    return ApiResponse.success(workflowConfigService.listDefinitions());
  }

  @PutMapping("/definitions/{nodeKey}")
  public ApiResponse<WorkflowDefinitionRecord> upsertDefinition(
      Authentication authentication,
      @PathVariable String nodeKey,
      @Valid @RequestBody WorkflowDefinitionUpsertRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.WORKFLOW_MANAGE);
    return ApiResponse.success(workflowConfigService.upsertDefinition(nodeKey, request, operator));
  }

  @GetMapping("/node-rules")
  public ApiResponse<List<WorkflowNodeRuleRecord>> nodeRules(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.NODE_RULE_MANAGE);
    return ApiResponse.success(workflowConfigService.listNodeRules());
  }

  @GetMapping("/node-rules/{nodeKey}")
  public ApiResponse<WorkflowNodeRuleRecord> detailNodeRule(
      Authentication authentication, @PathVariable String nodeKey) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.NODE_RULE_MANAGE);
    return ApiResponse.success(workflowConfigService.detailNodeRule(nodeKey));
  }

  @PutMapping("/node-rules/{nodeKey}")
  public ApiResponse<WorkflowNodeRuleRecord> upsertNodeRule(
      Authentication authentication,
      @PathVariable String nodeKey,
      @Valid @RequestBody WorkflowNodeRuleUpsertRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.NODE_RULE_MANAGE);
    return ApiResponse.success(workflowConfigService.upsertNodeRule(nodeKey, request, operator));
  }

  @GetMapping("/role-codes")
  public ApiResponse<List<String>> roleCodes(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.NODE_RULE_MANAGE);
    return ApiResponse.success(workflowConfigService.listEnabledRoleCodes());
  }
}
