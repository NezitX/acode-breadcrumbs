export class BreadcrumbsCore {
  constructor(ts) {
    this.ts = ts;
  }

  async generateBreadcrumbs(language, sourceCode, cursorPosition) {
    const { tags: tagsQuery } = await this.ts.getLanguage(language);
    const tree = await this.ts.parse(sourceCode, language);
    if (!tree) return [];

    const currentNode =
      tree.rootNode.namedDescendantForPosition(cursorPosition);
    if (!currentNode) return [];

    const query = tree.language.query(tagsQuery);
    const captures = query.captures(tree.rootNode);

    const captureMap = new Map();
    captures.forEach(capture => {
      if (capture.name.startsWith('definition')) {
        captureMap.set(capture.node.id, capture);
      }
    });

    const breadcrumbs = [];
    let node = currentNode;
    while (node) {
      const capture = captureMap.get(node.id);
      if (capture) {
        const symbolType = this.getSymbolTypeFromTag(capture.name);
        const name = this.getNodeName(node);
        if (symbolType && name) {
          breadcrumbs.unshift({
            type: symbolType,
            name,
            row: node.startPosition.row,
            column: node.startPosition.column
          });
        }
      }
      node = node.parent;
    }
    return breadcrumbs;
  }

  getNodeName(node) {
    if (node._cachedName) return node._cachedName;
    const nameNode =
      node.childForFieldName('name') ||
      node.descendantsOfType('identifier')[0] ||
      node.descendantsOfType('property_identifier')[0];

    return (node._cachedName = nameNode?.text ?? null);
  }

  getSymbolTypeFromTag(tagName) {
    return tagName.split('.').pop();
  }

  async destroy() {
    await this.ts.destroy();
  }
}
