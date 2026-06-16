---
title: "WWDC26 세션 297 — Visual Intelligence 통합 베스트 프랙티스"
issue: 2
createdAt: 2026-06-16T06:44:22Z
updatedAt: 2026-06-16T06:57:50Z
labels: ["published","translation"]
---

> 본문은 **Apple WWDC26 세션 297 "Best practices for integrating visual intelligence in your app"** 을 한국어로 정리한 학습 노트입니다.
> 원본 세션: https://developer.apple.com/videos/play/wwdc2026/297/
> Apple Developer Program 회원은 [Apple Developer](https://developer.apple.com/videos/play/wwdc2026/297/) 에서 정식 영상을 시청할 수 있습니다.

# Visual Intelligence 통합 베스트 프랙티스 — WWDC26 세션 297 정리

iOS 26, iPadOS, macOS에서 카메라로 비추거나 화면을 인식했을 때, 우리 앱의 콘텐츠가 **Visual Intelligence 검색 결과**로 등장하는 방법을 다룬 세션. 음악 탐색 앱(Music Discovery)을 예시로 처음부터 끝까지 만들어 본다.

세션은 약 18분. 챕터 9개. 챕터별 핵심만 추려 보았다.

---

## 0. 들어가며

Visual Intelligence 통합의 두 축이 있다.

1. **Image Search** — 우리 앱의 콘텐츠를 Visual Intelligence 결과에 노출
2. **System Stores** — 캘린더, 연락처, 건강 데이터 등 시스템 저장소에 기록 → 우리 앱이 읽어 활용

iOS 26 / iPadOS / macOS 세 플랫폼에서 동일한 코드로 동작한다. 세션은 첫 번째 축을 음악 앱으로, 두 번째 축을 캘린더 연동으로 보여준다.

---

## 1. 콘텐츠 정의하기 — `AppEntity`

Visual Intelligence가 우리 앱의 콘텐츠를 검색 결과로 보여주려면, 먼저 그 콘텐츠를 **`AppEntity`** 로 모델링해야 한다.

`AppEntity`는 시각적 표현을 위해 두 가지를 반드시 가져야 한다.

- `displayRepresentation` — `title`, `subtitle`, 그리고 작은 썸네일 `image`
- `typeDisplayRepresentation` — 결과 그룹의 헤더에 보일 이름

`AlbumEntity` 예시:

```swift
struct AlbumEntity: AppEntity {
    var id: String
    @Property var name: String
    @Property var artistName: String
    var coverArtData: Data

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)",
            subtitle: "\(artistName)",
            image: .init(data: coverArtData)
        )
    }

    static let defaultQuery = AlbumEntityQuery()
    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Album" }
}
```

> **포인트**: 썸네일 이미지는 작은 크기로, 식별 가능한 텍스트는 짧고 정확하게. 검색 결과 카드에서 한 줄로 의미가 전달돼야 한다.

---

## 2. 쿼리 구현하기 — `IntentValueQuery` + Vision

검색은 **`IntentValueQuery`** 가 담당한다. `SemanticContentDescriptor` 의 `pixelBuffer` 를 받아서 우리 카탈로그에서 매칭되는 앨범을 반환한다.

```swift
struct SearchHandler: IntentValueQuery {
    @Dependency var catalog: AlbumCatalog

    func values(for input: SemanticContentDescriptor) async throws -> [VisualSearchResult] {
        guard let pixelBuffer = input.pixelBuffer else { return [] }
        let albums = try await catalog.search(matching: pixelBuffer)
        return albums.map { VisualSearchResult.album($0) }
    }
}
```

핵심은 **on-device 이미지 유사도 비교**. Vision 프레임워크의 `GenerateImageFeaturePrintRequest` 로 이미지 특징을 추출하고, 카탈로그에 미리 계산해둔 feature print 와 **거리(distance)** 로 정렬한다.

```swift
let request = GenerateImageFeaturePrintRequest()
let result = try await request.perform(on: image)  // FeaturePrintObservation
return result
```

> **포인트**
> - **Feature print는 사전 계산**해서 캐싱. 사용자가 검색할 때마다 전체 카탈로그를 처리하는 일은 없어야 한다.
> - `maxDistance` 임계값으로 노이즈 결과를 잘라낸다. 거리 1.0 이하는 의미 있는 매칭으로 본다.
> - 한도(`limit`)를 두고 상위 N개만 반환.

---

## 3. 결과 열기 — `OpenIntent`

사용자가 Visual Intelligence 결과에서 우리 항목을 탭하면, **앱이 포그라운드로 올라오면서** `OpenIntent` 가 실행된다. 이 시점에 무거운 작업은 절대 하면 안 된다 — 앱이 뜨는 속도가 곧 사용자 경험이다.

```swift
struct OpenAlbumIntent: OpenIntent {
    static let title: LocalizedStringResource = "Open Album"
    @Parameter(title: "Album")
    var target: AlbumEntity

    @Dependency var appState: AppState

    func perform() async throws -> some IntentResult {
        await appState.openAlbum(id: target.id)
        return .result()
    }
}
```

> **포인트**: 앱 안에 이미 존재하는 `OpenIntent` 가 있다면 그대로 재사용한다. Visual Intelligence 전용 `OpenIntent` 를 굳이 새로 만들지 않는다.

---

## 4. Mac과 iPad 적용

같은 `AlbumEntity`, 같은 `SearchHandler`, 같은 `OpenIntent` 가 macOS 와 iPadOS 에서 그대로 동작한다. 다만 두 가지를 주의.

- **입력 소스 차이** — iOS/iPadOS 는 카메라 또는 스크린샷, macOS 는 스크린샷 위주
- **픽셀 버퍼 크기** — Mac 의 스크린샷은 iPhone 카메라 캡처보다 훨씬 크다. 메모리 압박을 피하려면 검색 전에 **적절한 크기로 리사이즈** 하는 게 안전하다

> **포인트**: 코드 분기를 플랫폼별로 만들지 말고, 입력 정규화 한 군데에서 처리한다.

---

## 5. 여러 결과 타입 반환 — `@UnionValue`

앨범만 보여주지 말고 **관련된 콘서트도 함께** 노출하고 싶다면, 결과 타입을 합친다.

```swift
@UnionValue
enum VisualSearchResult {
    case album(AlbumEntity)
    case concert(ConcertEntity)
}
```

`SearchHandler` 에서 앨범 매칭 → 그 아티스트의 콘서트를 찾아 union 으로 묶어 반환한다.

```swift
let albums = try await catalog.search(matching: pixelBuffer)
let artists = albums.map { $0.artistName }
let concerts = await concertFinder.findNearby(byArtists: artists)

return albums.map { .album($0) } + concerts.map { .concert($0) }
```

> **포인트**: 픽셀 매칭에서 출발해서 **연관 콘텐츠로 확장**하는 발상이 중요. 사용자가 한 번에 발견할 수 있는 가치를 키운다.

---

## 6. 인앱 검색으로 연결 — `semanticContentSearch` 스키마

Visual Intelligence 결과는 1차 노출. 더 깊은 검색은 **우리 앱 안의 검색 화면**으로 안내한다. 이때 카메라가 캡처한 의미 정보를 함께 넘겨주면, 앱은 그 컨텍스트를 미리 채워서 검색 결과에 적용할 수 있다.

```swift
@AppIntent(schema: .visualIntelligence.semanticContentSearch)
struct SemanticContentSearchIntent: AppIntent {
    static let title: LocalizedStringResource = "Search in app"
    static let openAppWhenRun: Bool = true

    var semanticContent: SemanticContentDescriptor

    @Dependency var catalog: AlbumCatalog
    @Dependency var concertFinder: ConcertFinder
    @Dependency var appState: AppState

    func perform() async throws -> some IntentResult {
        guard let pixelBuffer = semanticContent.pixelBuffer else { return .result() }

        let albums = try await catalog.search(matching: pixelBuffer)
        let artists = albums.map { $0.artistName }
        let concerts = await concertFinder.findNearby(byArtists: artists)

        await appState.openSearch(albums: albums, concerts: concerts)
        return .result()
    }
}
```

> **포인트**: `openAppWhenRun = true` 로 앱 안 검색 화면으로 직행. 카메라가 본 것 + 관련 메타데이터를 미리 채워두면 사용자 입력 없이도 풍부한 결과.

---

## 7. 시스템 스토어 연동

Visual Intelligence는 단순히 "보여주기" 만 하는 게 아니다. 캡처한 정보를 **시스템 데이터 저장소에 기록**하고, 우리 앱이 다시 읽어 활용할 수 있다.

| 저장소 | 프레임워크 | 용도 |
|--------|------------|------|
| 캘린더 | EventKit (`EKEventStore`) | 콘서트 일정 자동 추가 |
| 연락처 | Contacts (`CNContactStore`) | 인물 정보 |
| 건강 | HealthKit (`HKHealthStore`) | 의료 기기 측정값 |

세션은 EventKit 예시만 보여주는데, 패턴은 동일하다.

```swift
let granted = try await eventStore.requestFullAccessToEvents()
guard granted else { return }

let predicate = eventStore.predicateForEvents(
    withStart: .now,
    end: .now.addingTimeInterval(90 * 24 * 60 * 60),  // 90일
    calendars: nil
)
let events = eventStore.events(matching: predicate)
```

> **포인트**: 저장소가 갱신될 때마다 알림을 받아 우리 캐시를 갱신한다.

```swift
for await _ in NotificationCenter.default
    .notifications(named: .EKEventStoreChanged) {
    await fetchUpcomingConcerts()
}
```

이렇게 하면 사용자가 캘린더에 추가한 콘서트가 **자동으로 우리 앱의 추천에 등장**한다.

---

## 8. 정리

| 통합 지점 | 핵심 타입 | 비고 |
|-----------|-----------|------|
| Image Search | `AppEntity` + `IntentValueQuery` + `OpenIntent` | on-device feature print 비교 |
| 인앱 검색 연결 | `semanticContentSearch` schema | 컨텍스트 pre-fill |
| System Stores | EventKit / Contacts / HealthKit | 변경 알림으로 캐시 동기화 |

세 플랫폼에서 거의 같은 코드로 동작하고, 핵심 분기(픽셀 버퍼 크기, 입력 소스)는 입력 정규화 한 곳에서 처리하는 게 깔끔하다.

---

## 참고 자료

- [WWDC26 세션 297 - Best practices for integrating visual intelligence in your app](https://developer.apple.com/videos/play/wwdc2026/297/)
- [Integrating your app with visual intelligence (Documentation)](https://developer.apple.com/documentation/VisualIntelligence/integrating-your-app-with-visual-intelligence)
- [Visual Intelligence (Framework reference)](https://developer.apple.com/documentation/VisualIntelligence)

---

## 학습 메모 (개인)

- **on-device 추론 강점** — feature print 생성·비교가 디바이스 안에서 끝남. 사용자 이미지가 외부로 안 나간다. Apple Intelligence와 같은 방향성.
- **`@UnionValue`** 처음 봤다. enum case 마다 다른 엔티티를 담을 수 있게 해주는데, Swift 6 의 typed throws 와 함께 **App Intents 의 표현력을 한 단계 끌어올린** 느낌.
- **`@Dependency`** 패턴은 TCA(Composable Architecture) 의 그것과 닮았다. Apple이 의존성 주입을 first-party 로 들여온 건 의외.
- `EKEventStoreChanged` 알림 + `for await` 비동기 스트림 조합 — iOS 18+ 의 깔끔한 Observable 패턴. NotificationCenter 직접 구독보다 훨씬 읽기 좋다.
