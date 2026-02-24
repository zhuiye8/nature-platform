/**
 * @input SpringApplication from org.springframework.boot; SecurityProperties/DingTalkProperties/MinioProperties local config types
 * @output NaturePlatformApplication bootstrap entry for the backend service runtime
 * @position Application bootstrap layer that initializes timezone and starts all module components
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.TimeZone;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({
  SecurityProperties.class,
  DingTalkProperties.class,
  MinioProperties.class
})
public class NaturePlatformApplication {

  public static void main(String[] args) {
    TimeZone.setDefault(TimeZone.getTimeZone("Asia/Shanghai"));
    SpringApplication.run(NaturePlatformApplication.class, args);
  }
}

