let selectionTimeout;
let translatePopup = null;
let lastMousePosition = { x: 0, y: 0 };
let targetLanguage = 'tr';

// Global fonksiyonları tanımla
window.translateTools = {
    speak: function(text, lang) {
        chrome.runtime.sendMessage({
            action: 'speak',
            text: text,
            lang: lang
        });
    },
    copy: function(text) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Metin kopyalandı');
        }).catch(err => {
            console.error('Kopyalama hatası:', err);
            showNotification('Kopyalama başarısız', 'error');
        });
    },
    share: async function(text) {
        if (navigator.share) {
            try {
                await navigator.share({ text: text });
                showNotification('Metin paylaşıldı');
            } catch (error) {
                console.error('Paylaşma hatası:', error);
                showNotification('Paylaşma başarısız', 'error');
            }
        } else {
            this.copy(text);
        }
    },
    capture: async function() {
        try {
            const imageUrl = await captureScreen();
            return imageUrl;
        } catch (error) {
            console.error('Ekran görüntüsü hatası:', error);
            showNotification('Ekran görüntüsü alınamadı', 'error');
        }
    },
    ocr: async function() {
        try {
            const imageUrl = await captureScreen();
            const text = await performOCR(imageUrl);
            if (text) {
                translateText(text);
            }
        } catch (error) {
            console.error('OCR hatası:', error);
            showNotification('OCR işlemi başarısız', 'error');
        }
    },
    addFlashcard: function(originalText, translatedText, fromLang, toLang) {
        const flashcard = {
            id: Date.now(),
            originalText,
            translatedText,
            fromLang,
            toLang,
            createdAt: new Date().toISOString(),
            lastReviewed: null,
            reviewCount: 0,
            confidence: 0
        };

        chrome.storage.local.get(['flashcards'], (result) => {
            const flashcards = result.flashcards || [];
            const exists = flashcards.some(card => 
                card.originalText === originalText && 
                card.fromLang === fromLang && 
                card.toLang === toLang
            );

            if (!exists) {
                flashcards.push(flashcard);
                chrome.storage.local.set({ flashcards }, () => {
                    showNotification('Kelime kartı eklendi');
                });
            } else {
                showNotification('Bu kelime kartı zaten mevcut');
            }
        });
    }
};

// Hedef dili yükle
chrome.storage.sync.get(['targetLang'], (result) => {
    if (result.targetLang) {
        targetLanguage = result.targetLang;
    }
});

// Fare konumunu takip et
document.addEventListener('mousemove', (e) => {
    lastMousePosition.x = e.clientX;
    lastMousePosition.y = e.clientY;
});

// Seçim değiştiğinde tetiklenecek fonksiyon
document.addEventListener('mouseup', () => {
    setTimeout(() => {
        const selectedText = window.getSelection().toString().trim();
        if (selectedText && !translatePopup) {
            showTranslateIcon(selectedText);
        }
    }, 100);
});

// Çeviri ikonunu göster
function showTranslateIcon(text) {
    if (translatePopup) {
        translatePopup.remove();
    }

    translatePopup = document.createElement('div');
    translatePopup.style.cssText = `
        position: fixed;
        top: ${lastMousePosition.y - 10}px;
        left: ${lastMousePosition.x + 10}px;
        background: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        cursor: pointer;
        z-index: 999999;
        user-select: none;
        transition: transform 0.2s;
        background-image: url('${chrome.runtime.getURL('assets/icon48.png')}');
        background-size: 16px;
        background-position: center;
        background-repeat: no-repeat;
    `;

    // İkon yüklenemezse yedek stil
    translatePopup.addEventListener('error', () => {
        translatePopup.style.backgroundColor = '#4285f4';
        translatePopup.style.color = 'white';
        translatePopup.style.display = 'flex';
        translatePopup.style.alignItems = 'center';
        translatePopup.style.justifyContent = 'center';
        translatePopup.innerHTML = 'T';
    });

    translatePopup.addEventListener('mouseover', () => {
        translatePopup.style.transform = 'scale(1.1)';
    });

    translatePopup.addEventListener('mouseout', () => {
        translatePopup.style.transform = 'scale(1)';
    });

    translatePopup.addEventListener('click', (e) => {
        e.stopPropagation();
        translateText(text);
    });

    document.body.appendChild(translatePopup);

    // Sayfa tıklamasında ikonu kaldır
    const handleClick = (e) => {
        if (e.target !== translatePopup) {
            translatePopup.remove();
            translatePopup = null;
            document.removeEventListener('click', handleClick);
        }
    };

    setTimeout(() => {
        document.addEventListener('click', handleClick);
    }, 100);
}

