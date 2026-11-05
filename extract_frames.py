import cv2
import sys
import os

video_path = sys.argv[1]
output_dir = sys.argv[2]
os.makedirs(output_dir, exist_ok=True)

vidcap = cv2.VideoCapture(video_path)
success,image = vidcap.read()
count = 0
frame_rate = vidcap.get(cv2.CAP_PROP_FPS)
interval = int(frame_rate * 5) # every 5 seconds

while success:
    if count % interval == 0:
        cv2.imwrite(f"{output_dir}/frame_{count}.jpg", image)
    success,image = vidcap.read()
    count += 1
print(f"Extracted frames to {output_dir}")
