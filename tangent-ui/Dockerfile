FROM node:16-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Create a .env file during build
ARG REACT_APP_API_URL
ARG REACT_APP_OLLAMA_URL
ARG REACT_APP_INFERENCE_URL

ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_OLLAMA_URL=${REACT_APP_OLLAMA_URL}
ENV REACT_APP_INFERENCE_URL=${REACT_APP_INFERENCE_URL}

# Build the application
RUN npm run build

# Production stage
FROM node:16-alpine

WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy built files from builder stage
COPY --from=builder /app/build ./build

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["serve", "-s", "build", "-l", "3000"] 