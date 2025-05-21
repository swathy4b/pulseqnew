# PulseQ - Intelligent Queue Management System

PulseQ is an AI-powered queue management system with real-time crowd monitoring and analytics.

## Project Structure

```
pulseqnew/
├── client/               # Frontend application
│   ├── index.html        # Main HTML file
│   ├── script.js         # Main JavaScript file
│   ├── styles.css        # Main styles
│   ├── package.json      # Frontend dependencies
│   └── Dockerfile        # Frontend Docker configuration
├── server/               # Backend application
│   └── app.py           # Main Flask application
├── docker-compose.yml    # Multi-container setup
├── Dockerfile            # Backend Docker configuration
└── requirements.txt      # Python dependencies
```

## Prerequisites

- Docker and Docker Compose installed
- Python 3.10+
- Node.js 16+ (for local development)

## Local Development

### Backend Setup

1. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Run the Flask development server:
   ```bash
   cd server
   flask run
   ```

### Frontend Setup

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

## Docker Deployment

1. Build and start the containers:
   ```bash
   docker-compose up --build
   ```

2. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Environment Variables

### Backend

- `FLASK_APP`: Main application file (default: `server/app.py`)
- `FLASK_ENV`: Environment (development/production)
- `SECRET_KEY`: Secret key for session management
- `MONGODB_URI`: MongoDB connection string

### Frontend

- `REACT_APP_BACKEND_URL`: Backend API URL (default: `http://localhost:5000`)

## License

MIT
