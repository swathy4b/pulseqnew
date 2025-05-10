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

# Create necessary directories
RUN mkdir -p server

# Copy server files
COPY PulseQ/server/app.py server/
COPY PulseQ/server/server.js server/
COPY PulseQ/server/templates server/templates/
COPY PulseQ/server/static server/static/
COPY PulseQ/server/routes server/routes/
COPY PulseQ/server/models server/models/
COPY PulseQ/server/analytics_history.json server/

# Copy package files
COPY PulseQ/package.json .
COPY PulseQ/package-lock.json .

# Verify package.json exists and show its contents
RUN ls -la && cat package.json

# Install Node.js dependencies
RUN npm install

# Copy requirements
COPY PulseQ/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir numpy && \
    pip install --no-cache-dir cmake==3.25.0 && \
    pip install --no-cache-dir dlib==19.22.0 && \
    pip install --no-cache-dir -r requirements.txt

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=5000
ENV FLASK_APP=server/app.py
ENV FLASK_ENV=production
ENV SECRET_KEY=crowd-detection-secret
ENV NODE_ENV=production

# Expose ports
EXPOSE 5000
EXPOSE 10000

# Create start script
RUN echo '#!/bin/bash\n\
# Start Python server in background\n\
python server/app.py &\n\
# Start Node.js server\n\
node server/server.js\n\
' > start.sh && chmod +x start.sh

# Start both servers
CMD ["./start.sh"] 