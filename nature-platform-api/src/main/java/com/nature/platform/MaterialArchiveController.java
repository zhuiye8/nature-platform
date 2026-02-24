/**
 * @input MaterialArchiveService operations and authenticated operator context
 * @output /api/v1/material-archives endpoints for node-16 save/submit/list APIs
 * @position HTTP adapter for material archive stage operations
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/material-archives")
public class MaterialArchiveController {
  private final MaterialArchiveService materialArchiveService;

  public MaterialArchiveController(MaterialArchiveService materialArchiveService) {
    this.materialArchiveService = materialArchiveService;
  }

  @GetMapping
  public ApiResponse<List<MaterialArchiveRecord>> list() {
    return ApiResponse.success(materialArchiveService.list());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<MaterialArchiveRecord>> detail(@PathVariable long projectId) {
    return materialArchiveService
        .detail(projectId)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "material archive not found")));
  }

  @PutMapping("/{projectId}")
  public ApiResponse<MaterialArchiveRecord> save(
      Authentication authentication,
      @PathVariable long projectId,
      @Valid @RequestBody MaterialArchiveRequest request) {
    return ApiResponse.success(
        materialArchiveService.save(projectId, request, CurrentUser.username(authentication)));
  }

  @PostMapping("/{projectId}/submit")
  public ApiResponse<MaterialArchiveRecord> submit(
      Authentication authentication, @PathVariable long projectId) {
    return ApiResponse.success(materialArchiveService.submit(projectId, CurrentUser.username(authentication)));
  }
}
