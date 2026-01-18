import { ItemView, WorkspaceLeaf, TFile, debounce } from 'obsidian';
import { Transformer } from 'markmap-lib';
import { Markmap, deriveOptions } from 'markmap-view';
import type MindMapPlugin from './main';

export const VIEW_TYPE_MINDMAP = 'mindmap-view';

interface IMarkmapNode {
    content: string;
    children?: IMarkmapNode[];
    depth?: number;
    payload?: {
        lines?: [number, number];
    };
}

export class MindMapView extends ItemView {
    private plugin: MindMapPlugin;
    private currentFile: TFile | null = null;
    private transformer: Transformer;
    private markmap: Markmap | null = null;
    private svgEl: SVGSVGElement | null = null;
    private containerEl_inner: HTMLDivElement | null = null;
    private editingNode: HTMLInputElement | null = null;
    private currentRoot: IMarkmapNode | null = null;

    // 用于存储节点与行号的映射
    private nodeLineMap: Map<string, [number, number]> = new Map();

    constructor(leaf: WorkspaceLeaf, plugin: MindMapPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.transformer = new Transformer();
    }

    getViewType(): string {
        return VIEW_TYPE_MINDMAP;
    }

    getDisplayText(): string {
        return this.currentFile ? `思维导图: ${this.currentFile.basename}` : '思维导图';
    }

    getIcon(): string {
        return 'git-branch';
    }

    async onOpen() {
        // 创建容器
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('mindmap-container');

        // 创建工具栏
        const toolbar = container.createDiv({ cls: 'mindmap-toolbar' });

        // 缩放按钮
        const zoomInBtn = toolbar.createEl('button', { text: '+', cls: 'mindmap-btn' });
        zoomInBtn.addEventListener('click', () => this.zoomIn());

        const zoomOutBtn = toolbar.createEl('button', { text: '-', cls: 'mindmap-btn' });
        zoomOutBtn.addEventListener('click', () => this.zoomOut());

        const fitBtn = toolbar.createEl('button', { text: '适应', cls: 'mindmap-btn' });
        fitBtn.addEventListener('click', () => this.fit());

        // 刷新按钮
        const refreshBtn = toolbar.createEl('button', { text: '刷新', cls: 'mindmap-btn' });
        refreshBtn.addEventListener('click', () => this.refresh());

        // SVG 容器
        this.containerEl_inner = container.createDiv({ cls: 'mindmap-svg-container' });
        this.svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svgEl.setAttribute('id', 'mindmap-svg');
        this.containerEl_inner.appendChild(this.svgEl);

        // Command/Ctrl + 滚轮缩放
        const handleWheel = (e: WheelEvent) => {
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                // 基于滚轮偏移量计算连续缩放因子
                const sensitivity = 0.1;
                const zoomFactor = Math.exp(-e.deltaY * sensitivity);
                this.handleZoom(zoomFactor);
            }
        };
        this.containerEl_inner.addEventListener('wheel', handleWheel, { passive: false, capture: true });

        // 监听文件变化
        this.registerEvent(
            this.app.vault.on('modify', debounce((file: TFile) => {
                if (file === this.currentFile) {
                    this.syncFromFile();
                }
            }, 300, true))
        );

