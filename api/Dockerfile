FROM node:22.12.0-alpine3.20 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22.12.0-alpine3.20
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app.js server.js ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
