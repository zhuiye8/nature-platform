/**
 * @input JdbcTemplate persistence APIs; NotificationRecord mapping for query results
 * @output Notification CRUD/read-state operations and event notification creation methods
 * @position Notification application service layer with persistent storage implementation
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {
  private final JdbcTemplate jdbcTemplate;

  public NotificationService(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public List<NotificationRecord> list(String username, int limit) {
    return jdbcTemplate.query(
        """
        SELECT id, title, content, read_flag, event_type, ref_type, ref_id, created_at
        FROM system_notification
        WHERE receiver_username = ? AND deleted_flag = 0
        ORDER BY id DESC
        LIMIT ?
        """,
        new NotificationRowMapper(),
        username,
        limit);
  }

  public int unreadCount(String username) {
    Integer count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(1)
            FROM system_notification
            WHERE receiver_username = ? AND read_flag = 0 AND deleted_flag = 0
            """,
            Integer.class,
            username);
    return count == null ? 0 : count;
  }

  public boolean markRead(String username, long id) {
    int rows =
        jdbcTemplate.update(
            """
            UPDATE system_notification
            SET read_flag = 1
            WHERE id = ? AND receiver_username = ? AND deleted_flag = 0
            """,
            id,
            username);
    return rows > 0;
  }

  public void markAllRead(String username) {
    jdbcTemplate.update(
        """
        UPDATE system_notification
        SET read_flag = 1
        WHERE receiver_username = ? AND deleted_flag = 0
        """,
        username);
  }

  public boolean delete(String username, long id) {
    int rows =
        jdbcTemplate.update(
            """
            DELETE FROM system_notification
            WHERE id = ? AND receiver_username = ? AND deleted_flag = 0
            """,
            id,
            username);
    return rows > 0;
  }

  public void createForUser(
      String username, String title, String content, String eventType, String refType, Long refId) {
    jdbcTemplate.update(
        """
        INSERT INTO system_notification (receiver_username, title, content, event_type, ref_type, ref_id, read_flag, deleted_flag)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0)
        """,
        username,
        title,
        content,
        eventType,
        refType,
        refId);
  }

  public void createForUsers(
      List<String> usernames,
      String title,
      String content,
      String eventType,
      String refType,
      Long refId) {
    for (String username : usernames) {
      createForUser(username, title, content, eventType, refType, refId);
    }
  }

  private static class NotificationRowMapper implements RowMapper<NotificationRecord> {
    @Override
    public NotificationRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      NotificationRecord record = new NotificationRecord();
      record.setId(rs.getLong("id"));
      record.setTitle(rs.getString("title"));
      record.setContent(rs.getString("content"));
      record.setRead(rs.getBoolean("read_flag"));
      record.setEventType(rs.getString("event_type"));
      record.setRefType(rs.getString("ref_type"));
      Long refId = rs.getLong("ref_id");
      if (rs.wasNull()) {
        refId = null;
      }
      record.setRefId(refId);
      record.setCreatedAt(String.valueOf(rs.getTimestamp("created_at")));
      return record;
    }
  }
}

