# Assets Directory

이 디렉토리에는 애플리케이션 아이콘과 리소스 파일들이 포함됩니다.

## 필요한 파일들

### Windows (Electron) 빌드용:
- `icon.ico` - Windows 애플리케이션 아이콘 (256x256 또는 그 이상)
- `icon.png` - 일반 PNG 아이콘 (512x512 권장)

### Android (Capacitor) 빌드용:
- `icon-72x72.png`
- `icon-96x96.png`
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png`
- `icon-192x192.png`
- `icon-384x384.png`
- `icon-512x512.png`

### PWA용:
- `screenshot1.png` - 앱 스크린샷 (1280x720)

## 아이콘 생성 도구

온라인 아이콘 생성기를 사용하여 하나의 큰 이미지에서 모든 크기를 생성할 수 있습니다:
- https://favicon.io/
- https://realfavicongenerator.net/
- https://www.favicon-generator.org/

## 주의사항

아이콘 파일이 없으면 빌드는 성공하지만 기본 아이콘이 사용됩니다.
제대로 된 아이콘을 사용하려면 위의 파일들을 이 디렉토리에 추가하세요.