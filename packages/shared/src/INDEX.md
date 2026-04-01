<!-- FORMAT-DOC: Update when files in this folder change -->

# packages/shared/src

共享源码根目录，对外统一导出跨包复用的类型、常量和 Zod 校验器。
前端与服务端都应优先依赖这里的公共契约，避免重复定义。

## Files

| File | Role | Responsibilities |
|---|---|---|
| index.ts | Barrel | 统一导出 `types`、`constants` 与 `validators` 子模块 |
