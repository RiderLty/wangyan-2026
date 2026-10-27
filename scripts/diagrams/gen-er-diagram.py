#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成论文图 4-3 数据库 E-R 图（陈氏记法：矩形实体 / 椭圆属性 / 菱形联系）。
数据来源：apps/server/src/modules/**/*.entity.ts 与 docs/v2/v2-ddl.sql（16 张基表）。
输出：docs/v2/assets/4-3-数据库ER图.svg / .png
"""
import math
import subprocess
from pathlib import Path

W, H = 3400, 2400
ROOT = Path(__file__).resolve().parents[2]
OUT_SVG = ROOT / "docs/v2/assets/4-3-数据库ER图.svg"
OUT_PNG = ROOT / "docs/v2/assets/4-3-数据库ER图.png"

CN_FONT = "'PingFang SC','Microsoft YaHei',sans-serif"
SLATE = "#475569"
TEXT = "#1E293B"
LINE = "#64748B"
AI = "#6366F1"
AI_FILL = "#EEF2FF"
AI_TEXT = "#312E81"


def text_w(s, fs):
    return sum(fs * 1.0 if ord(c) > 127 else fs * 0.6 for c in s)


# ---------------------------------------------------------------- 实体定义
# x/y 为中心点；attrs 为展示的主要属性（PK 自动加下划线，完整字段见附录 A）
# attr_pos 为每个属性椭圆的固定圆心（手工布点，避开联系线与其它图形）
ENTITIES = {
    "teams": dict(cn="团队", en="teams", x=700, y=360,
        attrs=["团队ID", "名称", "简介"], pk="团队ID",
        attr_pos={"团队ID": (475, 490), "名称": (449, 293), "简介": (570, 135)}),
    "users": dict(cn="用户", en="users", x=700, y=1100,
        attrs=["用户ID", "邮箱", "用户名", "密码哈希"], pk="用户ID",
        attr_pos={"用户ID": (540, 1377), "邮箱": (430, 1235),
                  "用户名": (385, 1044), "密码哈希": (474, 874)}),
    "team_invitations": dict(cn="团队邀请", en="team_invitations", x=1700, y=300,
        attrs=["邀请ID", "受邀邮箱", "状态", "到期时间"], pk="邀请ID",
        attr_pos={"邀请ID": (1900, 150), "受邀邮箱": (1720, 118),
                  "状态": (1530, 150), "到期时间": (1400, 220)}),
    "folders": dict(cn="文件夹", en="folders", x=1600, y=960,
        attrs=["文件夹ID", "名称"], pk="文件夹ID",
        attr_pos={"文件夹ID": (1250, 790), "名称": (1900, 940)}),
    "notes": dict(cn="笔记", en="notes", x=2350, y=1100,
        attrs=["笔记ID", "标题", "正文", "可见性"], pk="笔记ID",
        attr_pos={"笔记ID": (1967, 779), "标题": (2139, 647),
                  "正文": (2350, 600), "可见性": (2561, 653)}),
    "tags": dict(cn="标签", en="tags", x=3100, y=480,
        attrs=["标签ID", "名称", "颜色"], pk="标签ID",
        attr_pos={"标签ID": (3028, 209), "名称": (3175, 130), "颜色": (3298, 282)}),
    "note_versions": dict(cn="笔记版本", en="note_versions", x=1000, y=1600,
        attrs=["版本ID", "版本号", "来源"], pk="版本ID",
        attr_pos={"版本ID": (1208, 1720), "版本号": (1062, 1832), "来源": (880, 1808)}),
    "yjs_updates": dict(cn="协作增量", en="yjs_updates", x=3250, y=850,
        attrs=["增量ID", "增量数据"], pk="增量ID",
        attr_pos={"增量ID": (3074, 702), "增量数据": (3210, 624)}),
    "recycle_bin": dict(cn="回收站", en="recycle_bin", x=3150, y=1250,
        attrs=["记录ID", "到期时间"], pk="记录ID",
        attr_pos={"记录ID": (3071, 1034), "到期时间": (3229, 1034)}),
    "share_links": dict(cn="分享链接", en="share_links", x=1500, y=1650,
        attrs=["链接ID", "令牌", "权限"], pk="链接ID",
        attr_pos={"链接ID": (1735, 1736), "令牌": (1606, 1877), "权限": (1414, 1885)}),
    "ai_conversations": dict(cn="AI 会话", en="ai_conversations", x=600, y=1900,
        attrs=["会话ID", "标题"], pk="会话ID", ai=True,
        attr_pos={"会话ID": (557, 2146), "标题": (365, 1814)}),
    "ai_messages": dict(cn="AI 消息", en="ai_messages", x=1400, y=2150,
        attrs=["消息ID", "角色", "内容", "令牌数"], pk="消息ID", ai=True,
        attr_pos={"消息ID": (1660, 2050), "角色": (1685, 2150),
                  "内容": (1660, 2250), "令牌数": (1800, 2320)}),
    "note_ai_meta": dict(cn="AI 整理元数据", en="note_ai_meta", x=2450, y=1800,
        attrs=["笔记ID", "摘要", "标签建议"], pk="笔记ID", ai=True,
        attr_pos={"笔记ID": (2667, 1675), "摘要": (2667, 1925),
                  "标签建议": (2450, 2050)}),
    "note_embeddings": dict(cn="向量切片", en="note_embeddings", x=3050, y=1600,
        attrs=["切片ID", "切片内容", "向量"], pk="切片ID", ai=True,
        attr_pos={"切片ID": (3266, 1679), "切片内容": (3165, 1799),
                  "向量": (3010, 1826)}),
}

# ---------------------------------------------------------------- 联系定义
# name 联系名；a/b 实体键；card=两端的基数；pos 菱形中心（必须落在两实体连线上）；
# attrs 联系自身的属性（仅 M:N 的“加入”有）
RELATIONS = [
    dict(a="users", b="teams", name="拥有", card=("1", "N"), pos=(760, 700)),
    dict(a="users", b="teams", name="加入", card=("M", "N"), pos=(520, 700),
         attrs=[("角色", (300, 600)), ("加入时间", (300, 830))]),
    dict(a="users", b="team_invitations", name="发出", card=("1", "N"), pos=(1000, 860)),
    dict(a="teams", b="team_invitations", name="招募", card=("1", "N"), pos=(1200, 330)),
    dict(a="users", b="folders", name="创建", card=("1", "N"), pos=(1150, 1030)),
    dict(a="users", b="notes", name="编写", card=("1", "N"), pos=(1400, 1100)),
    dict(a="users", b="note_versions", name="产生", card=("1", "N"), pos=(850, 1350)),
    dict(a="users", b="share_links", name="生成", card=("1", "N"), pos=(1100, 1375)),
    dict(a="users", b="ai_conversations", name="发起", card=("1", "N"), pos=(644, 1550)),
    dict(a="teams", b="notes", name="发布", card=("1", "N"), pos=(1525, 730)),
    dict(a="folders", b="notes", name="收纳", card=("1", "N"), pos=(2050, 1064)),
    dict(a="notes", b="tags", name="标注", card=("M", "N"), pos=(2725, 790)),
    dict(a="notes", b="note_versions", name="留存", card=("1", "N"), pos=(1675, 1350)),
    dict(a="notes", b="yjs_updates", name="记录", card=("1", "N"), pos=(2800, 975)),
    dict(a="notes", b="recycle_bin", name="对应", card=("1", "1"), pos=(2750, 1175)),
    dict(a="notes", b="share_links", name="分享", card=("1", "N"), pos=(1925, 1375)),
    dict(a="notes", b="note_ai_meta", name="派生", card=("1", "0..1"), pos=(2400, 1450)),
    dict(a="notes", b="note_embeddings", name="切分", card=("1", "N"), pos=(2700, 1350)),
    dict(a="ai_conversations", b="ai_messages", name="包含", card=("1", "N"), pos=(1000, 2025)),
]

ATTR_FS = 28
DIAMOND_FS = 30
ENTITY_FS = 36
EN_FS = 19
PK_GAP = 6

parts = []
parts.append(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
    f'font-family="{CN_FONT}">\n'
    f'<rect x="0" y="0" width="{W}" height="{H}" fill="#FFFFFF"/>\n'
)


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def ent_geom(e):
    w = max(text_w(e["cn"], ENTITY_FS) + 64, 180)
    h = 104
    return w, h


def attr_geom(t):
    w = max(text_w(t, ATTR_FS) + 52, 148)
    return w, 62


def diamond_geom(name):
    w = max(text_w(name, DIAMOND_FS) + 76, 150)
    return w, 100


def border_rect(cx, cy, w, h, tx, ty):
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    t = min((w / 2) / abs(dx) if dx else 1e9, (h / 2) / abs(dy) if dy else 1e9)
    return cx + dx * t, cy + dy * t


def border_diamond(cx, cy, hw, hh, tx, ty):
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    t = 1.0 / (abs(dx) / hw + abs(dy) / hh)
    return cx + dx * t, cy + dy * t


def border_ellipse(cx, cy, rx, ry, tx, ty):
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    t = 1.0 / math.hypot(dx / rx, dy / ry)
    return cx + dx * t, cy + dy * t


# ---------------------------------------------------------------- 画联系
for r in RELATIONS:
    A, B = ENTITIES[r["a"]], ENTITIES[r["b"]]
    if "pos" in r:
        dx, dy = r["pos"]
    else:
        dx, dy = (A["x"] + B["x"]) / 2, (A["y"] + B["y"]) / 2
    dw, dh = diamond_geom(r["name"])
    hw, hh = dw / 2, dh / 2

    for key, e in ((r["a"], A), (r["b"], B)):
        ew, eh = ent_geom(e)
        x1, y1 = border_rect(e["x"], e["y"], ew, eh, dx, dy)
        x2, y2 = border_diamond(dx, dy, hw, hh, e["x"], e["y"])
        parts.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{LINE}" stroke-width="1.8"/>\n'
        )
        # 基数标签：贴近实体一端
        lx, ly = x1 + (x2 - x1) * 0.25, y1 + (y2 - y1) * 0.25
        # 垂直偏移
        vx, vy = x2 - x1, y2 - y1
        ln = math.hypot(vx, vy) or 1
        ox, oy = -vy / ln * 26, vx / ln * 26
        card = r["card"][0] if key == r["a"] else r["card"][1]
        parts.append(
            f'<text x="{lx + ox:.1f}" y="{ly + oy:.1f}" font-size="26" '
            f'font-weight="700" fill="{SLATE}" text-anchor="middle" '
            f'dominant-baseline="middle">{card}</text>\n'
        )

    # 菱形
    pts = f"{dx},{dy - hh} {dx + hw},{dy} {dx},{dy + hh} {dx - hw},{dy}"
    parts.append(
        f'<polygon points="{pts}" fill="#F8FAFC" stroke="{SLATE}" stroke-width="2"/>\n'
    )
    parts.append(
        f'<text x="{dx}" y="{dy}" font-size="{DIAMOND_FS}" font-weight="600" '
        f'fill="{TEXT}" text-anchor="middle" dominant-baseline="middle">'
        f'{esc(r["name"])}</text>\n'
    )

    # 联系自身的属性
    for attr, (ax, ay) in r.get("attrs", []):
        aw, ah = attr_geom(attr)
        bx, by = border_diamond(dx, dy, hw, hh, ax, ay)
        # 从菱形边缘连到椭圆边缘
        ex, ey = border_ellipse(ax, ay, aw / 2, ah / 2, bx, by)
        parts.append(
            f'<line x1="{bx:.1f}" y1="{by:.1f}" x2="{ex:.1f}" y2="{ey:.1f}" '
            f'stroke="{LINE}" stroke-width="1.6"/>\n'
        )
        parts.append(
            f'<ellipse cx="{ax}" cy="{ay}" rx="{aw / 2}" ry="{ah / 2}" '
            f'fill="#FFFFFF" stroke="{SLATE}" stroke-width="1.6"/>\n'
        )
        parts.append(
            f'<text x="{ax}" y="{ay}" font-size="{ATTR_FS}" fill="{TEXT}" '
            f'text-anchor="middle" dominant-baseline="middle">{esc(attr)}</text>\n'
        )

# ---------------------------------------------------------------- 画实体
for key, e in ENTITIES.items():
    ew, eh = ent_geom(e)
    is_ai = e.get("ai", False)
    fill = AI_FILL if is_ai else "#FFFFFF"
    stroke = AI if is_ai else SLATE
    tcol = AI_TEXT if is_ai else TEXT
    parts.append(
        f'<rect x="{e["x"] - ew / 2}" y="{e["y"] - eh / 2}" width="{ew}" height="{eh}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="2.4"/>\n'
    )
    parts.append(
        f'<text x="{e["x"]}" y="{e["y"] - 9}" font-size="{ENTITY_FS}" font-weight="700" '
        f'fill="{tcol}" text-anchor="middle" dominant-baseline="middle">{esc(e["cn"])}</text>\n'
    )
    parts.append(
        f'<text x="{e["x"]}" y="{e["y"] + 27}" font-size="{EN_FS}" '
        f'fill="{AI if is_ai else "#64748B"}" text-anchor="middle" '
        f'dominant-baseline="middle">{esc(e["en"])}</text>\n'
    )

# ---------------------------------------------------------------- 画属性
for key, e in ENTITIES.items():
    ew, eh = ent_geom(e)
    for attr in e["attrs"]:
        ax, ay = e["attr_pos"][attr]
        aw, ah = attr_geom(attr)
        # 椭圆边缘 -> 实体边缘
        ex, ey = border_ellipse(ax, ay, aw / 2, ah / 2, e["x"], e["y"])
        rx, ry = border_rect(e["x"], e["y"], ew, eh, ax, ay)
        parts.append(
            f'<line x1="{ex:.1f}" y1="{ey:.1f}" x2="{rx:.1f}" y2="{ry:.1f}" '
            f'stroke="{LINE}" stroke-width="1.5"/>\n'
        )
        parts.append(
            f'<ellipse cx="{ax:.1f}" cy="{ay:.1f}" rx="{aw / 2:.1f}" ry="{ah / 2:.1f}" '
            f'fill="#FFFFFF" stroke="{SLATE}" stroke-width="1.6"/>\n'
        )
        is_pk = attr == e["pk"]
        parts.append(
            f'<text x="{ax:.1f}" y="{ay:.1f}" font-size="{ATTR_FS}" fill="{TEXT}" '
            f'text-anchor="middle" dominant-baseline="middle">{esc(attr)}</text>\n'
        )
        if is_pk:
            tw = text_w(attr, ATTR_FS)
            uy = ay + ATTR_FS / 2 + PK_GAP
            parts.append(
                f'<line x1="{ax - tw / 2:.1f}" y1="{uy:.1f}" x2="{ax + tw / 2:.1f}" '
                f'y2="{uy:.1f}" stroke="{TEXT}" stroke-width="2"/>\n'
            )

# ---------------------------------------------------------------- 图例
legend_y = 2280
items = [
    ("rect", "实体"),
    ("ellipse", "属性"),
    ("diamond", "联系"),
    ("pk", "主键"),
    ("ai", "AI 派生实体"),
]
x = 110
parts.append(f'<g font-size="26" fill="{TEXT}">\n')
for kind, label in items:
    if kind == "rect":
        parts.append(f'<rect x="{x}" y="{legend_y - 22}" width="64" height="40" fill="#FFFFFF" stroke="{SLATE}" stroke-width="2"/>\n')
        tx = x + 82
    elif kind == "ellipse":
        parts.append(f'<ellipse cx="{x + 34}" cy="{legend_y - 2}" rx="34" ry="21" fill="#FFFFFF" stroke="{SLATE}" stroke-width="1.7"/>\n')
        tx = x + 82
    elif kind == "diamond":
        parts.append(f'<polygon points="{x + 34},{legend_y - 24} {x + 70},{legend_y - 2} {x + 34},{legend_y + 20} {x - 2},{legend_y - 2}" fill="#F8FAFC" stroke="{SLATE}" stroke-width="2"/>\n')
        tx = x + 82
    elif kind == "pk":
        parts.append(f'<ellipse cx="{x + 34}" cy="{legend_y - 2}" rx="34" ry="21" fill="#FFFFFF" stroke="{SLATE}" stroke-width="1.7"/>\n')
        parts.append(f'<text x="{x + 34}" y="{legend_y - 2}" font-size="24" text-anchor="middle" dominant-baseline="middle">属性</text>\n')
        parts.append(f'<line x1="{x + 20}" y1="{legend_y + 9}" x2="{x + 48}" y2="{legend_y + 9}" stroke="{TEXT}" stroke-width="2"/>\n')
        tx = x + 82
    else:
        parts.append(f'<rect x="{x}" y="{legend_y - 22}" width="64" height="40" fill="{AI_FILL}" stroke="{AI}" stroke-width="2"/>\n')
        tx = x + 82
    parts.append(f'<text x="{tx}" y="{legend_y}" text-anchor="start">{label}</text>\n')
    x = tx + text_w(label, 26) + 70
parts.append('</g>\n')

parts.append("</svg>\n")
OUT_SVG.write_text("".join(parts), encoding="utf-8")
print(f"SVG -> {OUT_SVG}")

subprocess.run(["rsvg-convert", "-w", str(W), "-o", str(OUT_PNG), str(OUT_SVG)], check=True)
print(f"PNG -> {OUT_PNG}")