        // 监听编辑器变化（更实时的同步）
        this.registerEvent(
            this.app.workspace.on('editor-change', debounce((editor, info) => {
                if (info.file === this.currentFile) {
                    this.syncFromFile();
                }
            }, 300, true))
        );
    }

    async onClose() {
        this.markmap = null;
        this.svgEl = null;
    }

    async setFile(file: TFile) {
        this.currentFile = file;
        await this.syncFromFile();
    }

    async syncFromFile() {
        if (!this.currentFile || !this.svgEl) return;

        const content = await this.app.vault.read(this.currentFile);
        this.renderMarkmap(content);
    }

    renderMarkmap(content: string) {
        if (!this.svgEl) return;

        // 解析 Markdown
        const { root, features } = this.transformer.transform(content);
        this.currentRoot = root as IMarkmapNode;

        // 构建节点行号映射
        this.buildNodeLineMap(content);

        // 获取样式资产
        const { styles, scripts } = this.transformer.getUsedAssets(features);

        // 渲染选项
        const options = deriveOptions({
            colorFreezeLevel: 2,
            duration: 300,
            maxWidth: 300,
        });

        if (this.markmap) {
            // 更新现有实例
            this.markmap.setData(root, options);
        } else {
            // 创建新实例
            this.markmap = Markmap.create(this.svgEl, options, root);
        }

        // 添加节点点击事件
        this.setupNodeInteraction();
    }

    buildNodeLineMap(content: string) {
        this.nodeLineMap.clear();
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            // 标题
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                const text = headingMatch[2].trim();
                this.nodeLineMap.set(this.normalizeText(text), [index, index]);
            }

            // 列表项
            const listMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
            if (listMatch) {
                const text = listMatch[2].trim();
                this.nodeLineMap.set(this.normalizeText(text), [index, index]);
            }
        });
    }

    normalizeText(text: string): string {
        // 移除 Markdown 格式
        return text
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/`(.+?)`/g, '$1')
            .replace(/\[(.+?)\]\(.+?\)/g, '$1')
            .trim();
    }

    setupNodeInteraction() {
        if (!this.svgEl) return;

        // 获取所有节点
        const nodes = this.svgEl.querySelectorAll('g.markmap-node');

        nodes.forEach((node) => {
            const textEl = node.querySelector('text');
            if (!textEl) return;

            // 双击编辑
            textEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.startEditNode(textEl);
            });
        });
    }

    startEditNode(textEl: SVGTextElement) {
        if (this.editingNode || !this.containerEl_inner) return;

        const text = textEl.textContent || '';
        const rect = textEl.getBoundingClientRect();
        const containerRect = this.containerEl_inner.getBoundingClientRect();

        // 创建输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.value = text;
        input.className = 'mindmap-node-editor';
        input.style.position = 'absolute';
        input.style.left = `${rect.left - containerRect.left}px`;
        input.style.top = `${rect.top - containerRect.top}px`;
        input.style.width = `${Math.max(rect.width, 100)}px`;
        input.style.fontSize = window.getComputedStyle(textEl).fontSize;

        this.containerEl_inner.appendChild(input);
        this.editingNode = input;

        input.focus();
        input.select();

        // 确认编辑
        const confirmEdit = async () => {
            const newText = input.value.trim();
            if (newText && newText !== text) {
                await this.updateNodeText(text, newText);
            }
            this.endEditNode();
        };

        input.addEventListener('blur', confirmEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                confirmEdit();
            } else if (e.key === 'Escape') {
                this.endEditNode();
            }
        });
    }

    endEditNode() {
        if (this.editingNode) {
            this.editingNode.remove();
            this.editingNode = null;
        }
    }

    async updateNodeText(oldText: string, newText: string) {
        if (!this.currentFile) return;

        const content = await this.app.vault.read(this.currentFile);
        const lines = content.split('\n');
        const normalizedOld = this.normalizeText(oldText);
        const lineInfo = this.nodeLineMap.get(normalizedOld);

        if (lineInfo) {
            const [lineIndex] = lineInfo;
            const line = lines[lineIndex];

            // 替换标题
            if (line.match(/^#{1,6}\s+/)) {
                lines[lineIndex] = line.replace(oldText, newText);
            }
            // 替换列表项
            else if (line.match(/^\s*[-*+]\s+/)) {
                lines[lineIndex] = line.replace(oldText, newText);
            }

            const newContent = lines.join('\n');
            await this.app.vault.modify(this.currentFile, newContent);
        }
    }

    private currentScale = 1;

    handleZoom(factor: number) {
        if (!this.markmap || !this.svgEl) return;

        this.currentScale *= factor;
        // 限制缩放范围
        this.currentScale = Math.max(0.1, Math.min(5, this.currentScale));

        // 使用 markmap 的 rescale 方法
        this.markmap.rescale(factor);
    }

    zoomIn() {
        this.handleZoom(1.3);
    }

    zoomOut() {
        this.handleZoom(0.7);
    }

    fit() {
        if (this.markmap) {
            this.markmap.fit();
        }
    }

    async refresh() {
        await this.syncFromFile();
        this.fit();
    }
}
