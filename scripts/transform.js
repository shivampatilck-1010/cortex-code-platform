module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  
  let isDirty = false;

  // Find all calls to classroomDb.something()
  root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      object: { name: 'classroomDb' }
    }
  }).forEach(path => {
    // Check if it's already awaited
    if (path.parentPath.value.type !== 'AwaitExpression') {
      // Replace with await expression
      j(path).replaceWith(j.awaitExpression(path.value));
      isDirty = true;
      
      // Make the containing function async
      let curr = path;
      while (curr && curr.node.type !== 'FunctionDeclaration' && curr.node.type !== 'ArrowFunctionExpression' && curr.node.type !== 'FunctionExpression' && curr.node.type !== 'ClassMethod') {
        curr = curr.parentPath;
      }
      if (curr && !curr.node.async) {
        curr.node.async = true;
      }
    }
  });

  return isDirty ? root.toSource() : null;
};
