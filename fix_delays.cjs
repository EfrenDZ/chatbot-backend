const fs = require('fs');
const path = require('path');

function replaceDelays(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  code = code.replace(/await delay\(\d+\)/g, 'await delay(500)');
  fs.writeFileSync(filePath, code);
  console.log("Fixed delays in", filePath);
}

replaceDelays(path.join(__dirname, 'src/services/bot/index.ts'));
replaceDelays(path.join(__dirname, 'src/services/bot/flow.router.ts'));
