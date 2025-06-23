// API_KEY'i doğrudan tanımla
const API_KEY = 'YOUR_API_KEY_HERE';

// Geçmiş ve favorileri yönetmek için
let translationHistory = [];
const MAX_HISTORY_ITEMS = 50;

// Geçmişe çeviri ekle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'addToHistory') {
        const translation = {
            id: Date.now(),
            originalText: request.originalText,
            translatedText: request.translatedText,
            fromLang: request.fromLang,
            toLang: request.toLang,
            timestamp: new Date().toISOString(),
            isFavorite: false
        };

        // Geçmişi storage'dan al
        chrome.storage.local.get(['translationHistory'], (result) => {
            let history = result.translationHistory || [];
            history.unshift(translation);
            if (history.length > MAX_HISTORY_ITEMS) {
                history = history.slice(0, MAX_HISTORY_ITEMS);
            }
            chrome.storage.local.set({ translationHistory: history }, () => {
                sendResponse({ success: true });
            });
        });
        return true;
    }

    if (request.action === 'toggleFavorite') {
        chrome.storage.local.get(['translationHistory'], (result) => {
            let history = result.translationHistory || [];
            const index = history.findIndex(item => item.id === request.id);
            if (index !== -1) {
                history[index].isFavorite = !history[index].isFavorite;
                chrome.storage.local.set({ translationHistory: history });
            }
        });
    }

    if (request.action === 'getApiKey') {
        sendResponse({ apiKey: API_KEY });
    }

    if (request.action === 'speak') {
        chrome.tts.speak(request.text, {
            lang: request.lang,
            rate: 1.0,
            onEvent: function(event) {
                if (event.type === 'error') {
                    console.error('TTS hatası:', event);
                }
            }
        });
    }
});

// Bağlam menüsü oluştur
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "translateSelection",
        title: "Seçili Metni Çevir",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "translatePage",
        title: "Tüm Sayfayı Çevir",
        contexts: ["page"]
    });
});

// Bağlam menüsü tıklamalarını dinle
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "translateSelection") {
        chrome.tabs.sendMessage(tab.id, {
            action: "translateText",
            text: info.selectionText
        });
    }
    else if (info.menuItemId === "translatePage") {
        chrome.tabs.sendMessage(tab.id, {
            action: "translatePage"
        });
    }
});

// Kısayol tuşlarını dinle
chrome.commands.onCommand.addListener((command) => {
    if (command === "translate_selection") {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "translateSelection"
            });
        });
    }
});

// Manifest v2 için chrome.browserAction kullanıyoruz
chrome.browserAction.onClicked.addListener((tab) => {
  // ... kodlar aynı ...
}); 