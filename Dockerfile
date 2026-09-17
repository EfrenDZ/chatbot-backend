FROM node:22-alpine
WORKDIR /app

COPY package.json ./
COPY prisma ./prisma
RUN corepack enable pnpm && pnpm install && npx prisma generate

COPY . .
RUN pnpm build

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/index.js"]
