FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV EMBEDDING_MODEL=all-minilm
ENV GENERATION_MODEL=qwen2.5-coder:7b
ENV REACT_APP_API_URL=http://localhost:5001
ENV REACT_APP_OLLAMA_URL=http://localhost:11434

# Expose the port the app runs on
EXPOSE 5001

# Command to run the application
CMD ["python", "src/app.py"] 