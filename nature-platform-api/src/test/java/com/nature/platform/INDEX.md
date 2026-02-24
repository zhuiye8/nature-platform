<!-- FORMAT-DOC: Update when files in this folder change -->

# platform

Backend test folder containing unit-level regression coverage for core workflow and numbering rules.

## Files

| File | Role | Responsibilities |
|---|---|---|
| ContractNumberServiceTests.java | Test | Verifies contract number/name generation scenarios |
| NaturePlatformApplicationTests.java | Test | Verifies JWT issue and username/scope claim parse baseline behavior |
| ProjectRegisterServiceTests.java | Test | Verifies project-register submit/approve Flowable writeback and trace behavior |
| QualityReviewServiceTests.java | Test | Verifies quality-review assignment concurrency and mandatory-assignment submit gate |
| RecycleBinServiceTests.java | Test | Verifies recycle-bin restore super-admin permission and invalid-type guards |
| UserAccountServiceTests.java | Test | Verifies role-filter candidate SQL ordering and empty-role fallback behavior |
| WorkflowTaskServiceTests.java | Test | Verifies workflow todo role-permission rules and contract/project/quality/report action dispatch |
