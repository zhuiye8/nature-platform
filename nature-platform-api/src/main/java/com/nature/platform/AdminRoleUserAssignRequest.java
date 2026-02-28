/**
 * @input Usernames selected from role-assignment UI transfer list
 * @output AdminRoleUserAssignRequest payload for replacing role-to-user mappings
 * @position IAM write contract for assigning or unassigning users by role
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;

public class AdminRoleUserAssignRequest {
  private List<String> usernames = new ArrayList<>();

  public List<String> getUsernames() {
    return usernames;
  }

  public void setUsernames(List<String> usernames) {
    this.usernames = usernames == null ? new ArrayList<>() : usernames;
  }
}
