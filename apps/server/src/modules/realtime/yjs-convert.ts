import * as Y from 'yjs';

/**
 * ProseMirror 文档 JSON → Y.XmlFragment 播种转换（论文 4.4.2）
 *
 * 严格遵循 y-prosemirror sync-plugin 的存储映射（schema-free 复刻）：
 * - 相邻 text 节点合并为一个 Y.XmlText（delta 格式），marks 写为同名属性（值 = mark.attrs）
 * - 元素节点 → Y.XmlElement(node.type)，非 null attrs 写为属性
 *
 * 该映射保证：播种后的 Yjs 文档与 Tiptap(y-prosemirror) 客户端编辑产生的结构一致，
 * 客户端可直接增量编辑（y-prosemirror 官方 prosemirrorJSONToYXmlFragment 需要 PM Schema，
 * 服务端无 Schema，故按相同映射自行实现）。
 */

interface PMNodeJson {
  type: string;
  text?: string;
  attrs?: Record<string, unknown> | null;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: PMNodeJson[];
}

interface DeltaItem {
  insert: string;
  attributes: Record<string, unknown>;
}

function marksToAttributes(marks: PMNodeJson['marks']): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const mark of marks ?? []) {
    if (mark.type !== 'ychange') {
      // 与 y-prosemirror marksToAttributes 一致：同名 mark 互斥时直接用类型名作键
      attributes[mark.type] = mark.attrs ?? {};
    }
  }
  return attributes;
}

function buildChildren(node: PMNodeJson): Y.AbstractType<any>[] {
  const nodes: Y.AbstractType<any>[] = [];
  let textDelta: DeltaItem[] = [];
  const flushText = () => {
    if (textDelta.length) {
      const ytext = new Y.XmlText();
      ytext.applyDelta(textDelta);
      nodes.push(ytext);
      textDelta = [];
    }
  };
  for (const child of node.content ?? []) {
    if (typeof child.text === 'string') {
      textDelta.push({ insert: child.text, attributes: marksToAttributes(child.marks) });
    } else {
      flushText();
      nodes.push(buildElement(child));
    }
  }
  flushText();
  return nodes;
}

function buildElement(node: PMNodeJson): Y.XmlElement {
  const element = new Y.XmlElement(node.type);
  for (const [key, val] of Object.entries(node.attrs ?? {})) {
    if (val !== null && val !== undefined && key !== 'ychange') {
      element.setAttribute(key, val as string);
    }
  }
  element.insert(0, buildChildren(node) as Y.XmlElement[]);
  return element;
}

/** 把 ProseMirror 文档 JSON 播种进 Yjs 的 'default' fragment（Tiptap Collaboration 约定） */
export function pmJsonToYFragment(
  docJson: Record<string, unknown>,
  fragment: Y.XmlFragment,
): void {
  const children = buildChildren(docJson as unknown as PMNodeJson);
  if (children.length) fragment.insert(0, children as Y.XmlElement[]);
}
