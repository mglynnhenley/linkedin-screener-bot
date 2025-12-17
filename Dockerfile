# Use Node.js LTS
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
