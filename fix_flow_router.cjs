const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/services/bot/flow.router.ts');
let code = fs.readFileSync(file, 'utf8');

// Remove all debug.log appends
code = code.replace(/require\('fs'\)\.appendFileSync[^;]+;/g, '');

fs.writeFileSync(file, code);
console.log("Fixed flow.router.ts");
