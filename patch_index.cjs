const fs = require('fs');

const indexPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/index.ts';
let indexCode = fs.readFileSync(indexPath, 'utf8');

indexCode = indexCode.replace("import authRouter from './routes/auth';", "import authRouter from './routes/auth';\nimport integrationRouter from './routes/integration';");
indexCode = indexCode.replace("app.use('/api/config', configRouter);", "app.use('/api/config', configRouter);\napp.use('/api/integration', integrationRouter);");

fs.writeFileSync(indexPath, indexCode, 'utf8');
console.log("Index patched");
