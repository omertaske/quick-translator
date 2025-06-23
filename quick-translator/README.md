# Quick Translator 🌐

Quick Translator, web sayfalarında anlık çeviri yapmanızı sağlayan güçlü bir tarayıcı eklentisidir. OCR, kelime kartları ve offline mod gibi gelişmiş özellikleriyle çeviri deneyiminizi üst seviyeye taşır.

## ✨ Özellikler

### 📝 Temel Özellikler
- Anlık metin çevirisi
- Çoklu dil desteği
- Metin seçimi ile otomatik çeviri
- Sürükle-bırak arayüz
- Koyu/Açık tema desteği

### 🎯 Gelişmiş Özellikler
- **Kelime Öğrenme Modu**
  - Kelime kartları
  - Öğrenme takibi
  - Günlük hedefler
  - İlerleme istatistikleri

- **OCR (Optik Karakter Tanıma)**
  - Ekran görüntüsünden metin tanıma
  - Resim içindeki metinleri çevirme
  - Çoklu dil desteği

- **Offline Mod**
  - İnternetsiz çeviri
  - Akıllı önbellek sistemi
  - Veri senkronizasyonu

### ⌨️ Kısayol Tuşları
- `Ctrl+Shift+T`: Seçili metni çevir
- `Alt+T`: Hızlı ayarlar
- `Alt+X`: Son çeviriyi kapat
- `Alt+C`: Son çeviriyi kopyala

## 🚀 Kurulum

1. Eklentiyi tarayıcınıza yükleyin:
   - Chrome Web Mağazası'ndan indirin
   - veya dosyaları indirip "Paketlenmemiş öğe yükle" seçeneği ile yükleyin

2. API Anahtarı Ayarlama:
   - `config.example.js` dosyasını `config.js` olarak kopyalayın
   - Google Cloud API anahtarınızı ekleyin:
   ```javascript
   const API_KEY = 'YOUR_API_KEY_HERE';
   ```

3. Tarayıcınızda eklenti simgesine tıklayın
4. Tercih ettiğiniz dili ve ayarları seçin
5. Hazırsınız! Artık herhangi bir metni seçip çevirebilirsiniz

## 💡 Kullanım

1. **Hızlı Çeviri**
   - Metni seçin
   - Çıkan çeviri ikonuna tıklayın
   - veya `Ctrl+Shift+T` kısayolunu kullanın

2. **Kelime Öğrenme**
   - Çevirilen metni kelime kartı olarak kaydedin
   - Günlük hedeflerinizi belirleyin
   - İlerlemenizi takip edin

3. **OCR Kullanımı**
   - Ekran görüntüsü alın
   - veya resim içeren bir alanı seçin
   - OCR butonuna tıklayın

## ⚙️ Özelleştirme

Eklenti ayarlarını özelleştirmek için:
1. Eklenti ikonuna sağ tıklayın
2. "Seçenekler"i seçin
3. İstediğiniz ayarları yapılandırın:
   - Font boyutu
   - Çeviri kutusu konumu
   - Tema rengi
   - Animasyonlar
   - Otomatik kapatma süresi

## 🔒 Gizlilik

- Hiçbir kişisel veri toplanmaz
- Tüm veriler yerel olarak saklanır
- Sadece çeviri ve OCR API'leri ile iletişim kurulur
- Açık kaynak kodlu yazılım

## 🤝 Katkıda Bulunma

1. Bu depoyu fork edin
2. Yeni bir branch oluşturun (`git checkout -b feature/amazing`)
3. Değişikliklerinizi commit edin (`git commit -m 'Harika özellik eklendi'`)
4. Branch'inizi push edin (`git push origin feature/amazing`)
5. Pull Request oluşturun

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 👥 İletişim

- Geliştirici: Ömer Taşkesen
- E-posta: omertaskesenn@gmail.com

## 🌟 Teşekkürler

Bu projeye katkıda bulunan herkese teşekkürler!

---

**Not:** Bu eklenti Chrome, Opera ve diğer Chromium tabanlı tarayıcılar ile uyumludur. 