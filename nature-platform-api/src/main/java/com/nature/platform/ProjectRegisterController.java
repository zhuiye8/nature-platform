/**
 * @input ProjectRegisterService domain operations and auth principal operator context
 * @output /api/v1/project-registers endpoints for project registration CRUD, submit-review, and workflow trace query
 * @position HTTP adapter layer for project registration workflows and validation errors
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/project-registers")
public class ProjectRegisterController {
  private final ProjectRegisterService projectRegisterService;

  public ProjectRegisterController(ProjectRegisterService projectRegisterService) {
    this.projectRegisterService = projectRegisterService;
  }

  @GetMapping
  public ApiResponse<List<ProjectRegisterRecord>> list() {
    return ApiResponse.success(projectRegisterService.list());
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<ProjectRegisterRecord>> detail(@PathVariable long id) {
    return projectRegisterService
        .findById(id)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "project register not found")));
  }

  @PostMapping
  public ApiResponse<Map<String, Long>> create(
      Authentication authentication, @Valid @RequestBody ProjectRegisterRequest request) {
    long id = projectRegisterService.create(request, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }

  @PutMapping("/{id}")
  public ApiResponse<ProjectRegisterRecord> update(
      Authentication authentication,
      @PathVariable long id,
      @Valid @RequestBody ProjectRegisterRequest request) {
    return ApiResponse.success(
        projectRegisterService.update(id, request, CurrentUser.username(authentication)));
  }

  @DeleteMapping("/{id}")
  public ApiResponse<Map<String, Long>> delete(Authentication authentication, @PathVariable long id) {
    projectRegisterService.delete(id, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }

  @PostMapping("/{id}/submit-review")
  public ApiResponse<Map<String, Long>> submitReview(Authentication authentication, @PathVariable long id) {
    projectRegisterService.submitReview(id, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }

  @GetMapping("/{id}/workflow-trace")
  public ApiResponse<List<WorkflowTraceRecord>> workflowTrace(@PathVariable long id) {
    return ApiResponse.success(projectRegisterService.listWorkflowTrace(id));
  }
}
