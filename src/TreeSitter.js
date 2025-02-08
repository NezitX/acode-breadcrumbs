import Parser from 'web-tree-sitter';
const fs = acode.require('fs');

export default class TreeSitter {
  static TREE_SITTER_DIR = `${DATA_STORAGE}/tree-sitter`;
  static CDN_BASE_URL = 'https://cdn.jsdelivr.net/npm';

  #initialized = false;
  #languages = new Map();
  #versionChecked = new Set();
  #notExist = new Set();
  #currentLang = null;
  #parser = null;

  get languages() {
    return this.#languages;
  }

  async init() {
    if (this.#initialized) return;

    const treeSitterDir = fs(TreeSitter.TREE_SITTER_DIR);
    if (!(await treeSitterDir.exists())) {
      await fs(DATA_STORAGE).createDirectory('tree-sitter');
    }

    await Parser.init();
    this.#parser = new Parser();
    this.#initialized = true;
  }

  destroy() {
    this.#languages.clear();
    if (this.#parser) {
      this.#parser.delete();
      this.#parser = null;
    }
    this.#initialized = false;
    this.#versionChecked.clear();
    this.#notExist.clear();
  }

  async getLanguage(lang) {
    if (!this.#initialized) {
      throw new Error('TreeSitter not initialized. Call init() first.');
    }

    if (!this.#languages.has(lang)) {
      await this.#initLanguage(lang);
    }

    return this.#languages.get(lang);
  }

  async parse(code, lang) {
    if (!this.#initialized) {
      throw new Error('TreeSitter not initialized. Call init() first.');
    }

    const language = await this.getLanguage(lang);
    if (!language) return;

    if (this.#currentLang !== lang) {
      this.#parser.setLanguage(language.wasm);
      this.#currentLang = lang;
    }
    return this.#parser.parse(code);
  }

  async #initLanguage(lang) {
    if (this.#languages.has(lang)) return;

    const language = await this.#getLang(lang);
    if (!language) return;

    const languageWasm = await Parser.Language.load(language.wasmUrl);
    this.#languages.set(lang, {
      ...language,
      wasm: languageWasm
    });
  }

  async #getLang(lang) {
    const langUrl = `${TreeSitter.TREE_SITTER_DIR}/${lang}`;
    const langDir = fs(langUrl);

    if (!(await langDir.exists())) {
      const state = await this.#downloadLanguage(lang);
      if (!state) return;
    }

    const json = await fs(`${langUrl}/tree-sitter.json`).readFile('json');
    if (!this.#versionChecked.has(lang)) {
      const isOld = await this.#checkVersion(lang, json.metadata.version);
      if (isOld) {
        await fs(`${TreeSitter.TREE_SITTER_DIR}/${lang}`).delete();
        await this.#downloadLanguage(lang);
      }
    }

    const wasmPath = `${langUrl}/${lang}.wasm`;
    return {
      json,
      tags: await fs(`${langUrl}/tags.scm`).readFile('utf8'),
      wasmUrl: await acode.toInternalUrl(wasmPath)
    };
  }

  async #checkVersion(lang, currentVersion) {
    this.#versionChecked.add(lang);

    const response = await fetch(this.#buildUrl(lang, 'json'));
    if (!response.ok) return false;

    const { metadata } = await response.json();

    const currentParts = currentVersion.split('.').map(Number);
    const newParts = metadata.version.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (newParts[i] > currentParts[i]) return true;
      if (newParts[i] < currentParts[i]) return false;
    }
    return false;
  }

  #buildUrl(lang, type) {
    const base = TreeSitter.CDN_BASE_URL;
    switch (type) {
      case 'json':
        return `${base}/tree-sitter-${lang}@latest/tree-sitter.json`;
      case 'wasm':
        return `${base}/tree-sitter-${lang}@latest/tree-sitter-${lang}.wasm`;
      case 'tags':
        return `${base}/tree-sitter-${lang}@latest/queries/tags.scm`;
      default:
        throw new Error(`Invalid URL type: ${type}`);
    }
  }

  async #checkPackageExists(lang) {
    const response = await fetch(
      `${TreeSitter.CDN_BASE_URL}/tree-sitter-${lang}/package.json`
    );
    return response.ok;
  }

  async #downloadLanguage(lang) {
    if (this.#notExist.has(lang)) return false;
    if (!(await this.#checkPackageExists(lang))) {
      this.#notExist.add(lang);
      return false;
    }

    await fs(TreeSitter.TREE_SITTER_DIR).createDirectory(lang);
    await Promise.all([
      this.#downloadFile(lang, 'json', 'tree-sitter.json'),
      this.#downloadFile(lang, 'wasm', `${lang}.wasm`, 'arrayBuffer'),
      this.#downloadFile(lang, 'tags', 'tags.scm', 'text')
    ]);

    return true;
  }

  async #downloadFile(lang, type, fileName, responseType = 'json') {
    const url = this.#buildUrl(lang, type);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    const content = await response[responseType]();
    await fs(`${TreeSitter.TREE_SITTER_DIR}/${lang}`).createFile(
      fileName,
      content
    );
  }
}
