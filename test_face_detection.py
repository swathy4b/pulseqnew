import cv2
import mediapipe as mp
import time
import os

# Initialize MediaPipe Face Detection
mp_face_detection = mp.solutions.face_detection
mp_drawing = mp.solutions.drawing_utils
face_detection = mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5)

# Initialize webcam
cap = cv2.VideoCapture(0)

print("Starting face detection test...")
print("Processing 10 frames and saving results...")

# Create output directory if it doesn't exist
os.makedirs('test_output', exist_ok=True)

for i in range(10):
    ret, frame = cap.read()
    if not ret:
        print("Failed to read frame")
        continue
        
    # Convert the BGR image to RGB
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # Process the frame
    results = face_detection.process(frame_rgb)
    
    # Draw face detections
    if results.detections:
        for detection in results.detections:
            mp_drawing.draw_detection(frame, detection)
        print(f"Frame {i+1}: Detected {len(results.detections)} faces")
    else:
        print(f"Frame {i+1}: No faces detected")
    
    # Save the frame
    cv2.imwrite(f'test_output/frame_{i+1}.jpg', frame)
    time.sleep(0.5)  # Wait between frames

print("Test complete. Check the 'test_output' directory for results.")

# Clean up
cap.release() 