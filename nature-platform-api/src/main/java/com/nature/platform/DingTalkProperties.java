/**
 * @input ConfigurationProperties from Spring Boot; app.dingtalk namespace from environment
 * @output DingTalkProperties bean with corp app credentials and callback settings
 * @position Integration configuration layer for DingTalk login and organization sync
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.dingtalk")
public class DingTalkProperties {
  private String appKey = "";
  private String appSecret = "";
  private String corpId = "";
  private String redirectUri = "";
  private String callbackBase = "";
  private String frontendRedirectUri = "";
  private String frontendRedirectOrigins = "";

  public String getAppKey() {
    return appKey;
  }

  public void setAppKey(String appKey) {
    this.appKey = appKey;
  }

  public String getAppSecret() {
    return appSecret;
  }

  public void setAppSecret(String appSecret) {
    this.appSecret = appSecret;
  }

  public String getCorpId() {
    return corpId;
  }

  public void setCorpId(String corpId) {
    this.corpId = corpId;
  }

  public String getRedirectUri() {
    return redirectUri;
  }

  public void setRedirectUri(String redirectUri) {
    this.redirectUri = redirectUri;
  }

  public String getCallbackBase() {
    return callbackBase;
  }

  public void setCallbackBase(String callbackBase) {
    this.callbackBase = callbackBase;
  }

  public String getFrontendRedirectUri() {
    return frontendRedirectUri;
  }

  public void setFrontendRedirectUri(String frontendRedirectUri) {
    this.frontendRedirectUri = frontendRedirectUri;
  }

  public String getFrontendRedirectOrigins() {
    return frontendRedirectOrigins;
  }

  public void setFrontendRedirectOrigins(String frontendRedirectOrigins) {
    this.frontendRedirectOrigins = frontendRedirectOrigins;
  }
}
