let memorialData = {};
let uploadedPhoto = null;
let uploadedVideo = null;

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    loadMemorialData();
    setupEventListeners();
    setupDateInputs();
});

// 기존 데이터 로드
async function loadMemorialData() {
    try {
        const response = await fetch('/api/memorial_data');
        memorialData = await response.json();
        populateForm();
    } catch (error) {
        console.error('데이터 로드 실패:', error);
    }
}

// 폼에 기존 데이터 채우기
function populateForm() {
    if (memorialData.name) document.getElementById('fullName').value = memorialData.name;
    if (memorialData.birthDate) {
        // 서버에서 받은 날짜 데이터를 적절한 형식으로 변환
        document.getElementById('birthDate').value = formatDateForInput(memorialData.birthDate);
    }
    if (memorialData.deathDate) {
        document.getElementById('deathDate').value = formatDateForInput(memorialData.deathDate);
    }
    if (memorialData.epitaph) document.getElementById('epitaph').value = memorialData.epitaph;
    if (memorialData.lastWords) document.getElementById('lastWords').value = memorialData.lastWords;

    if (memorialData.photo) {
        uploadedPhoto = memorialData.photo;
        showPhotoPreview(uploadedPhoto);
    }
    if (memorialData.video) {
        uploadedVideo = memorialData.video;
        showVideoPreview(uploadedVideo);
    }
}

// 날짜를 input[type="date"] 형식으로 변환 (YYYY-MM-DD)
function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    // 다양한 날짜 형식을 처리
    let date;
    if (dateString.includes('.')) {
        // "YY. MM. DD" 형식
        const parts = dateString.split('.').map(part => part.trim());
        if (parts.length >= 3) {
            let year = parseInt(parts[0]);
            // 2자리 연도를 4자리로 변환 (50 이상이면 19xx, 미만이면 20xx)
            if (year < 100) {
                year = year >= 50 ? 1900 + year : 2000 + year;
            }
            const month = parseInt(parts[1]);
            const day = parseInt(parts[2]);
            date = new Date(year, month - 1, day);
        }
    } else {
        // ISO 형식이나 다른 형식
        date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) return '';
    
    // YYYY-MM-DD 형식으로 반환
    return date.toISOString().split('T')[0];
}

