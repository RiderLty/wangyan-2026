# 技术决策记录（DECISIONS）

> 追加式，编号递增，禁止删除旧条目。已定的决策不许无故推翻；要推翻，新增一条说明原因。
> "理由"一栏请写充分些——以后可以直接搬进论文。

## D-000：技术栈核心锁定

- 日期：2026-09-05
- 背景：论文大纲第 2 章已按固定技术栈撰写，实现必须与论文一致。
- 选项：锁定 vs 放开
- 决定：核心锁定——React 18 + TypeScript + Ant Design / NestJS / PostgreSQL(JSONB) / Redis / Yjs + WebSocket / JWT / Docker + Docker Compose。
- 理由：论文第 2 章逐一介绍了这些技术，若实现与论文不符会造成答辩硬伤；Yjs（CRDT）是实时协作的核心卖点（论文 7.2.1）。
- 影响论文小节：第2章全部、4.1.1、7.2.1

## D-001：Markdown 编辑器选型（Tiptap vs Vditor）

- 日期：2026-09-05
- 背景：大纲 2.1.3 需要选型对比，实现必须用选中的那一个，禁止两个都装。
- 选项：Tiptap（基于 ProseMirror，Headless，配合 Yjs 生态成熟）/ Vditor（开箱即用，中文文档友好，三种编辑模式）
- 决定：**Tiptap**
- 理由：本项目核心卖点是 CRDT 实时协作（论文 7.2.1），Tiptap 基于 ProseMirror，官方提供 y-prosemirror 集成，与 Yjs/Awareness（多光标）生态成熟，协作实现路径最短；Vditor 虽开箱即用但与 Yjs 集成缺乏成熟方案，实时协作是其短板。对比本身可直接写进论文 2.1.3。
- 影响论文小节：2.1.3、5.3.1、5.3.2、5.4.2

## D-002：ORM 选型（TypeORM vs Prisma）

- 日期：2026-09-05
- 背景：NestJS 后端需要 ORM 访问 PostgreSQL。
- 选项：TypeORM（NestJS 官方集成好，装饰器风格与 NestJS 一致）/ Prisma（类型安全强，schema 即文档）
- 决定：**TypeORM**
- 理由：@nestjs/typeorm 是 NestJS 官方集成，实体用装饰器定义，与 NestJS 依赖注入风格一致，代码样例在论文 5 章中更易讲解；JSONB 列支持成熟（论文 2.3.1 要求用 JSONB 存笔记正文）；synchronize 模式便于开发期建表，最终导出 DDL 作附录 A。
- 影响论文小节：2.3.1、4.3、5.1.2

## D-003：项目组织方式（monorepo）

- 日期：2026-09-05
- 背景：前后端分离，需约定仓库结构。
- 选项：pnpm workspace monorepo（apps/web + apps/server）/ 两个独立仓库 / 单仓简单分目录
- 决定：**pnpm workspace monorepo**（apps/web + apps/server + packages/shared）
- 理由：一套脚本管理前后端；packages/shared 放前后端共用的 TS 类型与 DTO，避免接口定义手写两遍对不上；目录结构本身可作为论文 5.1.2 的素材。
- 影响论文小节：5.1.2

## D-005：开发/部署拓扑（NAS 数据库 + Mac 开发）

- 日期：2026-09-05
- 背景：原 LXC 容器（NAS 内）根文件系统为 shfs（FUSE）、Docker 存储驱动为 vfs，IO 极慢；用户要求不破坏 NAS 环境；演示仅需 PPT 截图。
- 选项：LXC 内开发 / 全容器化 / NAS 常驻数据库容器 + Mac 原生开发
- 决定：**NAS（192.168.3.3）用两条 docker run 部署 postgres:16-alpine(:15432) 与 redis:7-alpine(:16379)，数据根目录 /mnt/user/appdata/wangyan-2026/；Mac mini（192.168.3.177，Apple Silicon）原生跑 Node 开发（无容器）；代码经 NAS 上的 bare 仓库（/mnt/user/storage/Projects/wangyan-2026.git）同步**。
- 理由：NAS 7×24 在线适合常驻数据库，Mac 开发体验最好；LXC 的 shfs+vfs 组合不适合开发也不适合构建；高位端口因 NAS 已被占用（原生 postgres 5432、redis 6379、neko-master 3000）；数据集中一个目录便于迁移备份，docker rm -f 即完全清除。
- 附件：部署命令存档于根目录 `nas-db-setup.sh`（⚠️ 含密码，禁止公开）；NAS Docker 24.0.9 无 compose 插件，故不用 compose 部署。
- 状态：**容器尚未部署**（用户要求手动执行脚本），Mac 工具链（brew/node/pnpm）尚未安装。数据目录变更见 D-006。
- 影响论文小节：2.5、5.1.1、5.1.3、5.9

## D-004：目录组织与 Docker 编排方案

