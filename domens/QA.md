# QA

Обеспечение качества и тестирование: теория, виды тестирования, техники, инструменты и автоматизация.

## Теория тестирования

### Базовые понятия
- **Пирамида тестирования** — модульные / интеграционные / системные (E2E)
- **Жизненный цикл дефекта**
- **STLC** (Software Testing Lifecycle)
- **Definition of Ready / Definition of Done** (см. Analysis) применительно к тестированию

### Виды тестирования
- **Функциональное** — позитивные, негативные сценарии
- **Нефункциональное** — производительность, нагрузка, стресс, стабильность
- **Регрессионное**
- **Интеграционное**
- **Системное**
- **Приёмочное (UAT)**
- **Smoke, Sanity**
- **Exploratory (исследовательское)**
- **Dimo/Demo тестирование**
- **Хостовое и целевое** (embedded)
- **End-to-End (E2E)**
- **UI тестирование**
- **API тестирование**
- **Аналитики** — тестирование аналитических выгрузок и потоков данных

### По методу доступа
- **Black Box** — «чёрный ящик»
- **White Box** — «белый ящик»
- **Gray Box**

### Специализированные виды
- **Нагрузочное (Load) и стрессовое (Stress) тестирование**
- **Security Testing**
- **Penetration Testing** (⚠️ пересечение с InfoSec)
- **Usability Testing**
- **Тестирование мобильных платформ** (iOS, Android, iPadOS)
- **Тестирование веба**
- **Тестирование Mobile/Backend**
- **Snapshot-тесты**
- **Тестирование сервисной архитектуры**
- **Тестирование без функциональной спецификации**

## Техники тест-дизайна

- **Классы эквивалентности**
- **Граничные значения**
- **Попарное тестирование (Pairwise)**
- **Диаграммы переходов и состояний**
- **Decision Table Testing**
- **Предугадывание ошибки, причина-следствие**
- **Исследовательское тестирование**
- **Валидация требований на тестируемость**

## Тест-документация (артефакты)

- **Test Plan** — план тестирования
- **Test Case** — тест-кейс
- **Test Scenario** — тестовый сценарий
- **Checklist** — чек-лист
- **Bug Report** — баг-репорт
- **ПМИ** (программа и методика испытаний)
- **Тестовые отчёты** (инструкции, отчёты о результатах тестирования)
- **Приёмочные тесты / сценарии приёмки**
- **Автоматизированные тестовые сценарии** (описание)
- **Функциональные тестовые сценарии**

## Уровни тестов

### Unit
- Модульные тесты — пирамида, основа
- Паттерны — AAA (Arrange-Act-Assert)
- Моки, стабы, заглушки, эмуляторы
- Генераторы тестовых данных
- Фикстуры

### Integration
- Тесты API, БД, RESTful API
- Моки сервисов (Hoverfly, WireMock, MockK)
- Контрактные тесты

### E2E / UI
- UI-тесты
- Snapshot-тесты
- E2E-сценарии
- Тестирование через браузер

### Нефункциональные
- Нагрузочное тестирование (Performance)
- Stress, Endurance (⚠️)
- Мониторинг деградации

## Техники и паттерны автотестов

- **Page Object Pattern** (PageObject) — см. также Development/Patterns
- **Factory** — фабрика тест-данных
- **BDD** (Behaviour-Driven Development) — Gherkin, Cucumber
- **TDD** (Test-Driven Development)
- **Параметризация, корреляция** (нагрузка)
- **Test-fit патерны** — data-driven, keyword-driven

## Моки, заглушки, эмуляторы

- **Моки**, stubs, эмуляторы
- **WireMock, MockK, Mockito, NSubstitute, Hoverfly**
- **MOCK-сервисы**
- **Fakes**
- **Testcontainers** — контейнеризованные тестовые зависимости

## Процессы QA

### Управление тестированием
- Планирование тестирования (оценка трудозатрат)
- Составление планов тестирования (regression, smoke etc)
- Анализ результатов тестов
- Проектирование тестового фреймворка
- Проектирование тестовых инструментов
- Поддержка и расширение существующего test automation framework
- CI/CD для автотестов — пайплайны запуска тестов (⚠️ пересечение с DevOps)
- Настройка и конфигурация тестовых окружений
- Фермы реальных устройств и виртуальных устройств (mobile)

### Командные процессы
- Code review для тестов
- QA участие в требованиях (раннее тестирование)

## Инструменты

### Управление тестированием (TMS)
- **TestRail**
- **Zephyr** (Atlassian), Testflo
- **TestReil**, Ситечко
- **Allure TestOps, Allure EE**
- **TestIT, akitaGPB**
- **HP ALM**, **X-RAY** (Jira plugin)

### Баг-трекеры
- Jira, YouTrack, Redmine, Trello, Bugzilla, Mantis (⚠️), Kaiten

