# 变更流水（CHANGELOG）

## [2026-09-17] 论文初稿（thesis-draft.md）——按学校初稿要求裁剪

- 做了什么：新建 docs/thesis/thesis-draft.md（4.2 万字符，完整版 thesis.md 不动）。进度呈现为"刚过 1/3"（经用户确认）：第 1-4 章原样（含 ER/关系图等 5 张图），第 5 章保留 5.1-5.2 完整实现（含 3 张截图）并新增表 5-1 实现进度计划，5.3 起各小节标题保留、正文标待实现（37 处）；第 6 章 6.1 测试环境+表 6-2 测试计划（121 例分模块计划），6.2-6.4 标注待补充；第 7 章 7.1 改写为阶段小结、7.2 标注待提炼、7.3 展望原样保留；摘要/Abstract 改为进行时表述；附录 A/B/C 保留
- 为什么：学校现阶段只要求交初稿（经用户确认裁剪深度与推送范围）
- 诚实表述：初稿头部注释注明"由完整版裁剪生成，完整版见 thesis.md"（转 Word 前删除）
- 新增依赖：无
- 产出素材：docs/thesis/thesis-draft.md
- 遗留问题：无
## [2026-09-16] 项目上传 GitHub（公开仓库）+ 历史脱敏

- 做了什么：① git filter-repo 将 nas-db-setup.sh（含 NAS postgres/redis 真实密码）从**全部提交历史**中抹除，重写后全历史 grep 验证无密码残留；本地文件保留（加警告头 + .gitignore）；② NAS 裸仓库 force push 同步重写后历史（部署流程不受影响，git archive 照常）；③ gh repo create 公开仓库 https://github.com/RiderLty/wangyan-2026 并推送 main（远程名 github，origin 仍为 NAS 裸仓库）
- 为什么：用户要求上传 GitHub；公开前必须脱敏——密码可登录局域网可达的活数据库
- 安全清单（推送前核对）：.env / state.json / nas-db-setup.sh / 范例PDF 均未入库；.env.example 仅占位符；历史中密码字符串仅存在于 nas-db-setup.sh 一处（已抹除）
- 新增依赖：无（工具：brew git-filter-repo；重写前已做 /tmp/wangyan-backup-0916.bundle 全量备份）
- 产出素材：GitHub 公开仓库
- 遗留问题：无

## [2026-09-15] 论文素材批产：NAS 重部署 + 21 张前端截图 + 数据库/后端/ER 图

- 做了什么：
  - **修复两个截图过程中暴露的真实缺陷**：① 协作增量 compaction 误删种子帧→残留孤儿帧回放空白且防误清锁死（d3758b5，compaction 改为清空全部帧+bindState 快照自愈兜底+flushBuffer 可等待消除删除竞态）；② 协作光标样式类名错配——样式写的是 y-prosemirror 的 ProseMirror-yjs-cursor，而 Tiptap CollaborationCursor 实际渲染 collaboration-cursor__caret/__label，姓名标签裸块渲染成整行色块（380811e）
  - **NAS 重部署两轮**（DEP-R5~8 已记入 5.9-deploy-tests.md），存量坏数据自愈验证通过
  - **截图流水线** scripts/screenshots/：setup-data.mjs（幂等造演示数据：3 账号/笔记/文件夹/标签/版本/回收站/团队/邀请/分享链接）、shoot.mjs（puppeteer-core + Edge 无头，21 张界面截图 @2x，多用户双 context、访客无 token 场景）、terminal-shots.mjs（psql 真实输出/docker ps/服务日志/perf 脚本 → 终端风格渲染 7 张）、diagram-shots.mjs（mermaid 内联离线渲染：4.3.1 ER 图、4.3.9 关系图）
  - **产出素材 30 张**：docs/assets/ 下 5.2.x~5.9.3 界面截图 21 张（新界面：冻结工具栏、专注模式、多光标行内标签、含图/表快照的版本预览）+ 4.3-db-tables/4.3-db-notes-ddl/4.4-yjs-frames/5.9-docker-ps/5.4-server-logs/6.3-perf-api 终端图 7 张 + 4.3.1-er-diagram/4.3.9-db-relations 2 张
- 为什么：论文第 5 章需要最终版式截图；第 4 章需要 ER/关系图；数据库与后端运行佐证素材此前缺失
- 新增依赖：puppeteer-core@25.11（devDep，无头截图用本机 Edge 不下载浏览器）、mermaid（devDep，ER 图离线渲染）；工具链 brew install libpq（psql 客户端，未入 package.json）
- 诚实表述：终端风格截图的窗口是样式渲染、命令与输出均为真实执行结果（脚本头部注明）；设计稿 4 视图真实库中不存在（DEP-10 试建后删除，业务走基表），未伪造视图查询图
- 遗留问题：① 论文图 3-1 用例图、4-1 架构图、4-2 功能结构图、4-5 同步流程图仍待绘制（可用 diagram-shots.mjs 同管线生成，问用户）；② 演示账号 chenmo/suqing/wangyuan@wangyan.test 保留在库中；③ thesis.md 中 5.7.1 版本抽屉、5.4.3 光标等占位可替换为新图；④ 5.5.x 三张截图为修复前版本但内容无误（tnDeploy 种子帧幸存路径），如需统一可重拍

## [2026-09-15] 修复版本预览空白（缺扩展渲染面）

- 做了什么：`apps/web/src/components/notes/VersionDrawer.tsx` 的 VersionPreview 编辑器从裸 `StarterKit` 改为 `StarterKit.configure({history:false}) + markdownContentExtensions()`（与 ReadableView 同组）；`utils/editor-extensions.ts` 注释"四渲染面"修正为"五渲染面"
- 为什么：用户反馈版本回滚无法预览。根因：09-15 编辑器语法补全会话把图片/表格节点写进了 JSONB 快照，但版本预览这个渲染面漏注册对应扩展（当时只统一了编辑器/只读视图/分享页/打印页四处），快照含 image/table 节点时 ProseMirror Node.fromJSON 抛"Unknown node type"、预览空白。全量 grep useEditor 确认其余四处均已注册，仅此一处遗漏
- 教训：新增 schema 节点时必须排查**所有** Tiptap 实例（本次以 grep useEditor 全量核对为准，不能只记"四个渲染面"）
- 新增依赖：无
- 产出素材：无（缺陷修复；VER-01~03 用例复验建议：插入图片/表格 → 保存版本 → 打开版本抽屉预览）
- 遗留问题：NOTE-27~29 人工复核时顺带覆盖本修复场景

