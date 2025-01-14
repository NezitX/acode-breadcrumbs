import { BreadcrumbsUI } from "./ui.js";
import { BreadcrumbsCore } from "./core.js";

export class Breadcrumbs {
  constructor() {
    this.ui = new BreadcrumbsUI();
    this.core = new BreadcrumbsCore();

    this.disabled = false;
  }

  async updateLanguageParser() {
    if (this.disabled) return;
    const mode = this.core.editor.session.getMode();
    const language = mode.$id?.split("/").pop();

    if (!this.core.isLanguageSupported(language)) return this.ui.hide();
    this.ui.hide();

    try {
      if (language !== this.core.currentLanguage) {
        this.core.currentParser = await this.core.loadParser(language);
        this.core.currentLanguage = language;
      }

      this.core.updateScopeMap();
    } catch (error) {
      console.error(`Failed to load parser for ${language}:`, error);
    }
  }

  updateBreadcrumbs() {
    if (this.disabled) return;
    if (!this.core.isLanguageSupported(this.core.currentLanguage)) {
      return this.ui.hide();
    }

    const currentScope = this.core.findCurrentScope();
    const scopeChain = currentScope
      ? this.core.getScopeChain(currentScope)
      : null;
    this.ui.renderBreadcrumbs(scopeChain);
  }
  
  destroy() {
    this.ui.destroy();
    this.core.destroy();
  }
}
