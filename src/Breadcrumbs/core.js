import LanguagesConfig from "../config.js";

// TODO: Handle more scopes (variables, ...)
// TODO: Handle syntax errors

export class BreadcrumbsCore {
  constructor() {
    this.editor = editorManager.editor;

    this.scopes = [];
    this.scopeMap = new Map();

    this.currentParser = null;
    this.currentLanguage = null;

    this.parsers = new Map();
    this.$scripts = new Map();

    this.disabled = false;
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
      // console.debug("Parse error:", e);
      return;
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

  destroy() {
    this.$scripts.forEach($script => $script.remove());
    this.scopes = [];
    this.scopeMap.clear();
    this.parsers.clear();
  }
}