// Metni çevir ve sonucu göster
async function translateText(text) {
    try {
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`);
        const data = await response.json();
        const translatedText = data[0][0][0];
        const detectedLang = data[2];

        // Çeviriyi geçmişe ekle
        chrome.runtime.sendMessage({
            action: 'addToHistory',
            originalText: text,
            translatedText: translatedText,
            fromLang: detectedLang,
            toLang: targetLanguage
        });

        showTranslationResult(text, translatedText, detectedLang);
    } catch (error) {
        console.error('Çeviri hatası:', error);
        showTranslationResult(text, 'Çeviri yapılırken bir hata oluştu.', '');
    }
}

// Çeviri sonucunu gösteren kutu
function showTranslationResult(originalText, translatedText, detectedLang) {
    // Tema ayarını al
    chrome.storage.sync.get(['theme'], (result) => {
        const isDarkMode = result.theme === 'dark' || 
            (result.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

        const resultBox = document.createElement('div');
        resultBox.style.cssText = `
            position: fixed;
            top: ${lastMousePosition.y + 20}px;
            left: ${lastMousePosition.x + 20}px;
            background: ${isDarkMode ? '#1a1a1a' : 'white'};
            padding: 0;
            border-radius: 12px;
            box-shadow: ${isDarkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.12)'} 0px 2px 12px;
            z-index: 999999;
            min-width: 300px;
            min-height: 100px;
            max-width: 800px;
            max-height: 600px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            user-select: none;
            overflow: hidden;
            animation: slideIn 0.2s ease-out;
            color: ${isDarkMode ? '#fff' : '#2c3e50'};
        `;

        const languages = {
            en: 'İngilizce',
            tr: 'Türkçe',
            de: 'Almanca',
            fr: 'Fransızca',
            es: 'İspanyolca',
            it: 'İtalyanca',
            ru: 'Rusça',
            ar: 'Arapça',
            ja: 'Japonca',
            ko: 'Korece'
        };

        // String'lerdeki özel karakterleri escape et
        const escapedOriginal = originalText.replace(/'/g, "\\'").replace(/"/g, '\\"');
        const escapedTranslated = translatedText.replace(/'/g, "\\'").replace(/"/g, '\\"');

        resultBox.innerHTML = `
            <style>
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .translate-header {
                    padding: 12px;
                    border-bottom: 1px solid ${isDarkMode ? '#333' : '#eef0f1'};
                    position: relative;
                    cursor: move;
                    background: ${isDarkMode ? '#1a1a1a' : 'white'};
                }
                .translate-body {
                    padding: 12px;
                    background: ${isDarkMode ? '#242424' : '#f8f9fa'};
                    max-height: 400px;
                    overflow-y: auto;
                    overflow-x: hidden;
                }
                .translate-body::-webkit-scrollbar {
                    width: 8px;
                }
                .translate-body::-webkit-scrollbar-track {
                    background: ${isDarkMode ? '#333' : '#f1f1f1'};
                    border-radius: 4px;
                }
                .translate-body::-webkit-scrollbar-thumb {
                    background: ${isDarkMode ? '#666' : '#888'};
                    border-radius: 4px;
                }
                .translate-body::-webkit-scrollbar-thumb:hover {
                    background: ${isDarkMode ? '#888' : '#666'};
                }
                .lang-label {
                    color: ${isDarkMode ? '#aaa' : '#666'};
                    font-size: 11px;
                    margin-bottom: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .text-content {
                    font-size: 14px;
                    line-height: 1.5;
                    color: ${isDarkMode ? '#fff' : '#2c3e50'};
                    user-select: text;
                }
                .close-btn {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border-radius: 50%;
                    opacity: 0.6;
                    transition: all 0.2s;
                    font-size: 14px;
                    color: ${isDarkMode ? '#fff' : '#000'};
                }
                .close-btn:hover {
                    opacity: 1;
                    background: ${isDarkMode ? '#333' : '#f0f0f0'};
                }
                .resize-handle {
                    position: absolute;
                    right: 0;
                    bottom: 0;
                    width: 20px;
                    height: 20px;
                    cursor: se-resize;
                    background: linear-gradient(135deg, transparent 50%, ${isDarkMode ? '#444' : '#ccc'} 50%);
                    z-index: 1000000;
                }
                .translate-tools {
                    padding: 8px 12px;
                    border-top: 1px solid ${isDarkMode ? '#333' : '#eef0f1'};
                    display: flex;
                    gap: 8px;
                    background: ${isDarkMode ? '#1a1a1a' : 'white'};
                }
                .tool-btn {
                    padding: 6px 12px;
                    border: 1px solid ${isDarkMode ? '#444' : '#ddd'};
                    border-radius: 4px;
                    background: ${isDarkMode ? '#333' : '#f8f9fa'};
                    color: ${isDarkMode ? '#fff' : '#333'};
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    transition: all 0.2s;
                }
                .tool-btn:hover {
                    background: ${isDarkMode ? '#444' : '#eee'};
                }
                .tool-btn.active {
                    background: #4285F4;
                    color: white;
                    border-color: #4285F4;
                }
            </style>
            <div class="translate-header">
                <div class="lang-label">
                    ${languages[detectedLang] || 'Algılanan Dil'} → ${languages[targetLanguage]}
                </div>
                <div class="text-content">${originalText}</div>
                <div class="close-btn">✕</div>
            </div>
            <div class="translate-body">
                <div class="text-content">${translatedText}</div>
            </div>
            <div class="resize-handle"></div>
            <div class="translate-tools">
                <button class="tool-btn speak-original">Orijinal</button>
                <button class="tool-btn speak-translated">🔊 Çeviri</button>
                <button class="tool-btn copy">📋 Kopyala</button>
                <button class="tool-btn share">📤 Paylaş</button>
                <button class="tool-btn capture">📷 Ekran Görüntüsü</button>
                <button class="tool-btn ocr">👁️ Metni Tanı (OCR)</button>
                <button class="tool-btn add-flashcard">📝 Kelime Kartı Ekle</button>
            </div>
        `;

        document.body.appendChild(resultBox);

        // Buton event listener'ları
        resultBox.querySelector('.speak-original').addEventListener('click', () => {
            speakText(originalText, detectedLang);
        });

        resultBox.querySelector('.speak-translated').addEventListener('click', () => {
            speakText(translatedText, targetLanguage);
        });

        resultBox.querySelector('.copy').addEventListener('click', () => {
            copyToClipboard(translatedText);
        });

        resultBox.querySelector('.share').addEventListener('click', () => {
            shareText(translatedText);
        });

        resultBox.querySelector('.capture').addEventListener('click', () => {
            captureScreen();
        });

        resultBox.querySelector('.ocr').addEventListener('click', () => {
            startOCR();
        });

        resultBox.querySelector('.add-flashcard').addEventListener('click', () => {
            addToFlashcards(originalText, translatedText, detectedLang, targetLanguage);
        });

        // Sürükleme işlevselliği
        let isDragging = false;
        let isResizing = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        let initialWidth;
        let initialHeight;

        const dragStart = (e) => {
            if (e.target.classList.contains('close-btn') || e.target.classList.contains('resize-handle')) return;
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target.closest('.translate-header')) {
                isDragging = true;
            }
        };

        const dragEnd = () => {
            isDragging = false;
            isResizing = false;
            initialX = currentX;
            initialY = currentY;
        };

        const drag = (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;

                resultBox.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        };

        // Yeniden boyutlandırma işlevselliği
        const resizeStart = (e) => {
            if (e.target.classList.contains('resize-handle')) {
                isResizing = true;
                initialWidth = resultBox.offsetWidth;
                initialHeight = resultBox.offsetHeight;
                initialX = e.clientX;
                initialY = e.clientY;
            }
        };

        const resize = (e) => {
            if (isResizing) {
                e.preventDefault();
                const width = initialWidth + (e.clientX - initialX);
                const height = initialHeight + (e.clientY - initialY);

                if (width >= 300 && width <= 800) {
                    resultBox.style.width = `${width}px`;
                }
                if (height >= 100 && height <= 600) {
                    resultBox.style.height = `${height}px`;
                }
            }
        };

        // Event listener'lar
        resultBox.querySelector('.translate-header').addEventListener('mousedown', dragStart);
        resultBox.querySelector('.resize-handle').addEventListener('mousedown', resizeStart);
        document.addEventListener('mousemove', (e) => {
            drag(e);
            resize(e);
        });
        document.addEventListener('mouseup', dragEnd);

        // Kapatma düğmesi işlevselliği
        resultBox.querySelector('.close-btn').addEventListener('click', () => {
            resultBox.remove();
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', dragEnd);
        });

        // Dışarı tıklandığında kapat
        document.addEventListener('click', function closeCard(e) {
            if (!resultBox.contains(e.target) && e.target !== translatePopup) {
                resultBox.remove();
                // Sürükleme event listener'larını temizle
                document.removeEventListener('mousemove', drag);
                document.removeEventListener('mouseup', dragEnd);
                document.removeEventListener('click', closeCard);
            }
        });

        // ESC tuşu ile kapatma
        document.addEventListener('keydown', function escClose(e) {
            if (e.key === 'Escape') {
                resultBox.remove();
                // Sürükleme event listener'larını temizle
                document.removeEventListener('mousemove', drag);
                document.removeEventListener('mouseup', dragEnd);
                document.removeEventListener('keydown', escClose);
            }
        });
    });
}

// Mesajları dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translateText") {
        translateText(request.text);
    }
    else if (request.action === "translateSelection") {
        const selectedText = window.getSelection().toString().trim();
        if (selectedText) {
            translateText(selectedText);
        }
    }
    else if (request.action === "translatePage") {
        const bodyText = document.body.innerText;
        translateText(bodyText);
    }
});

// Kısayol tuşları için klavye dinleyicisi
document.addEventListener('keydown', (e) => {
    // Alt+X ile son çeviriyi kapat
    if (e.altKey && e.key === 'x') {
        const resultBox = document.querySelector('.translate-result');
        if (resultBox) {
            resultBox.remove();
        }
    }

    // Alt+C ile son çeviriyi kopyala
    if (e.altKey && e.key === 'c') {
        const translatedText = document.querySelector('.translate-body .text-content');
        if (translatedText) {
            navigator.clipboard.writeText(translatedText.textContent);
            showNotification('Çeviri kopyalandı');
        }
    }
});

// Bildirim göster
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ff4444' : '#333'};
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 1000000;
        animation: fadeInOut 2s ease-in-out;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    const icon = type === 'error' ? '❌' : '✅';
    notification.innerHTML = `${icon} ${message}`;
    
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 2000);
}

// Stil ekle
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(20px); }
        20% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-20px); }
    }
`;
document.head.appendChild(style);

// TTS fonksiyonu
function speakText(text, lang) {
    chrome.runtime.sendMessage({
        action: 'speak',
        text: text,
        lang: lang
    });
}

// OCR fonksiyonu
async function performOCR(imageUrl) {
    try {
        showNotification('Metin tanıma başladı...');
        
        const response = await chrome.runtime.sendMessage({
            action: 'getApiKey'
        });
        
        const apiKey = response.apiKey;
        
        const ocrResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
            method: 'POST',
            body: JSON.stringify({
                requests: [{
                    image: {
                        content: imageUrl.split(',')[1]
                    },
                    features: [{
                        type: 'TEXT_DETECTION'
                    }]
                }]
            })
        });

        const result = await ocrResponse.json();
        if (result.responses[0].fullTextAnnotation) {
            return result.responses[0].fullTextAnnotation.text;
        }
        throw new Error('Metin bulunamadı');
    } catch (error) {
        console.error('OCR hatası:', error);
        showNotification('Metin tanıma başarısız', 'error');
        throw error;
    }
}

// Ekran görüntüsü alma
async function captureScreen() {
    try {
        // Kullanıcıdan izin iste
        const stream = await navigator.mediaDevices.getDisplayMedia({
            preferCurrentTab: true,  // Eklendi
            video: {
                mediaSource: "screen",
                cursor: "always"     // Eklendi
            }
        });
        
        const video = document.createElement('video');
        video.srcObject = stream;
        
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                resolve();
            };
        });

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        // Stream'i temizle
        stream.getTracks().forEach(track => track.stop());
        
        return canvas.toDataURL('image/png');
    } catch (error) {
        if (error.name === 'NotAllowedError') {
            showNotification('Ekran görüntüsü izni reddedildi', 'error');
        } else {
            console.error('Ekran görüntüsü hatası:', error);
            showNotification('Ekran görüntüsü alınamadı', 'error');
        }
        throw error;
    }
}

