import cv2
import numpy as np
import time
import mediapipe as mp
import base64
from flask import Flask, render_template, request, jsonify, send_from_directory, Response
from flask_socketio import SocketIO, emit
import threading
import datetime
import json
from collections import deque
import os
import logging
import socket
import eventlet
import sys

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Get the absolute path to the server directory
server_dir = os.path.dirname(os.path.abspath(__file__))
templates_dir = os.path.join(server_dir, 'templates')

# Initialize Flask app with correct paths
app = Flask(__name__, 
            template_folder=templates_dir,
            static_folder=os.path.join(server_dir, 'static'))
app.config['SECRET_KEY'] = 'crowd-detection-secret'
socketio = SocketIO(app, cors_allowed_origins="*")

# Global variables
frame_queue = deque(maxlen=10)
crowd_count = 0
is_running = False
video_capture = None
video_thread = None
face_detection = None
last_frame = None
video_lock = threading.Lock()

def initialize_face_detection():
    """Initialize MediaPipe Face Detection"""
    global face_detection
    try:
        mp_face_detection = mp.solutions.face_detection
        mp_drawing = mp.solutions.drawing_utils
        face_detection = mp_face_detection.FaceDetection(
            model_selection=1,
            min_detection_confidence=0.5
        )
        logger.info("MediaPipe Face Detection initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize MediaPipe Face Detection: {str(e)}")
        return False

