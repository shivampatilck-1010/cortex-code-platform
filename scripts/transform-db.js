module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  
  let isDirty = false;

  // Add async to all methods of ClassroomDatabase
  root.find(j.ClassMethod).forEach(path => {
    if (path.parentPath.parentPath.value.id && path.parentPath.parentPath.value.id.name === 'ClassroomDatabase') {
      if (!path.value.async) {
        path.value.async = true;
        isDirty = true;
      }
    }
  });

  // Find all .get(), .all(), .run(), .exec() calls on prepare() chains and add await
  const dbMethods = ['get', 'all', 'run', 'exec'];
  
  root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression'
    }
  }).forEach(path => {
    const methodName = path.value.callee.property.name;
    if (dbMethods.includes(methodName)) {
      // Check if it's a db call (e.g., this.getDb().prepare(...).get(...))
      // Or just blanket add await to all .get, .all, .run, .exec since this file only uses them for DB
      if (path.parentPath.value.type !== 'AwaitExpression') {
        j(path).replaceWith(j.awaitExpression(path.value));
        isDirty = true;
      }
    }
  });

  return isDirty ? root.toSource() : null;
};
