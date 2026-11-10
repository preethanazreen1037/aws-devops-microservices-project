# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/

RUN npm install --workspace=packages/shared

# Copy shared package
COPY packages/shared ./packages/shared

# Copy service files
COPY services/api-gateway/package*.json ./services/api-gateway/
COPY services/api-gateway/tsconfig.json ./services/api-gateway/
COPY services/api-gateway/src ./services/api-gateway/src

WORKDIR /app/services/api-gateway

RUN npm install
RUN cd /app && npm run build --workspace=packages/shared
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/

RUN npm install --production --workspace=packages/shared

COPY packages/shared ./packages/shared
COPY --from=builder /app/packages/shared/dist /app/packages/shared/dist

COPY services/api-gateway/package*.json ./services/api-gateway/
COPY services/api-gateway/tsconfig.json ./services/api-gateway/

WORKDIR /app/services/api-gateway

RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/services/api-gateway/dist ./dist

EXPOSE 3000

RUN mkdir -p /app/services/api-gateway/logs && chown -R node:node /app/services/api-gateway/logs

USER node

CMD ["node", "dist/index.js"]
