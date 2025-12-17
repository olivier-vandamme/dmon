# -------------------------------------------------------------------
# Dockerfile - Security setup
# -------------------------------------------------------------------
# - Multi-stage build: OpenSSL installed only in the builder,
#   removed in the final image to reduce attack surface.
# - Creation of a non-root user (appuser): avoids running
#   as root and limits privileges in case of compromise.
# - Adjusted permissions (chown): the application only accesses its own files.
# - Install dependencies in production mode only:
#   removes unnecessary modules and reduces image size.
# - Final execution under appuser: ensures the application runs
#   without administrator privileges.
# -------------------------------------------------------------------

# Stage 1: Builder with openssl
FROM node:24-alpine AS builder
WORKDIR /app

# Install openssl only in this stage
RUN apk add --no-cache openssl

# Generate self-signed certificates
RUN mkdir certs && \
    openssl req -x509 -newkey rsa:2048 -nodes \
      -keyout certs/key.pem \
      -out certs/cert.pem \
      -days 365 \
      -subj "/CN=localhost"

# Stage 2: Final image without openssl
FROM node:24-alpine
WORKDIR /app

# Create a group and a non-root user on Alpine
# => avoids running as root and ensures the user exists
RUN addgroup -S appgroup && adduser -S -G appgroup appuser

# Copy dependencies and install production only
COPY package*.json ./
RUN npm install --only=production   # Install only production dependencies

# Copy application code
COPY app/ .

# Copy generated certificates from builder
COPY --from=builder /app/certs ./certs

# Adjust permissions for the non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose HTTPS port
EXPOSE 443

# Start the application
CMD ["npm", "start"]