# ADR-001 技术栈拍板

状态：Accepted  
日期：2026-02-09

## 决策

- 后端：Java 21 + Spring Boot 3.5.x
- 前端：Vue 3.5.x + Vite 7.x + Element Plus 2.13.x
- 数据：MySQL 8.4 + Redis 8.4 + MinIO
- 流程引擎：Flowable 7.2.0

## 原因

- 适配本地机房 + 小团队维护成本
- 满足 V1 16 节点流程与审核编排需求
- 保持与既有 Java/Vue 技能栈一致，降低学习成本

## 影响

- 先做模块化单体，不拆微服务
- 后续 V2 可基于模块边界平滑拆分

