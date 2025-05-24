"""
WSGI config for the application.

This module contains the WSGI application used for production deployment.
"""
import os
import sys
import logging
from server.app import create_app, socketio

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Create application instance
try:
    app = create_app()
    application = app  # For Gunicorn
    logger.info("Application initialized successfully")
except Exception as e:
    logger.critical(f"Failed to initialize application: {str(e)}", exc_info=True)
    raise

# For local development
if __name__ == "__main__":
    try:
        logger.info("Starting development server...")
        socketio.run(
            app,
            host=os.environ.get('HOST', '0.0.0.0'),
            port=int(os.environ.get('PORT', 5000)),
            debug=os.environ.get('FLASK_ENV') == 'development',
            use_reloader=True
        )
    except Exception as e:
        logger.critical(f"Server crashed: {str(e)}", exc_info=True)
        raise
