console.log("--- 스크립트 로드됨 (버전: 2.1) ---");

// State
const state = {
    allRestaurants: [],
    candidates: [],
    currentRotation: 0,
    isSpinning: false,
    selectedRadius: 400 // Default 5min
};

// Colors for Roulette Segments (Sophisticated Theme)
const colors = ['#d1fae5', '#f8fafc']; // Very Soft Emerald & Off-White

// DOM Elements
const elements = {
    // tabs: document.querySelectorAll('.tab-btn'), // Removed
    paramsInput: document.getElementById('params-input'),
    searchBtn: document.getElementById('search-btn'),
    resultsArea: document.getElementById('search-results'),
    selectionSection: document.getElementById('selection-section'),
    selectedName: document.getElementById('selected-name'),
    distanceRadios: document.querySelectorAll('input[name="distance"]'),
    findRestaurantsBtn: document.getElementById('find-restaurants-btn'),

    rouletteSection: document.getElementById('roulette-section'),
    candidateCount: document.getElementById('candidate-count'),
    refreshBtn: document.getElementById('refresh-candidates-btn'),
    canvas: document.getElementById('roulette-canvas'),
    startBtn: document.getElementById('roulette-start-btn')
};

// Constants
const CAFES_CODE = 'CE7';
const RESTAURANT_CODE = 'FD6';
const MAX_CANDIDATES = 15;

// Utilities
function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// Initialize
init();

function init() {
    setupEventListeners();
}

function setupEventListeners() {
    // Mode Switching Removed (Unified Search)

    // Search
    elements.searchBtn.addEventListener('click', () => handleSearch(false));
    elements.paramsInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch(false);
    });

    // Real-time Search
    elements.paramsInput.addEventListener('input', debounce(() => {
        const query = elements.paramsInput.value.trim();
        if (!query) {
            elements.resultsArea.classList.add('hidden');
            return;
        }
        handleSearch(true);
    }, 300));

    // Distance Change
    elements.distanceRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.selectedRadius = parseInt(e.target.value);
        });
    });

    // Find Restaurants
    elements.findRestaurantsBtn.addEventListener('click', fetchRestaurants);

    // Roulette Controls
    elements.refreshBtn.addEventListener('click', refreshCandidates);
    elements.startBtn.addEventListener('click', spinRoulette);
}

function resetSearch() {
    elements.resultsArea.innerHTML = '';
    elements.resultsArea.classList.add('hidden');
    elements.selectionSection.classList.add('hidden');
    elements.rouletteSection.classList.add('hidden');
}

// 1. Search Location (Company/Address)
function handleSearch(isSilent = false) {
    const query = elements.paramsInput.value.trim();
    if (!query) {
        if (!isSilent) alert("검색어를 입력해주세요!");
        return;
    }

    // Check if Kakao API and Services are fully loaded and valid
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
        console.warn("Kakao API Readiness Check failed:");
        console.warn("- window.kakao:", !!window.kakao);
        console.warn("- window.kakao.maps:", window.kakao ? !!window.kakao.maps : "N/A");
        console.warn("- window.kakao.maps.services:", (window.kakao && window.kakao.maps) ? !!window.kakao.maps.services : "N/A");
        console.warn("Check your API Key and registered domains in Kakao Developers console.");

        renderMockLocations(query);
        return;
    }

    try {
        const ps = new kakao.maps.services.Places();
        const geocoder = new kakao.maps.services.Geocoder();

        elements.resultsArea.classList.remove('hidden');
        elements.resultsArea.innerHTML = '<div class="result-item"><p>검색 중...</p></div>';

        // Run both searches: Keyword and Address
        const keywordPromise = new Promise((resolve) => {
            ps.keywordSearch(query, (data, status) => {
                if (status === kakao.maps.services.Status.OK) resolve(data);
                else resolve([]);
            });
        });

        const addressPromise = new Promise((resolve) => {
            geocoder.addressSearch(query, (result, status) => {
                if (status === kakao.maps.services.Status.OK) {
                    const formatted = result.map(item => ({
                        place_name: item.road_address ? item.road_address.building_name || item.address_name : item.address_name,
                        address_name: item.address_name,
                        road_address_name: item.road_address ? item.road_address.address_name : '',
                        x: item.x,
                        y: item.y,
                        isAddress: true // Flag to distinguish
                    }));
                    resolve(formatted);
                } else {
                    resolve([]);
                }
            });
        });

        Promise.all([keywordPromise, addressPromise]).then(([keywords, addresses]) => {
            // Merge results: Addresses first if it looks like an address search, otherwise mixed?
            // Prioritize: If address search returns results, show them at top?
            // Actually, let's just merge. Keyword search is usually broader.

            // Deduplicate? (Simple approach: just concat)
            // But sometimes keyword search returns the building as well.
            // Let's just concat for now.
            const combined = [...addresses, ...keywords];
            renderLocationResults(combined);
        });

    } catch (e) {
        console.error("Kakao API Error:", e);
        renderMockLocations(query);
    }
}

