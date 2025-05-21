// This script runs after the build is complete
const fs = require('fs');
const path = require('path');

// Fix for SPA routing in production
const filePath = path.join(__dirname, 'build', 'index.html');
let content = fs.readFileSync(filePath, 'utf8');

// Add base tag for SPA routing
if (!content.includes('<base href="/">')) {
  content = content.replace(
    '<head>',
    '<head>\n    <base href="/">'
  );
  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('Post-build script completed');
