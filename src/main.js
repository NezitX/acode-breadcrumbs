import plugin from "../plugin.json";
import Breadcrumbs from "./Breadcrumbs.js";
import style from "./style.scss";

// TODO:
// 1. Add command/key binding hide/show breadcrumbs
// 2. Add icon to class/function
// 3. Better performance? (optional)

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

    this.setEvents();
    document.head.append(this.$style);
  }

  setEvents() {
    this.currentEditor.on("change", this.onEditorChange);
    this.currentEditor.selection?.on(
      "changeCursor",
      this.onSelectionCursorChange
    );
    this.currentEditor.session?.on("changeMode", this.onSessionModeChange);
    editorManager.on("switch-file", this.onSwitchFile);
    this.breadcrumbs.$el.addEventListener("click", this.onClickBreadcrumb);
  }

  removeEvents() {
    this.currentEditor.off("change", this.onEditorChange);
    this.currentEditor.selection?.off(
      "changeCursor",
      this.onSelectionCursorChange
    );
    this.currentEditor.session?.off("changeMode", this.onSessionModeChange);
    editorManager.off("switch-file", this.onSwitchFile);
    this.breadcrumbs.$el.removeEventListener("click", this.onClickBreadcrumb);
  }

  async onSwitchFile() {
    this.currentEditor = editorManager.editor;
    if (!this.currentEditor) return;

    this.removeEvents();
    this.setEvents();

    this.breadcrumbs.editor = this.currentEditor;

    await this.breadcrumbs.updateLanguageParser();
    this.breadcrumbs.updateScopeMap();
    this.breadcrumbs.updateBreadcrumbs();
  }

  onEditorChange() {
    if (!this.currentEditor) return;
    this.breadcrumbs.updateScopeMap();
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