def initialize_webcam():
    """Initialize webcam with fallback options"""
    try:
        # Try default webcam
        cap = cv2.VideoCapture(0)
        if cap.isOpened():
            logger.info("Successfully opened default webcam")
            return cap

        # Try alternative webcam indices
        for i in range(1, 5):
            cap = cv2.VideoCapture(i)
            if cap.isOpened():
                logger.info(f"Successfully opened webcam at index {i}")
                return cap

        # If no webcam is available, create a test video
        logger.warning("No webcam available, creating test video")
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            # Create a test video with a black frame
            test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(test_frame, "No Camera Available", (50, 240),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                raise Exception("Could not initialize any video source")
        return cap
    except Exception as e:
        logger.error(f"Failed to initialize webcam: {str(e)}")
        raise

def process_frame(frame):
    """Process a single frame for face detection"""
    try:
        if face_detection is None:
            logger.error("Face detection model not initialized")
            return frame, 0
            
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_detection.process(frame_rgb)
        
        person_count = 0
        if results.detections:
            person_count = len(results.detections)
            for detection in results.detections:
                bboxC = detection.location_data.relative_bounding_box
                ih, iw, _ = frame.shape
                x, y, w, h = int(bboxC.xmin * iw), int(bboxC.ymin * ih), int(bboxC.width * iw), int(bboxC.height * ih)
                # Draw bounding box
                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 0, 255), 2)
                # Draw label
                score = int(detection.score[0] * 100)
                cv2.putText(frame, f'Person {score}%', (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            logger.debug(f"Detected {person_count} people in frame")
        
        cv2.putText(frame, f'People: {person_count}', (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        
        return frame, person_count
    except Exception as e:
        logger.error(f"Error processing frame: {str(e)}")
        return frame, 0

def video_processor():
    """Process video frames and emit results"""
    global crowd_count, video_capture, is_running, last_frame
    logger.debug("Video processor started")
    try:
        while is_running:
            logger.debug(f"Loop check: is_running={is_running}")
            if video_capture is None or not video_capture.isOpened():
                logger.error("Video capture is not available")
                time.sleep(1)
                continue

            ret, frame = video_capture.read()
            if not ret:
                logger.warning("Failed to read frame")
                # Create a test frame if webcam fails
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(frame, "Camera Error", (50, 240),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                time.sleep(0.1)
                continue
                
            processed_frame, count = process_frame(frame)
            crowd_count = count
            last_frame = processed_frame
            
            try:
                _, buffer = cv2.imencode('.jpg', processed_frame)
                frame_base64 = base64.b64encode(buffer).decode('utf-8')
                timestamp = datetime.datetime.now().isoformat()
                avg_wait = calculate_average_wait_time(crowd_count)
                socketio.emit('video_frame', {
                    'frame': frame_base64,
                    'count': crowd_count,
                    'avg_wait': avg_wait,
                    'metrics': {
                        'peak': max(crowd_count, get_peak_count()),
                        'current': crowd_count,
                        'status': get_crowd_status(crowd_count)
                    },
                    'timestamp': timestamp
                })
                update_analytics_history(crowd_count, timestamp)
            except Exception as e:
                logger.error(f"Error encoding/sending frame: {str(e)}")

            time.sleep(0.033)
    except Exception as e:
        logger.error(f"Video processor error: {str(e)}")
    finally:
        logger.debug("Video processor stopped")
        is_running = False
        if video_capture:
            video_capture.release()
            video_capture = None
            logger.debug("Video capture released in video_processor")

def calculate_average_wait_time(count):
    """Calculate average wait time based on crowd count"""
    if count <= 5:
        return 5
    elif count <= 10:
        return 10
    elif count <= 15:
        return 15
    else:
        return 20

def get_crowd_status(count):
    """Get crowd status based on count"""
    if count > 15:
        return 'Crowded'
    elif count > 8:
        return 'Busy'
    else:
        return 'Normal'

def get_peak_count():
    """Get the peak count from analytics history"""
    try:
        with open('analytics_history.json', 'r') as f:
            history = json.load(f)
            return max(entry['count'] for entry in history)
    except:
        return 0

def update_analytics_history(count, timestamp):
    """Update analytics history with current count"""
    try:
        history = []
        try:
            with open('analytics_history.json', 'r') as f:
                history = json.load(f)
        except:
            pass
            
        history.append({
            'count': count,
            'timestamp': timestamp
        })
        
        # Keep only last 24 hours of data
        cutoff = (datetime.datetime.now() - datetime.timedelta(hours=24)).isoformat()
        history = [entry for entry in history if entry['timestamp'] > cutoff]
        
        with open('analytics_history.json', 'w') as f:
            json.dump(history, f)
    except Exception as e:
        logger.error(f"Error updating analytics history: {str(e)}")

def generate_frames():
    camera = cv2.VideoCapture(0)
    while True:
        success, frame = camera.read()
        if not success:
            break
        else:
            # Convert the BGR image to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process the frame with MediaPipe
            results = face_detection.process(rgb_frame)
            
            # Draw face detections
            if results.detections:
                for detection in results.detections:
                    mp_drawing.draw_detection(frame, detection)
            
            # Convert the frame to JPEG
            ret, buffer = cv2.imencode('.jpg', frame)
            frame = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/feed')
def video_feed():
    """Serve the video feed"""
    try:
        return Response(generate_frames(),
                        mimetype='multipart/x-mixed-replace; boundary=frame')
    except Exception as e:
        logger.error(f"Error serving video feed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/start', methods=['POST'])
def start_detection():
    """Start video processing"""
    global is_running, video_capture, video_thread, face_detection
    
    logger.debug("Start detection requested")
    
    if not is_running:
        try:
            # Initialize face detection if not already done
            if face_detection is None:
                if not initialize_face_detection():
                    return jsonify({'error': 'Failed to initialize face detection model'}), 500
            
            # Try to initialize webcam with fallback
            try:
                video_capture = initialize_webcam()
            except Exception as e:
                logger.error(f"Webcam initialization error: {str(e)}")
                return jsonify({'error': 'Could not access webcam. Please check camera permissions.'}), 500
                
            is_running = True
            video_thread = threading.Thread(target=video_processor, daemon=True)
            video_thread.start()
            logger.info("Detection started successfully")
            socketio.emit('notification', {'message': 'Detection started', 'type': 'success'})
            return jsonify({'status': 'started'})
        except Exception as e:
            logger.error(f"Start error: {str(e)}")
            if video_capture:
                video_capture.release()
                video_capture = None
            return jsonify({'error': str(e)}), 500
    return jsonify({'status': 'already running'})

@app.route('/stop', methods=['POST'])
def stop_detection():
    """Stop video processing"""
    global is_running, video_capture, video_thread, last_frame, crowd_count, face_detection

    logger.debug("Stop detection requested")

    if is_running:
        try:
            is_running = False

            # Wait for video thread to finish
            if video_thread and video_thread.is_alive():
                logger.debug("Joining video thread...")
                video_thread.join(timeout=5)
                if video_thread.is_alive():
                    logger.warning("Video thread did not stop gracefully, forcing webcam release")
                    # Forcefully release webcam
                    if video_capture:
                        video_capture.release()
                        video_capture = None

            # Release video capture (again, for safety)
            if video_capture:
                logger.debug("Releasing video capture...")
                video_capture.release()
                video_capture = None

            # Reset last frame and crowd count
            last_frame = None
            crowd_count = 0

            # Close face detection model
            if face_detection:
                logger.debug("Closing face detection model...")
                face_detection.close()
                face_detection = None

            logger.info("Detection stopped successfully")
            socketio.emit('notification', {'message': 'Detection stopped', 'type': 'info'})
            return jsonify({'status': 'stopped'})

        except Exception as e:
            logger.error(f"Error stopping detection: {str(e)}")
            return jsonify({'error': str(e)}), 500

    return jsonify({'status': 'not running'})

@app.route('/status')
def get_status():
    """Get current detection status"""
    logger.debug(f"Status requested. Running: {is_running}, Count: {crowd_count}")
    return jsonify({
        'running': is_running,
        'count': crowd_count,
        'timestamp': datetime.datetime.now().isoformat()
    })

@app.route('/static/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory(app.static_folder, path)

@socketio.on('connect')
def handle_connect():
    """Handle new socket connection"""
    logger.debug("New client connected")
    emit('status', {'running': is_running, 'count': crowd_count})

if __name__ == '__main__':
    import logging
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    print("Starting server in production mode (no debug, no watchdog)")
    
    # Get port from environment variable
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting Python server on port {port}")
    
    try:
        # Initialize face detection before starting server
        print("Initializing face detection model...")
        if not initialize_face_detection():
            print("Failed to initialize face detection model")
            sys.exit(1)
        print("Face detection model initialized successfully")
            
        # Try to start server
        try:
            print(f"Starting Flask server on port {port}...")
            # Use eventlet for production
            import eventlet
            eventlet.monkey_patch()
            socketio.run(app, debug=False, host='0.0.0.0', port=port)
        except OSError as e:
            if e.errno == 98:  # Address already in use
                print(f"Port {port} is in use, trying port {port + 1}")
                try:
                    socketio.run(app, debug=False, host='0.0.0.0', port=port + 1)
                except Exception as e:
                    print(f"Failed to start server on port {port + 1}: {str(e)}")
                    sys.exit(1)
            else:
                print(f"Failed to start server: {str(e)}")
                sys.exit(1)
    except Exception as e:
        print(f"Server startup error: {str(e)}")
        sys.exit(1)