/**
 * @input Contract project-name fuzzy search matches and exact-existence check result
 * @output ContractProjectNameSuggestionResponse payload for contract-create project-name autocomplete
 * @position Contract auxiliary read model for project-name dedup hints in create/edit forms
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;

public class ContractProjectNameSuggestionResponse {
  private List<String> items = new ArrayList<>();
  private boolean exactExists;

  public List<String> getItems() {
    return items;
  }

  public void setItems(List<String> items) {
    this.items = items == null ? new ArrayList<>() : items;
  }

  public boolean isExactExists() {
    return exactExists;
  }

  public void setExactExists(boolean exactExists) {
    this.exactExists = exactExists;
  }
}
