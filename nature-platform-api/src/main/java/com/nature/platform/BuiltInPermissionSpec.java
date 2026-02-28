/**
 * @input Built-in permission metadata from backend registry declarations
 * @output BuiltInPermissionSpec immutable descriptor for startup synchronization and manual sync APIs
 * @position IAM registry model representing system-owned permission seeds
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public record BuiltInPermissionSpec(
    String permissionCode, String permissionName, String category, String description) {}
