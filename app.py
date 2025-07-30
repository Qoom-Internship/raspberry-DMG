from flask import Flask, Response, render_template, jsonify, request, send_from_directory, redirect, url_for
import cv2
import ffmpeg
import numpy as np
import os
import json
import time
from datetime import datetime
import threading
from werkzeug.utils import secure_filename

app = Flask(__name__)

# 전역 변수
cap = cv2.VideoCapture(0)
current_state = "main"  # main, detecting, redirect, video
person_detected = False
detection_timer = 0
face_stay_timer = 0
DETECTION_TIMEOUT = 20  # 30초 후 메인 화면으로 복귀
FACE_STAY_THRESHOLD = 5  # 5초 동안 머물러야 동영상 재생
face_detected = False
face_rectangles = []
redirect_requested = False  # 리다이렉트 요청 플래그

# 얼굴 감지를 위한 Haar Cascade 로드
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

# 설정
STATIC_FOLDER = os.path.join(app.root_path, 'static')
UPLOAD_FOLDER = os.path.join(STATIC_FOLDER, 'uploads')
PHOTO_FOLDER = os.path.join(UPLOAD_FOLDER, 'photos')
VIDEO_FOLDER = os.path.join(UPLOAD_FOLDER, 'videos')
DATA_FILE = 'memorial_data.json'

ALLOWED_PHOTO_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'avi', 'mov'}

# 폴더 생성
os.makedirs(PHOTO_FOLDER, exist_ok=True)
os.makedirs(VIDEO_FOLDER, exist_ok=True)
os.makedirs(os.path.join(app.root_path, 'templates'), exist_ok=True)

def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def load_memorial_data():
    """메모리얼 데이터 로드"""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_memorial_data(data):
    """메모리얼 데이터 저장"""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def detect_faces(frame):
    """얼굴 감지"""
    global face_rectangles
    
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    
    face_rectangles = []
    for (x, y, w, h) in faces:
        face_rectangles.append((x, y, w, h))
    
    return len(faces) > 0

