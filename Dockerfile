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

# Copy dependencies and install
COPY package*.json ./
RUN npm install --only=production

# Copy application code
COPY app/ .

# Copy generated certificates from builder
COPY --from=builder /app/certs ./certs

# Expose HTTPS port
EXPOSE 443

CMD ["npm", "start"]