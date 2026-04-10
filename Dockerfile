FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist/ ./dist/

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "dist/server.js"]
