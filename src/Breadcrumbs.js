import LanguagesConfig from "./config.js";

export default class Breadcrumbs {
  static UI = {
    global: () => `<span class="breadcrumb-global">Global Scope</span>`,
    seprater: () =>
      `<span class="breadcrumb-seprater icon keyboard_arrow_right"></span>`,
    ellipsis: () => `<span class="breadcrumb-ellipsis">•••</span>`,
    class: ({ name, startRow }) =>
      `<span class="breadcrumb-class" data-row="${startRow}">${name}</span>`,
    function: ({ name, startRow }) =>
      `<span class="breadcrumb-function" data-row="${startRow}">${name}</span>`
  };

  constructor() {
    this.editor = editorManager.editor;
    this.scopes = [];
    this.scopeMap = new Map();
    this.currentParser = null;
    this.currentLanguage = null;
    this.parsers = new Map();
    this.$scripts = new Map();
    this.disabled = false;

    this.$el = document.createElement("div");
    this.$el.className = "breadcrumbs";
  }

  get isHidden() {
    return document.querySelector(".breadcrumbs") === null;
  }

  show() {
    if (!this.isHidden || this.disabled) return;
    const root = document.querySelector("#root");
    root.insertBefore(this.$el, root.querySelector("main"));
  }

  hide() {
    if (this.isHidden) return;
    this.$el.remove();
  }