## [2026-09-15] 编辑器顶部区域冻结（标题栏 + 工具栏不随滚动消失）

- 做了什么：`apps/web/src/index.css` 两处修改——① `.editor-content` 增加 `min-height: 0; overflow-y: auto`，滚动从外层 Content（HomePage.tsx:613 `overflow:'auto'`）收进编辑器正文内部；② 删除 `.editor-toolbar` 上失效的 `position: sticky`（被固定高度父容器限制，从未生效），顶部由布局天然固定
- 为什么：用户反馈长文编辑时标题栏（标题/导出/分享按钮）与 H1/H2/B 工具栏被滚出视野。根因：滚动发生在编辑面板整体的滚动容器上，且 sticky 的包含块是 height:100% 的 editor-panel，无法吸附。改为"外层固定 + 正文内滚"的经典编辑器布局
- 行为变化：`.editor-meta`（创建于/更新于）现在常驻面板底部不再随内容滚动；ReadableView（团队只读）同步获得相同冻结效果；专注模式布局不受影响
- 新增依赖：无
- 产出素材：无（界面行为修复；docs/assets 截图为旧版式，本就待重截，重截时以本版为准）
- 遗留问题：无

## [2026-09-15] 论文全文初稿撰写（约 1.1 万字）

- 做了什么：新建 `docs/thesis/thesis.md`——论文全文 Markdown 初稿（单文件，经用户确认：单 md + 一次性写完）。结构严格按冻结大纲：摘要/Abstract、第 1–7 章全部三级小节、参考文献 15 条（真实文献，含 CRDT/OT 原始论文）、致谢、附录 A/B/C。正文约 4.4 万字符（含 Markdown 记号，中文正文约 1.1 万字）
- 写作依据：范例 PDF（国开本科体例：平实叙述、每节图表支撑）＋ THESIS-HANDOFF 素材索引（DECISIONS/数据库设计稿/api.md/测试表/perf.md）；诚实表述要点全部落实——4.1.3 按"模块化设计"表述不写微服务、5.3.2 写"初版核心语法+迭代增强"、6.2.2 按 26 例口径（NOTE-27~29 未计入 121 例）、5.9.3 如实写"compose 一键启动方案 + NAS 生产 docker run"并存、6.4.1 Edge 全过 + 其余浏览器标注待人工复核
- 图的处理：第 3/4 章架构图/ER 图/用例图/流程图留【待插图】占位（含画图要点文字底稿，画图要点源自 docs/diagrams/ 与 DECISIONS），第 5 章 22 处插图占位均指向 docs/assets/ 真实截图并标注"建议按新版式重截"处（5.3.5）
- 新增依赖：无（纯文档工作）
- 产出素材：docs/thesis/thesis.md
- 遗留问题：① 第 3/4 章 6 张图需用户绘制（底稿已在占位处）；② 5.3.5 截图按新版式重截后替换图 5-9；③ 附录 A/B/C 转 Word 时从 docs/ 三个文件粘贴全文；④ 参考文献[5] RFC 7519 与正文对应关系请用户核对学校格式要求；⑤ NOTE-27~29 人工复核后可在 5.3.2 补一句确认

## [2026-09-15] 论文撰写交接（编码阶段收尾）

- 做了什么：新建 `docs/memory/THESIS-HANDOFF.md`——论文撰写入口索引（章→素材映射表、诚实表述要点、环境事实、开工建议）；PROGRESS 当前状态改为"编码阶段结束/下一步论文撰写"
- 为什么：用户将开新 agent 会话写论文，编码会话结束前固化全部交接线索（AGENTS §1.1 要求下个 agent 先读记忆，本文件保证线索完整不丢）
- 新增依赖：无
- 产出素材：THESIS-HANDOFF.md
- 遗留问题：无新增（写论文前的两个前置见 PROGRESS 当前状态与 HANDOFF 第三节）

## [2026-09-15] 编辑器 Markdown 语法补全（图片 + 表格）+ 工作台布局优化

