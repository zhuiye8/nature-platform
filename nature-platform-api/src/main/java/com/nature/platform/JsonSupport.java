/**
 * @input ObjectMapper from Jackson; JSON text payloads persisted in database columns
 * @output toJson() and fromJsonList() helpers for compact list serialization/deserialization
 * @position Shared serialization utility layer for JSON-backed domain fields
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Collections;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class JsonSupport {
  private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
  private static final TypeReference<List<Integer>> INTEGER_LIST = new TypeReference<>() {};

  private final ObjectMapper objectMapper;

  public JsonSupport(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public String toJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException ex) {
      throw new IllegalArgumentException("json serialize failed", ex);
    }
  }

  public List<String> fromJsonList(String raw) {
    if (raw == null || raw.isBlank()) {
      return Collections.emptyList();
    }
    try {
      return objectMapper.readValue(raw, STRING_LIST);
    } catch (JsonProcessingException ex) {
      throw new IllegalArgumentException("json parse failed", ex);
    }
  }

  public List<Integer> fromJsonIntList(String raw) {
    if (raw == null || raw.isBlank()) {
      return Collections.emptyList();
    }
    try {
      return objectMapper.readValue(raw, INTEGER_LIST);
    } catch (JsonProcessingException ex) {
      throw new IllegalArgumentException("json parse failed", ex);
    }
  }
}