  async loadParser(language) {
    const config = LanguagesConfig[language];
    if (!config) return null;

    if (this.parsers.has(language)) {
      return this.parsers.get(language);
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = config.url;
      script.onload = () => {
        const parser = window[config.parser];
        this.parsers.set(language, parser);
        this.$scripts.set(language, script);
        resolve(parser);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  isLanguageSupported(language) {
    if (!language || !LanguagesConfig[language]) {
      this.scopes = [];
      this.scopeMap.clear();
      this.currentParser = null;
      this.currentLanguage = null;
      return null;
    }
    return true;
  }

  async updateLanguageParser() {
    if (this.disabled) return;
    const mode = this.editor.session.getMode();
    const language = mode.$id?.split("/").pop();

    if (!this.isLanguageSupported(language)) return this.hide();
    this.hide();

    try {
      if (language !== this.currentLanguage) {
        this.currentParser = await this.loadParser(language);
        this.currentLanguage = language;
      }

      this.updateScopeMap();
    } catch (error) {
      console.error(`Failed to load parser for ${language}:`, error);
    }
  }

  updateScopeMap() {
    if (!this.currentParser || !this.currentLanguage || this.disabled) return;

    const config = LanguagesConfig[this.currentLanguage];
    if (!config) return;

    const code = this.editor.getValue();
    this.scopes = [];
    this.scopeMap = new Map();

    try {
      const ast = config.scopeRules.parse(
        this.currentParser,
        code,
        config.parserOptions
      );
      this.traverseAST(ast, null, config.scopeRules);
    } catch (e) {
      console.debug("Parse error:", e);
    }
  }

  traverseAST(node, parent, rules) {
    if (!node) return;

    // Check if the node matches any scope rules
    for (const scope of rules.scopes) {
      if (
        scope.nodeTypes.includes(node.type) &&
        (!scope.condition || scope.condition(node))
      ) {
        const name = scope.getName(node);
        if (name) {
          const location = scope.getLocation(node);
          const newScope = {
            type: scope.type,
            name: name,
            startRow: location.start,
            endRow: location.end,
            parent
          };

          this.addScope(newScope);

          // Process the body with the new scope as parent
          const body = scope.getBody(node);
          if (body) {
            this.traverseAST(body, newScope, rules);
          }
          return; // Stop processing this branch after handling the scope
        }
      }
    }

    // Continue traversing for non-scope nodes
    if (Array.isArray(node)) {
      node.forEach(child => this.traverseAST(child, parent, rules));
    } else if (typeof node === "object") {
      Object.entries(node).forEach(([key, value]) => {
        if (key !== "loc" && key !== "range" && key !== "parent") {
          this.traverseAST(value, parent, rules);
        }
      });
    }
  }

  addScope(scope) {
    this.scopes.push(scope);

    for (let row = scope.startRow; row <= scope.endRow; row++) {
      if (!this.scopeMap.has(row)) {
        this.scopeMap.set(row, new Set());
      }
      this.scopeMap.get(row).add(scope);
    }
  }

  findCurrentScope() {
    const pos = this.editor.getCursorPosition();
    const rowScopes = Array.from(this.scopeMap.get(pos.row) || new Set());

    // Find the most specific (innermost) scope that contains the cursor
    return rowScopes.reduce((innermost, scope) => {
      if (!innermost) return scope;

      // If current scope is nested inside innermost, use current scope
      let parent = scope.parent;
      while (parent) {
        if (parent === innermost) return scope;
        parent = parent.parent;
      }

      // If innermost is nested inside current scope, keep innermost
      parent = innermost.parent;
      while (parent) {
        if (parent === scope) return innermost;
        parent = parent.parent;
      }

      // If no nesting relationship, use the one that starts later
      return scope.startRow > innermost.startRow ? scope : innermost;
    }, null);
  }

  getScopeChain(scope) {
    const chain = [];
    let current = scope;

    while (current) {
      // Only add the scope if it's not already in the chain
      if (
        !chain.some(s => s.name === current.name && s.type === current.type)
      ) {
        chain.unshift(current);
      }
      current = current.parent;
    }

    return chain;
  }

  updateBreadcrumbs() {
    const { UI } = Breadcrumbs;
    if (this.disabled) return;
    if (!this.isLanguageSupported(this.currentLanguage)) return this.hide();

    const currentScope = this.findCurrentScope();
    if (!currentScope) {
      this.$el.innerHTML = `<div class="breadcrumbs-content">${UI.global()}</div>`;
      if (this.isHidden) this.show();
      return;
    }

    const scopeChain = this.getScopeChain(currentScope);
    const getMeasuredWidth = (measureDiv, html) => {
      measureDiv.innerHTML = html;
      return measureDiv.offsetWidth;
    };

    const measureDiv = document.createElement("div");
    measureDiv.style.visibility = "hidden";
    measureDiv.style.position = "absolute";
    document.body.appendChild(measureDiv);

    const containerWidth = this.$el.offsetWidth;
    const ellipsisWidth = getMeasuredWidth(measureDiv, "...") + 10; // Add some padding
    const separatorWidth = getMeasuredWidth(measureDiv, UI.seprater());

    const scopeWidths = scopeChain.map(scope => {
      const element = UI[scope.type](scope);
      return getMeasuredWidth(measureDiv, element);
    });

    let totalWidth = 0;
    let visibleScopesCount = 0;
    let needsEllipsis = false;

    for (let i = scopeChain.length - 1; i >= 0; i--) {
      const currentWidth =
        scopeWidths[i] + (visibleScopesCount > 0 ? separatorWidth : 0);

      if (
        totalWidth + currentWidth + (i > 0 ? ellipsisWidth : 0) <=
        containerWidth
      ) {
        totalWidth += currentWidth;
        visibleScopesCount++;
      } else {
        needsEllipsis = i > 0 && scopeChain.length > 2;
        break;
      }
    }

    measureDiv.remove();

    const visibleScopes = scopeChain.slice(-visibleScopesCount);
    const breadcrumbs = [];

    if (needsEllipsis) {
      breadcrumbs.push(UI.ellipsis());
    }

    visibleScopes.forEach((scope, index) => {
      if (index > 0 || needsEllipsis) {
        breadcrumbs.push(UI.seprater());
      }
      breadcrumbs.push(UI[scope.type](scope));
    });

    this.$el.innerHTML = `<div class="breadcrumbs-content">
      ${breadcrumbs.length > 0 ? breadcrumbs.join("") : UI.global()}
    </div>`;

    if (this.isHidden) this.show();
  }

  destroy() {
    this.$el.remove();

    this.$scripts.forEach($script => $script.remove());
    this.scopes = [];
    this.scopeMap.clear();
    this.parsers.clear();
  }
}
