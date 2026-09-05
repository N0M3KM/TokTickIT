FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci

COPY client client
EXPOSE 5173
CMD ["npm", "run", "dev:client", "--", "--host", "0.0.0.0"]