function renderLocationResults(data) {
    elements.resultsArea.classList.remove('hidden'); // Fix: Ensure visible
    elements.resultsArea.innerHTML = '';

    if (data.length === 0) {
        elements.resultsArea.innerHTML = '<div class="result-item"><p>검색 결과가 없습니다.</p></div>';
        return;
    }

    data.forEach(place => {
        const div = document.createElement('div');
        div.className = 'result-item';
        const address = place.road_address_name || place.address_name || '';
        div.innerHTML = `
            <h4>${place.place_name}</h4>
            <p>${address}</p>
        `;

        div.addEventListener('click', () => {
            selectLocation(place);
        });

        elements.resultsArea.appendChild(div);
    });
}

function renderMockLocations(query) {
    elements.resultsArea.classList.remove('hidden');
    elements.resultsArea.innerHTML = '<div class="result-item"><p>가상 데이터 검색 중...</p></div>';

    setTimeout(() => {
        const mocks = [
            { place_name: query + " 본사", address_name: "서울 강남구 테헤란로 123", x: 127.1, y: 37.4 },
            { place_name: query + " 센터", address_name: "성남시 분당구 판교역로 456", x: 127.1, y: 37.4 },
        ];
        renderLocationResults(mocks);
    }, 300);
}

function selectLocation(place) {
    state.selectedLocation = place;
    elements.selectedName.textContent = place.place_name;
    elements.selectionSection.classList.remove('hidden');
    elements.rouletteSection.classList.add('hidden');

    elements.resultsArea.innerHTML = '';
    elements.resultsArea.classList.add('hidden');

    // Scroll to selection
    elements.selectionSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// 2. Fetch Nearby Restaurants
function fetchRestaurants() {
    if (!state.selectedLocation) return;

    const x = state.selectedLocation.x;
    const y = state.selectedLocation.y;
    const radius = state.selectedRadius;

    if (!window.kakao || !window.kakao.maps) {
        generateMockRestaurants();
        return;
    }

    const ps = new kakao.maps.services.Places();

    // Strategy: "Mix & Max"
    // 1. Fetch Top 3 Pages by Accuracy (Popularity) -> ~45 items
    // 2. Fetch Top 1 Page by Distance (Nearest) -> ~15 items
    // Result: ~60 items pool

    const accuracyPromises = [1, 2, 3].map(page => {
        return new Promise(resolve => {
            ps.categorySearch(RESTAURANT_CODE, (data, status) => {
                resolve(status === kakao.maps.services.Status.OK ? data : []);
            }, {
                x: x, y: y, radius: radius,
                useMapBounds: false, size: 15, page: page,
                sort: kakao.maps.services.SortBy.ACCURACY
            });
        });
    });

    const distancePromise = new Promise(resolve => {
        ps.categorySearch(RESTAURANT_CODE, (data, status) => {
            resolve(status === kakao.maps.services.Status.OK ? data : []);
        }, {
            x: x, y: y, radius: radius,
            useMapBounds: false, size: 15, page: 1,
            sort: kakao.maps.services.SortBy.DISTANCE
        });
    });

    Promise.all([...accuracyPromises, distancePromise]).then(results => {
        const rawPlaces = results.flat();

        // Filter out cafes
        let validPlaces = rawPlaces.filter(place => place.category_group_code !== CAFES_CODE);

        // Deduplicate by ID
        const uniquePlaces = [];
        const seenIds = new Set();
        validPlaces.forEach(p => {
            if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                uniquePlaces.push(p);
            }
        });

        if (uniquePlaces.length < 5) {
            alert("주변에 식당이 별로 없네요! 가상의 맛집을 추가합니다.");
            const mocks = getMockRestaurants(MAX_CANDIDATES - uniquePlaces.length);
            state.allRestaurants = [...uniquePlaces, ...mocks];
        } else {
            state.allRestaurants = uniquePlaces;
        }

        console.log(`[맛집 데이터] 총 ${uniquePlaces.length}개 확보 완료`);
        prepareRoulette();
    });
}

function generateMockRestaurants() {
    state.allRestaurants = getMockRestaurants(30);
    prepareRoulette();
}

function getMockRestaurants(count) {
    const names = ["순대국", "김치찌개", "파스타", "소고기", "초밥", "햄버거", "떡볶이", "짬뽕", "백반", "샐러드", "타코", "쌀국수", "카레", "삼겹살", "닭갈비"];
    const results = [];
    for (let i = 0; i < count; i++) {
        const name = names[i % names.length] + " 맛집 " + (i + 1) + "호점";
        results.push({ place_name: name, category_name: '가상 맛집' });
    }
    return results;
}

// 3. Prepare Roulette
function prepareRoulette() {
    refreshCandidates();
    elements.rouletteSection.classList.remove('hidden');
    elements.rouletteSection.scrollIntoView({ behavior: 'smooth' });
}