- 做了什么（编辑器部分）：
  - 根因：Tiptap 插件化架构，StarterKit 只含核心节点（标题/加粗/列表/引用/代码块），图片/表格需独立扩展；tiptap-markdown 自带这两种节点的序列化器，注册即通
  - 新增 @tiptap/extension-image、@tiptap/extension-table、extension-table-row、extension-table-cell、extension-table-header（均 ^2.8.0 与现有 Tiptap 对齐）
  - 新建 utils/editor-extensions.ts 统一导出 markdownContentExtensions()，四个渲染面（编辑器 EditorBody / 只读 ReadableView / 分享页 SharePage / 打印页 PrintPage）注册同一组扩展，避免 JSONB 快照节点被缺扩展的面丢弃
  - 工具栏新增：插入图片（URL 弹窗，与 ![](url) 等价）、插入 3×3 表格、表格内显示删除表格按钮；服务端确认无需改动（yjs-convert.ts 为 schema-free 通用映射，节点类型直通）
  - CSS：表格边框/表头底色/选中单元格高亮、图片 max-width:100%，三渲染面共用
  - 测试素材：docs/testing/5.3-notes-tests.md 追加 NOTE-27~29（诚实标注"待人工复核"）
  - 补充（同日）：标准 Markdown 语法输入支持——图片输入规则 extension-image 自带 + 自定义兜底规则（URL 含中文等更宽松）；表格官方无 input rule，自定义 MarkdownTableSyntax（输入表头行回车 → 输入 | --- | 分隔行回车 → 两行转表格，光标入表头首格）；注册 Markdown 扩展开启 transformPasted/CopiedText（粘贴 Markdown 文本解析为节点、复制导出为 Markdown）；此前 Markdown 扩展仅导出时临时使用，实时编辑器未注册，粘贴 Markdown 不解析
  - 补充（同日）：语法二次补全（GFM）——新增 Link（StarterKit 不含链接！autolink 自动识别裸 URL + 自定义 [text](url) 输入规则）、TaskList/TaskItem（- [ ] 勾选列表，task-item 自带输入规则）；刻意不加：数学公式/脚注/Mermaid/代码高亮（论文大纲外，体积大）
  - 补充（同日）：渲染样式统一为 GitHub 白色主题——github-markdown-css 官方样式包 light 版（.markdown-body 作用域，四渲染面 ProseMirror 挂 class），删除 index.css 中冲突的手写排版规则（p/h1-h3/列表/引用/代码/表格/图片）；保留 ProseMirror 行为样式（outline/占位符/选中单元格高亮/任务列表结构）；打印页保留 14px 字号覆写；内容区底色统一纯白（Antd Layout 默认 #f0f2f5 与 GitHub 白色主题有色差）
  - 排障（同日）：装包后 Vite 报 504 Outdated Optimize Dep——预构建缓存过期，清 node_modules/.vite + vite --force 重启解决
  - 补充（同日）：NAS 重新部署（编辑器语法补全 + GitHub 主题上线 192.168.3.3:18080）——部署方式改进：源码改为 NAS 上从裸仓库 git archive 提取（替代 Mac scp tar，根治 D-013 旧文件问题）；重建 server(329MB)/web(70.7MB) 镜像并重启容器，健康检查直连/经代理均通过（DEP-R1~4，见 5.9-deploy-tests.md）

- 做了什么（布局部分，已随 35628d5 提交）：
  - 三栏比例调整（注：Content flex:auto 抢宽度问题当日已修，最终形态为左/中栏均 240px 固定、编辑区自适应填满，860→1000→移除上限三步演进见下方"补充"条目）
  - 新增"专注模式"：HomePage 增 focusMode 状态 + Esc 退出监听；编辑器头部（NoteEditorPanel EditorBody）加展开/收起按钮；激活时根 Layout 挂 `.focus-mode` 类，CSS 隐藏顶栏/左栏/中栏，编辑器独占整页
  - 涉及文件：HomePage.tsx、NoteEditorPanel.tsx、NoteListPanel.tsx、index.css
  - 补充（同日）：vite.config.ts 的 server 加 `host: true` 固化 0.0.0.0 监听——局域网设备（手机）可直接访问 dev 服务器实时预览；原因：系统已部署 NAS，日常开发在 Mac 直连 NAS 数据，用户需要多端预览新版式
  - 补充（同日）：修复中栏宽度不生效——Antd `Content` 默认 `flex:auto` 会伸展抢剩余宽度，显式 `flex:'none'` 锁定 240px（与左栏同宽），笔记标题 maxWidth 恢复 170；教训：Layout.Content 上写 width 必须同时关 flex
  - 补充（同日）：编辑区去掉 `max-width:1000px` 上限，改为自适应填满两侧固定栏之外的剩余宽度（响应式）——用户反馈 936px 内容宽度限制不合理；此前 860→1000 的两步上限调整均已作废
  - 补充（同日）：左栏可收起——顶栏标题左侧加 折叠/展开 按钮控制 Sider（collapsedWidth=0 完全收回带动画），收起时编辑区自适应占满；CSS 处理收起态溢出与边框残留
  - 补充（同日）：侧栏开关按钮改为白色图标（深色顶栏上原 ghost 默认色看不清）+ 动效——悬停白色半透明底、图标旋转 180° 过渡（单 MenuFoldOutlined 旋转代替双图标切换，避免重挂载跳变）
  - 补充（同日）：侧栏收起后最左"白线"修复——实为中栏列表的 borderInlineStart，改为随收起状态条件化显示；侧栏自身 12px 内边距在收起态同步清零（否则残留 24px 白边）
  - 补充（同日）：删除笔记提示语去掉内部小节引用"（5.7 提供恢复界面）"（论文编号不该出现在用户界面），改为"已移入回收站，30 天内可在回收站恢复"；已 grep 全前端确认其余"5.x"均为代码注释标注，无同类泄漏
- 为什么：用户反馈中栏占比过大、编辑器应为主体，且需要编辑器全页切换；对应大纲 5.3.5 界面展示
- 新增依赖（编辑器部分）：@tiptap/extension-image + table 系列 ×4（^2.8.0）——StarterKit 不含图片/表格节点，官方扩展补齐 Markdown 语法支持；@tiptap/core（^2.8.0，显式声明——pnpm 严格模式下自定义 input rule 需直接 import，此前为传递依赖）；@tiptap/extension-link + task-list + task-item（^2.8.0，GFM 链接与任务列表）；github-markdown-css（GitHub 官方渲染样式提取版，light 版 ~5KB gzip，替代手写排版 CSS）；均与现有 Tiptap 2.8.0 版本对齐，无功能重叠
- 方案要点：专注模式用 CSS 类切换而非浏览器 Fullscreen API——后者依赖浏览器授权、演示环境行为不一致；CSS 方案 Tiptap 实例不重挂载、Yjs 协作会话不中断（与 D-007 协作架构兼容）
- 产出素材：无新截图（见遗留问题）
- 遗留问题：
  - [ ] 布局调整后 5.3.5 界面截图需重截（旧截图仍是 860px/260px 版式），专注模式效果图建议一并补一张
  - [ ] 图片/表格/链接/任务列表的协作多端与持久化链路人工复核（NOTE-27~29 标注待复核；NAS 线上已可验证）

## [2026-09-11] 第 6 章测试整编（6.2.7 汇总 + 6.3 性能实测）

