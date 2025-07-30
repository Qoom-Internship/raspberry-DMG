let memorialData = {};
let isVideoLoaded = false;
let countdownTimer = null;
let fallbackTimer = null;

// 음소거 토글
function toggleMute() {
    const video = document.getElementById('memorialVideo');
    const muteBtn = document.getElementById('muteBtn');
    
    if (video.style.display !== 'none') {
        video.muted = !video.muted;
        muteBtn.textContent = video.muted ? '🔇' : '🔊';
        muteBtn.title = video.muted ? '음소거 해제' : '음소거';
    }
}

// 키보드 이벤트 처리 (ESC 키로 뒤로가기)
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        goBackToMain();
    }
});

// 메인 페이지로 돌아가기
function goBackToMain() {
    console.log('메인 페이지로 돌아갑니다...');
    
    // 비디오 정지
    const video = document.getElementById('memorialVideo');
    if (video && !video.paused) {
        video.pause();
        video.currentTime = 0;
    }
    
    // 타이머 정리
    if (countdownTimer) {
        clearInterval(countdownTimer);
    }
    if (fallbackTimer) {
        clearTimeout(fallbackTimer);
    }
    
    // 얼굴 인식 시스템 리셋 요청
    fetch('/api/reset_detection', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(() => {
        // 메인 페이지로 이동
        window.location.href = '/';
    }).catch(error => {
        console.error('리셋 요청 실패:', error);
        // 실패해도 메인 페이지로 이동
        window.location.href = '/';
    });
}

// 5초 카운트다운 시작
function startCountdown() {
    let count = 3;
    const countdownOverlay = document.getElementById('countdownOverlay');
    const countdownNumber = document.getElementById('countdownNumber');
    
    countdownOverlay.style.display = 'flex';
    countdownNumber.textContent = count;
    
    countdownTimer = setInterval(() => {
        count--;
        if (count > 0) {
            countdownNumber.textContent = count;
            // 애니메이션 재시작을 위해 클래스 제거 후 추가
            countdownNumber.style.animation = 'none';
            setTimeout(() => {
                countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
            }, 10);
        } else {
            clearInterval(countdownTimer);
            countdownOverlay.classList.add('hidden');
            setTimeout(() => {
                countdownOverlay.style.display = 'none';
                startVideo();
            }, 300);
        }
    }, 1000);
}

// 비디오 시작
function startVideo() {
    const video = document.getElementById('memorialVideo');
    const fallback = document.getElementById('videoFallback');
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    if (isVideoLoaded && memorialData.video) {
        // 업로드된 비디오가 있는 경우
        showVideo();
        hideLoading();
        
        video.currentTime = 0;
        video.play().then(() => {
            console.log('비디오 재생 시작');
        }).catch(error => {
            console.error('비디오 재생 실패:', error);
            showFallback();
            hideLoading();
        });
    } else {
        // 비디오가 없는 경우 fallback 표시
        console.log('업로드된 비디오가 없어 fallback을 표시합니다.');
        showFallback();
        hideLoading();
        
        // fallback의 경우 10초 후 자동으로 메인으로 돌아가기
        fallbackTimer = setTimeout(() => {
            goBackToMain();
        }, 10000);
    }
}

// 메모리얼 데이터 로드 및 비디오 설정
async function loadMemorialData() {
    try {
        const response = await fetch('/api/memorial_data');
        memorialData = await response.json();
        
        setupVideo();
        setupFallback();
        setupVideoInfo();
        
    } catch (error) {
        console.error('메모리얼 데이터 로딩 실패:', error);
        showFallback();
        hideLoading();
    }
}

// 비디오 설정
function setupVideo() {
    const video = document.getElementById('memorialVideo');
    const source = video.querySelector('source');
    
    if (memorialData.video && memorialData.video !== '' && !memorialData.video.includes('sample.mp4')) {
        source.src = memorialData.video;
        video.load();
        
        video.addEventListener('loadeddata', function() {
            console.log('비디오 로드 완료:', memorialData.video);
            isVideoLoaded = true;
        });
        
        video.addEventListener('error', function(e) {
            console.error('비디오 로드 실패:', e);
            isVideoLoaded = false;
        });
        
        // 비디오가 끝나면 메인으로 돌아가기
        video.addEventListener('ended', function() {
            console.log('비디오 재생 완료. 메인 페이지로 돌아갑니다.');
            setTimeout(() => {
                goBackToMain();
            }, 1000); // 1초 후 돌아가기
        });
        
    } else {
        console.log('업로드된 비디오가 없습니다.');
        isVideoLoaded = false;
    }
}

// fallback 화면 설정
function setupFallback() {
    if (memorialData.photo) {
        document.getElementById('animatedPhoto').src = memorialData.photo;
    }
    
    if (memorialData.lastWords) {
        document.getElementById('fallbackMessage').textContent = `"${memorialData.lastWords}"`;
    }
    
    if (memorialData.name) {
        document.getElementById('fallbackTitle').textContent = `안녕하세요, ${memorialData.name}입니다!`;
    }
}

// 비디오 정보 설정
function setupVideoInfo() {
    const videoInfo = document.getElementById('videoInfo');
    const videoInfoName = document.getElementById('videoInfoName');
    const videoInfoDates = document.getElementById('videoInfoDates');
    
    if (memorialData.name) {
        videoInfoName.textContent = memorialData.name;
    }
    
    if (memorialData.birthDate && memorialData.deathDate) {
        videoInfoDates.textContent = `${memorialData.birthDate} ~ ${memorialData.deathDate}`;
    }
    
    // 비디오 정보 표시
    if (memorialData.name || (memorialData.birthDate && memorialData.deathDate)) {
        videoInfo.style.display = 'block';
    }
}

// 비디오 표시
function showVideo() {
    document.getElementById('memorialVideo').style.display = 'block';
    document.getElementById('videoFallback').style.display = 'none';
}

// fallback 표시
function showFallback() {
    document.getElementById('memorialVideo').style.display = 'none';
    document.getElementById('videoFallback').style.display = 'flex';
}

// 로딩 숨기기
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('hidden');
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
    }, 500);
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('비디오 페이지 로드됨');
    
    // 메모리얼 데이터 로드
    loadMemorialData();
    
    // 5초 카운트다운 시작
    startCountdown();
    
    // 10초 후에도 로딩이 표시되면 강제로 숨기기
    setTimeout(function() {
        hideLoading();
        if (!isVideoLoaded) {
            showFallback();
        }
    }, 10000);
});

// 페이지를 벗어날 때 정리 작업
window.addEventListener('beforeunload', function() {
    const video = document.getElementById('memorialVideo');
    if (video && !video.paused) {
        video.pause();
    }
    
    if (countdownTimer) {
        clearInterval(countdownTimer);
    }
    
    if (fallbackTimer) {
        clearTimeout(fallbackTimer);
    }
});

// 화면 클릭으로 뒤로가기 (옵션)
document.addEventListener('click', function(event) {
    // 컨트롤 버튼이 아닌 곳을 클릭했을 때만
    if (!event.target.closest('.control-btn-overlay')) {
        // 더블클릭으로 뒤로가기
        if (event.detail === 2) {
            goBackToMain();
        }
    }
});