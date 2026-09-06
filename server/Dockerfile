FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci

COPY server server
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy --schema server/prisma/schema.prisma && npm run prisma:seed --workspace=server && npm run dev:server"]