- 做了什么：
  - docs/testing/6.2-summary.md：8 张模块测试表汇总——121 条用例 100% 通过 + 6 个"测试发现并修复的缺陷"清单（6.2.7 素材）
  - 性能实测（对 NAS 部署系统 192.168.3.3:18080，经 nginx）：
    - 6.3.1 接口响应：读 avg 5.3ms/p95 7.7ms；登录 72.8ms（bcrypt 预期成本）；写入 23.8ms
    - 6.3.2 WS 并发：200/200 连接成功，建连 avg 10ms/p95 13.4ms
    - 6.3.3 编辑传播延迟：avg 0.8ms/p95 1.7ms（增量内存广播不阻塞——D-007 架构收益的直接证据）
  - 复现脚本入库 scripts/perf/（api-latency / ws-concurrent / edit-latency）
  - docs/testing/perf.md：6.1 环境表 + 6.3 三组数据 + 6.3.4 分析五条 + 6.4 兼容性框架表
- 为什么：对应大纲 6.1/6.2.7/6.3；AGENTS §6 要求性能数据"部署后协助设计压测方案与记录"
- 新增依赖：无（Node 原生 fetch/performance.now + workspace 内 ws/yjs）
- 产出素材：docs/testing/6.2-summary.md、perf.md、scripts/perf/
- 诚实记录：
  - edit-latency 首版直接往 XmlElement 插字符串报错（应插到段内 XmlText），修正后跑通
  - 6.4 兼容性仅 Edge(Chromium) 全流程实测，Safari/Firefox 留人工复核（如实标注"待复核"）
- 遗留问题：无新增（论文撰写为下一阶段工作）

## [2026-09-11] 5.9 系统部署完成（第 5 章全部完成）

- 做了什么：
  - 部署文件：nginx.conf → nginx.conf.template（envsubst 注入 BACKEND_HOST，compose/NAS 双用）；web Dockerfile 用 nginx 官方 templates 机制；compose 四服务修正（高位端口默认、redis requirepass、restart 策略）并复制为 docs/appendix-compose.yml；vite manualChunks 函数式分包（1.3MB 单块 → 5 块）
  - NAS 构建：git archive 上传源码，NAS 本机 docker build 原生 amd64 两镜像（server 330MB / web 70.7MB）
  - NAS 部署：.env 上传为 wangyan-2026-app.env（600 权限），docker run 前后端两容器（--restart unless-stopped，参照数据库容器方式），部署命令存档 nas-app-setup.sh
  - 端到端验证 10 项全过（DEP-01~10）：直连/代理健康、网页、登录全链路、经 nginx WebSocket、部署页截图（无控制台错误）
  - 附录：docs/appendix-ddl.sql（生产库 pg_dump schema + 4 视图，视图 SQL 真库试建验证）
  - README 重写：架构图更新为全容器拓扑 + 两种启动方式
- 为什么：对应大纲 5.9.1~5.9.3 + 附录 A/B；用户指定不用 compose 部署（NAS 无插件），参照数据库容器方式
- 新增依赖：@nestjs/schedule（上一条已记，本次无新增）；本次无新增运行时依赖
- 产出素材：docs/assets/5.9.3-nas-deployed-login.png；docs/testing/5.9-deploy-tests.md（DEP-01~10）；appendix-ddl.sql / appendix-compose.yml
- 诚实记录（排障两次，均有真实价值）：
  - 第一轮 web 容器崩溃循环：git archive 只导出已提交文件，nginx 模板化未提交就上传构建 → 旧配置上线。教训：上传构建前先 commit（已记 D-013 要点 4）
  - 分包裸子串 'react' 匹配把 antd 内部 reactNode.js 分进 react 块形成循环 chunk → 部署页运行时崩溃（React undefined）。本地 vite preview 复现并验证修复后重新部署——真机部署暴露了本地从未触发的问题
  - 设计稿 13 表中 attachments 未建（大纲无上传功能），DDL 附录已注释说明
- 遗留问题：
  - [ ] 第 6 章测试整编：6.2.7 汇总表 + 6.3 性能测试（接口响应时间/WS 并发/编辑延迟）待做
  - [ ] wangyan-server 镜像运行时层含全量 node_modules（含 dev 依赖），镜像 330MB 偏大；功能无影响，优化列为 7.3
  - [ ] NAS 构建目录 /mnt/user/storage/Projects/wangyan-2026-build 保留（下次构建复用），清理命令见 nas-app-setup.sh 头注释

## [2026-09-11] 5.8 笔记导出完成（第 5 章功能模块全部完成）

- 做了什么：
  - 前端导出方案（D-012，用户指定纯前端）：utils/export.ts——Markdown 用 tiptap-markdown（headless Editor 实例序列化 ProseMirror JSON，与编辑器同 schema）+ Blob 下载（文件名安全化）；PDF 走 /print/:noteId 打印视图（干净排版+导出时间戳+自动 window.print，浏览器另存为 PDF）
  - 编辑器头部"导出"下拉（trigger click）：导出 Markdown（.md）/ 导出 PDF（打印视图）；PrintPage 路由（RequireAuth 保护）+ 打印媒体 CSS
  - 验证：CDP 驱动真实浏览器——Markdown 序列化输出核对（标题/加粗/列表全对）、Page.printToPDF 生成真实 A4 PDF（204KB 1 页）；产物入库 docs/assets/5.8.1-export.pdf、5.8.2-export.md
- 为什么：对应大纲 5.8.1~5.8.3；方案经用户确认（"前端实现"）
- 新增依赖：tiptap-markdown@^0.9（web，Markdown 序列化，与 Tiptap 同 schema）；服务端零新增
- 产出素材：docs/assets/5.8.1-export.pdf、5.8.2-export.md、5.8.3-export-menu.png；docs/testing/5.8-export-tests.md（EXP-01~06）；纯前端实现，api.md 无需增补
- 遗留问题：
  - [ ] PDF 分页样式（页眉页脚/页码）依赖浏览器打印设置，如需定制可后续加 @page 规则
  - [ ] vite 1.3MB chunk 警告延续（5.9 manualChunks 分包）