### Unit-тест фреймворки
- **Java/Kotlin** — JUnit, JUnit 5, TestNG, Spock, Robolectric, Hamcrest, Kaspresso, Kakao, Mockito, MockK, restAssured, Jacoco, Wiremock, Hoverfly, Testify
- **Python** — PyUnit, unittest, PyTest, DocTest, Nose
- **JS/TS** — Jest, Mocha, Chai, Jasmine, Vitest
- **PHP** — PHPUnit, Codeception
- **.NET** — NUnit, xUnit, MsTest, NSubstitute, SpecFlow
- **Swift** — XCTest, Quick, Nimble, RxTest, RxBlocking, SnapshotTesting
- **Ruby** — RSpec
- **C++** — Google Test (⚠️ не явно упомянут), Catch

### Автотесты UI
- **Web** — Selenium WebDriver (Selenide, Grid, Selenoid), Cypress, Playwright, Puppeteer, WDIO, Moon, Protractor
- **Mobile** — Appium, XCUI, XCUITest, KIF, Emcee, Espresso, UiAutomator, Kakao, Kaspresso, Earl Grey, Squish
- **Desktop** — UFT (ex-QTP), TestComplete
- **Generic** — Robot Framework
- **Screenshot testing** — SnapshotTesting

### BDD / Gherkin
- Cucumber (Ruby/JVM/PHP), Сucumber, Gherkin

### Нагрузочное тестирование
- **JMeter** (Apache)
- **Gatling**
- **HPE LoadRunner / Performance Center**
- **Grafana k6**
- **Яндекс.Танк**
- **Locust** (⚠️ не явно упомянут, но популярный)

### API-тесты / HTTP-клиенты (пересечение с Dev)
- **Postman**, TestMace, Insomnia
- **SoapUI**
- **Charles Proxy, Proxyman, Fiddler**
- **curl, httpx**
- **restAssured** (Java)

### Тесты баз данных
- **tSQLt** — T-SQL unit testing
- **DbFit, DbUnit** (⚠️)

### Перехват / прокси трафика
- Charles, Proxyman, Fiddler, mitmproxy (⚠️)

### Мобильные эмуляторы и фермы
- **Genymotion** (Android)
- **iOS Simulator**
- **Android эмулятор Android Studio**
- **Фермы реальных устройств / виртуальных устройств** — BrowserStack, Sauce Labs (⚠️), отечественные фермы
- **adb** (Android Debug Bridge)

### Статический анализ (качество кода с точки зрения QA)
- **SonarQube**, **Sonarlint**
- **Checkstyle**
- **Fortify**
- **PyLint, Black, flake8, isort** (Python)
- **ESLint, Prettier** (JS)
- **Detekt, ktlint** (Kotlin)

### Автотесты в CI/CD
- Запуск в Jenkins / GitLab CI / GitHub Actions / TeamCity
- Параллельный запуск, распараллеливание, shard

### 1С-тестирование (субдомен)
- **1С:Сценарное тестирование**, **1С:Тестировщик**, **Vanessa-Automation**
- **1С:ЦУП, Тест Гилева** (нагрузочное в 1С)
- See Разное/1С

### DevTools и браузерные инструменты
- Chrome DevTools (cookie, localStorage, IndexedDB, консоль)
- Анализ трафика приложений/сайтов

## Типовые опытные требования

- Тестирование интеграционное (≥ 2 лет)
- Тестирование функциональное (≥ 2 лет)
- Тестирование WEB/Mobile/Backend
- Опыт white-box тестирования
- Опыт тестирования 1С (⚠️ см. Разное/1С)
- Опыт тестирования аналитики
- Опыт тестирования сервисной архитектуры
- Большое количество автотестов в портфеле
- Опыт тестирования интеграций с оборудованием (терминалы, фискальные регистраторы и т.п.)

## Пересечения

- **Паттерны Page Object, Factory** — живут также в Development/Patterns как подход к проектированию.
- **CI/CD для автотестов** — пересечение с DevOps (пайплайны, тестовые окружения).
- **Pen testing, Security testing** — пересечение с InfoSec.
- **1С-тесты** — в Разное/1С (специфика платформы).
- **Тестирование UI на соответствие макетам** — пересечение с Design.
- **Анализ требований на тестируемость** — пересечение с Analysis (валидация требований).
- **Тестирование железа** — пересечение с Embedded / IoT (Development).
- **Mock-серверы как часть разработки** — пересечение с Development.

## Неоднозначное

- ⚠️ **Penetration testing / Security testing** — в бульоне упомянуты как часть QA. По сути — самостоятельная дисциплина InfoSec. Листья разведены: «тест-навык» здесь, «специализированный Security engineer» в InfoSec.
- ⚠️ **Static analysis (SonarQube и пр.)** — инструмент QA, но часто интегрируется в DevOps-пайплайны. Основная классификация здесь.
- ⚠️ **Нагрузочное тестирование (JMeter, Gatling, Loadrunner)** — может восприниматься как SRE/DevOps-функция, но тест-инструменты здесь.
