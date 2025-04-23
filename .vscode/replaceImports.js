const fs = require('fs');
const path = require('path');

function replaceImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  // Detect and replace import statements for .ts files
  content = content.replace(/(['"])(\*?.*?)\.ts\1\s*;/g, '$1$2.js$1;');
  fs.writeFileSync(filePath, content, 'utf-8');
}

function replaceImportsInDirectory(directory) {
  fs.readdirSync(directory).forEach(file => {
    const fullPath = path.join(directory, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      replaceImportsInDirectory(fullPath);
    } else if (fullPath.endsWith('.js')) {
      replaceImportsInFile(fullPath);
    }
  });
}

console.log('Replacing imports in .js files...');
replaceImportsInDirectory('./shared');
console.log('Imports replaced successfully!');
process.exit(0);