## [2026-09-10] 5.7 版本管理与回收站完成

- 做了什么：
  - 服务端：NoteVersion 实体（version_no 笔记内递增、source CHECK manual/auto/rollback）；VersionsService（手动保存/列表/详情/回滚）+ versions 路由；writeState 内实现"会话结束且有变更自动建版（auto）"；回滚双路径（热文档 CRDT 清空重建实时生效 / 冷文档回写快照作废帧）；RecycleBin 模块（列表含剩余天数/恢复放回原文件夹/彻底删除外键级联）；CleanupService（@nestjs/schedule 每小时+启动：到期回收清除、过期邀请置 expired）
  - 前端：VersionDrawer（版本列表来源标签/只读预览/手动保存/回滚确认）+ RecycleBinModal（剩余天数/恢复/彻底删除）+ 侧栏回收站入口 + 编辑器版本历史按钮
  - 修复 VER-05 缺陷：回滚前快照的去重逻辑原本只比较内容，纯改标题场景会丢失回滚前版本，改为标题+内容双比较
- 为什么：对应大纲 5.7.1~5.7.5；快照策略按 D-007 ④，回滚策略 D-011
- 新增依赖：@nestjs/schedule（服务端官方定时任务模块）
- 产出素材：docs/assets/5.7.1-version-drawer.png、5.7.3-recycle-bin.png；docs/testing/5.7-versions-recycle-tests.md（VER/BIN/CLN 共 15 条）；docs/api.md 版本与回收站节
- 诚实记录：
  - 测试中"开题答辩记录"被彻底删除（BIN-02 语义如此，不可恢复）；"私有草稿"保留在回收站作演示
  - VER-05 首测失败（回滚前快照丢失）如实记录于测试表
- 遗留问题：
  - [ ] 版本无分页（单笔记版本量大后需要，数据量小不阻塞）
  - [ ] 团队笔记删除者的回收站可见性：列表按 original_owner（笔记创建者）过滤，团队管理员看不到他人删除的记录（7.3 可扩展）
  - [ ] vite 1.3MB chunk 警告延续（5.9 分包）

## [2026-09-10] 5.6 笔记分享模块完成

- 做了什么：
  - 服务端 modules/share/：ShareLink 实体（token unique/permission CHECK/is_enabled/expires_at NULL=永久/visit_count）；创建/列表/改期/启停/删除（分享权限=笔记 owner 或团队 owner/admin）；公开解析（Redis cache:share:{token} 60s + 变更即失效 + 统一 404 防枚举 + 访问计数）
  - 访客协作（D-010）：RealtimeService 增加 ?share=token 通道，JWT 校验失败回落分享 token 校验，edit 链接放行 / read 拒绝
  - 前端：ShareModal（权限/有效期生成、启停开关、计数、复制、删除）、公开页 /s/:token（read 只读渲染 / edit 挂访客协作，awareness 名"访客"）
  - 修复真实竞态：bindState 不被 await 导致的"断连销毁→再播种"双份内容，加按笔记异步互斥锁（bindState/writeState 串行化）
  - 清账：/__dev_login 临时截图路由移除（5.5 收尾时声称已移除实际遗漏，本次更正并 grep 验证）
- 为什么：对应大纲 5.6.1~5.6.4；表结构按 D-007 §3.12，实现决策 D-010
- 新增依赖：dayjs@web（antd5 日期生态标准件）
- 产出素材：docs/assets/5.6.1-share-modal.png、5.6.2-guest-collab.png；docs/testing/5.6-share-tests.md（SHARE-01~17）；docs/api.md 分享接口节
- 诚实记录——本次排障波折（详见测试表"过程记录"）：
  - 分享页截图发现正文双份，先后排查出两层原因：① 播种竞态（真 bug，加锁修复）；② 此前截图窗口未死透（pkill 的 `\|` 模式在 ERE 失效），僵尸连接重连新服务端反复播种旧内容（运维失误）。两处分别修复后双探针回归稳定
  - 演示笔记 N1/CRDT 笔记在排障中多次内容污染，均按"清 yjs 帧 + API 重写"流程恢复
- 遗留问题：
  - [ ] 访客协作无法区分不同访客（awareness 统一显示"访客"，随机色区分端）；7.3 可扩展访客昵称
  - [ ] 过期链接批量清理属 5.7.4 定时任务（当前访问时即时校验已覆盖）
  - [ ] vite 1.3MB chunk 警告延续（5.9 分包）

## [2026-09-09] 5.5 团队协作模块完成

- 做了什么：
  - 服务端 modules/teams/：Team/TeamMember（role CHECK + unique(team,user)）/TeamInvitation（status CHECK + unique(team,email)）三实体；Note 补上 team_id 物理外键（5.3 遗留项清账，onDelete RESTRICT）
  - 团队 CRUD（R4 owner 双写事务保证一致；有笔记禁删与文件夹同策略）+ 成员管理（owner 调角色/admin 移除/本人退队/创建者不可移除）
  - 邀请审批：邮箱邀请 7 天有效、重复 pending 拦截、非 pending 旧行复用重置（满足唯一约束且支持再次邀请）、接受（事务插 member）/拒绝/撤回/我的邀请
  - 团队笔记 RBAC：四级访问矩阵 owner>team_admin>team_edit>team_read（notes.service.getAccessLevel 集中实现，不可见一律 404）；visibility 修改限 owner/团队管理员；GET /teams/:id/notes 按角色过滤
  - 协作权限对齐 REST：owner/团队 owner+admin/team_edit 成员可连 WS；team_read 拒绝（y-websocket 无法限只读写穿，论文如实说明）
  - 前端：侧栏团队列表+创建弹窗、团队管理弹窗（成员/角色/邀请/记录撤回，独立组件 TeamManageModal）、收到的邀请卡片（接受/拒绝）、编辑器团队可见性下拉、team_read 只读视图（REST 快照渲染）
