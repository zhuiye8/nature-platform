/**
 * @input Optional MinioClient, MinioProperties, MultipartFile, and ApiResponse
 * @output /api/v1/files/upload and /api/v1/files/download-url endpoints for file upload and task-scoped direct-download URL retrieval
 * @position File asset HTTP adapter that enforces upload entry contract and attachment ownership checks for workflow downloads
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import io.minio.GetPresignedObjectUrlArgs;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.http.Method;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/files")
public class FileAssetController {
  private static final int DOWNLOAD_URL_EXPIRE_SECONDS = 600;
  private static final List<String> PROJECT_TASK_TYPES =
      List.of(
          "PROJECT_REGISTER",
          "REPORT_TECH_REVIEW",
          "REPORT_CONTENT_REVIEW",
          "REPORT_FINAL_REVIEW");

  private final Optional<MinioClient> minioClient;
  private final MinioProperties minioProperties;
  private final WorkflowTaskService workflowTaskService;
  private final ProcessOverviewService processOverviewService;
  private final ContractService contractService;

  public FileAssetController(
      Optional<MinioClient> minioClient,
      MinioProperties minioProperties,
      WorkflowTaskService workflowTaskService,
      ProcessOverviewService processOverviewService,
      ContractService contractService) {
    this.minioClient = minioClient;
    this.minioProperties = minioProperties;
    this.workflowTaskService = workflowTaskService;
    this.processOverviewService = processOverviewService;
    this.contractService = contractService;
  }

  @PostMapping("/upload")
  public ResponseEntity<ApiResponse<Map<String, Object>>> upload(
      Authentication authentication, @RequestPart("file") MultipartFile file) {
    if (file.isEmpty()) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST)
          .body(ApiResponse.failure(ErrorCode.VALIDATION_ERROR, "file is empty"));
    }

    String username = authentication == null ? "anonymous" : authentication.getName();
    String objectKey = OffsetDateTime.now().toLocalDate() + "/" + UUID.randomUUID() + "-" + file.getOriginalFilename();

    try {
      if (minioProperties.isEnabled() && minioClient.isPresent()) {
        ensureBucket(minioClient.get(), minioProperties.getBucket());
        try (InputStream stream = file.getInputStream()) {
          minioClient.get()
              .putObject(
                  PutObjectArgs.builder()
                      .bucket(minioProperties.getBucket())
                      .object(objectKey)
                      .contentType(file.getContentType())
                      .stream(stream, file.getSize(), -1)
                      .build());
        }
      }
    } catch (Exception ex) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(ApiResponse.failure(ErrorCode.WORKFLOW_ERROR, "upload failed: " + ex.getMessage()));
    }

    return ResponseEntity.ok(
        ApiResponse.success(
            Map.of(
                "objectKey", objectKey,
                "size", file.getSize(),
                "uploader", username,
                "storage", minioProperties.isEnabled() ? "MINIO" : "DISABLED")));
  }

  @GetMapping("/download-url")
  public ResponseEntity<ApiResponse<Map<String, Object>>> downloadUrl(
      Authentication authentication,
      @RequestParam("objectKey") String objectKey,
      @RequestParam("taskType") String taskType,
      @RequestParam("bizId") long bizId) {
    if (objectKey == null || objectKey.isBlank()) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST)
          .body(ApiResponse.failure(ErrorCode.VALIDATION_ERROR, "objectKey is required"));
    }
    if (taskType == null || taskType.isBlank()) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST)
          .body(ApiResponse.failure(ErrorCode.VALIDATION_ERROR, "taskType is required"));
    }
    if (bizId <= 0) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST)
          .body(ApiResponse.failure(ErrorCode.VALIDATION_ERROR, "bizId is invalid"));
    }
    if (!minioProperties.isEnabled() || minioClient.isEmpty()) {
      return ResponseEntity.status(HttpStatus.CONFLICT)
          .body(ApiResponse.failure(ErrorCode.WORKFLOW_ERROR, "object storage is disabled"));
    }

    String username = authentication == null ? "anonymous" : authentication.getName();
    String normalizedObjectKey = objectKey.trim();
    String normalizedTaskType = taskType.trim().toUpperCase(Locale.ROOT);
    try {
      workflowTaskService.ensureTaskAccessible(username, normalizedTaskType, bizId);
      ensureObjectKeyOwnedByTask(normalizedTaskType, bizId, normalizedObjectKey);
    } catch (ResponseStatusException ex) {
      ErrorCode errorCode = mapErrorCode(ex.getStatusCode().value());
      return ResponseEntity.status(ex.getStatusCode())
          .body(ApiResponse.failure(errorCode, ex.getReason()));
    }

    try {
      String url =
          minioClient
              .get()
              .getPresignedObjectUrl(
                  GetPresignedObjectUrlArgs.builder()
                      .method(Method.GET)
                      .bucket(minioProperties.getBucket())
                      .object(normalizedObjectKey)
                      .expiry(DOWNLOAD_URL_EXPIRE_SECONDS, TimeUnit.SECONDS)
                      .build());
      OffsetDateTime expiresAt = OffsetDateTime.now().plusSeconds(DOWNLOAD_URL_EXPIRE_SECONDS);
      return ResponseEntity.ok(
          ApiResponse.success(
              Map.of(
                  "objectKey", normalizedObjectKey,
                  "taskType", normalizedTaskType,
                  "bizId", bizId,
                  "url", url,
                  "expiresAt", expiresAt.toString(),
                  "requestedBy", username)));
    } catch (Exception ex) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(ApiResponse.failure(ErrorCode.WORKFLOW_ERROR, "download url generate failed: " + ex.getMessage()));
    }
  }

  private void ensureBucket(MinioClient client, String bucket) throws Exception {
    boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
    if (!exists) {
      client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
    }
  }

  private void ensureObjectKeyOwnedByTask(String taskType, long bizId, String objectKey) {
    if ("CONTRACT".equals(taskType)) {
      ContractRecord contract =
          contractService
              .findById(bizId)
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "contract not found"));
      if (!matchesObjectKey(contract.getContractFileObjectKey(), objectKey)) {
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN, "objectKey does not belong to current contract task");
      }
      return;
    }
    if (!PROJECT_TASK_TYPES.contains(taskType)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unsupported task type");
    }
    boolean matched =
        processOverviewService.load(bizId).getAttachments().stream()
            .map(ProcessOverviewRecord.AttachmentItem::getObjectKey)
            .anyMatch(item -> matchesObjectKey(item, objectKey));
    if (!matched) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "objectKey does not belong to current workflow task");
    }
  }

  private boolean matchesObjectKey(String source, String target) {
    return source != null && source.trim().equals(target);
  }

  private ErrorCode mapErrorCode(int httpStatus) {
    if (httpStatus == HttpStatus.BAD_REQUEST.value()) {
      return ErrorCode.VALIDATION_ERROR;
    }
    if (httpStatus == HttpStatus.NOT_FOUND.value()) {
      return ErrorCode.NOT_FOUND;
    }
    if (httpStatus == HttpStatus.FORBIDDEN.value()) {
      return ErrorCode.AUTH_FORBIDDEN;
    }
    return ErrorCode.WORKFLOW_ERROR;
  }
}
