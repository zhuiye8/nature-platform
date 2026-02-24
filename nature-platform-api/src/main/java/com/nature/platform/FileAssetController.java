/**
 * @input Optional MinioClient, MinioProperties, MultipartFile, and ApiResponse
 * @output /api/v1/files/upload endpoint for baseline file asset upload behavior
 * @position File asset HTTP adapter that enforces upload entry contract for workflow documents
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/files")
public class FileAssetController {
  private final Optional<MinioClient> minioClient;
  private final MinioProperties minioProperties;

  public FileAssetController(Optional<MinioClient> minioClient, MinioProperties minioProperties) {
    this.minioClient = minioClient;
    this.minioProperties = minioProperties;
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

  private void ensureBucket(MinioClient client, String bucket) throws Exception {
    boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
    if (!exists) {
      client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
    }
  }
}