- 日期：2026-09-05
- 背景：脚手架搭建前需确定前后端、数据库、Docker 的组织方式（用户已确认）。
- 选项：详见本次会话讨论（单体分目录 vs workspace 分包；compose 单文件 vs 分 dev/prod）
- 决定：
  - `apps/web`（React 18 + Vite + TS + Antd），页面按论文模块分目录，Yjs 协作逻辑独立为 `src/collaboration/` 层；
  - `apps/server`（NestJS 模块化单体），`src/modules/` 下一个目录 = 论文一个模块：auth / users / notes / realtime / teams / share / versions / recycle-bin / export；
  - `packages/shared`：前后端共享类型；
  - 数据库不单独建应用：PostgreSQL、Redis 是 compose 服务 + 数据卷，表结构以 TypeORM 实体为唯一事实来源；
  - Docker：单份 `docker-compose.yml` 编排 4 服务（postgres / redis / server / web），server 与 web 各写多阶段构建 Dockerfile，web 生产镜像内用 nginx 托管；开发期仅容器化 db/redis，前后端本地跑热重载。
- 理由：模块目录与论文小节一一对应，"论文可引用代码"的映射天然成立；compose 单文件配合多阶段构建即可同时满足开发与"一键启动"演示（论文 5.9）。
- 影响论文小节：4.1.1、4.1.3、5.1.2、5.1.3、5.9、附录B

## D-006：NAS 数据库数据目录变更（修订 D-005）

- 日期：2026-09-08
- 背景：D-005 原定数据根目录为 `/mnt/user/appdata/wangyan-2026/`；用户指定改为 `/mnt/user/storage/Projects/wangyan-2026-db-data/`，与 NAS 上的项目 bare 仓库（/mnt/user/storage/Projects/wangyan-2026.git）同盘同区，项目相关数据集中一处管理。
- 选项：维持原 appdata 目录 / 移至 storage/Projects 下
- 决定：数据根目录改为 **`/mnt/user/storage/Projects/wangyan-2026-db-data/`**（内含 postgres/、redis/ 两个子目录）。
- 理由：与代码仓库同处一个 Projects 目录，项目资产（代码 + 数据）一体化，备份与"清干净重来"的边界更清晰；不改变 D-005 的其余拓扑（NAS 容器 + Mac 开发、高位端口不变）。
- 影响文件：nas-db-setup.sh、README.md
- 影响论文小节：2.5、5.1.3（部署描述按新目录撰写）

## D-007：数据库设计总案（13 表 + 4 视图）

- 日期：2026-09-08
- 背景：进入 5.2 前需定全库表结构。大纲 4.3 点名 7 张表（users/teams/team_members/notes/note_versions/share_links/recycle_bin）为实现底线，另有 4 个设计缺口需决策。
- 选项与决定（均经用户确认）：
  1. 文件夹：新增 folders 表（自引用嵌套），支撑 5.3.3
  2. Yjs 与 JSONB 共存：notes.content 存 ProseMirror 快照 JSONB（满足"正文 JSONB"锁定约束，供列表/搜索/导出/版本） + yjs_updates 表存 CRDT 二进制增量（bytea，追加式），定时合并回写快照——Y-Websocket 持久化的标准做法
  3. 回收站：notes.deleted_at 软删标记 + recycle_bin 只记删除元数据（谁/何时/何时到期），笔记本体不搬家，保住外键引用
  4. 版本策略：手动 + 关键事件快照（回滚前、编辑会话结束且有变更），不做纯定时
  5. 颗粒度：team_invitations 从 team_members 拆出（邀请≠成员，两个生命周期）；枚举一律 varchar+CHECK（不用 PG enum，扩展友好）
  6. 增项：加 tags+note_tags（标签双维度分类）与 attachments（附件，文件本体落盘只存元数据）；**不加**审计日志、登录设备管理（用户明确取舍）
  7. 视图：v_active_notes / v_team_overview / v_recycle_bin_items / v_note_latest_version，只读统计走视图、CRUD 走基表
  8. 受控反规范化 4 处（content_text 派生列、recycle_bin 快照、版本快照、owner 双重表达），均记录理由，论文 4.3 主动交代
- 理由：表结构与大纲 4.3 逐节对齐保证论文-实现一致；Yjs 增量与快照分离兼顾实时性与查询性能；邀请/成员拆表符合生命周期建模；uuid 主键 + varchar+CHECK 为后续扩展留余地。
- 设计稿：docs/diagrams/database-design.md（表结构/范式分析/索引/视图/Redis 键/RBAC 落表）
- 影响论文小节：4.3 全部、4.4.2、4.5、5.3.3、5.5.2、附录A

## D-008：5.3 笔记管理实现策略（搜索/自动保存/实时预览/索引调整）

