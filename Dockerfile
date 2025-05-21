# Base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy and install Node.js dependencies
COPY client/package*.json ./client/
RUN cd client && npm install

# Copy application code
COPY server/ ./server/
COPY client/ ./client/

# Install nginx for serving static files
RUN apt-get update && apt-get install -y nginx

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Expose ports
EXPOSE 80
EXPOSE 5000

# Start both nginx and Flask server
CMD ["sh", "-c", "python server/server.py & nginx -g 'daemon off;'"], "TargetLintErrorIds": []

# Copy requirements.txt first
COPY requirements.txt ./

# Install remaining Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Set environment variables
ENV FLASK_APP=server/app.py
ENV FLASK_ENV=production
ENV SECRET_KEY=3456789888
ENV PORT=5000
ENV MONGODB_URI=mongodb+srv://swaathy:MveSJIZ5tddtg7n7@smartqueue.unjf9yz.mongodb.net/?retryWrites=true&w=majority&appName=smartqueue

# Expose ports
EXPOSE 5000
EXPOSE 10000

# Start the application
CMD ["python", "server/app.py"]