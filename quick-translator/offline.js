// Çeviri önbelleği
class TranslationCache {
    constructor() {
        this.dbName = 'translationCache';
        this.dbVersion = 1;
        this.storeName = 'translations';
        this.db = null;
    }

    // IndexedDB'yi başlat
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }

    // Çeviriyi önbelleğe ekle
    async addToCache(text, translation, fromLang, toLang) {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const id = this.generateCacheKey(text, fromLang, toLang);
        const entry = {
            id,
            text,
            translation,
            fromLang,
            toLang,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const request = store.put(entry);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(entry);
        });
    }

    // Önbellekten çeviri al
    async getFromCache(text, fromLang, toLang) {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const id = this.generateCacheKey(text, fromLang, toLang);

        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    // Önbelleği temizle
    async clearCache() {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    // Önbellek istatistiklerini al
    async getStats() {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const countRequest = store.count();
            countRequest.onerror = () => reject(countRequest.error);
            countRequest.onsuccess = () => {
                resolve({
                    count: countRequest.result,
                    size: this.estimateCacheSize()
                });
            };
        });
    }

    // Önbellek boyutunu tahmin et
    estimateCacheSize() {
        // Ortalama çeviri boyutu (byte)
        const avgEntrySize = 500;
        return (this.count * avgEntrySize) / (1024 * 1024); // MB cinsinden
    }

    // Önbellek anahtarı oluştur
    generateCacheKey(text, fromLang, toLang) {
        return `${text}_${fromLang}_${toLang}`;
    }
}

// Offline mod yöneticisi
class OfflineManager {
    constructor() {
        this.cache = new TranslationCache();
        this.isOffline = false;
    }

    async init() {
        await this.cache.init();
        this.loadOfflineStatus();
        this.setupNetworkListeners();
    }

    // Offline durumunu yükle
    loadOfflineStatus() {
        chrome.storage.sync.get(['offlineMode'], (result) => {
            this.isOffline = result.offlineMode || false;
            this.updateUI();
        });
    }

    // Ağ durumu dinleyicileri
    setupNetworkListeners() {
        window.addEventListener('online', () => this.handleNetworkChange(true));
        window.addEventListener('offline', () => this.handleNetworkChange(false));
    }

    // Ağ durumu değişikliğini işle
    handleNetworkChange(isOnline) {
        if (!isOnline && this.isOffline) {
            this.showNotification('Çevrimdışı mod aktif');
        }
    }

    // Çeviri yap
    async translate(text, fromLang, toLang) {
        try {
            // Önce önbellekte ara
            const cached = await this.cache.getFromCache(text, fromLang, toLang);
            if (cached) {
                return cached.translation;
            }

            // Çevrimdışıysa ve önbellekte yoksa
            if (this.isOffline) {
                throw new Error('Çevrimdışı modda ve önbellekte bulunamadı');
            }

            // Çevrimiçi çeviri yap
            const translation = await this.onlineTranslate(text, fromLang, toLang);
            
            // Önbelleğe ekle
            await this.cache.addToCache(text, translation, fromLang, toLang);
            
            return translation;
        } catch (error) {
            console.error('Çeviri hatası:', error);
            throw error;
        }
    }

    // UI güncelle
    async updateUI() {
        const stats = await this.cache.getStats();
        document.getElementById('cachedTranslations').textContent = stats.count;
        document.getElementById('cacheSize').textContent = `${stats.size.toFixed(2)} MB`;
        document.getElementById('offlineMode').checked = this.isOffline;
    }

    // Bildirim göster
    showNotification(message) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Quick Translate Pro',
            message: message
        });
    }
}

// Offline yöneticiyi başlat
const offlineManager = new OfflineManager();
offlineManager.init();

// Event listener'ları ekle
document.getElementById('offlineMode').addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.sync.set({ offlineMode: enabled });
    offlineManager.isOffline = enabled;
    offlineManager.showNotification(
        enabled ? 'Çevrimdışı mod aktif' : 'Çevrimdışı mod devre dışı'
    );
});

document.getElementById('clearCache').addEventListener('click', async () => {
    if (confirm('Önbelleği temizlemek istediğinizden emin misiniz?')) {
        await offlineManager.cache.clearCache();
        offlineManager.updateUI();
        offlineManager.showNotification('Önbellek temizlendi');
    }
});

document.getElementById('downloadOfflineData').addEventListener('click', () => {
    // Offline veri indirme işlemi
    offlineManager.showNotification('Çevrimdışı veriler indiriliyor...');
    // İndirme işlemi burada gerçekleştirilecek
}); 