/**
 * @input ProcessOverviewService aggregate query, AdminAccessService resource checks, and authenticated principal
 * @output /api/v1/process-overview/{projectId} read-only endpoint for workflow current-state detail snapshots
 * @position HTTP adapter exposing full-process overview for cross-node reviewers and operators
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/process-overview")
public class ProcessOverviewController {
  private static final List<String> VIEW_RESOURCES =
      List.of(
          ResourceKeys.PAGE_PROJECT_REGISTERS,
          ResourceKeys.PAGE_POLICE_REGISTERS,
          ResourceKeys.PAGE_ON_SITE_ASSESSMENTS,
          ResourceKeys.PAGE_QUALITY_REVIEWS,
          ResourceKeys.PAGE_REPORT_TECH_REVIEWS,
          ResourceKeys.PAGE_REPORT_CONTENT_REVIEWS,
          ResourceKeys.PAGE_REPORT_COMPILE_ASSIGNMENTS,
          ResourceKeys.PAGE_REPORT_COMPILE_SUBMISSIONS,
          ResourceKeys.PAGE_REPORT_FINAL_REVIEWS,
          ResourceKeys.PAGE_MATERIAL_ARCHIVES,
          ResourceKeys.PAGE_WORKFLOW);

  private final ProcessOverviewService processOverviewService;
  private final AdminAccessService adminAccessService;

  public ProcessOverviewController(
      ProcessOverviewService processOverviewService, AdminAccessService adminAccessService) {
    this.processOverviewService = processOverviewService;
    this.adminAccessService = adminAccessService;
  }

  @GetMapping("/{projectId}")
  public ApiResponse<ProcessOverviewRecord> detail(
      Authentication authentication, @PathVariable long projectId) {
    String username = CurrentUser.username(authentication);
    boolean allowed = VIEW_RESOURCES.stream().anyMatch(item -> adminAccessService.hasResource(username, item));
    if (!allowed) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "current user has no permission: process-overview:view");
    }
    return ApiResponse.success(processOverviewService.load(projectId));
  }
}
