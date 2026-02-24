/**
 * @input ErrorCode from com.nature.platform for standardized error reporting
 * @output ApiResponse<T>, success(), failure() wrappers for REST responses
 * @position Shared API contract type used by all controllers to keep response shape stable
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.time.OffsetDateTime;

public record ApiResponse<T>(
    String code,
    String message,
    T data,
    String traceId,
    OffsetDateTime timestamp) {

  public static <T> ApiResponse<T> success(T data) {
    return new ApiResponse<>("OK", "success", data, "", OffsetDateTime.now());
  }

  public static <T> ApiResponse<T> failure(ErrorCode errorCode, String message) {
    return new ApiResponse<>(errorCode.name(), message, null, "", OffsetDateTime.now());
  }
}

