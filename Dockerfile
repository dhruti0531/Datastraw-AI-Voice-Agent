# Multi-stage Docker build for Aura Skincare Voice Support Agent
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and package files
COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN cd backend && npm install
RUN cd frontend && npm install

# Copy source files
COPY backend ./backend
COPY frontend ./frontend

# Build frontend and backend
RUN cd frontend && npm run build
RUN cd backend && npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 5000

CMD ["node", "backend/dist/server.js"]
