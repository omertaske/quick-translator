document.addEventListener('DOMContentLoaded', () => {
    // Kaydedilmiş ayarları yükle
    chrome.storage.sync.get(['targetLang', 'theme'], (result) => {
        if (result.targetLang) {
            document.getElementById('targetLang').value = result.targetLang;
        }
        if (result.theme) {
            document.getElementById('themeSelect').value = result.theme;
            applyTheme(result.theme);
        }
    });

    // Tema değişikliğini dinle
    document.getElementById('themeSelect').addEventListener('change', (e) => {
        applyTheme(e.target.value);
    });

    // Ayarları kaydet
    document.getElementById('saveSettings').addEventListener('click', () => {
        const targetLang = document.getElementById('targetLang').value;
        const theme = document.getElementById('themeSelect').value;

        chrome.storage.sync.set({ 
            targetLang,
            theme
        }, () => {
            const btn = document.getElementById('saveSettings');
            btn.textContent = 'Kaydedildi!';
            setTimeout(() => {
                btn.textContent = 'Kaydet';
            }, 1500);
        });
    });

    displayHistory();
    loadFlashcards();
    loadStatistics();
    loadAppearanceSettings();
});

function applyTheme(theme) {
    if (theme === 'system') {
        // Sistem temasını kontrol et
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    } else if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

// Geçmiş ve favorileri göster
function displayHistory() {
    const historyContainer = document.getElementById('historyContainer');
    
    chrome.storage.local.get(['translationHistory'], (result) => {
        const history = result.translationHistory || [];
        
        historyContainer.innerHTML = history.map(item => `
            <div class="history-item">
                <div class="history-text">
                    <div>${item.originalText}</div>
                    <div style="color: #666;">${item.translatedText}</div>
                </div>
                <div class="history-actions">
                    <button onclick="toggleFavorite(${item.id})" title="Favorilere Ekle">
                        ${item.isFavorite ? '⭐' : '☆'}
                    </button>
                    <button onclick="copyTranslation('${item.translatedText}')" title="Kopyala">
                        📋
                    </button>
                    <button onclick="speakText('${item.translatedText}', '${item.toLang}')" title="Seslendir">
                        🔊
                    </button>
                </div>
            </div>
        `).join('');
    });
}

// Favorilere ekle/çıkar
function toggleFavorite(id) {
    chrome.runtime.sendMessage({
        action: 'toggleFavorite',
        id: id
    }, () => {
        displayHistory(); // Listeyi güncelle
    });
}

// Metni kopyala
function copyTranslation(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Metin kopyalandı');
    });
}

// Bildirim göster
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 10px 20px;
        border-radius: 4px;
        color: white;
        font-size: 14px;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        background: ${type === 'error' ? '#ff4444' : '#4CAF50'};
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Kelime kartları yönetimi
let currentFlashcard = null;
let flashcards = [];

function loadFlashcards() {
    chrome.storage.local.get(['flashcards', 'dailyGoal', 'dailyProgress'], (result) => {
        flashcards = result.flashcards || [];
        const dailyGoal = result.dailyGoal || 10;
        const dailyProgress = result.dailyProgress || 0;

        // İstatistikleri güncelle
        document.getElementById('learnedWords').textContent = flashcards.length;
        document.getElementById('dailyGoal').textContent = dailyGoal;

        // İlerleme çubuğunu güncelle
        const progressBar = document.querySelector('.progress-fill');
        if (progressBar) {
            progressBar.style.width = `${(dailyProgress / dailyGoal) * 100}%`;
        }

        // Kelime listesini güncelle
        updateWordList();
    });
}

