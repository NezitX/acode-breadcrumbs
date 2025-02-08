export class BreadcrumbsUI {
  #cachedIcons = new Map();

  constructor() {
    this.$el = document.createElement('div');
    this.$el.className = 'breadcrumbs';

    this.$container = document.createElement('div');
    this.$container.className = 'container';

    this.$el.appendChild(this.$container);

    this.$separator = this.#createSeparator();
  }

  get isHidden() {
    return !this.$el.isConnected;
  }

  show() {
    if (!this.isHidden) return;
    requestAnimationFrame(() => {
      const root = document.querySelector('#root');
      if (root) root.insertBefore(this.$el, root.querySelector('main'));
    });
  }

  hide() {
    if (this.isHidden) return;
    this.$el.remove();
  }

  renderBreadcrumbs(scopeChain) {
    if (!scopeChain?.length) {
      const globalScope = this.#getScopeElement('global');
      this.$container.replaceChildren(globalScope);
      this.show();
      return;
    }

    const fragment = document.createDocumentFragment();
    scopeChain.forEach((scope, index) => {
      if (index > 0) fragment.appendChild(this.$separator.cloneNode(true));
      fragment.appendChild(this.#getScopeElement(scope.type, scope));
    });

    this.$container.replaceChildren(fragment);
    this.show();

    requestAnimationFrame(() => {
      this.$container.scrollTo({
        left: this.$container.scrollWidth,
        behavior: 'smooth'
      });
    });
  }

  #createSeparator() {
    const separator = document.createElement('span');
    separator.className = 'crumb-seprater icon keyboard_arrow_right';
    return separator;
  }

  #getScopeElement(type, options) {
    if (type === 'global') {
      const crumb = document.createElement('span');
      crumb.className = 'crumb-global';
      crumb.innerHTML = '<span class="crumb-text">GlobalScope</span>';
      return crumb;
    }

    const crumb = document.createElement('span');
    crumb.className = 'crumb';

    if (options) {
      crumb.dataset.type = type;
      crumb.dataset.row = options.row;
      crumb.dataset.column = options.column;

      const icon = this.#getIcon(type);
      if (icon) crumb.appendChild(icon);

      const textSpan = document.createElement('span');
      textSpan.className = 'crumb-text';
      textSpan.textContent = options.name || 'non';
      crumb.appendChild(textSpan);
    }

    return crumb;
  }

  #getIcon(type) {
    if (this.#cachedIcons.has(type)) {
      return this.#cachedIcons.get(type).cloneNode(true);
    }

    const icon = document.createElement('span');

    switch (type) {
      case 'function':
      case 'method':
      case 'arrow':
      case 'generator':
        icon.className = 'crumb-icon-method';
        break;
      case 'variable':
      case 'lexical':
        icon.className = 'crumb-icon-variable';
        break;
      case 'constant':
        icon.className = 'crumb-icon-constant';
        break;
      case 'class':
      case 'struct':
      case 'enum':
      case 'interface':
        icon.className = `crumb-icon-${type}`;
        break;
      default:
        return null;
    }

    this.#cachedIcons.set(type, icon);
    return icon.cloneNode(true);
  }

  destroy() {
    this.#cachedIcons.clear();
    this.$el.remove();
    this.$separator.remove();
  }
}
