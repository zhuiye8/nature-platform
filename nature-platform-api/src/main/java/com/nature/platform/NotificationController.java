/**
 * @input NotificationService; Authentication principal; ApiResponse/ErrorCode contracts
 * @output /api/v1/notifications endpoints for list, unread count, read-state updates, and delete
 * @position HTTP adapter layer exposing persistent system notification center capabilities
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
  private final NotificationService notificationService;

  public NotificationController(NotificationService notificationService) {
    this.notificationService = notificationService;
  }

  @GetMapping("/unread-count")
  public ApiResponse<Map<String, Integer>> unreadCount(Authentication authentication) {
    String username = CurrentUser.username(authentication);
    return ApiResponse.success(Map.of("count", notificationService.unreadCount(username)));
  }

  @GetMapping
  public ApiResponse<List<NotificationRecord>> list(
      Authentication authentication, @RequestParam(defaultValue = "20") int limit) {
    String username = CurrentUser.username(authentication);
    return ApiResponse.success(notificationService.list(username, limit));
  }

  @PostMapping("/{id}/read")
  public ResponseEntity<ApiResponse<Map<String, Object>>> markRead(
      Authentication authentication, @PathVariable long id) {
    String username = CurrentUser.username(authentication);
    boolean ok = notificationService.markRead(username, id);
    if (!ok) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND)
          .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "notification not found"));
    }
    return ResponseEntity.ok(ApiResponse.success(Map.of("id", id, "read", true)));
  }

  @PostMapping("/read-all")
  public ApiResponse<Map<String, Integer>> readAll(Authentication authentication) {
    String username = CurrentUser.username(authentication);
    notificationService.markAllRead(username);
    return ApiResponse.success(Map.of("count", 0));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<ApiResponse<Map<String, String>>> delete(
      Authentication authentication, @PathVariable long id) {
    String username = CurrentUser.username(authentication);
    boolean ok = notificationService.delete(username, id);
    if (!ok) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND)
          .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "notification not found"));
    }
    return ResponseEntity.ok(ApiResponse.success(Map.of("id", String.valueOf(id))));
  }
}
