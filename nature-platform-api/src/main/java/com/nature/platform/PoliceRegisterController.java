/**
 * @input PoliceRegisterService operations, authentication principal, and request validation data
 * @output /api/v1/police-registers endpoints for node-7 list/detail/save/submit operations
 * @position HTTP adapter for police registration stage management in the project workflow chain
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
@RequestMapping("/api/v1/police-registers")
public class PoliceRegisterController {
  private final PoliceRegisterService policeRegisterService;

  public PoliceRegisterController(PoliceRegisterService policeRegisterService) {
    this.policeRegisterService = policeRegisterService;
  }

  @GetMapping
  public ApiResponse<List<PoliceRegisterRecord>> list() {
    return ApiResponse.success(policeRegisterService.list());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<PoliceRegisterRecord>> detail(@PathVariable long projectId) {
    return policeRegisterService
        .detail(projectId)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "police register not found")));
  }

  @PutMapping("/{projectId}")
  public ApiResponse<PoliceRegisterRecord> save(
      Authentication authentication,
      @PathVariable long projectId,
      @Valid @RequestBody PoliceRegisterRequest request) {
    return ApiResponse.success(
        policeRegisterService.save(projectId, request, CurrentUser.username(authentication)));
  }

  @PostMapping("/{projectId}/submit")
  public ApiResponse<PoliceRegisterRecord> submit(Authentication authentication, @PathVariable long projectId) {
    return ApiResponse.success(policeRegisterService.submit(projectId, CurrentUser.username(authentication)));
  }
}
