/**
 * @input admin_audit_log query rows mapped from JdbcTemplate
 * @output AdminAuditLogRecord DTO for management audit query APIs
 * @position Read model representing immutable audit trail entries for admin operations
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class AdminAuditLogRecord {
  private Long id;
  private String operator;
  private String actionType;
  private String targetType;
  private String targetId;
  private String detailJson;
  private String createdAt;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getOperator() {
    return operator;
  }

  public void setOperator(String operator) {
    this.operator = operator;
  }

  public String getActionType() {
    return actionType;
  }

  public void setActionType(String actionType) {
    this.actionType = actionType;
  }

  public String getTargetType() {
    return targetType;
  }

  public void setTargetType(String targetType) {
    this.targetType = targetType;
  }

  public String getTargetId() {
    return targetId;
  }

  public void setTargetId(String targetId) {
    this.targetId = targetId;
  }

  public String getDetailJson() {
    return detailJson;
  }

  public void setDetailJson(String detailJson) {
    this.detailJson = detailJson;
  }

  public String getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(String createdAt) {
    this.createdAt = createdAt;
  }
}