- 日期：2026-09-08
- 背景：D-007 设计稿落地为代码时，有几处需要定实现策略。
- 选项与决定：
  1. **搜索**：content_text 派生列 + ILIKE '%kw%'（通配符转义），不引入 tsvector/GIN。理由：'simple' 分词器不切分中文，tsvector 对中文子串匹配基本无效；演示数据量下 ILIKE 足够，zhparser 列入 7.3 改进方向。设计稿 gin_notes_search 随之取消，论文如实写
  2. **实时预览**：Tiptap input rules 即时渲染（输入 "# "/"- "/"> " 转换为富文本），即"所写即所见"；不做左源码右预览双栏。理由：D-001 选 Tiptap 的意义就在于编辑视图即渲染视图，双栏模式是 Vditor 的形态；5.4 实时协作也只在 Tiptap 上成立
  3. **自动保存**：编辑停顿 800ms 防抖 PATCH /notes/:id，状态栏四态（已保存/有未保存修改/保存中/失败）；空标题不落库，服务端 trim 后兜底为"未命名笔记"
  4. **folders 唯一约束**：typeorm 0.3.31 不支持表达式索引装饰器，建普通 (owner_id,parent_id,name) 唯一索引，"根级 NULL 不去重"由服务层 assertNameAvailable 显式查重兜底（设计稿 §3.2 已回写）
  5. **URL 深链**：工作台支持 ?q=（初始搜索词）与 ?note=（直达笔记），作为可分享链接，同时支撑 headless 截图
- 新增依赖：@ant-design/icons@^5（图标，antd5 生态配套，pnpm 严格模式须显式声明）；@tiptap/extension-placeholder（空文档占位提示）
- 影响论文小节：5.3.1、5.3.2、5.3.4、4.6.2

## D-009：实时协作架构落地（5.4，Yjs + WebSocket）

- 日期：2026-09-09
- 背景：D-007 已定"yjs_updates 增量日志 + notes.content 快照"分工，5.4 需选服务端实现与持久化机制。
- 选项：① y-websocket 参考实现（setupWSConnection）+ 自定义持久化适配器；② 基于原生 ws 手写 y-protocols 同步；③ NestJS @WebSocketGateway 网关自建协议
- 决定：**①**。理由：y-websocket 是 Yjs 官方推荐的服务端参考实现（含 ping 保活、awareness 广播、末连接销毁等完整细节），配合自定义 IDatabasePersistence（bindState/writeState）即可落 D-007 的增量/快照分工；②重复造轮子且易错；③绕开官方生态。
- 要点：
  1. **挂载方式**：不启用 Nest WsAdapter，在 main.ts 手动处理 HTTP server 的 upgrade 事件（/ws/:noteId），与 REST 共进程共端口（论文 4.1.1 网关层）
  2. **握手鉴权**：浏览器 WebSocket 无法带 Authorization 头 → token 走查询参数，upgrade 期校验 JWT（复用 AuthModule 的 JwtModule）+ 笔记归属，失败 401
  3. **播种转换**：y-prosemirror 官方 prosemirrorJSONToYXmlFragment 需要 PM Schema（服务端无），按其 sync-plugin 的存储映射（marks→同名属性、text→XmlText delta）写 schema-free 的 pmJsonToYFragment；反向回写用官方 yXmlFragmentToProsemirrorJSON（schema-free）
  4. **增量缓冲**：每帧增量缓冲 2s 用 Y.mergeUpdates 合并成一帧入库，避免逐键写行
  5. **防误清保护**：writeState 时"会话文档为空且库中快照非空"→ 跳过回写（调试期真实发生过空会话清空正文的事故，详见 CHANGELOG）
  6. **前端会话生命周期**：Y.Doc/WebsocketProvider 必须用 useEffect 管理（useMemo 在 StrictMode 下双调用会泄漏连接，产生幽灵在线用户）
- 新增依赖：y-websocket@^2.1、y-prosemirror@^1.3.7（server+web）
- 影响论文小节：4.4.1、4.4.2、4.4.3、4.6.4、5.4.1~5.4.5、7.2.1

## D-010：分享模块与访客协作实现（5.6）

- 日期：2026-09-10
- 背景：share_links 需要链接生成/访问控制/有效期管理三件套；访客"可编辑"如何落地需决策。
- 选项（访客编辑）：① 访客只读快照+邮件/注册后编辑（削弱演示效果）；② 访客以 share-token 鉴权进 Yjs 实时协作（与 5.4 同一条链路）
- 决定：**②**。理由：分享 token 本身即凭证（论文 4.5.4），edit 链接的访客走 `?share=token` 的 WS 握手鉴权进入同一 Yjs 文档，与登录用户实时协作——把 7.2.1 CRDT 卖点延伸到访客角色；只读链接拒绝连接防写穿。
- 要点：
  1. token 用 Node crypto randomBytes(16).hex（32 位，等价 nanoid 语义）——零新依赖
  2. 公开解析统一 404 防枚举（停用/过期/已删/伪造同文案）；元数据 Redis 缓存 60s（cache:share:{token}），管理端变更即时失效；visit_count 不缓存实时累加
  3. 分享权限 = 笔记 owner 或团队 owner/admin（分享是扩权动作，普通成员不可）
  4. **播种竞态修复**（真实事故）：y-websocket 不 await bindState，"连接即断→writeState 销毁→新连接再播种"会让同一快照出现两份（CRDT 两处位置）。修复：CollaborationPersistence 按笔记加异步互斥锁，bindState/writeState 串行化
- 新增依赖：dayjs@web（antd5 DatePicker 生态标准件，pnpm 严格模式须显式声明）
- 影响论文小节：4.3.7、4.5.4、4.6.2 补充、5.6.1~5.6.4、7.2.1
