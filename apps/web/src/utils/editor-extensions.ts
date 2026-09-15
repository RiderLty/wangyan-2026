import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';

/**
 * StarterKit 之外的 Markdown 内容扩展（论文 5.3.2 Markdown 语法支持）。
 *
 * Tiptap 是插件化架构：StarterKit 只含标题/加粗/列表/引用/代码块等核心节点，
 * 图片与表格需注册官方扩展后，Markdown 的 ![]() 与管道表格语法才有对应
 * schema 节点与输入规则（tiptap-markdown 自带这两种节点的序列化器）。
 *
 * 编辑器/只读视图/分享页/打印页四个渲染面必须注册同一组扩展，
 * 否则 JSONB 快照里的图片/表格节点会在缺扩展的渲染面被丢弃。
 */
export function markdownContentExtensions() {
  return [
    Image.configure({ inline: false, allowBase64: true }),
    // resizable 关闭：协作场景下列宽属 CRDT 属性同步，演示版保持简单
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}
