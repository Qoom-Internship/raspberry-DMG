let currentState = 'main';
let isTransitioning = false;
let hasUploadedVideo = false; // 업로드된 비디오 존재 여부 추적

function goToEdit() {
    window.location.href = "/edit";
}

function goToMain() {
    document.getElementById("videoContainer").style.display = "none";
    document.getElementById("mainContainer").style.display = "flex";
    document.getElementById("recognizedMessage").style.display = "none";
    document.getElementById("progressIndicator").style.display = "none";

    const video = document.getElementById("memorialVideo");
    if (video && !video.paused) {
        video.pause();
    }

    currentState = 'main';
    isTransitioning = false;
}

function updateDetectionStatus(data) {
    const statusEl = document.getElementById('detectionStatus');
    const progressIndicator = document.getElementById('progressIndicator');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const countdown = document.getElementById('countdown');
    const cameraWrapper = document.querySelector('.camera-wrapper');

    if (data.state === 'main') {
        if (data.face_detected) {
            statusEl.textContent = '얼굴이 감지되었습니다';
            statusEl.className = 'detection-status detecting';
            cameraWrapper.className = 'camera-wrapper detecting';

            progressIndicator.style.display = 'flex';
            progressIndicator.className = 'progress-indicator active';

            const progress = (data.face_stay_timer / data.threshold) * 100;
            const remaining = data.threshold - data.face_stay_timer;

            progressFill.style.width = `${Math.min(progress, 100)}%`;
            countdown.textContent = `${remaining.toFixed(1)}s`;

            if (progress >= 100) {
                progressText.textContent = '인식 완료! 동영상 페이지로 이동합니다...';
                statusEl.className = 'detection-status recognized';
                statusEl.textContent = '5초 인식 완료!';
                cameraWrapper.className = 'camera-wrapper recognized';
            } else {
                progressText.textContent = '계속 바라봐 주세요...';
            }
        } else {
            statusEl.textContent = '얼굴을 찾고 있습니다...';
            statusEl.className = 'detection-status';
            cameraWrapper.className = 'camera-wrapper';
            progressIndicator.style.display = 'none';
        }

    } else if (data.state === 'detecting') {
        // detecting 상태는 main과 겹치는 의미로 사용되므로 생략 가능

    } else if (data.state === 'redirect') {
        statusEl.textContent = '동영상 페이지로 이동 중...';
        statusEl.className = 'detection-status recognized';
        cameraWrapper.className = 'camera-wrapper recognized';
        progressIndicator.style.display = 'none';

    } else if (data.state === 'video') {
        statusEl.textContent = '비디오 재생 중';
        statusEl.className = 'detection-status recognized';
        cameraWrapper.className = 'camera-wrapper recognized';
        progressIndicator.style.display = 'none';
    }
}

function checkRecognition() {
    fetch("/api/state")
        .then(res => res.json())
        .then(data => {
            updateDetectionStatus(data);

            if (data.redirect_requested && !isTransitioning) {
                isTransitioning = true;

                const message = document.getElementById("recognizedMessage");
                if (message) {
                    message.style.display = "block";
                    message.textContent = "5초 인식 완료! 동영상 페이지로 이동합니다...";
                }

                setTimeout(() => {
                    window.location.href = '/video';
                }, 1000);

            } else if (data.state === 'video' && currentState === 'main' && !isTransitioning) {
                isTransitioning = true;

                const message = document.getElementById("recognizedMessage");
                message.style.display = "block";

                setTimeout(() => {
                    document.getElementById("mainContainer").style.display = "none";
                    document.getElementById("videoContainer").style.display = "block";

                    const video = document.getElementById("memorialVideo");
                    const fallback = document.getElementById("videoFallback");

                    if (hasUploadedVideo) {
                        fallback.style.display = "none";
                        video.style.display = "block";
                        video.currentTime = 0;
                        video.play().catch(e => {
                            console.log('자동 재생 실패, fallback으로 전환:', e);
                            video.style.display = "none";
                            fallback.style.display = "block";
                        });
                    } else {
                        video.style.display = "none";
                        fallback.style.display = "block";
                        console.log('업로드된 비디오가 없어 fallback 화면을 표시합니다.');
                    }

                    currentState = 'video';
                }, 1000);

            } else if (data.state === 'main' && currentState === 'video') {
                goToMain();
            }
        })
        .catch(error => {
            console.error('상태 확인 실패:', error);
        });
}

setInterval(checkRecognition, 500);

document.addEventListener('DOMContentLoaded', async function () {
    try {
        const response = await fetch('/api/memorial_data');
        const data = await response.json();

        if (data.name) {
            document.getElementById('memorialName').textContent = data.name;
        }

        if (data.birthDate && data.deathDate) {
            document.getElementById('memorialDates').textContent = `${data.birthDate} ~ ${data.deathDate}`;
        }

        if (data.epitaph) {
            document.getElementById('memorialSubtitle').innerHTML = data.epitaph.replace(/\n/g, "<br>");
        }

        if (data.lastWords) {
            document.getElementById('memorialQuote').textContent = `"${data.lastWords}"`;
        }

        if (data.photo) {
            const photo = document.getElementById('memorialPhoto');
            photo.src = data.photo;
            photo.style.display = 'block';
            document.getElementById('photoPlaceholder').style.display = 'none';

            const animatedPhoto = document.getElementById('animatedPhoto');
            if (animatedPhoto) {
                animatedPhoto.src = data.photo;
            }
        }

        if (data.video && data.video !== '' && !data.video.includes('sample.mp4')) {
            const video = document.getElementById('memorialVideo');
            const source = video.querySelector('source');
            source.src = data.video;
            video.load();

            hasUploadedVideo = true;

            video.addEventListener('loadeddata', function () {
                console.log('비디오 로드 완료:', data.video);
            });

            video.addEventListener('error', function (e) {
                console.error('비디오 로드 실패:', e);
                hasUploadedVideo = false;
            });

            document.getElementById('videoFallback').style.display = 'none';
            video.style.display = 'block';

            console.log('업로드된 비디오를 설정했습니다:', data.video);
        } else {
            hasUploadedVideo = false;
            const video = document.getElementById('memorialVideo');
            const source = video.querySelector('source');
            source.src = '';

            video.style.display = 'none';
            document.getElementById('videoFallback').style.display = 'block';

            console.log('업로드된 비디오가 없습니다. fallback 화면을 사용합니다.');
        }

    } catch (error) {
        console.error('메모리얼 데이터 로딩 실패:', error);
        hasUploadedVideo = false;
    }
});
