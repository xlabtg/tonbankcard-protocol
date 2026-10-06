const test = require('node:test');
const assert = require('node:assert/strict');
const braces = require('../vendor/braces');
test('normal patterns retain glob semantics', () => {
  assert.equal(braces.compile('src/{a,b}/*.js'), 'src/(a|b)/*.js');
  assert.deepEqual(braces.expand('v{1..3}'), ['v1', 'v2', 'v3']);
});
for (const method of ['parse','compile','expand','stringify']) {
  test(`${method}: finite deeply nested input is rejected before walking`, () => {
    assert.throws(() => braces[method]('{'.repeat(1500)+'a,b'+'}'.repeat(1500)), /depth limit/);
    assert.throws(() => braces[method]('('.repeat(1500)+'a'+')'.repeat(1500)), /depth limit/);
  });
}
for (const method of ['compile','expand','stringify']) test(`${method}: external AST is bounded`, () => {
  let ast = {type:'text',value:'a'};
  for (let i=0;i<1500;i++) ast={type:'root',nodes:[ast]};
  assert.throws(() => braces[method](ast), /depth\/node limit/);
  const cycle={type:'root',nodes:[]}; cycle.nodes.push(cycle);
  assert.throws(() => braces[method](cycle), /cycle/);
});
