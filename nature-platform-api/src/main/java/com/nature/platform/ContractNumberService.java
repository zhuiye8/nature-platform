/**
 * @input Contract system items, service years, and serial allocation inputs
 * @output Contract number/name generation utilities aligned with requirement rules
 * @position Domain rule service for deterministic contract naming/numbering behavior
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ContractNumberService {
  private static final ZoneId ZONE_ID = ZoneId.of("Asia/Shanghai");

  public int currentYear() {
    return LocalDate.now(ZONE_ID).getYear();
  }

  public String buildContractNo(int year, int seq) {
    return "YZN-" + year + "-" + String.format("%04d", seq);
  }

  public String buildContractName(
      String customerName, List<ContractSystemItemPayload> systemItems, List<Integer> serviceYears) {
    return customerName + "-" + formatSystemDisplay(systemItems) + "-" + formatServiceYears(serviceYears);
  }

  public String formatSystemDisplay(List<ContractSystemItemPayload> systemItems) {
    if (systemItems == null || systemItems.isEmpty()) {
      return "系统未设置";
    }

    List<ContractSystemItemPayload> sorted = new ArrayList<>(systemItems);
    sorted.sort((a, b) -> Integer.compare(a.getSystemLevel(), b.getSystemLevel()));
    if (sorted.size() <= 3) {
      List<String> names = sorted.stream().map(ContractSystemItemPayload::getSystemName).toList();
      return String.join("、", names);
    }

    long level2Count = sorted.stream().filter(item -> item.getSystemLevel() == 2).count();
    long level3Count = sorted.stream().filter(item -> item.getSystemLevel() == 3).count();
    return "二级系统" + level2Count + "个,三级系统" + level3Count + "个";
  }

  public String formatServiceYears(List<Integer> years) {
    if (years == null || years.isEmpty()) {
      return "未设置年份";
    }

    List<Integer> sorted = new ArrayList<>(years);
    Collections.sort(sorted);
    boolean continuous = true;
    for (int i = 1; i < sorted.size(); i++) {
      if (sorted.get(i) - sorted.get(i - 1) != 1) {
        continuous = false;
        break;
      }
    }
    if (continuous) {
      return sorted.size() == 1 ? String.valueOf(sorted.get(0)) : sorted.get(0) + "-" + sorted.get(sorted.size() - 1);
    }
    return sorted.stream().map(String::valueOf).reduce((a, b) -> a + "," + b).orElse("未设置年份");
  }
}

