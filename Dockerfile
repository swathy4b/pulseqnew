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
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY PulseQ/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir numpy && \
    pip install --no-cache-dir cmake==3.25.0 && \
    pip install --no-cache-dir dlib==19.22.0 && \
    pip install --no-cache-dir -r requirements.txt

# Copy the application
COPY PulseQ/server/ server/

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=5000
ENV FLASK_APP=PulseQ/server/app.py
ENV FLASK_ENV=production
ENV SECRET_KEY=crowd-detection-secret

# Expose port
EXPOSE 5000

# Start the application
CMD ["python", "server/app.py"] 