/**
 * @input WorkflowTaskService actions and Authentication principal for operator attribution
 * @output /api/v1/workflow/tasks endpoints for todo list query and review actions
 * @position Workflow HTTP adapter layer for task-center list and approve/reject operations
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workflow/tasks")
public class WorkflowController {
  private final WorkflowTaskService workflowTaskService;

  public WorkflowController(WorkflowTaskService workflowTaskService) {
    this.workflowTaskService = workflowTaskService;
  }

  @GetMapping("/todo")
  public ApiResponse<List<WorkflowTaskDto>> todo(
      Authentication authentication,
      @RequestParam(required = false) String type,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.success(workflowTaskService.listTodo(CurrentUser.username(authentication), type, keyword));
  }

  @PostMapping("/{taskId}/approve")
  public ApiResponse<Map<String, String>> approve(Authentication authentication, @PathVariable String taskId) {
    workflowTaskService.approve(taskId, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("taskId", taskId, "action", "APPROVE"));
  }

  @PostMapping("/{taskId}/reject")
  public ApiResponse<Map<String, String>> reject(
      Authentication authentication,
      @PathVariable String taskId,
      @RequestBody(required = false) ReviewActionRequest request) {
    String remark = request == null ? "" : request.getRemark();
    workflowTaskService.reject(taskId, CurrentUser.username(authentication), remark);
    return ApiResponse.success(Map.of("taskId", taskId, "action", "REJECT"));
  }
}
