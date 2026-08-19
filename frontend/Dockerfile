# Stage 1: Build static frontend assets
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY . .

# Build Vite application (output placed in dist/)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL:-http://localhost:4000}
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine AS production

# Copy compiled assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
