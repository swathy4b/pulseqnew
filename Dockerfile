FROM python:3.9-slim

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install pre-built face recognition packages
RUN pip install --no-cache-dir \
    face-recognition==1.3.0 \
    face-recognition-models==0.3.0 \
    dlib==19.22.0

# Set working directory
WORKDIR /app

# Copy package files first and verify
COPY package.json package-lock.json ./
RUN ls -la && cat package.json
RUN npm install --legacy-peer-deps

# Copy the rest of the application
COPY . .

# Copy requirements.txt first
COPY requirements.txt ./

# Install remaining Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
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
RUN echo '#!/bin/bash\npython server/app.py &\nnode server/server.js' > start.sh && chmod +x start.sh

# Start the application
CMD ["bash", "start.sh"]