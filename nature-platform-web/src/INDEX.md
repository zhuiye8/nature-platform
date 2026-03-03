<!-- FORMAT-DOC: Update when files in this folder change -->

# src

Changed-source index for current turn.

## Files

| File | Role | Responsibilities |
|---|---|---|
| AdminWorkflowView.vue | View | Node rule editor removes legacy min/max/sort fields and keeps slot-role-required only |
| DashboardView.vue | View | Dashboard quick entries now strictly permission-filtered with clean Chinese copy |
| LoginView.vue | View | Login form defaults cleared to avoid preset admin credentials |
| admin-service.ts | Service | Workflow node-rule contract removed min/max/sort and aligned with backend DTOs |
