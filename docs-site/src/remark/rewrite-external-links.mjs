import { visit } from 'unist-util-visit';
import path from 'node:path';

/**
 * Remark plugin that rewrites links pointing OUT of the docs/ tree
 * (e.g. `../README.md`, `../CONTRIBUTING.md`, `../audit/SCOPE.md`,
 * `../api/...`, `../contracts/...`) into absolute GitHub blob URLs.
 *
 * The protocol's documentation lives next to source code (CONTRIBUTING,
 * SECURITY, audit reports, contracts, …). Those files are not part of
 * the Docusaurus content tree, so without rewriting Docusaurus would
 * flag them as broken markdown links. Pointing them at the canonical
 * GitHub URL keeps the cross-references useful and the doc-site build
 * clean.
 *
 * Options:
 *   - repoUrl: GitHub repo base URL (default: tonbankcard repo).
 *   - branch:  Branch to link to (default: 'main').
 *   - docsDir: Absolute path to the docs source directory.
 */
export default function remarkRewriteExternalLinks(options = {}) {
  const {
    repoUrl = 'https://github.com/xlabtg/tonbankcard-protocol',
    branch = 'main',
    docsDir,
  } = options;

  if (!docsDir) {
    throw new Error(
      'remark-rewrite-external-links: `docsDir` option is required',
    );
  }

  const absDocsDir = path.resolve(docsDir);

  function rewrite(node, file) {
    if (!node.url || typeof node.url !== 'string') {
      return;
    }
    const url = node.url;

    if (
      /^[a-z][a-z0-9+.-]*:/.test(url) ||
      url.startsWith('//') ||
      url.startsWith('#') ||
      url.startsWith('mailto:')
    ) {
      return;
    }

    const [pathPart, hash] = url.split('#');
    if (!pathPart) {
      return;
    }

    const repoRoot = path.dirname(absDocsDir);
    let absoluteTarget;
    if (pathPart.startsWith('/') && /\.[a-z0-9]+($|\/)/i.test(pathPart)) {
      // Absolute path that looks like a repo file (e.g. `/SECURITY.md`).
      absoluteTarget = path.resolve(repoRoot, '.' + pathPart);
    } else if (pathPart.startsWith('/')) {
      return;
    } else {
      const filePath = file.path ?? file.history?.[0];
      if (!filePath) {
        return;
      }
      absoluteTarget = path.resolve(path.dirname(filePath), pathPart);
    }

    const relativeFromDocs = path.relative(absDocsDir, absoluteTarget);
    if (relativeFromDocs.startsWith('..') || path.isAbsolute(relativeFromDocs)) {
      const relativeFromRepo = path.relative(repoRoot, absoluteTarget);
      const normalized = relativeFromRepo.split(path.sep).join('/');
      const githubUrl = `${repoUrl}/blob/${branch}/${normalized}${hash ? `#${hash}` : ''}`;
      node.url = githubUrl;
    }
  }

  return (tree, file) => {
    visit(tree, ['link', 'definition'], (node) => rewrite(node, file));
  };
}
