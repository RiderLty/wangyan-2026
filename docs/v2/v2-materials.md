# v2.0 AI 增强——素材与变更索引

> **存放规则（用户 2026-10-08 指示）**：论文 Word 已定稿、不再从 Markdown 改造，本目录是 v2.0 全部新素材的独立存放点；**禁止修改 `docs/thesis/` 与 `docs/assets/`**（v1 定稿素材）。若论文新增 5.10 节，编号对照在本页维护。

## 截图（docs/v2/assets/）

| 文件 | 内容 | 对应用例 |
|---|---|---|
| `5.10.2-ai-menu.png` | 编辑器工具栏 AI 菜单展开（五动作 + 自定义指令） | AI-07 前置画面 |
| `5.10.2-ai-collab.png` | B 端（苏婉晴）视角：AI 续写内容经 CRDT 同步到达，列表/粗体/行内代码渲染正确，顶栏显示 A 端在线 | AI-07 / AI-15 / AI-18 |
| `5.10.3-ai-agent-drawer.png` | AI 助手抽屉：工具链路条（搜索笔记 Tag + 参数）+ 助手回答；背景为 Agent 创建的《Docker 部署检查清单》（引用块/加粗列表/行内代码/代码块渲染正确） | AGENT-05 |

## 可复跑脚本

- `scripts/screenshots/ai-ui-check.mjs` —— 无头浏览器 UI 复检：双 context 协作同步断言 + 前两张截图（对本地 `pnpm dev` 执行，临时笔记自动建删）
- `scripts/screenshots/agent-ui-check.mjs` —— Agent 抽屉 UI 复检 + 第三张截图

## 论文新小节编号对照（大纲解冻后启用）

| 拟定小节 | 素材 |
|---|---|
| 5.10.1 LLM 网关 | `llm-gateway.service.ts`（SSE 解析/tool_calls 聚合/双通道）、`docs/api.md` 第六节、AI-01~06 |
| 5.10.2 编辑器 AI 与 CRDT 集成 | `EditorAiMenu.tsx`（缓冲+整块解析插入，D-017）、本页两张截图、AI-07/15/17/18 |
| 5.10.3 Agent 工具调用与权限收敛 | `agent.service.ts`（MAX_STEPS 循环）、`agent/tools.ts`（工具×RBAC 收敛规则）、`markdown-to-prosemirror.ts`、`ai_messages` 审计表、抽屉截图、AGENT-01~06 |
| 6.2.8 AI 功能测试 | `docs/testing/ai-tests.md`（AI-01~20 + AGENT-01~06） |
