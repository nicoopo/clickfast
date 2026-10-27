FROM node:24.11.1-alpine3.22 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24.11.1-alpine3.22
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app.js server.js ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
