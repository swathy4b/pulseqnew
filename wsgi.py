"""
WSGI config for the application.

This module contains the WSGI application used for production deployment.
"""
import os
import sys
import logging

# Set up logging before importing app to catch all logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Add application directory to Python path
app_dir = os.path.abspath(os.path.dirname(__file__))
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

try:
    logger.info("Initializing application...")
    from server.app import create_app, socketio
    
    # Create application instance
    app = create_app()
    application = app  # For Gunicorn
    logger.info("Application initialized successfully")
    
    # Log important configuration
    logger.info(f"FLASK_ENV: {os.environ.get('FLASK_ENV', 'production')}")
    logger.info(f"FLASK_APP: {os.environ.get('FLASK_APP', 'wsgi:application')}")
    logger.info(f"HOST: {os.environ.get('HOST', '0.0.0.0')}")
    logger.info(f"PORT: {os.environ.get('PORT', '5000')}")
    
except Exception as e:
    logger.critical(f"Failed to initialize application: {str(e)}", exc_info=True)
    raise

# For local development
if __name__ == "__main__":
    try:
        host = os.environ.get('HOST', '0.0.0.0')
        port = int(os.environ.get('PORT', 5000))
        
        logger.info(f"Starting development server on {host}:{port}...")
        socketio.run(
            app,
            host=host,
            port=port,
            debug=os.environ.get('FLASK_ENV') == 'development',
            use_reloader=True,
            log_output=True
        )
    except Exception as e:
        logger.critical(f"Server crashed: {str(e)}", exc_info=True)
        raise
