# Use official Node.js image
FROM node:22-slim

# Install ffmpeg (required for video transcoding)
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the backend files
COPY . .

# Expose the API port
EXPOSE 8000

# Start the server
CMD ["npm", "start"]
