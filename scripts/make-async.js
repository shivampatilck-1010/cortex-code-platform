const { Project, SyntaxKind } = require('ts-morph');
const project = new Project();
project.addSourceFilesAtPaths("src/**/*.ts");
project.addSourceFilesAtPaths("src/**/*.tsx");

console.log("Analyzing project...");

const dbFile = project.getSourceFile("src/lib/classroom/db/index.ts");
const classDecl = dbFile.getClass("ClassroomDatabase");

// Get all methods of ClassroomDatabase
const methods = classDecl.getInstanceMethods().map(m => m.getName());

console.log(`Found ${methods.length} methods in ClassroomDatabase.`);

let changes = 0;

for (const sourceFile of project.getSourceFiles()) {
  let fileChanged = false;

  // Find all property access expressions that access classroomDb
  const propAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  
  for (const access of propAccesses) {
    if (access.getExpression().getText() === "classroomDb") {
      const methodName = access.getName();
      if (methods.includes(methodName)) {
        // It's a method call! Let's get the CallExpression
        const callExpr = access.getParentIfKind(SyntaxKind.CallExpression);
        if (callExpr) {
          // Check if it's already awaited
          const parentAwait = callExpr.getParentIfKind(SyntaxKind.AwaitExpression);
          if (!parentAwait) {
            // It is not awaited. We need to await it.
            callExpr.replaceWithText(`await ${callExpr.getText()}`);
            fileChanged = true;
            changes++;
            
            // Now we must ensure the containing function/method is async
            const containingFunction = callExpr.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
                                       callExpr.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ||
                                       callExpr.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ||
                                       callExpr.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
                                       
            if (containingFunction && !containingFunction.isAsync()) {
              containingFunction.setIsAsync(true);
            }
          }
        }
      }
    }
  }
  
  if (fileChanged) {
    sourceFile.saveSync();
  }
}

console.log(`Made ${changes} await replacements!`);