function updateWordList() {
    const wordList = document.getElementById('wordList');
    if (!wordList) return;

    wordList.innerHTML = flashcards.map(card => `
        <div class="word-item" data-id="${card.id}">
            <div class="word-text">
                <div class="word-original">${card.originalText}</div>
                <div class="word-translation">${card.translatedText}</div>
            </div>
            <div class="word-actions">
                <button onclick="reviewCard(${card.id})" title="Tekrar Et">🔄</button>
                <button onclick="deleteCard(${card.id})" title="Sil">🗑️</button>
                <div class="confidence-indicator" style="color: ${getConfidenceColor(card.confidence)}">
                    ●
                </div>
            </div>
        </div>
    `).join('');
}

function getConfidenceColor(confidence) {
    if (confidence < 30) return '#ff4444';
    if (confidence < 70) return '#ffaa00';
    return '#44ff44';
}

function reviewCard(cardId) {
    const card = flashcards.find(c => c.id === cardId);
    if (!card) return;

    const flashcardContainer = document.createElement('div');
    flashcardContainer.className = 'flash-card';
    flashcardContainer.innerHTML = `
        <div class="flash-card-inner">
            <div class="flash-card-front">
                <div class="card-content">
                    <div class="card-text">${card.originalText}</div>
                    <div class="card-hint">Çevirmek için tıkla</div>
                </div>
            </div>
            <div class="flash-card-back">
                <div class="card-content">
                    <div class="card-text">${card.translatedText}</div>
                    <div class="confidence-buttons">
                        <button onclick="updateConfidence(${card.id}, 'low')">Zor</button>
                        <button onclick="updateConfidence(${card.id}, 'medium')">Orta</button>
                        <button onclick="updateConfidence(${card.id}, 'high')">Kolay</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Mevcut kartı kaldır
    const existingCard = document.querySelector('.flash-card');
    if (existingCard) {
        existingCard.remove();
    }

    document.body.appendChild(flashcardContainer);
    currentFlashcard = card;

    // Kartı çevirmek için tıklama
    flashcardContainer.addEventListener('click', () => {
        flashcardContainer.classList.toggle('flipped');
    });
}

function updateConfidence(cardId, level) {
    const confidenceLevels = {
        low: 30,
        medium: 70,
        high: 100
    };

    chrome.storage.local.get(['flashcards', 'dailyProgress'], (result) => {
        const flashcards = result.flashcards || [];
        const dailyProgress = (result.dailyProgress || 0) + 1;
        
        const cardIndex = flashcards.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            flashcards[cardIndex].confidence = confidenceLevels[level];
            flashcards[cardIndex].lastReviewed = new Date().toISOString();
            flashcards[cardIndex].reviewCount++;

            chrome.storage.local.set({ 
                flashcards,
                dailyProgress
            }, () => {
                loadFlashcards();
                const flashcardContainer = document.querySelector('.flash-card');
                if (flashcardContainer) {
                    flashcardContainer.remove();
                }
            });
        }
    });
}

function deleteCard(cardId) {
    if (confirm('Bu kelime kartını silmek istediğinizden emin misiniz?')) {
        chrome.storage.local.get(['flashcards'], (result) => {
            const flashcards = result.flashcards || [];
            const updatedFlashcards = flashcards.filter(c => c.id !== cardId);
            
            chrome.storage.local.set({ flashcards: updatedFlashcards }, () => {
                loadFlashcards();
            });
        });
    }
}

// Günlük hedef düzenleme
document.getElementById('editGoal').addEventListener('click', () => {
    const currentGoal = parseInt(document.getElementById('dailyGoal').textContent);
    const newGoal = prompt('Yeni günlük hedef:', currentGoal);
    
    if (newGoal && !isNaN(newGoal) && newGoal > 0) {
        chrome.storage.local.set({ dailyGoal: parseInt(newGoal) }, () => {
            loadFlashcards();
        });
    }
});

// İstatistik yönetimi
function loadStatistics() {
    chrome.storage.local.get([
        'totalTranslations',
        'todayTranslations',
        'lastTranslationDate',
        'flashcards',
        'dailyGoal',
        'dailyProgress',
        'userRating',
        'feedbackHistory'
    ], (result) => {
        // Bugünün tarihini kontrol et ve gerekirse sıfırla
        const today = new Date().toDateString();
        if (result.lastTranslationDate !== today) {
            chrome.storage.local.set({
                todayTranslations: 0,
                dailyProgress: 0,
                lastTranslationDate: today
            });
            result.todayTranslations = 0;
            result.dailyProgress = 0;
        }

        // İstatistikleri güncelle
        document.getElementById('totalTranslations').textContent = result.totalTranslations || 0;
        document.getElementById('todayTranslations').textContent = result.todayTranslations || 0;
        document.getElementById('totalFlashcards').textContent = (result.flashcards || []).length;
        document.getElementById('learnedFlashcards').textContent = 
            (result.flashcards || []).filter(card => card.confidence >= 70).length;

        // İlerleme çubuğunu güncelle
        const dailyGoal = result.dailyGoal || 10;
        const dailyProgress = result.dailyProgress || 0;
        const progressPercent = Math.min((dailyProgress / dailyGoal) * 100, 100);

        document.getElementById('dailyProgressBar').style.width = `${progressPercent}%`;
        document.getElementById('progressPercent').textContent = `${Math.round(progressPercent)}%`;
        document.getElementById('progressCount').textContent = `${dailyProgress}/${dailyGoal}`;

        // Önceki derecelendirmeyi yükle
        if (result.userRating) {
            setRating(result.userRating);
        }
    });
}

// Yıldız derecelendirme sistemi
let currentRating = 0;
const stars = document.querySelectorAll('.star');

stars.forEach(star => {
    star.addEventListener('mouseover', (e) => {
        const rating = e.target.dataset.rating;
        highlightStars(rating);
    });

    star.addEventListener('mouseout', () => {
        highlightStars(currentRating);
    });

    star.addEventListener('click', (e) => {
        const rating = e.target.dataset.rating;
        currentRating = rating;
        setRating(rating);
        chrome.storage.local.set({ userRating: rating });
    });
});

function highlightStars(rating) {
    stars.forEach(star => {
        const starRating = star.dataset.rating;
        star.classList.toggle('active', starRating <= rating);
    });
}

function setRating(rating) {
    currentRating = rating;
    highlightStars(rating);
}

// Geri bildirim gönderme
document.getElementById('sendFeedback').addEventListener('click', () => {
    const feedbackText = document.getElementById('feedbackText').value.trim();
    if (!feedbackText) {
        showNotification('Lütfen geri bildirim yazın', 'error');
        return;
    }

    const feedback = {
        text: feedbackText,
        rating: currentRating,
        timestamp: new Date().toISOString()
    };

    chrome.storage.local.get(['feedbackHistory'], (result) => {
        const feedbackHistory = result.feedbackHistory || [];
        feedbackHistory.push(feedback);

        chrome.storage.local.set({ feedbackHistory }, () => {
            showNotification('Geri bildiriminiz için teşekkürler!');
            document.getElementById('feedbackText').value = '';
            // İsterseniz burada geri bildirimi bir sunucuya gönderebilirsiniz
        });
    });
});

// İstatistikleri güncelle
function updateStatistics(type) {
    chrome.storage.local.get([
        'totalTranslations',
        'todayTranslations',
        'lastTranslationDate'
    ], (result) => {
        const today = new Date().toDateString();
        const isNewDay = result.lastTranslationDate !== today;

        const updates = {
            totalTranslations: (result.totalTranslations || 0) + 1,
            todayTranslations: isNewDay ? 1 : (result.todayTranslations || 0) + 1,
            lastTranslationDate: today
        };

        chrome.storage.local.set(updates, () => {
            loadStatistics();
        });
    });
}

// Görünüm ayarları yönetimi
function loadAppearanceSettings() {
    chrome.storage.sync.get([
        'fontSize',
        'popupPosition',
        'themeColor',
        'animations',
        'autoClose'
    ], (result) => {
        // Font boyutu
        if (result.fontSize) {
            document.getElementById('fontSize').value = result.fontSize;
            applyFontSize(result.fontSize);
        }

        // Popup konumu
        if (result.popupPosition) {
            document.getElementById('popupPosition').value = result.popupPosition;
        }

        // Tema rengi
        if (result.themeColor) {
            document.getElementById('themeColor').value = result.themeColor;
            applyThemeColor(result.themeColor);
        }

        // Animasyonlar
        if (typeof result.animations !== 'undefined') {
            document.getElementById('animations').checked = result.animations;
            toggleAnimations(result.animations);
        }

        // Otomatik kapatma
        if (result.autoClose) {
            document.getElementById('autoClose').value = result.autoClose;
        }
    });
}

// Font boyutu değişikliğini dinle
document.getElementById('fontSize').addEventListener('change', (e) => {
    const size = e.target.value;
    applyFontSize(size);
    chrome.storage.sync.set({ fontSize: size });
});

// Font boyutunu uygula
function applyFontSize(size) {
    const sizes = {
        small: '12px',
        medium: '14px',
        large: '16px'
    };
    document.documentElement.style.setProperty('--base-font-size', sizes[size]);
}

// Popup konumu değişikliğini dinle
document.getElementById('popupPosition').addEventListener('change', (e) => {
    const position = e.target.value;
    chrome.storage.sync.set({ popupPosition: position });
    // Bu ayar content.js'de çeviri kutusunun konumunu etkileyecek
});

// Tema rengi değişikliğini dinle
document.getElementById('themeColor').addEventListener('change', (e) => {
    const color = e.target.value;
    applyThemeColor(color);
    chrome.storage.sync.set({ themeColor: color });
});

// Tema rengini uygula
function applyThemeColor(color) {
    document.documentElement.style.setProperty('--theme-color', color);
    // Ana rengi ve türevlerini güncelle
    const rgb = hexToRgb(color);
    const darkColor = shadeColor(color, -20); // %20 daha koyu
    const lightColor = shadeColor(color, 20); // %20 daha açık

    document.documentElement.style.setProperty('--theme-color-dark', darkColor);
    document.documentElement.style.setProperty('--theme-color-light', lightColor);
    document.documentElement.style.setProperty('--theme-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
}

// Animasyon değişikliğini dinle
document.getElementById('animations').addEventListener('change', (e) => {
    const enabled = e.target.checked;
    toggleAnimations(enabled);
    chrome.storage.sync.set({ animations: enabled });
});

// Animasyonları aç/kapa
function toggleAnimations(enabled) {
    if (!enabled) {
        document.documentElement.style.setProperty('--animation-duration', '0s');
    } else {
        document.documentElement.style.setProperty('--animation-duration', '0.3s');
    }
}

// Otomatik kapatma değişikliğini dinle
document.getElementById('autoClose').addEventListener('change', (e) => {
    const duration = parseInt(e.target.value);
    chrome.storage.sync.set({ autoClose: duration });
});

// Yardımcı fonksiyonlar
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function shadeColor(color, percent) {
    let R = parseInt(color.substring(1,3), 16);
    let G = parseInt(color.substring(3,5), 16);
    let B = parseInt(color.substring(5,7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R < 255) ? R : 255;
    G = (G < 255) ? G : 255;
    B = (B < 255) ? B : 255;

    const RR = ((R.toString(16).length === 1) ? "0" + R.toString(16) : R.toString(16));
    const GG = ((G.toString(16).length === 1) ? "0" + G.toString(16) : G.toString(16));
    const BB = ((B.toString(16).length === 1) ? "0" + B.toString(16) : B.toString(16));

    return "#" + RR + GG + BB;
}

// Sayfa yüklendiğinde görünüm ayarlarını yükle
document.addEventListener('DOMContentLoaded', () => {
    // ... mevcut kodlar ...
    loadAppearanceSettings();
}); 