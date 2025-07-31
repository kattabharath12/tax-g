# Use Node.js 18 Alpine (lightweight and reliable)
FROM node:18-alpine

# Install only essential dependencies
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --omit=dev --no-audit --no-fund

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application (without caching mounts to avoid Railway issues)
RUN npm run build

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Health check (remove curl dependency)
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start command with database migration
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
