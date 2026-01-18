# MindMapX - Obsidian 思维导图插件

将 Markdown 文件实时渲染为交互式思维导图，支持双向同步编辑。

## ✨ 功能特性

- **一键预览** - 打开任意 Markdown 文件，即可生成思维导图视图
- **双向同步** - Markdown 修改自动更新思维导图；节点编辑自动回写文件
- **交互操作** - 支持缩放、拖拽、展开/折叠节点
- **主题适配** - 完美支持 Obsidian 深色/浅色主题

## 📦 安装

### 手动安装

1. 下载最新版本的 `main.js`、`styles.css`、`manifest.json`
2. 复制到 Vault 的插件目录：`你的Vault/.obsidian/plugins/obsidian-mindmapx/`
3. 在 Obsidian 设置 → 第三方插件 → 启用 "MindMapX"

### 开发模式

```bash
cd obsidian-mindmapx
npm install
npm run dev   # 开发模式（监听文件变化）
npm run build # 生产构建
```

## 🚀 使用方法

1. 打开任意 Markdown 文件
2. 点击侧边栏的 🌲 图标，或使用命令面板执行 "打开思维导图视图"
3. 思维导图会在右侧面板显示

### 支持的 Markdown 结构

```markdown
# 中心主题

## 一级分支
- 子节点 1
- 子节点 2
  - 嵌套节点

## 另一个分支
- 更多内容
```

### 编辑节点

- **双击节点** - 进入编辑模式
- **Enter** - 确认修改（自动同步到 Markdown 文件）
- **Esc** - 取消编辑

### 工具栏

| 按钮 | 功能 |
|------|------|
| + | 放大 |
| - | 缩小 |
| 适应 | 自适应画布 |
| 刷新 | 重新渲染 |

## 📄 License

MIT
