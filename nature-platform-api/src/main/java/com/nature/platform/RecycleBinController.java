/**
 * @input RecycleBinService domain operations and authenticated operator context
 * @output /api/v1/recycle-bin endpoints for contract/project recycle list and restore actions
 * @position HTTP adapter layer for recycle-bin management with admin restore restrictions
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/recycle-bin")
public class RecycleBinController {
  private final RecycleBinService recycleBinService;

  public RecycleBinController(RecycleBinService recycleBinService) {
    this.recycleBinService = recycleBinService;
  }

  @GetMapping("/contracts")
  public ApiResponse<List<RecycleItemRecord>> contracts() {
    return ApiResponse.success(recycleBinService.listContracts());
  }

  @GetMapping("/project-registers")
  public ApiResponse<List<RecycleItemRecord>> projects() {
    return ApiResponse.success(recycleBinService.listProjects());
  }

  @PostMapping("/{type}/{id}/restore")
  public ApiResponse<Map<String, String>> restore(
      Authentication authentication, @PathVariable String type, @PathVariable long id) {
    recycleBinService.restore(type, id, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("type", type, "id", String.valueOf(id)));
  }
}

