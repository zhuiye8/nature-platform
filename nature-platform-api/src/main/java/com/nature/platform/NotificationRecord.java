/**
 * @input Notification table rows mapped from JdbcTemplate queries
 * @output NotificationRecord projection consumed by notification REST responses
 * @position Domain view model layer for system notification list and unread tracking
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class NotificationRecord {
  private long id;
  private String title;
  private String content;
  private boolean read;
  private String eventType;
  private String refType;
  private Long refId;
  private String createdAt;

  public long getId() {
    return id;
  }

  public void setId(long id) {
    this.id = id;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public String getContent() {
    return content;
  }

  public void setContent(String content) {
    this.content = content;
  }

  public boolean isRead() {
    return read;
  }

  public void setRead(boolean read) {
    this.read = read;
  }

  public String getEventType() {
    return eventType;
  }

  public void setEventType(String eventType) {
    this.eventType = eventType;
  }

  public String getRefType() {
    return refType;
  }

  public void setRefType(String refType) {
    this.refType = refType;
  }

  public Long getRefId() {
    return refId;
  }

  public void setRefId(Long refId) {
    this.refId = refId;
  }

  public String getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(String createdAt) {
    this.createdAt = createdAt;
  }
}
