module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  
  let isDirty = false;

  // Find all calls to this.getDb()
  root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      object: { type: 'ThisExpression' },
      property: { name: 'getDb' }
    }
  }).forEach(path => {
    // If it's not already awaited, wrap it in await
    if (path.parentPath.value.type !== 'AwaitExpression') {
      j(path).replaceWith(j.awaitExpression(path.value));
      isDirty = true;
    }
  });

  return isDirty ? root.toSource() : null;
};
