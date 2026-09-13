module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  
  let isDirty = false;

  root.find(j.ClassMethod).forEach(path => {
    if (path.parentPath.parentPath.value.id && path.parentPath.parentPath.value.id.name === 'ClassroomDatabase') {
      if (path.value.key.name !== 'constructor' && !path.value.async) {
        path.value.async = true;
        isDirty = true;
      }
    }
  });

  return isDirty ? root.toSource() : null;
};
