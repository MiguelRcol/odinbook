FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm run db:generate && npm prune --omit=dev
COPY src ./src
COPY public ./public
COPY seeds.js ./
COPY scripts ./scripts
ENV NODE_ENV=production
ENV PORT=3020
EXPOSE 3020
USER node
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm start"]
