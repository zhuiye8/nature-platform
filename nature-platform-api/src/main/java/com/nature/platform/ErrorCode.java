/**
 * @input Requirement baseline conventions for auth/rbac/workflow/validation/conflict error families
 * @output ErrorCode enum values used by ApiResponse failure responses
 * @position Shared error taxonomy layer to keep backend and frontend auth/error contract aligned
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public enum ErrorCode {
  AUTH_INVALID_CREDENTIALS,
  AUTH_UNAUTHORIZED,
  AUTH_FORBIDDEN,
  VALIDATION_ERROR,
  CONFLICT_ERROR,
  WORKFLOW_ERROR,
  NOT_FOUND
}
