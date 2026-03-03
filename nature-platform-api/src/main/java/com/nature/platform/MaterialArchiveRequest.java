/**
 * @input Material archive save payload with checklist enum codes plus report/form file object-key collections
 * @output MaterialArchiveRequest DTO for node-16 archive draft/submit operations with material-status checklist
 * @position Node-16 input contract for final material archive status+package persistence
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.List;

public class MaterialArchiveRequest {
  private List<String> materialStatusCodes = new ArrayList<>();
  private List<String> reportFiles = new ArrayList<>();
  private List<String> formFiles = new ArrayList<>();

  @Size(max = 1000)
  private String remark;

  public List<String> getMaterialStatusCodes() {
    return materialStatusCodes;
  }

  public void setMaterialStatusCodes(List<String> materialStatusCodes) {
    this.materialStatusCodes =
        materialStatusCodes == null ? new ArrayList<>() : materialStatusCodes;
  }

  public List<String> getReportFiles() {
    return reportFiles;
  }

  public void setReportFiles(List<String> reportFiles) {
    this.reportFiles = reportFiles == null ? new ArrayList<>() : reportFiles;
  }

  public List<String> getFormFiles() {
    return formFiles;
  }

  public void setFormFiles(List<String> formFiles) {
    this.formFiles = formFiles == null ? new ArrayList<>() : formFiles;
  }

  public String getRemark() {
    return remark;
  }

  public void setRemark(String remark) {
    this.remark = remark;
  }
}
