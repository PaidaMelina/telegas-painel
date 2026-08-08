FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# As migrações são lidas em tempo de execução, na subida da API.
COPY --from=builder /app/db ./db

ENV NODE_ENV=production

EXPOSE 3333

CMD ["node", "dist/server.js"]
