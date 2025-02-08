import Parser from 'web-tree-sitter';
const fs = acode.require('fs');

class TreeSitter {
  static TREE_SITTER_DIR = `${DATA_STORAGE}/tree-sitter`;
  #languages = new Map();

  get languages() {
    return this.#languages;
  }

  async init() {
    const treeSitterDir = fs(TreeSitter.TREE_SITTER_DIR);
    if (!(await treeSitterDir.exists())) {
      await fs(DATA_STORAGE).createDirectory('tree-sitter');
    }

    await Parser.init();
    this.parser = new Parser();
  }

  async initLanguage(lang) {
    try {
      if (this.#languages.has(lang)) {
        return this.#languages.get(lang);
      }

      const url = await this.getWasmUrl(lang);

      const languageWasm = await Parser.Language.load(url);
      this.#languages.set(lang, languageWasm);

      return languageWasm;
    } catch (e) {
      return;
    }
  }

  async getWasmUrl(lang) {
    try {
      const url = `${TreeSitter.TREE_SITTER_DIR}/${lang}.wasm`;
      const wasmFile = fs(url);

      if (!(await wasmFile.exists())) {
        await this.downloadWasm(lang);
      }

      return await acode.toInternalUrl(url);
    } catch (e) {
      return;
    }
  }

  async downloadWasm(lang) {
    try {
      const wasmUrl = `https://cdn.jsdelivr.net/npm/tree-sitter-${lang}@latest/tree-sitter-${lang}.wasm`;
      const response = await fetch(wasmUrl);
      if (!response.ok) return;

      const wasmBuffer = await response.arrayBuffer();
      await fs(TreeSitter.TREE_SITTER_DIR).createFile(
        `${lang}.wasm`,
        wasmBuffer
      );

      return wasmBuffer;
    } catch (e) {
      return;
    }
  }

  async parse(code, language) {
    try {
      if (!this.#languages.has(language)) {
        await this.initLanguage(language);
      }

      this.parser.setLanguage(this.#languages.get(language));
      return this.parser.parse(code);
    } catch (e) {
      return;
    }
  }

  async destroy() {
    this.#languages.clear();
    this.parser.delete();
  }
}

export default new TreeSitter();
