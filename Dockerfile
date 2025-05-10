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
    wget \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy the entire PulseQ directory
COPY PulseQ/ .

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir numpy && \
    pip install --no-cache-dir cmake==3.25.0 && \
    pip install --no-cache-dir dlib-binary==19.22.0 && \
    pip install --no-cache-dir -r requirements.txt

# Expose port
EXPOSE 5000

# Start the Python server
CMD ["python", "server/app.py"] 