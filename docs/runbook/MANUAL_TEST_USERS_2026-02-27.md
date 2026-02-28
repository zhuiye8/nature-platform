# 人工测试账号清单（2026-02-27）

用途：临时人工测试账号（非迁移文件），测完可一键清理。

## 账号对照表

| 账号 | 姓名 | 初始密码 | 默认角色 |
|---|---|---|---|
| `xiebaojian` | 谢宝建 | `123456` | `ROLE_USER` |
| `zhangyusong` | 张渝松 | `123456` | `ROLE_USER` |
| `chenxindong` | 陈新东 | `123456` | `ROLE_USER` |
| `songxiuzhen` | 宋秀珍 | `123456` | `ROLE_USER` |
| `chenyanwen` | 陈彦文 | `123456` | `ROLE_USER` |
| `wangxialin` | 王霞林 | `123456` | `ROLE_USER` |
| `yangquansen` | 杨泉森 | `123456` | `ROLE_USER` |
| `songnianting` | 宋年婷 | `123456` | `ROLE_USER` |
| `luyuxin` | 卢雨欣 | `123456` | `ROLE_USER` |
| `gengyu` | 耿宇 | `123456` | `ROLE_USER` |
| `lixu` | 李旭 | `123456` | `ROLE_USER` |
| `tangting` | 汤婷 | `123456` | `ROLE_USER` |

## 一键清理命令

```powershell
docker compose -f C:\work\nature\codex\deploy\compose\docker-compose.yml exec -T mysql mysql -uroot -p123456 -D nature_platform -e "DELETE FROM user_role WHERE username IN ('xiebaojian','zhangyusong','chenxindong','songxiuzhen','chenyanwen','wangxialin','yangquansen','songnianting','luyuxin','gengyu','lixu','tangting'); DELETE FROM user_account WHERE username IN ('xiebaojian','zhangyusong','chenxindong','songxiuzhen','chenyanwen','wangxialin','yangquansen','songnianting','luyuxin','gengyu','lixu','tangting');"
```

