# @nature/terminal

Electron 离线测评终端（V2 阶段实现）。

## 技术栈
- Electron + Vue 3 + Element Plus + better-sqlite3
- 与 @nature/web 共享 Vue 组件
- 与 @nature/shared 共享类型定义和校验逻辑

## 数据交换
- 平台导出 .npkg 包 → 终端导入
- 终端采集数据 → 导出 .npkg 包 → 平台导入合并

详见 `docs/ARCHITECTURE_DECISION.md` 第 13-14 章。
