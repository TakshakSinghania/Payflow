# Development Dockerfile for PayFlow Backend
# Installs all dependencies (including devDeps for ts-node) to support both dev and prod

FROM node:20-alpine

WORKDIR /app

# Install dependencies (all, including devDeps for ts-node and nodemon)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

EXPOSE 4000

# Default: start the API server in dev mode (ts-node)
# Override with: docker-compose command: npm run worker
CMD ["npm", "run", "dev"]