- 为什么：对应大纲 5.5.1~5.5.4；RBAC 落表按 D-007 §8 映射
- 新增依赖：无
- 产出素材：docs/assets/5.5.1~5.5.4 四张截图；docs/testing/5.5-team-tests.md（TEAM-01~23）；docs/api.md 团队接口节（4.6.3）
- 诚实记录：
  - 冒烟时发现 removeMember 传非 UUID 参数返回 500（DB 类型错误未转 4xx），记录为已知边界（前端不产生该输入）
  - collab-test.mjs 重复执行会经 Yjs 追加重复演示段落（CRDT 状态是事实来源），清理时误删正文一次，已按"清帧+API 重写"流程恢复；该脚本属临时验证工具不入库
- 遗留问题：
  - [ ] 邀请过期批量置 expired 属 5.7.4 定时清理（当前接受时即时校验已覆盖）
  - [ ] 团队笔记搜索：个人搜索接口不含团队笔记（团队内 keyword 已支持）；跨团队全局搜索列为 7.3 改进
  - [ ] vite 1.3MB chunk 警告延续（5.9 分包）
  - [ ] 视图 v_team_overview 等 4 个视图未建（设计稿定位"只读统计走视图"，当前等价 SQL 在服务层；DDL 附录导出时统一建）

## [2026-09-09] 5.4 实时协作编辑模块完成

- 做了什么：
  - 服务端 modules/realtime/：yjs_updates 实体（bigserial+bytea 追加日志）、CollaborationPersistence（bindState 回放/播种 + 2s 缓冲合并入库 + writeState 合并回写快照/增量压缩/防误清保护）、RealtimeService（手动挂载 ws upgrade 到 Nest HTTP server，握手 JWT+归属校验，复用 AuthModule 的 JwtModule）
  - 转换层：yjs-convert.ts 按 y-prosemirror sync-plugin 的映射实现 schema-free 的 PM JSON→Y.XmlFragment 播种（官方 prosemirrorJSONToYXmlFragment 需要 PM Schema）；回写方向用官方 yXmlFragmentToProsemirrorJSON
  - 前端：NoteEditorPanel 重构为协作驱动（Collaboration+CollaborationCursor+WebsocketProvider，StarterKit history:false 改用 Yjs UndoManager，会话用 useEffect 管理生命周期），在线人数+连接状态 UI，协作光标 CSS
  - 验证：Node 双客户端 4 断言全过（播种/并发收敛/awareness/回写压缩）；WS 越权 401；双浏览器窗口多光标截图（CDP 驱动真实光标）
- 为什么：对应大纲 5.4.1~5.4.5；架构按 D-007 分工落地，实现决策见 D-009
- 新增依赖：y-websocket@^2.1.0、y-prosemirror@^1.3.7（server+web，Yjs 生态标准件）
- 产出素材：docs/assets/5.4.2-yjs-integration.png、5.4.3-cursor-sync.png、5.4.4-crdt-merge.png；docs/testing/5.4-collab-tests.md（COLLAB-01~14）；docs/api.md WebSocket 事件节（4.6.4）
- 诚实记录——调试期间发生的真实事故与修复：
  - StrictMode 下 useMemo 双调用泄漏 WebsocketProvider → 幽灵在线用户；已改 useEffect 生命周期
  - 泄漏连接的空文档 + 无保护 writeState 级联清掉了 N1 笔记正文（依 5.3 测试记录重建，新增防误清保护 COLLAB-10）；期间一度误判"连了两个数据库"，实为两次读数之间发生了回写（时序误读，已如实记录排障过程）
  - collab-test.mjs 跑两遍给 CRDT 笔记留下重复段落（CRDT 状态是事实来源，PATCH content 会被回放覆盖），已清帧+去重修复
- 遗留问题：
  - [ ] 团队笔记的协作权限（notes.visibility）在 5.5 落地 RealtimeService 扩展
  - [ ] yjs:doc:{noteId} Redis 热文档缓存未实现（设计稿标注"实现时可裁剪"，当前内存 doc 即热缓存）
  - [ ] vite 1.3MB chunk 警告延续（5.9 分包）
  - [ ] Edge headless 截图需临时 /__dev_login 路由，本次已用后移除并 grep 验证

## [2026-09-08] 5.3 个人笔记管理模块完成

- 做了什么：
  - 服务端：modules/notes/ 落地 5 个实体（Note/Folder/Tag/NoteTag/RecycleBin），与 database-design.md 逐字段对应，物理外键 + CHECK（chk_notes_team_folder/visibility）+ 索引（idx_notes_owner 等）经 NAS 真实库 synchronize 验证落库
  - 接口：notes CRUD（软删写 recycle_bin）、folders 树管理（同级重名/防成环/非空删除三重校验）、tags + 打标（复合主键幂等）、GET /notes?keyword= 搜索（content_text ILIKE + 通配符转义）；越权一律 404
  - 前端：HomePage 改为三栏工作台（文件夹树+标签/搜索 | 笔记列表 | Tiptap 编辑器），800ms 防抖自动保存四态状态栏，URL 深链 ?q= / ?note=
  - 测试：26 条用例全过（含越权/注入/幂等/中文检索），截图 4 张（Edge headless，临时 /__dev_login 路由用后已删并 grep 验证）
  - 设计稿回写两处实现调整（表达式索引→服务层查重；取消 gin_notes_search→ILIKE），见 D-008
- 为什么：对应大纲 5.3.1~5.3.5；表结构按 D-007 设计稿，搜索策略调整见 D-008
- 新增依赖：
  - @ant-design/icons@^5.6.1（antd5 配套图标；pnpm 严格模式必须显式声明传递依赖）
  - @tiptap/extension-placeholder@^2.8.0（空文档占位提示）
  - 安装波折：npmmirror 两次网络超时，第三次成功；icons 曾误装 v6，改 pin ^5 对齐 antd5
