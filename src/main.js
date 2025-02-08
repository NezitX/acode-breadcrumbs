import plugin from '../plugin.json';
import style from './style.scss';
import TreeSitter from './TreeSitter.js';
import { Breadcrumbs } from './Breadcrumbs/index.js';

// TODO: add key bindings to {DATA_STORAGE/.key-bindings.json} file

class AcodeBreadcrumbs {
  constructor() {
    this.ts = new TreeSitter();
    this.$style = document.createElement('style');
    this.$style.innerHTML = style;

    this.currentEditor = null;

    this.onChange = this.onChange.bind(this);
    this.onSwitchFile = this.onSwitchFile.bind(this);
    this.onClickCrumb = this.onClickCrumb.bind(this);
  }

  async init() {
    await this.ts.init();
    this.breadcrumbs = new Breadcrumbs(this.ts);
    this.breadcrumbs.editor = this.currentEditor = editorManager.editor;

    this.setCommands();
    this.setEvents();
    document.head.append(this.$style);
  }

  getCommands() {
    const bindKey = (win, mac) => ({ win, mac });
    return [
      {
        name: 'breadcrumbs:show',
        description: 'Show Breadcrumbs if exist in file',
        bindKey: bindKey('Ctrl-Alt-B', 'Ctrl-Alt-B'),
        exec: async () => {
          this.breadcrumbs.updateBreadcrumbs();
        }
      },
      {
        name: 'breadcrumbs:hide',
        description: 'Hide Breadcrumbs if exist in file',
        bindKey: bindKey('Ctrl-Shift-B', 'Ctrl-Shift-B'),
        exec: async () => {
          this.breadcrumbs.ui.hide();
        }
      },
      {
        name: 'breadcrumbs:enable',
        description: 'Enable Breadcrumbs',
        bindKey: bindKey('Ctrl-Alt-P', 'Ctrl-Alt-P'),
        exec: async () => {
          this.breadcrumbs.disabled = false;
          this.breadcrumbs.updateBreadcrumbs();
        }
      },
      {
        name: 'breadcrumbs:disable',
        description: 'Disable Breadcrumbs',
        bindKey: bindKey('Ctrl-Shift-G', 'Ctrl-Shift-G'),
        exec: async () => {
          this.breadcrumbs.disabled = true;
          this.breadcrumbs.ui.hide();
        }
      }
    ];
  }

  setCommands() {
    const { commands } = this.currentEditor;
    commands.addCommands(this.getCommands());
  }

  removeCommands() {
    const { commands } = this.currentEditor;
    commands.removeCommands(this.getCommands().map(c => c.name));
  }

  setEvents() {
    // this.currentEditor.on('change', this.onChange);
    this.currentEditor.selection?.on('changeCursor', this.onChange);
    this.currentEditor.session?.on('changeMode', this.onChange);
    editorManager.on('switch-file', this.onSwitchFile);
    this.breadcrumbs.ui.$container.addEventListener('click', this.onClickCrumb);
  }

  removeEvents() {
    // this.currentEditor.off('change', this.onChange);
    this.currentEditor.selection?.off('changeCursor', this.onChange);
    this.currentEditor.session?.off('changeMode', this.onChange);
    editorManager.off('switch-file', this.onSwitchFile);
    this.breadcrumbs.ui.$container.removeEventListener(
      'click',
      this.onClickCrumb
    );
  }

  async onSwitchFile(e) {
    this.breadcrumbs.ui.hide();
    if (e.id === 'default-session') return;

    this.currentEditor = editorManager.editor;
    if (!this.currentEditor) return;

    this.removeEvents();
    this.setEvents();

    this.breadcrumbs.editor = this.currentEditor;
    await this.breadcrumbs.updateBreadcrumbs();
  }

  async onChange() {
    if (!this.currentEditor) return;
    await this.breadcrumbs.updateBreadcrumbs();
  }

  onClickCrumb(e) {
    let target = e.target;
    if (
      target.classList.contains('crumb-icon') ||
      target.classList.contains('crumb-text')
    ) {
      target = target.parentElement;
    }

    if (!target.classList.contains('crumb')) return;
    const row = parseInt(target.dataset.row);
    const column = parseInt(target.dataset.column) || 0;
    if (isNaN(row)) return;

    this.currentEditor.gotoLine(row + 1, column + 1);
    this.currentEditor.focus();
  }

  async destroy() {
    this.removeCommands();
    this.removeEvents();
    await this.breadcrumbs.destroy();
    this.$style.remove();

    this.currentEditor = null;
  }
}

if (window.acode) {
  const acodePlugin = new AcodeBreadcrumbs();
  acode.setPluginInit(
    plugin.id,
    async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
      acodePlugin.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
      await acodePlugin.init($page, cacheFile, cacheFileUrl);
    }
  );
  acode.setPluginUnmount(plugin.id, async () => {
    await acodePlugin.destroy();
  });
}
