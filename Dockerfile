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

# Copy requirements.txt first
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy client directory first
COPY client/ ./client/

# Copy server code
COPY server/ ./server/

# Install Node.js dependencies
RUN cd client && npm install

# Expose port
EXPOSE 5000

# Set environment variables
ENV FLASK_APP=server/app.py
ENV FLASK_ENV=production
ENV SECRET_KEY=3456789888
ENV PORT=5000
ENV MONGODB_URI=mongodb+srv://swaathy:MveSJIZ5tddtg7n7@smartqueue.unjf9yz.mongodb.net/?retryWrites=true&w=majority&appName=smartqueue

# Start the application
CMD ["python", "server/app.py"]