- 产出素材：docs/assets/5.3.1-note-edit.png、5.3.2-realtime-preview.png、5.3.3-folders.png、5.3.4-search.png；docs/testing/5.3-notes-tests.md（NOTE-01~26）；docs/api.md 笔记分组补全
- 遗留问题：
  - [ ] vite 1.3MB chunk 警告（antd+tiptap），5.9 打包时 manualChunks 分包
  - [ ] notes.team_id 暂无物理外键（teams 实体 5.5 落地时补建），服务端恒写 NULL 不受影响
  - [ ] 搜索为 ILIKE 无索引，数据量大后可考虑 pg_trgm 或 zhparser（论文 7.3 素材）
  - [ ] 演示数据已 seed（毕业论文/课程学习文件夹 + 3 笔记 + 2 标签），测试表附录有清单

## [2026-09-08] 5.2 用户认证模块完成（设计稿已获用户确认）

- 做了什么：
  - 服务端：Redis 全局模块（ioredis 连 NAS）；users 模块（User 实体对齐 database-design.md §3.1，`select:false` 隐藏密码列 + toSafe 脱敏）；auth 模块（注册/登录/登出 + JwtStrategy + JwtAuthGuard），TypeORM `uuidExtension:'pgcrypto'` 用 PG16 内置 gen_random_uuid()
  - 认证模型决策：单 JWT（7d）+ jti，登出写 Redis 黑名单 `auth:denylist:{jti}`（TTL=token 剩余寿命），不做 refresh_token 双令牌（毕业设计复杂度收益比，见 auth.service.ts 注释）
  - 前端：/login /register 页（Antd Form 前后端同规则校验）+ AuthContext + axios 拦截器（Bearer 注入 / 401 统一跳登录）+ 路由守卫 RequireAuth
  - 验证：curl 走通 10 条用例（注册/重复 409/弱密码 400/登录/守卫 401/登出拉黑），NAS 库与 Redis 键均确认；Edge headless 截图 3 张存 docs/assets/
  - 产出 docs/api.md（认证分组）与 docs/testing/5.2-auth-tests.md（AUTH-01~10 全过）
- 为什么：对应大纲 5.2.1~5.2.4；数据库设计稿经用户"确认"后才动工
- 新增依赖：@types/passport-jwt（dev，passport-jwt 已有的类型声明包）；其余全部使用脚手架已声明依赖（bcryptjs/@nestjs/jwt/passport 等），零新增运行时依赖
- 产出素材：docs/assets/5.2.1-register.png、5.2.2-login.png、5.2.4-home.png；docs/testing/5.2-auth-tests.md；docs/api.md
- 遗留问题：
  - [ ] vite build 754KB chunk 警告（antd 体积），5.9 打包优化时可用 manualChunks 分包，不影响功能
  - [ ] 测试遗留账号 lty@wangyan.test（username"另一个人"）可从库中删除；演示账号 demo@wangyan.test 保留
  - [ ] 实现细节：登录用户名"凌天"（2 字符）被 MinLength(3) 正确拦截——中文用户名按字符数计，前端规则一致

## [2026-09-08] 数据库设计稿（D-007，未建表）

- 做了什么：
  - 通读大纲（4.3 点名 7 表、3.3 七模块、4.5 RBAC、5.x 实现）与服务端现状（空脚手架，无实体约束）
  - 与用户确认 4 项核心决策：新增 folders 表 / JSONB 快照+yjs_updates 增量表 / 软删+recycle_bin 元数据 / 版本手动+关键事件快照
  - 第二轮细化：拆出 team_invitations、枚举用 varchar+CHECK、建 4 个视图、范式与反规范化逐条分析
  - 用户增项取舍：**加** tags+note_tags、attachments；**不加** audit_logs、refresh_tokens 设备管理（如实记录）
  - 产出 docs/diagrams/database-design.md：13 基表 + 4 视图 + 索引 + Redis 键 + RBAC 落表 + 扩展预留
- 为什么：5.2 编码前定全库结构，TypeORM 实体与附录 A DDL 的事实来源（论文 4.3）
- 新增依赖：无（纯设计，未写代码）
- 产出素材：docs/diagrams/database-design.md（兼作 4.3.1/4.3.9 ER 图文字底稿，用户据此画图）
- 遗留问题：
  - [ ] 设计稿待用户过目确认后，才在 5.2 起按实体落地建表（用户要求：不许直接写数据库）

## [2026-09-08] NAS 数据库容器部署与验证（5.1.3 完成）

- 做了什么：
  - 经用户授权，代为在 NAS（192.168.3.3）执行 nas-db-setup.sh：wangyan-postgres（postgres:16-alpine，:15432）与 wangyan-redis（redis:7-alpine，:16379）均已 up，`--restart unless-stopped`
  - 数据落在 D-006 新目录 /mnt/user/storage/Projects/wangyan-2026-db-data/{postgres,redis}，已确认有实际数据写入
  - NAS 侧验证：pg_isready accepting connections ✅、redis-cli PING → PONG ✅
  - Mac 侧端到端验证（用 workspace 内 pg/ioredis 走 .env 凭据）：PostgreSQL 16.15 连通 + JSONB 查询 OK ✅、Redis PING/SET/GET/DEL roundtrip ✅
  - 修复 nas-db-setup.sh 验证段：原脚本容器刚起就 pg_isready 必失败且 set -e 会跳过 redis 验证，改为 until 轮询等待
- 为什么：完成大纲 5.1.3 Docker 开发环境搭建；打通 Mac 开发 → NAS 数据库链路，为 5.2 用户认证模块（TypeORM 建表）铺路
- 新增依赖：无（验证脚本复用已有 pg / ioredis）
- 产出素材：无（环境验证，无界面）
- 遗留问题：
  - [ ] 本次部署未提交 NAS 本地的容器变更无回滚脚本需求（docker rm -f + 删数据目录即完全清除，运维速查见 nas-db-setup.sh）

## [2026-09-08] NAS 数据目录变更（D-006）

