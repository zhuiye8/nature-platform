/**
 * @input UserAccountService with mocked JdbcTemplate query behavior
 * @output Unit tests for role-filter SQL ordering and empty-role fallback branch
 * @position User-account service test layer preventing role-candidate query regression on MySQL
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

class UserAccountServiceTests {
  private final JdbcTemplate jdbcTemplate = org.mockito.Mockito.mock(JdbcTemplate.class);
  private final UserAccountService userAccountService = new UserAccountService(jdbcTemplate);

  @Test
  void shouldFallbackToAllEnabledUsersWhenRoleFilterEmpty() {
    when(jdbcTemplate.queryForList(anyString(), eq(String.class))).thenReturn(List.of("admin", "reviewer"));

    List<String> rows = userAccountService.listEnabledUsernamesByRoles(List.of());

    assertEquals(List.of("admin", "reviewer"), rows);
    verify(jdbcTemplate).queryForList(anyString(), eq(String.class));
  }

  @Test
  void shouldOrderRoleFilteredCandidatesByUsername() {
    when(jdbcTemplate.queryForList(anyString(), eq(String.class), eq("ROLE_SUPER_ADMIN"), eq("ROLE_REVIEWER")))
        .thenReturn(List.of("admin", "reviewer"));

    List<String> rows =
        userAccountService.listEnabledUsernamesByRoles(
            List.of(UserAccountService.ROLE_SUPER_ADMIN, UserAccountService.ROLE_REVIEWER));

    assertEquals(List.of("admin", "reviewer"), rows);
    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(jdbcTemplate)
        .queryForList(
            sqlCaptor.capture(), eq(String.class), eq("ROLE_SUPER_ADMIN"), eq("ROLE_REVIEWER"));
    String sql = sqlCaptor.getValue();
    assertTrue(sql.contains("SELECT DISTINCT u.username"));
    assertTrue(sql.contains("ORDER BY u.username ASC"));
    assertTrue(sql.contains("IN (?,?)"));
  }
}
