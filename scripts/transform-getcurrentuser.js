module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  
  let isDirty = false;

  root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      object: { name: 'ClassroomAuth' },
      property: { name: 'getCurrentUser' }
    }
  }).forEach(path => {
    if (path.parentPath.value.type !== 'AwaitExpression') {
      j(path).replaceWith(j.awaitExpression(path.value));
      isDirty = true;
    }
  });

  return isDirty ? root.toSource() : null;
};
