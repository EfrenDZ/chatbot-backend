const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/index.ts';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes("import authRoutes")) {
  code = code.replace("import configRoutes from './routes/config';", "import configRoutes from './routes/config';\nimport authRoutes from './routes/auth';");
  code = code.replace("app.use('/api/config', configRoutes);", "app.use('/api/auth', authRoutes);\napp.use('/api/config', configRoutes);");
}

fs.writeFileSync(path, code, 'utf8');
console.log("index.ts patched to mount auth routes");
