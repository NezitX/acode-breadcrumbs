export default {
  javascript: {
    parser: "acorn",
    url: "https://cdnjs.cloudflare.com/ajax/libs/acorn/8.11.3/acorn.min.js",
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true
    },
    scopeRules: {
      scopes: [
        {
          type: "function",
          nodeTypes: ["FunctionDeclaration", "MethodDefinition"],
          getName: node => node.id?.name || node.key?.name || node.key?.value,
          getLocation: node => ({
            start: node.loc.start.line - 1,
            end: node.loc.end.line - 1
          }),
          getBody: node =>
            node.type === "MethodDefinition" ? node.value.body : node.body
        },
        {
          type: "class",
          nodeTypes: ["ClassDeclaration"],
          getName: node => node.id?.name,
          getLocation: node => ({
            start: node.loc.start.line - 1,
            end: node.loc.end.line - 1
          }),
          getBody: node => node.body
        },
        {
          type: "function",
          nodeTypes: ["VariableDeclarator"],
          condition: node =>
            node.init &&
            (node.init.type === "FunctionExpression" ||
              node.init.type === "ArrowFunctionExpression"),
          getName: node => node.id?.name,
          getLocation: node => ({
            start: node.loc.start.line - 1,
            end: node.loc.end.line - 1
          }),
          getBody: node =>
            node.init.body.type === "BlockStatement" ? node.init.body : null
        }
      ],
      parse: (parser, code, options) => parser.parse(code, options)
    }
  }
};