function refreshCandidates() {
    if (state.allRestaurants.length === 0) return;

    // Add Animation Classes
    const btn = elements.refreshBtn;
    const canvas = elements.canvas;

    // Add spin to the icon inside (or the button itself if no icon span)
    // Let's assume the button text has an emoji we can spin, or spin the whole button?
    // The text is "🔄 후보 새로 고침". Let's spin the button for simplicity or clarity.
    btn.classList.add('spinning');
    canvas.classList.add('fade-out');

    setTimeout(() => {
        // Shuffle and pick 20
        const shuffled = [...state.allRestaurants].sort(() => 0.5 - Math.random());
        state.candidates = shuffled.slice(0, MAX_CANDIDATES);

        elements.candidateCount.textContent = state.candidates.length;
        drawRoulette();

        // Remove Animation Classes
        btn.classList.remove('spinning');
        canvas.classList.remove('fade-out');
    }, 300); // 300ms delay matches transition
}

// 4. Draw Roulette (Canvas)
function drawRoulette() {
    const ctx = elements.canvas.getContext('2d');
    const width = elements.canvas.width;
    const height = elements.canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = width / 2 - 10; // padding

    const len = state.candidates.length;
    const arc = (2 * Math.PI) / len;

    ctx.clearRect(0, 0, width, height);

    // Save context to rotate entire wheel
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.currentRotation);
    ctx.translate(-cx, -cy);

    for (let i = 0; i < len; i++) {
        const angle = i * arc;

        // Slice
        ctx.beginPath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, angle, angle + arc);
        ctx.lineTo(cx, cy);
        ctx.fill();

        ctx.lineWidth = 0.5; // Very fine stroke
        ctx.strokeStyle = "rgba(0,0,0,0.1)"; // Subtle dark line
        ctx.stroke();

        // Text
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + arc / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#1e293b"; // Dark text for contrast
        ctx.font = "bold 14px 'Noto Sans KR'";
        ctx.fillText(state.candidates[i].place_name.substring(0, 8), radius - 10, 5);
        ctx.restore();
    }

    // Draw Outer Border (Thick Dark Ring)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "#475569"; // Slate 600
    ctx.lineWidth = 2; // Reduced from 6
    ctx.stroke();

    // Draw Center Dot
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, 2 * Math.PI);
    ctx.fillStyle = "#475569"; // Match outer ring
    ctx.fill();

    ctx.restore();
}

// 5. Spin Logic
function spinRoulette() {
    if (state.isSpinning) return;

    state.isSpinning = true;
    elements.startBtn.disabled = true;

    // Random spin duration and rotations
    const duration = 5000; // 5 seconds
    const fullRotations = 5 + Math.random() * 5; // 5~10 rotations
    const randomAngle = Math.random() * 2 * Math.PI;
    const targetRotation = state.currentRotation + (fullRotations * 2 * Math.PI) + randomAngle;

    const startTime = performance.now();
    const startRotation = state.currentRotation;
    const changeInRotation = targetRotation - startRotation;

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        if (elapsed < duration) {
            // Easing function (Ease Out Quart)
            const t = elapsed / duration;
            const easeOut = 1 - Math.pow(1 - t, 4);

            state.currentRotation = startRotation + (changeInRotation * easeOut);
            drawRoulette();
            requestAnimationFrame(animate);
        } else {
            // End
            state.currentRotation = targetRotation;
            drawRoulette();
            state.isSpinning = false;
            elements.startBtn.disabled = false;

            showResult();
        }
    }

    requestAnimationFrame(animate);
}

function showResult() {
    // Calculate which index is at the top (Pointer is at 270 degrees or -90 degrees visually)
    // But our canvas 0 is at 3 o'clock.
    // Let's rely on simple math: normalize rotation

    // The pointer is at TOP (3/2 PI or -PI/2)
    // Current Rotation shifts the context.
    // Effective angle of pointer relative to board = (3*PI/2 - currentRotation) % 2PI
    const len = state.candidates.length;
    const arc = (2 * Math.PI) / len;

    // Normalize rotation to 0-2PI
    let normalizedRotation = state.currentRotation % (2 * Math.PI);

    // The pointer is at 270 degrees (Top).
    // To find which segment is under the pointer, we trace back.
    // Segment i spans [i*arc, (i+1)*arc]
    // Rotated segment: [i*arc + rot, (i+1)*arc + rot]
    // We want i such that i*arc + rot <= 1.5*PI <= (i+1)*arc + rot
    // => i*arc <= 1.5*PI - rot

    // Easier way:
    // angleFrom0 = (1.5 * Math.PI - normalizedRotation);
    // if negative, add 2PI
    let angleFrom0 = (1.5 * Math.PI - normalizedRotation) % (2 * Math.PI);
    if (angleFrom0 < 0) angleFrom0 += 2 * Math.PI;

    const index = Math.floor(angleFrom0 / arc);
    const winner = state.candidates[index];

    alert(`🎉 당첨! 오늘의 점심은 [${winner.place_name}] 입니다! \n맛있게 드세요!`);
}