// input[type="date"]에서 받은 날짜를 표시용 형식으로 변환
function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const year = date.getFullYear().toString().slice(-2); // 2자리 연도
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}. ${month}. ${day}`;
}

// 날짜 입력 필드 설정
function setupDateInputs() {
    const birthDateInput = document.getElementById('birthDate');
    const deathDateInput = document.getElementById('deathDate');
    
    // input type을 date로 변경
    birthDateInput.type = 'date';
    deathDateInput.type = 'date';
    
    // 최대 날짜를 오늘로 설정 (미래 날짜 방지)
    const today = new Date().toISOString().split('T')[0];
    birthDateInput.max = today;
    deathDateInput.max = today;
    
    // 생년월일이 변경되면 사망일의 최소값을 생년월일로 설정
    birthDateInput.addEventListener('change', function() {
        if (this.value) {
            deathDateInput.min = this.value;
            // 만약 사망일이 생년월일보다 이르다면 초기화
            if (deathDateInput.value && deathDateInput.value < this.value) {
                deathDateInput.value = '';
            }
        } else {
            deathDateInput.min = '';
        }
    });
    
    // 사망일이 변경되면 생년월일의 최대값을 사망일로 설정
    deathDateInput.addEventListener('change', function() {
        if (this.value) {
            birthDateInput.max = this.value;
            // 만약 생년월일이 사망일보다 늦다면 초기화
            if (birthDateInput.value && birthDateInput.value > this.value) {
                birthDateInput.value = '';
            }
        } else {
            birthDateInput.max = today;
        }
    });
    
    // 접근성을 위한 placeholder 및 title 설정
    birthDateInput.title = '생년월일을 선택해주세요';
    deathDateInput.title = '사망일을 선택해주세요';
    
    // 모바일에서 더 나은 경험을 위한 추가 속성
    birthDateInput.setAttribute('aria-label', '생년월일 선택');
    deathDateInput.setAttribute('aria-label', '사망일 선택');
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 사진 업로드
    const photoContainer = document.getElementById('photoUploadContainer');
    const photoInput = document.getElementById('photoInput');
    photoContainer.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', handlePhotoUpload);

    // 비디오 업로드
    const videoUploadBtn = document.getElementById('videoUploadBtn');
    const videoInput = document.getElementById('videoInput');
    videoUploadBtn.addEventListener('click', e => {
        e.stopPropagation();
        videoInput.click();
    });
    videoInput.addEventListener('change', handleVideoUpload);

    // 동영상 삭제 버튼 클릭 이벤트 추가
    const deleteVideoBtn = document.getElementById('deleteVideoBtn');
    deleteVideoBtn.addEventListener('click', handleVideoDelete);

    // 폼 제출
    document.getElementById('memorialForm').addEventListener('submit', handleFormSubmit);
}

// 사진 업로드 처리
async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        alert('파일 크기가 너무 큽니다. 10MB 이하의 파일을 선택해주세요.');
        return;
    }
    if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.');
        return;
    }

    try {
        showUploadProgress('photo');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'photo');
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const result = await response.json();
        if (result.success) {
            uploadedPhoto = result.url;
            showPhotoPreview(uploadedPhoto);
        } else {
            alert('업로드 실패: ' + result.error);
        }
    } catch (error) {
        console.error('사진 업로드 실패:', error);
        alert('사진 업로드 중 오류가 발생했습니다.');
    } finally {
        hideUploadProgress('photo');
    }
}

// 비디오 업로드 처리
async function handleVideoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
        alert('파일 크기가 너무 큽니다. 100MB 이하의 파일을 선택해주세요.');
        return;
    }
    if (!file.type.startsWith('video/')) {
        alert('비디오 파일만 업로드 가능합니다.');
        return;
    }

    try {
        showUploadProgress('video');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'video');
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const result = await response.json();
        if (result.success) {
            uploadedVideo = result.url;
            showVideoPreview(uploadedVideo);
        } else {
            alert('업로드 실패: ' + result.error);
        }
    } catch (error) {
        console.error('비디오 업로드 실패:', error);
        alert('비디오 업로드 중 오류가 발생했습니다.');
    } finally {
        hideUploadProgress('video');
    }
}

// 동영상 삭제 처리
function handleVideoDelete() {
    uploadedVideo = null;

    const previewVideo = document.getElementById('previewVideo');
    const placeholder = document.getElementById('videoUploadPlaceholder');
    const deleteBtn = document.getElementById('deleteVideoBtn');

    previewVideo.src = '';
    previewVideo.style.display = 'none';
    deleteBtn.style.display = 'none';
    placeholder.style.display = 'block';

    // 비디오 input 값 초기화 (선택 취소 효과)
    document.getElementById('videoInput').value = '';
}

// 사진 미리보기 표시
function showPhotoPreview(url) {
    const previewPhoto = document.getElementById('previewPhoto');
    const placeholder = document.getElementById('uploadPlaceholder');
    previewPhoto.src = url;
    previewPhoto.style.display = 'block';
    placeholder.style.display = 'none';
}

// 비디오 미리보기 표시
function showVideoPreview(url) {
    const previewVideo = document.getElementById('previewVideo');
    const placeholder = document.getElementById('videoUploadPlaceholder');
    const deleteBtn = document.getElementById('deleteVideoBtn');

    previewVideo.src = url;
    previewVideo.style.display = 'block';
    placeholder.style.display = 'none';
    deleteBtn.style.display = 'inline-block';
}

// 업로드 진행 표시
function showUploadProgress(type) {
    const container = type === 'photo' 
        ? document.getElementById('photoUploadContainer') 
        : document.getElementById('videoUploadContainer');
    container.classList.add('loading');
}

// 업로드 진행 숨기기
function hideUploadProgress(type) {
    const container = type === 'photo' 
        ? document.getElementById('photoUploadContainer') 
        : document.getElementById('videoUploadContainer');
    container.classList.remove('loading');
}

// 날짜 유효성 검사
function validateDates() {
    const birthDate = document.getElementById('birthDate').value;
    const deathDate = document.getElementById('deathDate').value;
    
    if (!birthDate || !deathDate) {
        return { valid: false, message: '생년월일과 사망일을 모두 선택해주세요.' };
    }
    
    const birth = new Date(birthDate);
    const death = new Date(deathDate);
    const today = new Date();
    
    // 미래 날짜 체크
    if (birth > today || death > today) {
        return { valid: false, message: '미래 날짜는 선택할 수 없습니다.' };
    }
    
    // 생년월일이 사망일보다 늦은지 체크
    if (birth >= death) {
        return { valid: false, message: '생년월일은 사망일보다 이전이어야 합니다.' };
    }
    
    // 나이가 너무 많은지 체크 (150세 제한)
    const ageInYears = (death - birth) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageInYears > 150) {
        return { valid: false, message: '입력된 날짜로 계산된 나이가 너무 많습니다. 날짜를 다시 확인해주세요.' };
    }
    
    return { valid: true };
}

// 폼 제출 처리
async function handleFormSubmit(event) {
    event.preventDefault();

    // 필수 필드 체크
    const requiredFields = ['fullName', 'birthDate', 'deathDate', 'epitaph', 'lastWords'];
    const missing = [];
    for (const id of requiredFields) {
        const element = document.getElementById(id);
        if (!element.value.trim()) {
            missing.push(document.querySelector(`label[for=${id}]`).textContent);
        }
    }
    if (missing.length) {
        alert('다음 필드를 입력해주세요:\n' + missing.join('\n'));
        return;
    }

    // 날짜 유효성 검사
    const dateValidation = validateDates();
    if (!dateValidation.valid) {
        alert(dateValidation.message);
        return;
    }

    if (!uploadedPhoto) {
        alert('사진을 업로드해주세요.');
        return;
    }

    const formData = {
        name: document.getElementById('fullName').value.trim(),
        birthDate: document.getElementById('birthDate').value, // 이미 YYYY-MM-DD 형식
        deathDate: document.getElementById('deathDate').value, // 이미 YYYY-MM-DD 형식
        epitaph: document.getElementById('epitaph').value.trim(),
        lastWords: document.getElementById('lastWords').value.trim(),
        photo: uploadedPhoto,
        video: uploadedVideo
    };

    try {
        const saveBtn = document.querySelector('.save-btn');
        saveBtn.disabled = true;
        saveBtn.classList.add('loading');

        const response = await fetch('/api/save_memorial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            alert('저장되었습니다!');
            window.location.href = '/';
        } else {
            alert('저장 실패: ' + result.error);
        }
    } catch (error) {
        console.error('저장 실패:', error);
        alert('저장 중 오류가 발생했습니다.');
    } finally {
        const saveBtn = document.querySelector('.save-btn');
        saveBtn.disabled = false;
        saveBtn.classList.remove('loading');
    }
}

// 메인으로 돌아가기
function goToMain() {
    if (confirm('저장하지 않은 변경사항이 있을 수 있습니다. 정말 나가시겠습니까?')) {
        window.location.href = '/';
    }
}

// 날짜 포맷 유틸리티 함수들 (필요시 사용)
const DateUtils = {
    // 나이 계산
    calculateAge: function(birthDate, deathDate) {
        const birth = new Date(birthDate);
        const death = new Date(deathDate);
        const ageInYears = Math.floor((death - birth) / (365.25 * 24 * 60 * 60 * 1000));
        return ageInYears;
    },
    
    // 한국어 날짜 형식으로 변환 (YYYY년 MM월 DD일)
    toKoreanDate: function(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        return `${year}년 ${month}월 ${day}일`;
    },
    
    // 상대적 날짜 표현 (예: "3년 전")
    getRelativeTime: function(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now - date;
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        
        if (diffInDays === 0) return '오늘';
        if (diffInDays === 1) return '어제';
        if (diffInDays < 30) return `${diffInDays}일 전`;
        if (diffInDays < 365) return `${Math.floor(diffInDays / 30)}개월 전`;
        return `${Math.floor(diffInDays / 365)}년 전`;
    }
};