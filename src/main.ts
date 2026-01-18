import { Plugin, WorkspaceLeaf, TFile, MarkdownView, Menu } from 'obsidian';
import { MindMapView, VIEW_TYPE_MINDMAP } from './MindMapView';

export default class MindMapPlugin extends Plugin {
    async onload() {
        // 注册思维导图视图
        this.registerView(
            VIEW_TYPE_MINDMAP,
            (leaf) => new MindMapView(leaf, this)
        );

        // 添加命令：打开当前文件的思维导图视图
        this.addCommand({
            id: 'open-mindmap',
            name: '打开思维导图视图 (Open as Mind Map)',
            checkCallback: (checking: boolean) => {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    if (!checking) {
                        this.openMindMapView(activeView.file);
                    }
                    return true;
                }
                return false;
            }
        });

        // 添加侧边栏图标 - 使用 'network' 或 'share-2' 图标
        this.addRibbonIcon('network', 'MindMapX: 打开思维导图', () => {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView && activeView.file) {
                this.openMindMapView(activeView.file);
            }
        });

        // 添加编辑器右键菜单
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor, view) => {
                if (view instanceof MarkdownView && view.file) {
                    menu.addItem((item) => {
                        item
                            .setTitle('📊 打开思维导图')
                            .setIcon('network')
                            .onClick(() => {
                                this.openMindMapView(view.file);
                            });
                    });
                }
            })
        );

        // 添加文件右键菜单
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu: Menu, file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    menu.addItem((item) => {
                        item
                            .setTitle('📊 打开思维导图')
                            .setIcon('network')
                            .onClick(() => {
                                this.openMindMapView(file);
                            });
                    });
                }
            })
        );
    }

    async openMindMapView(file: TFile | null) {
        if (!file) return;

        const { workspace } = this.app;

        // 查找已存在的思维导图视图
        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_MINDMAP);

        if (leaves.length > 0) {
            // 使用已存在的视图
            leaf = leaves[0];
        } else {
            // 在主页面向右分栏创建新视图
            const activeLeaf = workspace.getLeaf(false);
            if (activeLeaf) {
                leaf = workspace.createLeafBySplit(activeLeaf, 'vertical');
            }
            if (leaf) {
                await leaf.setViewState({
                    type: VIEW_TYPE_MINDMAP,
                    active: true,
                });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
            const view = leaf.view as MindMapView;
            await view.setFile(file);
        }
    }

    onunload() {
        // 清理视图
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_MINDMAP);
    }
}
