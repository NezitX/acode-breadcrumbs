// TODO: Add IntelliSense icons 
// TODO: Handle more scopes (variables, ...) ui
// TODO: Handle syntax errors ui

export class BreadcrumbsUI {
  constructor() {
    this.$el = document.createElement("div");
    this.$el.className = "breadcrumbs";

    this.$container = document.createElement("div");
    this.$container.className = "breadcrumb-container";

    this.$el.appendChild(this.$container);
  }

  get isHidden() {
    return !document.querySelector(".breadcrumbs");
  }

  show() {
    if (!this.isHidden) return;
    const root = document.querySelector("#root");
    root && root.insertBefore(this.$el, root.querySelector("main"));
  }

  hide() {
    if (this.isHidden) return;
    this.$el.remove();
  }

  renderBreadcrumbs(scopeChain) {
    if (!scopeChain || scopeChain.length === 0) {
      this.$container.innerHTML = this.getScopeElement("global");
      if (this.isHidden) this.show();
      return;
    }

    const getMeasuredWidth = (measureDiv, html) => {
      measureDiv.innerHTML = html;
      return measureDiv.offsetWidth;
    };

    const measureDiv = document.createElement("div");
    measureDiv.style.visibility = "hidden";
    measureDiv.style.position = "absolute";
    document.body.appendChild(measureDiv);

    const containerWidth = this.$el.offsetWidth;
    const ellipsisWidth = getMeasuredWidth(measureDiv, "•••") + 2; // Add some padding
    const separatorWidth = getMeasuredWidth(
      measureDiv,
      this.getScopeElement("seprater")
    );

    const scopeWidths = scopeChain.map(scope => {
      const element = this.getScopeElement(scope.type, scope);
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
      breadcrumbs.push(this.getScopeElement("ellipsis"));
    }

    visibleScopes.forEach((scope, index) => {
      if (index > 0 || needsEllipsis) {
        breadcrumbs.push(this.getScopeElement("seprater"));
      }

      breadcrumbs.push(this.getScopeElement(scope.type, scope));
    });

    this.$container.innerHTML =
      breadcrumbs.length > 0
        ? breadcrumbs.join("")
        : this.getScopeElement("global");

    if (this.isHidden) this.show();
  }

  getScopeElement(type, options) {
    const span = document.createElement("span");

    switch (type) {
      case "global":
        span.className = "breadcrumb-global";
        span.textContent = "GlobalScope";
        break;

      case "seprater":
        span.classList.add(
          "breadcrumb-seprater",
          "icon",
          "keyboard_arrow_right"
        );
        break;

      case "ellipsis":
        span.className = "breadcrumb-ellipsis";
        span.textContent = "•••";
        break;

      case "class":
        span.className = "breadcrumb-class";
        span.dataset["row"] = options?.startRow;
        span.innerHTML = options?.name;
        break;

      case "function":
        span.className = "breadcrumb-function";
        span.dataset["row"] = options?.startRow;
        span.innerHTML = options?.name;
        break;
    }

    return span.outerHTML;
  }

  destroy() {
    this.$el.remove();
  }
}

