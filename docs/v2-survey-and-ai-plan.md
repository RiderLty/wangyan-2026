# 在线 Markdown 笔记协作平台 v2.0 ——开源竞品调研报告与 AI Agent 开发计划

> 用途：向导师论证项目创新点、回应"与腾讯文档/WPS 等商业产品是否重复"的质疑，并作为 v2.0（AI 增强版）的开发依据。
> 调研时间：2026-10-07。所有引用均附来源链接，数据以当日检索为准。
> 关联文档：`docs/THESIS_OUTLINE.md`（v1 功能范围）、`docs/memory/PROGRESS.md`（v1 完成度：第 5 章 5.1~5.9 全部实现，121 条功能用例 100% 通过，性能实测见 `docs/testing/perf.md`）。

---

## 0. 结论摘要（TL;DR）

1. **商业大厂的动作恰好验证了本项目方向的正确性**：腾讯文档 2026 年 6 月发布行业首发的「人机双写」（AI 进入编辑器与人接力协作、冲突自动解决），WPS 智能文档、飞书知识问答、Notion Agent 均已把"AI×文档"作为核心卖点。这意味着选题踩在行业趋势上，可以直接写进论文 1.1/1.2 作为佐证。
2. **开源同类项目呈"单科冠军、组合空白"格局**：实时协作强的（AFFiNE/Outline/HedgeDoc）AI 不完整或闭源收费；AI Agent 强的（Trilium/AnythingLLM/Khoj）要么单用户、要么不是协作编辑器。**"实时协作 + 多级权限 + AI Agent + 全链路私有化"四者兼备的开源实现尚属空白**。
3. **本项目 v1 的功能广度与工程深度已达开源同类水准**，v2.0 补上 AI 层后，差异化创新点可以落到三处大厂没做透、开源界也没做全的地方：**面向 Agent 的权限收敛设计、模型可插拔的 AI 网关、CRDT 落地的自主工程方案（冷热回滚双路径/schema-free 播种）**。
4. v2.0 开发计划见第 6 节：L1~L4 四层递进，预计 2~4 周（需导师确认范围后启动）。

---

## 1. 商业产品趋势：为什么"AI×笔记×协作"是对的选题

| 产品 | 时间 | 动作 | 对本论文的意义 |
|---|---|---|---|
| 腾讯文档 | 2026-06 | 发布行业首发「人机双写」：AI 以"数字同事"身份进入文档编辑器，与人同屏接力协作，双重编辑冲突自动解决，操作逐条可回溯；同月开放 Skill（MCP 协议）+ OpenAPI 双通道（百余项 MCP 接口） | 直接佐证"AI 作为协作者进入实时编辑链路"是行业公认方向；开放 MCP 接口佐证"AI 操作文档系统"（Agent 化）是公认方向 |
| 腾讯文档 | 2025-02~05 | 接入 DeepSeek-R1 等外部模型 | 说明大厂也在做"模型层解耦" |
| WPS 智能文档 | 2026-08 | 官宣 AI 智能排版、千人级并发"零冲突"、离线编辑本地缓存+恢复合并、私有化部署（企业版） | 佐证"离线编辑""冲突合并""私有化"是真实需求 |
| 飞书 | 2025~2026 | 知识问答（Ask）：基于 RAG 对权限内文档/消息/会议纪要做带出处的问答；意图识别+问题改写+向量检索 | 佐证"个人/组织知识库 RAG 问答"是真实需求，且"权限内检索"是它的核心卖点 |
| Notion | 2025~2026 | Notion Agent（自定义代理自动处理任务）、企业搜索（跨 Slack/GitHub 等）、企业版零数据保留承诺 | 佐证 Agent 化趋势；同时其闭源 SaaS 属性反衬本项目"开源可自托管"的差异化 |

**写作建议**：论文 1.2（国内外研究现状）可按"商业产品验证趋势 → 开源方案现状 → 组合空白"三段展开，本报告第 2、3 节即素材。