- 做了什么：
  - 按用户要求，NAS 数据库容器数据目录由 `/mnt/user/appdata/wangyan-2026/` 改为 `/mnt/user/storage/Projects/wangyan-2026-db-data/`（与 bare 仓库同在 storage/Projects 下）
  - 同步修改：nas-db-setup.sh（6 处）、README.md（1 处）
  - 新增决策 D-006（修订 D-005 的数据目录，其余拓扑不变）
- 为什么：项目代码与数据集中到 Projects 目录，备份/清除边界更清晰（用户指定）
- 新增依赖：无
- 产出素材：无
- 遗留问题：
  - [ ] NAS 上执行 nas-db-setup.sh（用户手动，尚未部署容器，对应 5.1.3）

## [2026-09-07] 环境搭建收尾：构建复验 + 提交 pnpm-lock.yaml

- 做了什么：
  - 复验环境：node 22.22.0 / pnpm 11.25.0，`pnpm install` 幂等通过（662 包，无需重装）
  - 复验构建：`pnpm -r build` —— apps/server（nest build）✅、apps/web（tsc --noEmit + vite build，1468 模块）✅、packages/shared（纯 TS 源码引用，无需构建）✅
  - 提交 pnpm-lock.yaml（连同上一次会话遗留的 pnpm-workspace.yaml allowBuilds 配置与记忆三件套更新）
- 为什么：5.1.1 开发环境配置收尾；lockfile 入库保证依赖可复现（大纲 5.1.1）
- 新增依赖：无
- 产出素材：无（环境验证，无界面）
- 遗留问题：
  - [ ] NAS 上执行 nas-db-setup.sh（用户手动，尚未部署容器，对应 5.1.3）

## [2026-09-06] Mac 工具链验证：pnpm install 排错

- 做了什么：
  - 复现 `pnpm install` 报错并定位：真实错误只有一个——pnpm v10+ 的 `ERR_PNPM_IGNORED_BUILDS`（默认禁止依赖跑安装脚本），被拦下的是 esbuild / leveldown / @nestjs/core 三个包；其余为 npmmirror 慢导致的重试 WARN（自动恢复）与 level 旧包链的 deprecated 警告（来自 y-websocket 的 optional 依赖 y-leveldb，无害）
  - 修复：填 `pnpm-workspace.yaml` 的 `allowBuilds`（pnpm 自动生成的占位原本是 "set this to true or false"）。注意 pnpm 11 已不读 package.json 的 `pnpm.onlyBuiltDependencies` 字段，配置必须放 workspace yaml
  - 重新 install 成功：662 个包，leveldown 原生模块经 node-gyp 本机编译通过（需 Xcode CLT，已具备）
  - 验证 `pnpm build`：apps/server（nest build）✅、apps/web（tsc --noEmit + vite build，1468 模块）✅
- 为什么：PROGRESS 待办"Mac 工具链 + pnpm install 验证"，属大纲 5.1.1 开发环境配置
- 新增依赖：无（仅批准已有依赖的构建脚本，allowBuilds 是配置不是依赖）
- 产出素材：无（环境验证，无界面）
- 遗留问题：
  - [ ] pnpm-lock.yaml 已生成，待提交（用户确认后 git commit）
  - [ ] NAS 上执行 nas-db-setup.sh（用户手动，尚未部署容器）

## [2026-09-05] 脚手架搭建 + 开发环境定稿 + Mac 迁移

- 做了什么：
  - 搭建 pnpm workspace 脚手架：根配置（pnpm-workspace / .env.example / .gitignore / .npmrc 镜像源）、docker-compose.yml、apps/server（NestJS+TypeORM+健康检查）、apps/web（React18+Vite+Antd）、packages/shared、两个多阶段 Dockerfile + nginx.conf
  - 确定三项选型：Tiptap（D-001）、TypeORM（D-002）、pnpm workspace（D-003）；目录组织与 Docker 编排方案（D-004）
  - 环境摸底：LXC 根文件系统为 shfs、Docker vfs 驱动 → 放弃在 LXC 开发；确定拓扑 D-005（NAS 数据库容器 + Mac 原生开发）
  - git init（main 分支），bare 仓库建在 NAS /mnt/user/storage/Projects/wangyan-2026.git，远端名 nas
  - Mac ~/projects/wangyan-2026 已 clone，.env 已单独同步（不走 git）
  - 端口全面改高位：15432 / 16379 / 13000 / 18080（NAS 上 5432/6379/3000 均被占用）
  - 新增 nas-db-setup.sh（含密码的容器部署命令存档）与 README.md
- 为什么：数据库常驻 NAS、开发迁 Mac、演示只要 PPT，NAS 零侵入
- 新增依赖：仅声明（package.json），依赖未完整安装（LXC 网络断流 + 用户叫停；Mac 上待装工具链后重新 install）
- 产出素材：无（脚手架阶段无截图）
- 遗留问题：
  - [ ] NAS 上执行 nas-db-setup.sh（用户手动，尚未部署容器）
  - [ ] Mac 安装 Homebrew + node@22 + pnpm，然后 pnpm install 验证构建
  - [ ] pnpm-lock.yaml 尚未生成（首次成功 install 后提交）


> 时间倒序，最新在最上面。每次会话至少追加一条，格式见 AGENTS.md §5.3。
> 诚实原则：失败、绕路、没做完，都要如实写。

## [2026-09-05] 项目立项与规则建立

- 做了什么：
  - 建立 AI 开发规则体系：AGENTS.md（规则主体）+ CLAUDE.md（自动加载入口）
  - 归档论文大纲：docs/THESIS_OUTLINE.md（冻结）
  - 建立记忆三件套：docs/memory/{PROGRESS,DECISIONS,CHANGELOG}.md
- 为什么：毕业论文（在线 Markdown 笔记编辑与管理平台）配套系统从零开始，先立规矩再写代码。
- 新增依赖：无（尚未初始化代码）
- 产出素材：无
- 遗留问题：编辑器（D-001）、ORM（D-002）、monorepo（D-003）三项选型待定，初始化脚手架前需先定。
