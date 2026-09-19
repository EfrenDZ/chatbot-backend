const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/index.ts';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes("authRouter")) {
  code = code.replace("import { configRouter } from './routes/config';", "import { configRouter } from './routes/config';\nimport authRouter from './routes/auth';");
  code = code.replace("app.use('/api/config', configRouter);", "app.use('/api/auth', authRouter);\napp.use('/api/config', configRouter);");
  fs.writeFileSync(path, code, 'utf8');
  console.log("authRouter mounted successfully");
}
