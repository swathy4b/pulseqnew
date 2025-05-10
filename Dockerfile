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
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Clone the repository with submodules
RUN git clone --recursive https://github.com/swathy4b/pulseqnew.git /app

# Copy requirements first for better caching
COPY PulseQ/requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir numpy && \
    pip install --no-cache-dir cmake==3.25.0 && \
    pip install --no-cache-dir dlib && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY PulseQ/server/ /app/server/

# Expose port
EXPOSE 5000

# Start the Python server
CMD ["python", "server/app.py"] 