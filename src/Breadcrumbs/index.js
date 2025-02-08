import { BreadcrumbsUI } from './ui.js';
import { BreadcrumbsCore } from './core.js';

export class Breadcrumbs {
  editor;
  disabled = false;

  constructor(ts) {
    this.ui = new BreadcrumbsUI();
    this.core = new BreadcrumbsCore(ts);
  }

  async updateBreadcrumbs() {
    if (this.disabled) return;
    const lang = this.editor.session.$modeId.split('/').pop();
    const code = this.editor.session.getValue();
    const position = this.editor.getCursorPosition();

    const breadcrumbs = await this.core.generateBreadcrumbs(
      lang,
      code,
      position
    );

    if (!breadcrumbs) return;
    this.ui.renderBreadcrumbs(breadcrumbs);
  }

  async destroy() {
    await this.core.destroy();
    await this.ui.destroy();
  }
}
