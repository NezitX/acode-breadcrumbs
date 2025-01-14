import plugin from "../plugin.json";
import style from "./style.scss";
import { Breadcrumbs } from "./Breadcrumbs/index.js";

// TODO: add key bindings to {DATA_STORAGE/.key-bindings.json}

class AcodeBreadcrumbs {
  constructor() {
    this.$style = document.createElement("style");
    this.$style.innerHTML = style;

    this.currentEditor = null;

    this.onEditorChange = this.onEditorChange.bind(this);
    this.onSelectionCursorChange = this.onSelectionCursorChange.bind(this);
    this.onSessionModeChange = this.onSessionModeChange.bind(this);
    this.onSwitchFile = this.onSwitchFile.bind(this);
    this.onClickBreadcrumb = this.onClickBreadcrumb.bind(this);
  }

  async init() {
    this.breadcrumbs = new Breadcrumbs();
    this.currentEditor = editorManager.editor;

    this.setCommands();
    this.setEvents();
    document.head.append(this.$style);
  }

  getCommands() {
    const bindKey = (win, mac) => ({ win, mac });
    return [
      {
        name: "breadcrumbs:show",
        description: "Show Breadcrumbs if exist in file",
        bindKey: bindKey("Ctrl-Alt-B", "Ctrl-Alt-B"),
        exec: async () => {
          this.breadcrumbs.ui.show();
        }
      },
      {
        name: "breadcrumbs:hide",
        description: "Hide Breadcrumbs if exist in file",
        bindKey: bindKey("Ctrl-Shift-B", "Ctrl-Shift-B"),
        exec: async () => {
          this.breadcrumbs.ui.hide();
        }
      },
      {
        name: "breadcrumbs:enable",
        description: "Enable Breadcrumbs",
        bindKey: bindKey("Ctrl-Alt-P", "Ctrl-Alt-P"),
        exec: async () => {
          this.breadcrumbs.disabled = false;
          this.breadcrumbs.updateLanguageParser();
          this.breadcrumbs.updateBreadcrumbs();
        }
      },
      {
        name: "breadcrumbs:disable",
        description: "Disable Breadcrumbs",
        bindKey: bindKey("Ctrl-Shift-G", "Ctrl-Shift-G"),
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
    // this.commands.forEach(cmd => commands.removeCommand(cmd.name));
  }

  setEvents() {
    this.currentEditor.on("change", this.onEditorChange);
    this.currentEditor.selection?.on(
      "changeCursor",
      this.onSelectionCursorChange
    );
    this.currentEditor.session?.on("changeMode", this.onSessionModeChange);
    editorManager.on("switch-file", this.onSwitchFile);
    this.breadcrumbs.ui.$container.addEventListener(
      "click",
      this.onClickBreadcrumb
    );
  }

  removeEvents() {
    this.currentEditor.off("change", this.onEditorChange);
    this.currentEditor.selection?.off(
      "changeCursor",
      this.onSelectionCursorChange
    );
    this.currentEditor.session?.off("changeMode", this.onSessionModeChange);
    editorManager.off("switch-file", this.onSwitchFile);
    this.breadcrumbs.ui.$container.removeEventListener(
      "click",
      this.onClickBreadcrumb
    );
  }

  async onSwitchFile() {
    this.currentEditor = editorManager.editor;
    if (!this.currentEditor) return;

    this.removeEvents();
    this.setEvents();

    this.breadcrumbs.core.editor = this.currentEditor;

    await this.breadcrumbs.updateLanguageParser();
    this.breadcrumbs.core.updateScopeMap();
    this.breadcrumbs.updateBreadcrumbs();
  }

  onEditorChange() {
    if (!this.currentEditor) return;
    this.breadcrumbs.core.updateScopeMap();
    this.breadcrumbs.updateBreadcrumbs();
  }

  onSessionModeChange() {
    if (!this.currentEditor) return;
    this.breadcrumbs.updateLanguageParser();
  }

  onSelectionCursorChange() {
    if (!this.currentEditor) return;
    this.breadcrumbs.updateBreadcrumbs();
  }

  onClickBreadcrumb(e) {
    const target = e.target;
    if (
      target.classList.contains("breadcrumb-class") ||
      target.classList.contains("breadcrumb-function")
    ) {
      const row = parseInt(target.dataset.row);
      if (isNaN(row)) return;
      this.currentEditor.gotoLine(row + 1, 0);
      this.currentEditor.focus();
    }
  }

  async destroy() {
    this.removeCommands();
    this.removeEvents();
    this.breadcrumbs.destroy();
    this.$style.remove();

    this.currentEditor = null;
  }
}

if (window.acode) {
  const acodePlugin = new AcodeBreadcrumbs();
  acode.setPluginInit(
    plugin.id,
    async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
      acodePlugin.baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
      await acodePlugin.init($page, cacheFile, cacheFileUrl);
    }
  );
  acode.setPluginUnmount(plugin.id, async () => {
    await acodePlugin.destroy();
  });
}
