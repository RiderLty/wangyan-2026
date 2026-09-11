-- ============================================================
-- 附录 A：核心数据表结构 DDL（在线 Markdown 笔记编辑与管理平台）
-- 生成方式：TypeORM synchronize 建表后，由 NAS 生产库 pg_dump --schema-only 导出，
--           再追加设计稿（docs/diagrams/database-design.md §6）定义的 4 个只读视图。
-- 数据库：PostgreSQL 16（UUID 主键使用 pgcrypto 扩展的 gen_random_uuid()）
-- 说明：设计稿中的 attachments 表为上传功能预留，因论文大纲不含附件功能未建表（见 7.3 改进方向）。
-- ============================================================

-- UUID 生成依赖
CREATE EXTENSION IF NOT EXISTS pgcrypto;

--
-- PostgreSQL database dump
--

\restrict sXtaokq5n40yso1xXV2Rl2pcdFBFttbZ3jgfaIiX9KFDdXJuNCYRKwNZ75tjGvJ

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    parent_id uuid,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: note_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.note_tags (
    note_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: note_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.note_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    note_id uuid NOT NULL,
    version_no integer NOT NULL,
    title character varying(200) NOT NULL,
    content jsonb NOT NULL,
    source character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_note_versions_source CHECK (((source)::text = ANY ((ARRAY['manual'::character varying, 'auto'::character varying, 'rollback'::character varying])::text[])))
);


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    team_id uuid,
    folder_id uuid,
    title character varying(200) NOT NULL,
    content jsonb NOT NULL,
    content_text text DEFAULT ''::text NOT NULL,
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_notes_team_folder CHECK (((team_id IS NULL) OR (folder_id IS NULL))),
    CONSTRAINT chk_notes_visibility CHECK (((visibility)::text = ANY ((ARRAY['private'::character varying, 'team_read'::character varying, 'team_edit'::character varying])::text[])))
);