// Kopyalama fonksiyonu
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Metin kopyalandı');
    }).catch(err => {
        console.error('Kopyalama hatası:', err);
        showNotification('Kopyalama başarısız', 'error');
    });
}

// Paylaşma fonksiyonu
async function shareText(text) {
    if (navigator.share) {
        try {
            await navigator.share({
                text: text
            });
            showNotification('Metin paylaşıldı');
        } catch (error) {
            console.error('Paylaşma hatası:', error);
            showNotification('Paylaşma başarısız', 'error');
        }
    } else {
        copyToClipboard(text);
    }
}

// Metin biçimlendirme fonksiyonları
function formatText(text, type) {
    switch(type) {
        case 'uppercase':
            return text.toUpperCase();
        case 'lowercase':
            return text.toLowerCase();
        case 'capitalize':
            return text.replace(/\b\w/g, l => l.toUpperCase());
        case 'remove-spaces':
            return text.replace(/\s+/g, ' ').trim();
        default:
            return text;
    }
}

// Stil güncellemeleri
const additionalStyles = `
    .screenshot-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 1000000;
        cursor: crosshair;
    }
    .screenshot-guide {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 10px 20px;
        border-radius: 20px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 1000001;
        font-size: 14px;
    }
`;

// Mevcut style elementine yeni stilleri ekle
style.textContent += additionalStyles;

// Kelime kartı ekleme
function addToFlashcards(originalText, translatedText, fromLang, toLang) {
    const flashcard = {
        id: Date.now(),
        originalText,
        translatedText,
        fromLang,
        toLang,
        createdAt: new Date().toISOString(),
        lastReviewed: null,
        reviewCount: 0,
        confidence: 0
    };

    chrome.storage.local.get(['flashcards'], (result) => {
        const flashcards = result.flashcards || [];
        const exists = flashcards.some(card => 
            card.originalText === originalText && 
            card.fromLang === fromLang && 
            card.toLang === toLang
        );

        if (!exists) {
            flashcards.push(flashcard);
            chrome.storage.local.set({ flashcards }, () => {
                showNotification('Kelime kartı eklendi');
            });
        } else {
            showNotification('Bu kelime kartı zaten mevcut');
        }
    });
}

// OCR başlatma fonksiyonu
async function startOCR() {
    try {
        const imageUrl = await captureScreen();
        const text = await performOCR(imageUrl);
        if (text) {
            translateText(text);
        }
    } catch (error) {
        console.error('OCR hatası:', error);
        showNotification('OCR işlemi başarısız', 'error');
    }
} 