def draw_face_rectangles(frame, color):
    """얼굴에 사각형 그리기"""
    for (x, y, w, h) in face_rectangles:
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
        # 얼굴 위에 텍스트 표시
        cv2.putText(frame, "Face Detected", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

def reset_detection_system():
    """얼굴 인식 시스템 초기화"""
    global current_state, face_stay_timer, detection_timer, redirect_requested
    current_state = "main"
    face_stay_timer = 0
    detection_timer = 0
    redirect_requested = False
    print("얼굴 인식 시스템 초기화 완료")

def state_timer():
    global current_state, detection_timer, face_stay_timer, face_detected, redirect_requested
    while True:
        time.sleep(0.1)  # 더 정밀한 타이머를 위해 0.1초 간격
        
        if current_state == "main":
            if face_detected:
                current_state = "detecting"
                face_stay_timer = 0.1
            else:
                face_stay_timer = 0
                
        elif current_state == "detecting":
            if face_detected:
                face_stay_timer += 0.1
                if face_stay_timer >= FACE_STAY_THRESHOLD:
                    current_state = "redirect"
                    redirect_requested = True
                    print("5초 얼굴 인식 완료! /video로 리다이렉트 요청")
            else:
                # 얼굴이 사라지면 메인으로 돌아감
                current_state = "main"
                face_stay_timer = 0
                
        elif current_state == "video":
            # 비디오 페이지에서는 타이머만 관리 (자동 복귀는 클라이언트에서 처리)
            pass

def generate():
    global current_state, person_detected, detection_timer, face_detected, face_stay_timer
    
    while True:
        success, frame = cap.read()
        if not success:
            break

        # 얼굴 감지
        face_detected = detect_faces(frame)
        
        if current_state == "main":
            if face_detected:
                status_text = "Face detected! Stay still..."
                color = (0, 255, 255)  # 노란색 (BGR)
                draw_face_rectangles(frame, color)
            else:
                status_text = "Waiting for face detection..."
                color = (255, 255, 255)  # 흰색
                
        elif current_state == "detecting":
            if face_detected:
                remaining = FACE_STAY_THRESHOLD - face_stay_timer
                if remaining > 0:
                    color = (0, 165, 255)  # 주황색 (BGR)
                    status_text = f"Keep still... {remaining:.1f}s remaining"
                else:
                    color = (0, 255, 0)  # 초록색 (BGR)
                    status_text = "Detection complete! Redirecting..."
                    
                # 얼굴에 사각형 그리기
                draw_face_rectangles(frame, color)
                
                # 진행 바 표시
                progress_width = int((face_stay_timer / FACE_STAY_THRESHOLD) * 300)
                cv2.rectangle(frame, (10, 50), (310, 80), (100, 100, 100), 2)
                cv2.rectangle(frame, (10, 50), (10 + progress_width, 80), color, -1)
                
                # 진행률 텍스트
                progress_percent = int((face_stay_timer / FACE_STAY_THRESHOLD) * 100)
                cv2.putText(frame, f"{progress_percent}%", (320, 70), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
            else:
                status_text = "Face lost! Please look at the camera"
                color = (0, 0, 255)  # 빨간색
                
        elif current_state == "redirect":
            status_text = "Redirecting to video page..."
            color = (0, 255, 0)  # 초록색
            
        elif current_state == "video":
            status_text = "Video page active"
            color = (255, 0, 255)  # 마젠타색

        # 상태 텍스트 표시
        cv2.putText(frame, status_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

        # 현재 상태 표시
        cv2.putText(frame, f"State: {current_state.upper()}", (10, frame.shape[0] - 10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/')
def index():
    global current_state
    reset_detection_system()  # 메인 페이지 접근 시 시스템 초기화
    return render_template('index.html')

@app.route('/video')
def video_page():
    global current_state, redirect_requested
    current_state = "video"
    redirect_requested = False
    print("비디오 페이지 접근")
    return render_template('video.html')

@app.route('/edit')
def edit():
    return render_template('edit.html')

@app.route('/video_feed')
def video_feed():
    return Response(generate(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/state')
def get_state():
    global redirect_requested
    response_data = {
        'state': current_state,
        'face_detected': face_detected,
        'face_stay_timer': face_stay_timer,
        'timer': detection_timer,
        'threshold': FACE_STAY_THRESHOLD,
        'redirect_requested': redirect_requested
    }
    
    # 리다이렉트 요청이 있으면 플래그 리셋
    if redirect_requested:
        redirect_requested = False
        
    return jsonify(response_data)

@app.route('/api/reset_detection', methods=['POST'])
def reset_detection():
    """얼굴 인식 시스템 리셋 API"""
    reset_detection_system()
    return jsonify({'success': True, 'message': '얼굴 인식 시스템이 초기화되었습니다.'})

@app.route('/api/memorial_data')
def get_memorial_data():
    data = load_memorial_data()
    return jsonify(data)

@app.route('/api/save_memorial', methods=['POST'])
def save_memorial():
    try:
        data = request.json
        save_memorial_data(data)
        return jsonify({'success': True, 'message': '저장되었습니다.'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': '파일이 없습니다'}), 400
        
        file = request.files['file']
        file_type = request.form.get('type', 'photo')
        
        if file.filename == '':
            return jsonify({'error': '파일이 선택되지 않았습니다'}), 400
        
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
        base_filename = timestamp + os.path.splitext(filename)[0]
        ext = filename.rsplit('.', 1)[1].lower()

        if allowed_file(filename, ALLOWED_PHOTO_EXTENSIONS):
            folder = PHOTO_FOLDER
            save_filename = base_filename + '.' + ext
            filepath = os.path.join(folder, save_filename)
            file.save(filepath)
            url_path = f'/static/uploads/photos/{save_filename}'

        elif allowed_file(filename, ALLOWED_VIDEO_EXTENSIONS):
            folder = VIDEO_FOLDER
            temp_filename = base_filename + '.' + ext
            temp_path = os.path.join(folder, temp_filename)
            file.save(temp_path)

            # mp4로 변환 경로 지정
            converted_filename = base_filename + '.mp4'
            converted_path = os.path.join(folder, converted_filename)

            if ext != 'mp4':
                # ffmpeg 변환
                try:
                    ffmpeg.input(temp_path).output(converted_path, vcodec='libx264', acodec='aac', strict='experimental').run(overwrite_output=True)
                    os.remove(temp_path)  # 원본 avi 삭제
                except Exception as e:
                    return jsonify({'error': f'FFmpeg 변환 실패: {str(e)}'}), 500
            else:
                # 원래 mp4면 그냥 경로 변경
                converted_path = temp_path

            url_path = f'/static/uploads/videos/{converted_filename}'

        else:
            return jsonify({'error': '허용되지 않는 파일 형식입니다'}), 400

        return jsonify({
            'success': True,
            'filename': os.path.basename(converted_path),
            'filepath': converted_path,
            'url': url_path
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/static/uploads/photos/<filename>')
def get_photo(filename):
    return send_from_directory(PHOTO_FOLDER, filename)

@app.route('/static/uploads/videos/<filename>')
def get_video(filename):
    return send_from_directory(VIDEO_FOLDER, filename)

if __name__ == '__main__':
    timer_thread = threading.Thread(target=state_timer, daemon=True)
    timer_thread.start()
    
    print("디지털 스크린 묘비 시스템이 시작되었습니다.")
    print("얼굴 감지 기능이 활성화되었습니다. (5초 감지)")
    print("브라우저에서 http://yoonsun.local:3002 으로 접속하세요.")
    
    app.run(host='0.0.0.0', port=3002, debug=False)