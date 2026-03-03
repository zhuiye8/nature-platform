/**
 * @input DingTalk organization sync runtime counts and execution metadata
 * @output AdminDingTalkSyncResult DTO returned by admin sync endpoints
 * @position Integration read model for reporting sync summary to management UI
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public record AdminDingTalkSyncResult(
    int departmentTotal,
    int departmentInserted,
    int departmentUpdated,
    int userTotal,
    int userInserted,
    int userUpdated,
    int userDisabled) {}
