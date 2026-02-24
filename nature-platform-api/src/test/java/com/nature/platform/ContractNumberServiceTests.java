/**
 * @input ContractNumberService and contract-system payload inputs
 * @output Unit tests for contract number/name formatting and service-year display rules
 * @position Domain-rule test layer ensuring deterministic contract naming behavior
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;

class ContractNumberServiceTests {
  private final ContractNumberService service = new ContractNumberService();

  @Test
  void shouldFormatContractNo() {
    assertEquals("YZN-2026-0007", service.buildContractNo(2026, 7));
  }

  @Test
  void shouldFormatContinuousYearsAsRange() {
    assertEquals("2026-2028", service.formatServiceYears(List.of(2026, 2027, 2028)));
  }

  @Test
  void shouldFormatDiscreteYearsAsCsv() {
    assertEquals("2026,2028,2029", service.formatServiceYears(List.of(2026, 2028, 2029)));
  }

  @Test
  void shouldSummarizeSystemsWhenMoreThanThree() {
    ContractSystemItemPayload a = new ContractSystemItemPayload();
    a.setSystemLevel(2);
    a.setSystemName("A");
    ContractSystemItemPayload b = new ContractSystemItemPayload();
    b.setSystemLevel(2);
    b.setSystemName("B");
    ContractSystemItemPayload c = new ContractSystemItemPayload();
    c.setSystemLevel(3);
    c.setSystemName("C");
    ContractSystemItemPayload d = new ContractSystemItemPayload();
    d.setSystemLevel(3);
    d.setSystemName("D");

    assertEquals("二级系统2个,三级系统2个", service.formatSystemDisplay(List.of(a, b, c, d)));
  }
}