来源：[腾讯文档人机双写（央广网）](http://tech.cnr.cn/techgd/20260605/t20260605_527649457.shtml)、[腾讯文档 AI 工作台升级（央广网）](https://tech.cnr.cn/techph/20260908/t20260908_527808119.shtml)、[腾讯文档开放平台 Skill/MCP](https://docs.qq.com/open/document/saas/skill.html)、[WPS 智能文档官网](https://365.wps.cn/content/56d7c7bfa638437e876e866b2343d77b.html)、[飞书知识问答](https://www.feishu.cn/hc/zh-CN/articles/854453754409-%E4%BD%BF%E7%94%A8%E7%9F%A5%E8%AF%86%E9%97%AE%E7%AD%94)、[Notion 定价](https://www.notion.com/zh-cn/pricing)、[Notion MCP Server](https://www.notion.com/en-gb/blog/notions-hosted-mcp-server-an-inside-look)

---

## 2. 开源同类项目逐一分析

选型标准：自托管可行、活跃或曾活跃、与"笔记/文档+协作/AI"相关的主流开源项目，共 9 个 + 3 个略提。

### 2.1 AFFiNE（约 70k★，2026-06）

- **定位**：开源 Notion+Obsidian 替代，文档+白板+数据库一体化。
- **协作**：基于 CRDT（Yjs 系），AFFiNE Cloud 免费版限 3 人/工作区实时协作、7 天版本历史。
- **AI**：内置 AI（起草/摘要/生成思维导图），但与 Pro 付费套餐捆绑。
- **关键局限**：**双许可证**——编辑器 BlockSuite 为 MIT，但**后端服务器为商业 EE 许可**：自托管团队版 $10/席/月，未经商业授权只能查看后端源码，不能修改、编译或再分发。即"开源"主要在 UI 层，自托管完整协作后端受商业约束。
- **与本项目的差异点**：本项目后端全栈自主实现、无许可墙；本项目有笔记级四级 RBAC 与访客分享链接协作，AFFiNE 权限模型面向工作区订阅。

来源：[AFFiNE 定价](https://affine.pro/pricing)、[AFFiNE About](https://affine.pro/about-us)

### 2.2 AppFlowy（约 67k★，AGPL-3.0）

- **定位**：2026 年公认最强开源 Notion 替代（客户端 Rust/Flutter）。
- **协作**：纯本地模式无实时协作；实时协作需自托管 AppFlowy Cloud。
- **AI**：内置 AI 助手（写作/摘要），支持自定义 OpenAI 兼容端点。
- **关键局限**：**自托管部署重**——官方 Docker Compose 方案需 5 个以上服务（AppFlowy Cloud + Postgres/Supabase + MinIO + Redis 等），建议 4GB+ 内存；客户端与云后端版本兼容性问题常见。
- **与本项目的差异点**：本项目 4 个容器（postgres/redis/server/web）单机可跑（本论文即跑在 NAS 上）；无 5 服务编排门槛。

来源：[腾讯云社区：How to Self-Host AppFlowy](https://www.tencentcloud.com/techpedia/144001?lang=en)、[ossalt: Open Source Alternative to Notion 2026](https://ossalt.com/guides/open-source-alternative-to-notion-2026)

### 2.3 思源笔记 SiYuan（开源，TS+Go）

- **定位**：隐私优先、本地优先的块级个人知识管理（块引用、双向链接、闪卡）。
- **协作**：Docker 自托管可多人使用，但**协作以"多端同步+锁"为主，非真正的多光标实时共编**；官方主线是个人知识库。
- **AI**：接入 OpenAI 兼容接口（用户自备 Key），支持续写/翻译/摘要/问答聊天。
- **关键局限**：团队协作与权限管理非强项；AI 停留在"编辑器内辅助"，无 Agent 化操作。
- **与本项目的差异点**：本项目有多光标 CRDT 实时协作、四级 RBAC、团队模块、访客分享——即"团队协作维度"整体强于思源。

来源：[思源官网](https://b3log.org/siyuan/?lang=cn)、[Gitee 仓库](https://gitee.com/siyuan-note/siyuan)

### 2.4 Outline（约 40k★，自托管主流 wiki）

- **定位**：团队知识库/wiki 的自托管标杆，"少数不输云端产品的自托管 wiki"。
- **协作**：真实时多人编辑（无合并冲突）、嵌套集合、评论。
- **AI**：内置 AI 问答（对文档提问），云端版能力更全。
- **关键局限**：AI 仅"问答/检索"层面，无 Agent 化写操作；分享链接以只读公开分享为主；AI 能力与云订阅绑定较深。
- **与本项目的差异点**：本项目的访客分享链接可直接进入**受权限约束的实时协作会话**（访客可编辑），并带有效期/即时停用/防枚举/缓存设计；Outline 分享为只读。

来源：[Outline 官网](https://www.getoutline.com/?ref=axbom.com)、[ONES：5 Best Self-Hosted AI Team Knowledge Management 2026](https://ones.com/blog/tool-guide/5-best-self-hosted-ai/)

### 2.5 HedgeDoc（AGPL-3.0）

- **定位**：协作 Markdown 编辑器（前身 CodiMD），单文档协作的标杆。
- **协作**：实时协作是核心强项，六种笔记级权限模式。
- **关键局限**：**只管"一篇笔记的协作"，没有知识库**——无文件夹/标签体系、无多用户笔记管理、无 AI、无版本回滚到 CRDT 层的方案（仅修订历史）。
- **与本项目的差异点**：本项目是完整知识管理系统（七模块），HedgeDoc 可视为本项目"实时编辑模块"的同类，其余模块均为空白。

来源：[HedgeDoc 官网](https://hedgedoc.org/)、[ossalt: Self-Host HedgeDoc](https://ossalt.com/guides/how-to-self-host-hedgedoc-collaborative-markdown-2026)

### 2.6 Trilium Notes（AGPL-3.0）——⚠️ 最接近本 v2.0 设想的竞品，必须正视

- **定位**：单用户个人知识库（树形笔记、脚本扩展）。
- **AI**：2025~2026 年内置了较强的可选 AI：基于笔记内容聊天、**AI 助手可通过工具代为搜索/创建/更新笔记**、支持 OpenAI/Anthropic/Google/自托管 OpenAI 兼容模型、支持 MCP 暴露笔记给外部 AI——**这是开源界与本 v2.0"Agent 操作笔记系统"设想最接近的实现**。
- **关键局限**：**单用户设计**——不支持多用户、无实时协作、无团队/权限体系、无官方移动端。
- **与本项目的差异点**：Trilium 的 Agent 操作的是"一个人的笔记库"；本项目 v2.0 的 Agent 操作的是"多用户、四级 RBAC、团队/分享/回收站全模块的系统"，且**每次工具调用都经过与人类用户相同的权限矩阵校验**。差异不在"有没有 Agent"，而在"Agent 在多用户权限体系中的收敛设计"。

来源：[Trilium 官网](https://triliumnotes.org/)、[Trilium AI 文档](https://docs.triliumnotes.org/user-guide/llm)、[Trilium 内置 AI 助手](https://docs.triliumnotes.org/user-guide/note-types/text/ai-assistant)

### 2.7 Logseq（AGPL-3.0）

- **定位**：本地优先大纲式 PKM（双向链接、块引用）。
- **关键局限**：**无内置 AI**（全靠社区插件+自备 Key）；实时协作在 DB 2.0 中仍是早期/受限功能；双轨制（文件版/DB 版）导致生态分裂。纯个人工具，与本项目"团队协作平台"定位不同。

来源：[Logseq 评测 2026](https://makerstack.co/reviews/logseq-review/)、[Logseq 论坛：Agentic-AI 趋势讨论](https://discuss.logseq.com/t/how-is-logseq-s-official-development-aligning-with-the-emerging-agentic-ai-trend/34823)

### 2.8 Khoj（AGPL-3.0）

- **定位**：个人 AI"第二大脑"——与笔记聊天、语义检索、研究型 Agent。
- **动态**：**Khoj Cloud 已于 2026-04 关停**（订阅模式难以为继），转纯自托管。支持本地 LLM、私有文档 RAG。
- **关键局限**：是"AI 问答层"，**不是编辑器、不是协作平台**——没有文档编辑与多人协作，只能读你的笔记，不能"在系统里替你写"。云端关停本身也说明：纯 AI 知识库难独立成产品，AI 需要**长在编辑/协作系统上**——这正是本 v2.0 的思路。

来源：[Khoj Cloud Sunset 公告](https://app.khoj.dev)、[12 自托管 Deep Research 系统对比](https://dev.to/rosgluk/self-hosted-deep-research-systems-12-tools-compared-7pp)

### 2.9 AnythingLLM（MIT，66k★）

- **定位**：2026 年最活跃的自托管 RAG/Agent 平台：多用户+角色、任意 LLM、任意向量库、Agent 技能、Docker 一键部署。
- **关键局限**：**它是"聊+检索"平台，不是笔记/编辑器**——没有协作编辑、没有笔记管理七模块。它证明了"多用户自托管 Agent"技术可行，但它不回答"Agent 如何与文档协作编辑、笔记权限体系融合"。
- **与本项目的差异点**：本项目 v2.0 = 把 AnythingLLM 类的 Agent 能力**长进一个完整的协作笔记系统**，而不是并列一个聊天容器。

来源：[AnythingLLM 官网](https://anythingllm.com/)、[AnythingLLM Docker 部署文档](https://docs.anythingllm.com/installation-docker/overview)、[AnythingLLM Review 2026](https://dev.to/jovan_chan_9500711396d4e6/anythingllm-review-2026-best-self-hosted-rag-and-ai-agents-on-your-own-hardware-4f85)

### 2.10 略提：Docmost / BookStack / Reor

- **Docmost**：轻量 Notion 风自托管 wiki，无 Agent 化 AI。
- **BookStack**：书架式文档（SOP/手册），协作弱、无 AI。
- **Reor**：本地 AI 笔记（自动向量化、笔记自动互链），AGPL，但**桌面单机、更新已放缓**（2026 年评测称"updated last year"）。

---

## 3. 功能矩阵对比

图例：✅ 有且完整　🟨 有但有明显限制（备注）　❌ 没有

| 能力 | 本项目 v1 | 本项目 v2（规划） | AFFiNE | AppFlowy | 思源 | Outline | HedgeDoc | Trilium | Logseq | Khoj | AnythingLLM |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 开源自托管 | ✅ | ✅ | 🟨 后端 EE 许可 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 多用户系统 | ✅ | ✅ | ✅ | ✅ | 🟨 多端同步为主 | ✅ | 🟨 弱账号体系 | ❌ 单用户 | ❌ 单用户 | 🟨 单用户为主 | ✅ |
| 实时多光标协作 | ✅ | ✅ | ✅ | 🟨 需云后端 | ❌ | ✅ | ✅ | ❌ | 🟨 早期 | ❌ | ❌ |
| CRDT 冲突解决 | ✅ Yjs | ✅ | ✅ | 🟨 | ❌ | 🟨 | 🟨 | ❌ | 🟨 | ❌ | ❌ |
| 笔记级细粒度权限（四级 RBAC） | ✅ | ✅ | 🟨 工作区级 | 🟨 | ❌ | 🟨 集合级 | 🟨 单文档模式 | ❌ | ❌ | ❌ | 🟨 管理员角色 |
| 团队创建/邀请/审批 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 访客分享链接（有效期/停用/可协作） | ✅ 含访客进协作 | ✅ | 🟨 只读发布 | 🟨 | 🟨 发布 | 🟨 只读 | ✅ 匿名共编 | 🟨 只读发布 | ❌ | ❌ | ❌ |
| 版本历史 + 回滚 | ✅ CRDT 冷热双路径 | ✅ | 🟨 7 天（云） | 🟨 | ✅ | ✅ | 🟨 修订历史 | ✅ | ✅ | ❌ | ❌ |
| 回收站/软删除 + 定时清理 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Markdown 原生 + 全量导出 | ✅ MD/PDF | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| AI 写作辅助（续写/摘要） | ❌ | ✅ L1 | ✅ 付费 | ✅ | ✅ 自备 Key | 🟨 问答向 | ❌ | ✅ | 🟨 插件 | 🟨 聊天向 | 🟨 聊天向 |
| RAG 知识问答（权限内检索） | ❌ | ✅ L3 | 🟨 | 🟨 | 🟨 | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| AI Agent 工具调用操作笔记 | ❌ | ✅ L4 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 单用户 | ❌ | 🟨 研究 Agent | ✅ 非笔记系统 |
| **Agent 受多用户 RBAC 约束** | — | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟨 有角色但非笔记系统 |
| 模型可插拔（OpenAI 兼容自选） | — | ✅ | 🟨 | ✅ | ✅ | 🟨 | ❌ | ✅ | 🟨 插件 | ✅ | ✅ |
| Docker 一键部署（≤4 服务） | ✅ 4 服务 | ✅ | 🟨 | ❌ 5+ 服务 | ✅ | ✅ | ✅ | ✅ | ❌ 本地应用 | ✅ | ✅ |

**矩阵解读**：任何单项能力都有项目做得好，但**没有一行之外的项目能同时打满左三列（协作+权限+分享）与右三列（AI 辅助+RAG+Agent）**。Trilium 逼近但缺多用户与协作；Outline 逼近但无 Agent 写操作；AnythingLLM 有 Agent 但根本不是笔记系统。这就是 v2.0 的立足点：**不是发明新能力，而是首次在开源栈上把 AI 能力完整嵌入一个多用户实时协作笔记系统，并解决由此产生的权限收敛问题**。

---

## 4. 本项目差异化创新点论证（答辩用）

### I1　全链路私有化的轻量开源方案（对比商业 SaaS 与重型开源）

- **表述**：四个容器（PostgreSQL/Redis/server/web）单机一键部署，数据全部留在自有存储；对比商业 SaaS（腾讯/飞书/Notion/语雀均为闭源云服务），对比 AFFiNE（后端 EE 商业许可）与 AppFlowy（5+ 服务、4GB+ 内存门槛）开源方案更轻、许可更干净。
- **佐证**：部署实测 `docs/testing/5.9-deploy-tests.md`（DEP-01~10 + 重部署 DEP-R1~8）；NAS 生产运行截图。
- **答辩应对**："私有化不是新词，但'一个学生在一台 NAS 上跑通完整协作系统'体现的是工程完成度与轻量化设计。"

### I2　AI Agent 纳入多用户 RBAC 权限模型（v2.0 压轴创新）

- **表述**：将 AI 定义为系统第四类操作主体（个人用户/团队成员/访客之外），Agent 的每次工具调用（搜索/建笔记/建分享链接/回收站操作等）强制通过与人类用户相同的四级权限矩阵（owner/team_admin/team_edit/team_read）校验，越权即拒。Trilium 的 Agent 是单用户库的 Agent，AnythingLLM 的 Agent 在笔记系统之外——**"Agent 在多用户权限体系内收敛"在开源界无先例可循，属自主设计**。
- **佐证**：v1 已有的 `getAccessLevel` 四级访问矩阵、REST/WS 双链路权限对齐（用例 TEAM-13~22、SHARE-05~15）；v2.0 工具层直接复用该矩阵（见 6.3.4）。
- **答辩应对**："Notion Agent 有 Agent 但是闭源黑盒，无法审计它怎么过权限；我的方案权限模型形式化、代码可审计、有用例覆盖。"

### I3　模型可插拔的 AI 网关（数据主权 × 模型解耦）

- **表述**：AI 网关统一实现 OpenAI 兼容协议，一个配置项切换任意模型服务商乃至本地模型（Ollama/vLLM），全系统 AI 功能（编辑器辅助/RAG 问答/Agent）共用此网关；配合私有化部署，可实现"笔记数据与 AI 调用全链路不出内网"。大厂 AI 均绑定自家模型与云，开源同类（Outline）AI 与云订阅绑定。
- **佐证**：v2.0 `llm-gateway` 模块设计（6.3.2）；论文可测"切换不同模型端点功能不回退"。

### I4　CRDT 落地的自主工程方案（冷热回滚双路径 / schema-free 播种 / 防误清压缩）

- **表述**：Yjs 官方只提供同步原语，落地三件事无现成方案，均为自主设计并有用例支撑：① 版本回滚冷热双路径（热文档 CRDT 清空重建实时生效、冷文档快照回写作废帧，回滚前自动建版）；② ProseMirror JSON→Yjs 的 schema-free 播种转换 + 按笔记互斥锁防播种竞态；③ 增量帧压缩与防误清自愈机制。
- **佐证**：`versions.service.ts`、`yjs-convert.ts`、`collaboration.persistence.ts`；用例 VER-04~08、COLLAB-11；这是**对"只是调了 Yjs 库"质疑的最有力反驳**。
- **答辩应对**："腾讯人机双写也做冲突解决，但那是闭源黑盒；我的方案从 CRDT 帧存储到回滚路径每一层都可展示代码、设计依据和测试用例。"

### I5　访客分享链接与实时协作的深度融合

- **表述**：访客凭分享 token 直接进入受权限约束的 Yjs 协作会话（可读/可编辑由链接权限决定），叠加有效期、即时停用、404 防枚举、Redis 60s 缓存与 WS 握手鉴权联动。对比 Outline/思源/AFFiNE 的分享均为只读发布或发布页。
- **佐证**：`share.service.ts`、`realtime.service.ts`（访客 WS 鉴权）、用例 SHARE-05~15。

### I6（v2.0 增量，视接口能力）　混合语义检索

- **表述**：关键词检索（现有 ILIKE）+ 向量语义检索（pgvector）混合排序，支持"按意思找笔记"与 RAG 问答；对比 Outline 的全文检索为纯词法，思源无向量检索。
- **佐证**：6.3 可出"ILIKE vs 向量 vs 混合"召回/延迟对比实验数据，直接进论文第 6 章。

---

## 5. 回应"腾讯文档不是已经有了吗"（答辩 Q&A 口径）

**Q1：你这个文档系统，腾讯文档/WPS 不都有了？**
> 功能表象相似，实现完全自主——CRDT 协作、四级 RBAC、版本冷热回滚、分享链接协作，每一项都有设计依据、核心代码和 121 条功能用例。而且我有三件事它们做不了：① 开源可私有化，数据不出自己的服务器；② 模型可插拔，AI 网关可以指向本地模型，全链路不出内网；③ 数据反锁定，Markdown 原生 + 开放 schema，而 Notion 们恰恰靠专有格式留客。

**Q2：AI 功能是不是抄腾讯的人机双写？**
> 恰好相反，腾讯 2026 年 6 月发布人机双写，验证了我选题时判断的方向。区别在于：它是闭源商业实现，我给出的是开源技术栈上的轻量级自主实现，并额外解决了它没有公开解决的问题——AI 作为操作主体在多用户权限体系中的收敛（工具调用强制走 RBAC）。

**Q3：开源界不是也有 AFFiNE、思源吗？**
> 是，但没有一个同时具备"实时协作+多级权限+AI Agent+轻量私有化"（见报告第 3 节功能矩阵）。AFFiNE 后端是商业许可，AppFlowy 自托管要 5 个服务，思源没有实时共编，Trilium 的 Agent 是单用户的。我的定位是补上这个组合空白。

**Q4：那你的创新点到底是什么？（一句话版）**
> 不是发明单项技术，而是：在开源栈上首次完整实现"多用户 CRDT 实时协作 + AI Agent"，并自主设计解决了两个落地问题——AI 主体的权限收敛、CRDT 文档的版本回滚——全程 121 条用例与性能实测支撑。

---

## 6. v2.0 开发计划：AI Agent 模块（AI 增强版）

> 前提：导师确认创新点方向与范围后启动。技术栈零更换（NestJS/React/PG/Redis/Yjs 不动），新增依赖逐条记录 CHANGELOG。

### 6.1 范围分层（L1→L4 递进，L4 为压轴）

| 层 | 功能 | 优先级 | 新增工作量 |
|---|---|---|---|
| **L0 网关** | OpenAI 兼容 LLM 网关：SSE 流式、错误重试、会话与用量记录、模型端点可配置 | P0（地基） | server `ai` 模块 |
| **L1 编辑器 AI** | 选中润色/摘要/翻译/自定义指令、光标续写；流式输出**以 Yjs 文档写入**（多端可见 AI 逐字输入，CRDT 消冲突） | P0 | Tiptap AI 扩展 + SSE 通道 |
| **L2 笔记秘书** | 保存后异步生成摘要卡 + 标签建议（一键采纳）；存量笔记批量 AI 整理（队列+进度） | P1 | Bull/Redis 队列任务 |
| **L3 智能检索** | pgvector 向量化 + 关键词/向量混合检索 + RAG 问答（带出处笔记链接） | P1（取决于 embeddings 可用性） | pgvector 迁移 |
| **L4 Agent** | 对话式侧边栏 Agent，Function Calling 工具集操作七模块；工具调用强制过 RBAC | P0（创新点核心） | tool-registry + agent loop |

**非目标**（防范围膨胀）：不做微服务改造、不做移动端、不训练/微调模型、不引入 LangChain 等重型框架（自实现 agent loop，保持架构"模块化单体"表述一致）。

### 6.2 前置确认清单（启动前必须完成）

1. LLM 接口能力三问——**2026-10-08 已确认（选定 DeepSeek API 为默认提供方）**：
   - ✅ `stream:true` 流式：支持（chat completions 以 `text/event-stream` 返回 chunk 序列）
   - ✅ `tools/tool_calls`：支持（仅 function 类型；流式下分片到达，首个 chunk 携带 id/function，后续 chunk 只带参数增量，需网关聚合）
   - ❌ `/v1/embeddings`：**官方 API 不提供** → L3 改为双通道架构（见 6.3.2），embeddings 通道未配置时 L3 功能整体隐藏，不阻塞 L1/L4
2. NAS PostgreSQL 镜像是否带 pgvector；不带则换 `pgvector/pgvector` 镜像（部署章节顺势补"向量数据库选型"素材）。
3. 导师确认：v2.0 范围 + 论文大纲解冻（见 6.7）。
4. ~~模型与密钥安全~~ **已定（2026-10-08）**：AI 能力由服务器直接提供、用户零配置——Key/端点/模型全部只存服务端 `.env`，前端永不接触模型接口，设置页仅只读展示 AI 状态与用量。默认提供方 DeepSeek（`AI_BASE_URL=https://api.deepseek.com/v1`，默认模型 `deepseek-flash`，确切模型名以用户 DeepSeek 开放平台控制台模型清单为准）。

### 6.3 技术方案

#### 6.3.1 server 端：新增 `ai` 模块（NestJS Module）

```
apps/server/src/modules/ai/
├── ai.module.ts
├── llm/                      # L0 网关
│   ├── llm-gateway.service.ts      # OpenAI 兼容客户端：chat/stream/embeddings，端点可配置
│   └── llm.types.ts                # 统一消息/工具定义类型
├── conversation/
│   ├── ai-conversation.service.ts  # 会话 CRUD、上下文窗口裁剪（Redis 缓存最近 N 轮）
│   └── ai-conversation.controller.ts
├── agent/
│   ├── agent.service.ts            # agent loop：规划→工具调用→结果回填→继续/终止
│   ├── tool-registry.ts            # 工具注册表：名称/schema/requiredLevel/执行器
│   └── tools/                      # 每工具一文件，见 6.3.4 工具清单
├── editor/
│   └── editor-ai.controller.ts     # L1 SSE：润色/续写/摘要/翻译（接 noteId+选区）
└── task/
    └── ai-batch.service.ts         # L2 批量任务（@nestjs/schedule 或 Bull 队列）
```

#### 6.3.2 LLM 网关要点（默认 DeepSeek，双通道架构）

- **服务端全托管、用户零配置**：`AI_BASE_URL / AI_API_KEY / AI_MODEL` 等全部只存服务端 `.env`，全系统 AI（编辑器辅助/RAG 问答/Agent）共用唯一出网口 `llm-gateway`，前端永不直连模型；设置页仅只读展示状态与用量。
- **双通道配置**（因 DeepSeek 无 embeddings 端点，对话与向量分开）：
  - 对话通道：`AI_BASE_URL`（默认 `https://api.deepseek.com/v1`）+ `AI_MODEL`（默认 `deepseek-flash`）+ 可选 `AI_MODEL_FAST`（编辑器续写用低延迟档，避免思考模型首 token 慢）；
  - 向量通道（可选）：`AI_EMBEDDINGS_BASE_URL / AI_EMBEDDINGS_MODEL`（任意 OpenAI 兼容 embeddings 服务，如硅基流动 bge-m3 / 本地 vLLM），**未配置则 L3 功能整体隐藏**，L1/L2/L4 不受影响。
- **DeepSeek 特有处理**：① `reasoning_content`（思维链）不进正文——L1 只透传最终答案流，L4 侧边栏折叠展示思考过程；② tool_calls 流式分片由网关聚合为完整调用再交 agent loop；③ usage 的 `prompt_cache_hit_tokens` / `reasoning_tokens` 入库，审计页展示缓存命中率；④ 401 直报、429 指数退避、AbortController 支持用户 Esc 中断。
- SSE 转发：`chat.completions stream:true` → Nest SSE（`@Sse()`）→ 前端。
- 用量与审计：每次调用记录 model/tokens/耗时/关联用户，入 `ai_messages`（答辩可展示用量看板，又是工作量）。

#### 6.3.3 L1 关键设计：AI 写入走 Yjs（"AI 协作者"）

- AI 流式输出不直接改数据库，而是由服务端以 awareness/ydoc 客户端身份把 token 追加进该笔记的 Yjs 文档——**与人类用户同一冲突解决链路**；会话结束合并回写快照复用现有 `writeState` 机制。
- 论文表述："AI 作为协作者接入 CRDT 实时协作链路，输出与人类编辑统一经冲突解决与版本快照机制。"
- 前端：Tiptap 浮动菜单"AI：润色/摘要/翻译/续写/自定义"，流式选区替换或光标追加；Esc 中断。

#### 6.3.4 L4 关键设计：工具注册表 × RBAC 收敛（压轴创新点）

工具清单（直接映射现有七模块 API，全部复用 `getAccessLevel`/`assertRole`）：

| 工具名 | 背后能力 | 权限门槛 |
|---|---|---|
| `search_notes` | 笔记搜索（v2 后接混合检索） | 笔记级 read |
| `get_note` | 笔记详情 | read |
| `create_note` | 建笔记（可入指定文件夹/打标签） | 团队 edit 或个人 |
| `update_note` | 更新正文/标题 | edit |
| `move_note_to_folder` / `set_tags` | 文件夹/标签管理 | edit |
| `create_share_link` / `disable_share_link` | 分享链接生成/停用 | 权限矩阵内 + 上限约束 |
| `move_to_recycle_bin` / `restore_from_bin` | 回收站 | edit |
| `list_team_notes` / `get_team_info` | 团队信息 | 团队 read |

收敛规则（论文可写成一小节设计）：
1. Agent 以**当前对话用户身份**执行工具，不拥有独立身份；
2. 每次工具调用先过与 REST/WS 相同的权限矩阵，**拒绝也作为 tool result 回填**（让模型知错改道，而非静默失败）；
3. 破坏性工具（回收站/停用链接）二次确认或单轮限次；
4. 全部调用入审计记录（谁、何时、调了什么、参数、结果），页面可查。

#### 6.3.5 L3 关键设计：混合检索（视 embeddings 可用性）

- 表 `note_embeddings(note_id, chunk_text, embedding vector(1536), model)`；笔记保存/批量任务时切片向量化。
- 检索 SQL：`ILIKE` 关键词命中 ∪ pgvector 余弦 topK → RRF（倒数排名融合）排序 → 可选喂 LLM 生成带出处的回答。
- 实验设计（第 6 章素材）：同一批笔记跑 ILIKE / 向量 / 混合三组，记录命中率与延迟。

#### 6.3.6 数据库新增表（DDL 进附录 A）

- `ai_conversations(id, user_id, note_id NULL, title, created_at, updated_at)`
- `ai_messages(id, conversation_id, role, content, tool_calls jsonb, tokens, model, created_at)`
- `note_embeddings`（L3 启用时）

#### 6.3.7 web 端

- `AiAssistantDrawer`（右侧抽屉对话面板，可绑定当前笔记上下文）；
- Tiptap `AiMenu` 浮动扩展（L1）；
- 搜索框升级"智能搜索"入口（L3）；
- 设置页：模型端点配置 + AI 用量/审计查看。

### 6.4 里程碑与排期（合计约 2~4 周）

| 里程碑 | 内容 | 依赖 | 预估 |
|---|---|---|---|
| M1 | L0 网关 + L1 编辑器 AI（SSE + Yjs 写入） | 接口确认 stream | 4~5 天 |
| M2 | L4 Agent（tool-registry + agent loop + 对话面板） | 接口确认 tool_calls | 5~7 天 |
| M3 | L2 摘要/标签/批量整理 | M1 | 2~3 天 |
| M4 | L3 混合检索 + RAG（含 pgvector 迁移与实验数据） | embeddings 确认 | 3~4 天 |
| M5 | 测试用例表（AI-01~xx）+ 截图 + 性能/召回实验 + 论文 5.10 撰写 | 全部 | 3 天 |

赶时间时砍序：M3 的批量整理最先砍（纯工作量）；M4 若无 embeddings 则降级为"LLM 改写查询词的全文检索增强"。

### 6.5 测试与论文素材计划

- 功能用例：新增 `docs/testing/ai-tests.md`，AI-01~xx（网关/流式/权限拒绝/工具链路/RAG 出处/中断恢复），沿用现有用例表格式。
- 截图：AI 侧边栏对话、编辑器流式 AI 输入（多端同屏）、Agent 一句话建笔记+分享链接、审计页、智能搜索——均按 `<小节号>-<名称>.png` 进 `docs/assets/`。
- 性能/实验数据：SSE 首 token 延迟、Agent 单轮工具调用耗时、三路检索对比——进 `docs/testing/perf.md`。
- `docs/api.md` 同步追加 ai 模块接口。

### 6.6 风险与对策

| 风险 | 对策 |
|---|---|
| 接口不支持 tool_calls | L4 降级：prompt 约定 JSON 输出 + 严格 schema 校验 + 失败重试（稳定性降档，提前向导师说明） |
| Agent 误操作（删错/分享错） | 破坏性工具二次确认 + 审计可回溯 + 回收站天然兜底（软删除可恢复，正好是现有架构优势） |
| pgvector 在 NAS 不可用 | 换 pgvector 官方镜像重部署（M4 内消化）；或 L3 降级 |
| AI 输出污染 Yjs 文档 | AI 写入走独立事务标记，Esc/撤销即回滚；版本快照兜底 |
| 范围膨胀 | 非目标清单（6.1）+ 里程碑砍序规则 |

### 6.7 论文大纲联动（需导师同意后解冻修改）

- 3.3 增补"3.3.8 AI 智能辅助模块"功能需求；
- 第 5 章新增"5.10 AI 智能辅助模块实现"（5.10.1 网关 / 5.10.2 编辑器 AI 与 CRDT 集成 / 5.10.3 Agent 工具调用与权限收敛 / 5.10.4 混合检索与 RAG / 5.10.5 界面展示与核心代码）；
- 6.2 增"6.2.8 AI 功能测试"；6.3 增检索对比实验；
- 7.2 创新点更新为：① AI Agent 纳入 RBAC 的权限收敛设计；② 模型可插拔 AI 网关与全链路私有化；③ CRDT 落地自主工程方案（冷热回滚/播种/防误清）；
- 7.3 展望相应改写（移除已实现的 AI 项）。

---

## 7. 参考来源汇总

**商业产品**：
- 腾讯文档「人机双写」：http://tech.cnr.cn/techgd/20260605/t20260605_527649457.shtml
- 腾讯文档 AI 工作台：https://tech.cnr.cn/techph/20260908/t20260908_527808119.shtml
- 腾讯文档开放平台 Skill/MCP：https://docs.qq.com/open/document/saas/skill.html
- WPS 智能文档：https://365.wps.cn/content/56d7c7bfa638437e876e866b2343d77b.html
- 飞书知识问答：https://www.feishu.cn/hc/zh-CN/articles/854453754409-使用知识问答
- Notion 定价与 Agent：https://www.notion.com/zh-cn/pricing ｜ Notion MCP：https://www.notion.com/en-gb/blog/notions-hosted-mcp-server-an-inside-look

**开源项目**：
- AFFiNE：https://affine.pro/pricing ｜ https://affine.pro/about-us
- AppFlowy 自托管：https://www.tencentcloud.com/techpedia/144001 ｜ https://ossalt.com/guides/open-source-alternative-to-notion-2026
- 思源笔记：https://b3log.org/siyuan/?lang=cn ｜ https://gitee.com/siyuan-note/siyuan
- Outline：https://www.getoutline.com/ ｜ https://ones.com/blog/tool-guide/5-best-self-hosted-ai/
- HedgeDoc：https://hedgedoc.org/
- Trilium Notes：https://triliumnotes.org/ ｜ AI 文档：https://docs.triliumnotes.org/user-guide/llm
- Logseq：https://makerstack.co/reviews/logseq-review/
- Khoj（Cloud 关停）：https://app.khoj.dev ｜ https://dev.to/rosgluk/self-hosted-deep-research-systems-12-tools-compared-7pp
- AnythingLLM：https://anythingllm.com/ ｜ https://docs.anythingllm.com/installation-docker/overview
