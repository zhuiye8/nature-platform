/**
 * @input Spring MVC exception handler APIs; ApiResponse/ErrorCode shared contracts
 * @output Consistent REST error responses for validation, auth status, and generic exceptions
 * @position HTTP error translation layer that shields clients from raw framework/runtime errors
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
    String message =
        ex.getBindingResult().getFieldErrors().stream()
            .findFirst()
            .map(item -> item.getField() + ": " + item.getDefaultMessage())
            .orElse("validation failed");
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(ApiResponse.failure(ErrorCode.VALIDATION_ERROR, message));
  }

  @ExceptionHandler(ConstraintViolationException.class)
  public ResponseEntity<ApiResponse<Void>> handleConstraint(ConstraintViolationException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(ApiResponse.failure(ErrorCode.VALIDATION_ERROR, ex.getMessage()));
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<ApiResponse<Void>> handleStatusException(ResponseStatusException ex) {
    ErrorCode code =
        switch (ex.getStatusCode().value()) {
          case 400 -> ErrorCode.VALIDATION_ERROR;
          case 401 -> ErrorCode.AUTH_UNAUTHORIZED;
          case 403 -> ErrorCode.AUTH_FORBIDDEN;
          case 404 -> ErrorCode.NOT_FOUND;
          case 409 -> ErrorCode.CONFLICT_ERROR;
          default -> ErrorCode.WORKFLOW_ERROR;
        };
    return ResponseEntity.status(ex.getStatusCode())
        .body(ApiResponse.failure(code, ex.getReason() == null ? ex.getMessage() : ex.getReason()));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiResponse<Void>> handleOther(Exception ex) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(ApiResponse.failure(ErrorCode.WORKFLOW_ERROR, ex.getMessage()));
  }
}
