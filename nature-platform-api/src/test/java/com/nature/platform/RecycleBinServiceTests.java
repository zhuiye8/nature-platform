/**
 * @input RecycleBinService with mocked JdbcTemplate and UserAccountService dependencies
 * @output Unit tests for restore permission gate and unsupported recycle-type guard
 * @position Recycle-bin service test layer protecting role-based restore behavior
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class RecycleBinServiceTests {
  private final JdbcTemplate jdbcTemplate = org.mockito.Mockito.mock(JdbcTemplate.class);
  private final UserAccountService userAccountService = org.mockito.Mockito.mock(UserAccountService.class);
  private final RecycleBinService recycleBinService = new RecycleBinService(jdbcTemplate, userAccountService);

  @Test
  void shouldRejectRestoreForNonSuperAdmin() {
    when(userAccountService.hasRole("normal-user", UserAccountService.ROLE_SUPER_ADMIN)).thenReturn(false);

    ResponseStatusException ex =
        assertThrows(
            ResponseStatusException.class,
            () -> recycleBinService.restore("CONTRACT", 1L, "normal-user"));

    assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    verifyNoInteractions(jdbcTemplate);
  }

  @Test
  void shouldRejectUnsupportedRecycleTypeForSuperAdmin() {
    when(userAccountService.hasRole("admin", UserAccountService.ROLE_SUPER_ADMIN)).thenReturn(true);

    ResponseStatusException ex =
        assertThrows(
            ResponseStatusException.class,
            () -> recycleBinService.restore("UNKNOWN", 1L, "admin"));

    assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
  }
}