--
-- Name: recycle_bin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recycle_bin (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    note_id uuid NOT NULL,
    original_owner_id uuid NOT NULL,
    original_folder_id uuid,
    deleted_by uuid NOT NULL,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: share_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    note_id uuid NOT NULL,
    token character varying(32) NOT NULL,
    permission character varying(20) DEFAULT 'read'::character varying NOT NULL,
    expires_at timestamp with time zone,
    is_enabled boolean DEFAULT true NOT NULL,
    visit_count integer DEFAULT 0 NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_share_permission CHECK (((permission)::text = ANY ((ARRAY['read'::character varying, 'edit'::character varying])::text[])))
);


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name character varying(50) NOT NULL,
    color character varying(20),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: team_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    inviter_id uuid NOT NULL,
    invitee_email character varying(255) NOT NULL,
    invitee_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_team_invitations_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'declined'::character varying, 'cancelled'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role character varying(20) DEFAULT 'member'::character varying NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_team_members_role CHECK (((role)::text = ANY ((ARRAY['owner'::character varying, 'admin'::character varying, 'member'::character varying])::text[])))
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    owner_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(100) NOT NULL,
    avatar_url character varying(500),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: yjs_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.yjs_updates (
    id bigint NOT NULL,
    note_id uuid NOT NULL,
    update bytea NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: yjs_updates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.yjs_updates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: yjs_updates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.yjs_updates_id_seq OWNED BY public.yjs_updates.id;


--
-- Name: yjs_updates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yjs_updates ALTER COLUMN id SET DEFAULT nextval('public.yjs_updates_id_seq'::regclass);


--
-- Name: yjs_updates PK_00e7383d0c424492c4c58006022; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yjs_updates
    ADD CONSTRAINT "PK_00e7383d0c424492c4c58006022" PRIMARY KEY (id);


--
-- Name: recycle_bin PK_057db06896a171ede1311ed3f7e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recycle_bin
    ADD CONSTRAINT "PK_057db06896a171ede1311ed3f7e" PRIMARY KEY (id);


--
-- Name: share_links PK_70320b79ecd8acab96419fcdd6d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT "PK_70320b79ecd8acab96419fcdd6d" PRIMARY KEY (id);


--
-- Name: teams PK_7e5523774a38b08a6236d322403; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY (id);


--
-- Name: folders PK_8578bd31b0e7f6d6c2480dbbca8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT "PK_8578bd31b0e7f6d6c2480dbbca8" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: notes PK_af6206538ea96c4e77e9f400c3d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT "PK_af6206538ea96c4e77e9f400c3d" PRIMARY KEY (id);


--
-- Name: team_invitations PK_c14b443d431077f89344a3fd262; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT "PK_c14b443d431077f89344a3fd262" PRIMARY KEY (id);


--
-- Name: team_members PK_ca3eae89dcf20c9fd95bf7460aa; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT "PK_ca3eae89dcf20c9fd95bf7460aa" PRIMARY KEY (id);


--
-- Name: tags PK_e7dc17249a1148a1970748eda99; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY (id);


--
-- Name: note_versions PK_e8f8bdb9b26fa5486cf6aeeaf02; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_versions
    ADD CONSTRAINT "PK_e8f8bdb9b26fa5486cf6aeeaf02" PRIMARY KEY (id);


--
-- Name: note_tags PK_fdb07cb0571e1ecfaeffc703281; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_tags
    ADD CONSTRAINT "PK_fdb07cb0571e1ecfaeffc703281" PRIMARY KEY (note_id, tag_id);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: share_links UQ_9bc1c27d683c427cda047f23205; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT "UQ_9bc1c27d683c427cda047f23205" UNIQUE (token);


--
-- Name: users UQ_fe0bb3f6520ee0469504521e710; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE (username);


--
-- Name: IDX_7400b7c123acc341b1a124af24; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7400b7c123acc341b1a124af24" ON public.recycle_bin USING btree (expires_at);


--
-- Name: IDX_c9b5b525a96ddc2c5647d7f7fa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c9b5b525a96ddc2c5647d7f7fa" ON public.users USING btree (created_at);


--
-- Name: idx_note_tags_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_tags_tag ON public.note_tags USING btree (tag_id);


--
-- Name: idx_notes_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_folder ON public.notes USING btree (folder_id);


--
-- Name: idx_notes_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_owner ON public.notes USING btree (owner_id, deleted_at);


--
-- Name: idx_notes_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_team ON public.notes USING btree (team_id, deleted_at);


--
-- Name: idx_recycle_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recycle_expires ON public.recycle_bin USING btree (expires_at);


--
-- Name: idx_share_note; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_note ON public.share_links USING btree (note_id);


--
-- Name: idx_versions_note; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_versions_note ON public.note_versions USING btree (note_id, version_no);


--
-- Name: idx_yjs_note; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_yjs_note ON public.yjs_updates USING btree (note_id, id);


--
-- Name: uq_folders_owner_parent_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_folders_owner_parent_name ON public.folders USING btree (owner_id, parent_id, name);


--
-- Name: uq_tags_owner_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tags_owner_name ON public.tags USING btree (owner_id, name);


--
-- Name: uq_team_invitations_team_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_team_invitations_team_email ON public.team_invitations USING btree (team_id, invitee_email);


--
-- Name: uq_team_members_team_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_team_members_team_user ON public.team_members USING btree (team_id, user_id);


--
-- Name: teams FK_03655bd3d01df69022646faffd5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT "FK_03655bd3d01df69022646faffd5" FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: note_versions FK_3af23a358bd17d32b28749b4da8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_versions
    ADD CONSTRAINT "FK_3af23a358bd17d32b28749b4da8" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notes FK_43ac30e15db95c8e423110c8b1c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT "FK_43ac30e15db95c8e423110c8b1c" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE RESTRICT;


--
-- Name: team_invitations FK_47d9ff0726cf20571e29480a99b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT "FK_47d9ff0726cf20571e29480a99b" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: share_links FK_4e055b58ebb5b76da987a770673; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT "FK_4e055b58ebb5b76da987a770673" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: note_tags FK_6fa35b8ead30ef28cc1ac377b21; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_tags
    ADD CONSTRAINT "FK_6fa35b8ead30ef28cc1ac377b21" FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: note_versions FK_71f17f1c33f2a4e36cc7cd80005; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_versions
    ADD CONSTRAINT "FK_71f17f1c33f2a4e36cc7cd80005" FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: yjs_updates FK_836ce6a1dc01d7d729a729d6ba5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yjs_updates
    ADD CONSTRAINT "FK_836ce6a1dc01d7d729a729d6ba5" FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: note_tags FK_898115de9eadba996d4323ff0b6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_tags
    ADD CONSTRAINT "FK_898115de9eadba996d4323ff0b6" FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: notes FK_8aa719f42b3c8b23c2d29f799c0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT "FK_8aa719f42b3c8b23c2d29f799c0" FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;


--
-- Name: team_invitations FK_8cc7a808e2e23b0d5f68d9d5f28; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT "FK_8cc7a808e2e23b0d5f68d9d5f28" FOREIGN KEY (inviter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: folders FK_938a930768697b6ece215667d8e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT "FK_938a930768697b6ece215667d8e" FOREIGN KEY (parent_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: tags FK_9a56d7e79457b9cc8aba88a0329; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT "FK_9a56d7e79457b9cc8aba88a0329" FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recycle_bin FK_a229cbfc648d279fdf1a28686ac; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recycle_bin
    ADD CONSTRAINT "FK_a229cbfc648d279fdf1a28686ac" FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: team_members FK_c2bf4967c8c2a6b845dadfbf3d4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: share_links FK_d7a99959eb31e2185f3d0c851f5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT "FK_d7a99959eb31e2185f3d0c851f5" FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: folders FK_ecee72de3b100ef0bbebe47f3c4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT "FK_ecee72de3b100ef0bbebe47f3c4" FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notes FK_f9e103f8ae67cb1787063597925; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT "FK_f9e103f8ae67cb1787063597925" FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: team_invitations FK_fb94fab7079ad27b8b6655a67f2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT "FK_fb94fab7079ad27b8b6655a67f2" FOREIGN KEY (invitee_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: team_members FK_fdad7d5768277e60c40e01cdcea; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT "FK_fdad7d5768277e60c40e01cdcea" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict sXtaokq5n40yso1xXV2Rl2pcdFBFttbZ3jgfaIiX9KFDdXJuNCYRKwNZ75tjGvJ



-- ============================================================
-- 只读视图（设计稿 §6：业务 CRUD 走基表，视图只服务只读查询与统计——论文 4.3.9）
-- ============================================================

-- V1 语义基线：所有"未删除笔记"查询的统一入口
CREATE VIEW v_active_notes AS
  SELECT id, owner_id, team_id, folder_id, title, visibility, updated_at
  FROM notes WHERE deleted_at IS NULL;

-- V2 团队面板：列表 + 成员数 + 笔记数
CREATE VIEW v_team_overview AS
  SELECT t.id, t.name, t.owner_id,
         (SELECT count(*) FROM team_members m WHERE m.team_id = t.id) AS member_count,
         (SELECT count(*) FROM notes n
           WHERE n.team_id = t.id AND n.deleted_at IS NULL) AS note_count
  FROM teams t;

-- V3 回收站展示：含剩余天数（清理倒计时的计算收进数据库）
CREATE VIEW v_recycle_bin_items AS
  SELECT rb.id, rb.note_id, n.title, rb.original_owner_id, rb.deleted_by,
         rb.deleted_at, rb.expires_at,
         GREATEST(0, ceil(EXTRACT(EPOCH FROM (rb.expires_at - now())) / 86400)
         )::int AS days_remaining
  FROM recycle_bin rb JOIN notes n ON n.id = rb.note_id;

-- V4 版本首页：各笔记最新版本号
CREATE VIEW v_note_latest_version AS
  SELECT DISTINCT ON (note_id) note_id, version_no, created_at
  FROM note_versions ORDER BY note_id, version_no DESC;
