-- ============================================================
-- v2.0 AI 增强版新增表 DDL（论文 5.10 支撑表，2026-10-09）
-- 说明：v1 的 13 表 DDL 见 docs/appendix-ddl.sql（论文附录 A，随 v1 定稿冻结）。
-- 本文件是 v2.0 增量：AI 会话/消息、整理元数据、向量检索三组表。
-- 生产环境 NODE_ENV=production 时 TypeORM synchronize=false，本脚本即生产建表依据。
-- 执行方式（NAS）：docker exec -i wangyan-postgres psql -U <user> -d <db> < v2-ddl.sql
-- ============================================================

-- L3 混合检索依赖：pgvector 扩展（镜像需为 pgvector/pgvector:pg16）
CREATE EXTENSION IF NOT EXISTS vector;

-- ---- AI 会话（M2，论文 5.10.3）----
CREATE TABLE IF NOT EXISTS ai_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  note_id     uuid,
  title       varchar(200),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON ai_conversations(user_id);

-- ---- AI 消息（M2，含工具调用审计）----
CREATE TABLE IF NOT EXISTS ai_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            varchar(12) NOT NULL,          -- user / assistant / tool
  content         text,
  tool_calls      jsonb,                         -- assistant 发起的工具调用
  tool_call_id    varchar(64),                   -- tool 消息回填的调用 id
  model           varchar(64),
  tokens          integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages(conversation_id, created_at);

-- ---- AI 整理元数据（M3，L2 摘要卡/标签建议；与 notes 核心表分离）----
CREATE TABLE IF NOT EXISTS note_ai_meta (
  note_id        uuid PRIMARY KEY,               -- 一篇笔记一行，随笔记级联删除
  summary        text,
  suggested_tags jsonb,
  model          varchar(64),
  created_at     timestamptz NOT NULL DEFAULT now(),
  organized_at   timestamptz NOT NULL DEFAULT now()
);

-- ---- 笔记向量（M4，L3 混合检索；1024 维 = qwen3.7-text-embedding 实测口径）----
CREATE TABLE IF NOT EXISTS note_embeddings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     uuid NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  content     text NOT NULL,                     -- 该向量对应的正文切片
  embedding   vector(1024) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_note_chunk UNIQUE (note_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_note_emb_note ON note_embeddings(note_id);
-- 数据量小（论文演示规模）先建精确检索索引；超万行后可换 ivfflat/HNSW 近似索引
