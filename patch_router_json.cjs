const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/services/bot/flow.router.ts');
let code = fs.readFileSync(file, 'utf8');

// The line is: return val !== undefined && val !== null ? String(val) : match;
// Change it to: return val !== undefined && val !== null ? String(val) : 'null';
code = code.replace(/return val !== undefined && val !== null \? String\(val\) : match;/g, "return val !== undefined && val !== null ? String(val) : 'null';");

fs.writeFileSync(file, code);
console.log("Patched router to safely escape missing JSON template variables.");
