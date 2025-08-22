# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 필요한 지침을 제공합니다.

## 프로젝트 개요
HTML/JavaScript로 구축된 크로스 플랫폼 텍스트 파일 뷰어 애플리케이션입니다. Windows(Electron)와 Android(Capacitor) 플랫폼을 지원하며, UI 스타일링에 Tailwind CSS를 사용합니다.

## 개발 명령어

### 빌드 명령어
- **Windows 빌드**: `npm run build-windows` - `dist-electron/win-unpacked/`에 Electron 실행 파일 생성
- **Android 빌드**: `npm run build-android` - Capacitor를 사용하여 Android APK 빌드
- **CSS 빌드**: `npm run build-css` - watch 모드로 Tailwind CSS 컴파일

### 개발 명령어
- **시작**: `npm start` 또는 `npm run dev` - 포트 3000에서 live-server 시작
- **Electron 개발**: `npm run electron-dev` - 개발 모드에서 Electron 실행
- **Android 동기화**: `npm run sync-android` - 웹 자산을 Android 플랫폼에 동기화
- **Android 열기**: `npm run open-android` - Android Studio에서 Android 프로젝트 열기

### 테스트 및 품질
- **테스트**: `npm test` - Jest 테스트 실행
- **린트**: `npm run lint` - ESLint 코드 품질 검사

### 플랫폼 관리
- **Capacitor 초기화**: `npm run cap-init` - Capacitor 초기화
- **Android 추가**: `npm run cap-add-android` - Android 플랫폼 추가

## 아키텍처

### 크로스 플랫폼 전략
앱은 플랫폼별 적응과 함께 하이브리드 접근 방식을 사용합니다:
- **Web/PWA**: 서비스 워커를 지원하는 기본 HTML/JS 애플리케이션
- **Electron**: 네이티브 파일 시스템 접근과 메뉴를 제공하는 데스크톱 래퍼 (src/electron-main.js)
- **Capacitor**: 네이티브 플러그인을 지원하는 Android용 모바일 래퍼

### 핵심 컴포넌트
- **TextViewer 클래스** (src/app.js): 파일 작업, 검색, UI 상태를 처리하는 메인 애플리케이션 로직
- **플랫폼 감지**: 런타임 환경(Capacitor/Electron/Web)을 자동으로 감지하고 기능을 적응
- **파일 처리**: 인코딩 감지 및 드래그 앤 드롭을 지원하는 플랫폼별 파일 읽기

### 주요 기능
- 구문 강조 표시가 있는 텍스트 파일 보기
- 탐색 및 강조 표시가 있는 실시간 검색
- 파일 정보 및 인코딩 선택이 있는 사이드바
- 접을 수 있는 사이드바가 있는 반응형 디자인
- 키보드 단축키 (Ctrl+O, Ctrl+F, Ctrl+W, Esc)

### Windows 개발 참고사항
- 한글 인코딩 문제로 인해 .bat 파일의 주석은 영어로만 작성
- Windows 개발 환경에 맞춰 빌드 도구 구성
- 일부 빌드 작업에는 PowerShell 관리자 모드 필요

### 파일 구조
- `src/`: 메인 애플리케이션 소스 코드
- `android/`: Capacitor Android 플랫폼 파일
- `dist-electron/`: Electron 빌드 출력
- `assets/`: 정적 리소스 및 문서
- 빌드 스크립트: `build.bat`, `build-simple.bat`, `build-release.bat`, `setup-build-tools.bat`