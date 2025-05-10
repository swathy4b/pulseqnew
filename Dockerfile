FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    python3-dev \
    build-essential \
    cmake \
    pkg-config \
    libx11-dev \
    libatlas-base-dev \
    libgtk-3-dev \
    libboost-python-dev \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first and verify
COPY package.json package-lock.json ./
RUN ls -la && cat package.json

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir numpy && \
    pip install --no-cache-dir cmake==3.25.0 && \
    pip install --no-cache-dir dlib==19.22.0 && \
    pip install --no-cache-dir -r requirements.txt

# Set environment variables
ENV FLASK_APP=server/app.py
ENV FLASK_ENV=production
ENV SECRET_KEY=your-secret-key-here
ENV PORT=5000

# Expose ports
EXPOSE 5000
EXPOSE 10000

# Create start script
RUN echo '#!/bin/bash\npython server/app.py &\nnode server/server.js\n' > start.sh && chmod +x start.sh

# Start the application
CMD ["./start.sh"] 