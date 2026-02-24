/**
 * @input MinioProperties from config; MinioClient builder from io.minio
 * @output Conditional MinioClient bean for object storage operations
 * @position Infrastructure adapter factory for S3-compatible file storage integration
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import io.minio.MinioClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MinioConfig {
  @Bean
  @ConditionalOnProperty(prefix = "app.minio", name = "enabled", havingValue = "true")
  MinioClient minioClient(MinioProperties minioProperties) {
    return MinioClient.builder()
        .endpoint(minioProperties.getEndpoint())
        .credentials(minioProperties.getAccessKey(), minioProperties.getSecretKey())
        .build();
  }
}

