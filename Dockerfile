FROM node:22-alpine
WORKDIR /app

COPY package.json ./
COPY prisma ./prisma
RUN npm install && npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/index.js"]
