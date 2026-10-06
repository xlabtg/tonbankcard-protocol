'use strict';
// Check before recursive walkers, including callers supplying their own AST.
module.exports = ast => {
  const pending = [[ast, 0]];
  const seen = new Set();
  let count = 0;
  while (pending.length) {
    const [node, depth] = pending.pop();
    if (!node || typeof node !== 'object') throw new TypeError('Invalid brace AST');
    if (depth > 64 || ++count > 10000 || seen.has(node)) {
      throw new SyntaxError('Brace AST exceeds the depth/node limit or contains a cycle');
    }
    seen.add(node);
    if (node.nodes) for (const child of node.nodes) pending.push([child, depth + 1]);
  }
};
