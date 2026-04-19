# Development

Разработка программного обеспечения: написание и проектирование кода, работа с БД, архитектурой и интеграциями.

## Языки программирования

### Компилируемые статические
- **Java** — стандарты (ES5/ES6/ES2017 для JS-мира не относятся сюда; для Java — Java SE, Java EE, OpenJDK; фичи: Collections, Concurrency, Generics, Reflection, Stream API, лямбды, Java Memory Model, GC, NIO, java.util.concurrent, java.lang.reflect, java.time)
- **Kotlin** — coroutines, Flow, Multiplatform (KMM), Serialization, DSL, exposed, ktlint, Detekt, MockK
- **C++** — STL, Boost (asio, beast, context), GLM
- **C** — libpq, ESP-IDF
- **C#** — LINQ, типы данных, модель памяти, делегаты и события, generics
- **Go (Golang)** — GoSEC
- **Rust**
- **Swift** — Combine, POP, Generics, Multithreading, NSOperation, Optionals
- **Objective-C** — Runtime, SocketRocket
- **Scala**

### Интерпретируемые / динамические
- **Python** — генераторы, абстрактные классы, менеджеры контекста, декораторы
- **JavaScript** — классы, импорты, декораторы, стрелочные функции, генераторы, промисы, прототипное наследование, this, event loop, async/await, generators/iterators, Service Worker
- **TypeScript**
- **PHP** — composer, fpm, cli, PSR-2/PSR-12
- **Ruby** — Rollbar, Rspec, JRuby
- **Dart** — cubit, BLoC, Event Loop, Isolates
- **Lua**
- **Perl**
- **Groovy**
- **R**
- **VBS**

### JVM-совместимые / CLR
- **Kotlin** (см. выше) — JVM, JS, Native
- **Scala** (см. выше)
- **Groovy** (см. выше)
- **C#/F#/VB.NET** — CLR

### Языки с узким применением
- **Solidity** — смарт-контракты Ethereum
- **OneScript / OScript** — связка с 1С ⚠️ (см. Разное/1С)
- **Bash** — скриптинг Linux
- **PowerShell** — скриптинг Windows
- **Gherkin** — BDD-сценарии (см. QA)
- **GraphQL** — язык запросов к API
- **Regexp**
- **WSDL / RAML / JAML / AsciiDoc** — скорее форматы, см. раздел «Интеграция»
- **WebAssembly (wasm)**

### Шейдерные и специализированные
- **HLSL**
- **GLSL**
- **Gremlin** (для графовых БД), **openCypher**
- **NginScript**
- **CMD**

### Стандарты и спецификации языков
- **ECMAScript** — ES5, ES6, ES2015–ES2021, ES2017
- **PSR** (PHP) — PSR-2, PSR-12
- **Java SE / EE** — Blueprint, JSF, EJB, JMS
- **ANSI SQL-92** (см. БД)
- **POSIX**

## Runtime / Среды исполнения

- **JVM** — Drools, Akka, Micronaut, Java Memory Model, Project Reactor, OpenJDK
- **Node.js** — Express, NestJS, Moleculer, Strapi, менеджеры пакетов (NPM, PNPM, NVM, Yarn)
- **.NET** — .NET Framework, .NET Core, .NET Standard, CLR
- **Python CPython** — GIL-аспекты
- **Ruby MRI / JRuby**
- **ESP-IDF** — микроконтроллеры
- **Yocto** — Linux для embedded

## Веб-разработка

### Frontend / Разметка
- **HTML** — семантическая вёрстка
- **CSS** — Selectors, Flex, Grid, Layouts
- **Препроцессоры** — SASS/SCSS, LESS, Stylus, PostCSS, PostHTML
- **CSS-фреймворки** — Bootstrap, Tailwind CSS, WidiCSS, Bulma
- **Линтеры CSS** — Stylelint
- **Методологии** — БЭМ
- **CSS-in-JS** — styled-components, Emotion, linaria

### Frontend / JS-библиотеки общего назначения
- **Утилиты** — Lodash, Ramda, Date-fns, MomentJS, dayjs, Reflect, yup
- **DOM/AJAX** — jQuery (DatePicker, Slider, DateTimePicker, drag&drop), jQuery-UI, Axios, Fetch API
- **Графика/визуализация** — D3.js, Three.js, Chart.js, FusionCharts, ZingChart, apexcharts, AntCharts, eCharts, Fancybox, pixijs (WebGL)
- **Карты** — openlayers, Leaflet, Mapbox, ArcGIS, Google Maps, Yandex Maps
- **Таблицы/гриды** — agGrid
- **Реактивность** — RxJS
- **Валидация** — yup
- **Веб-сокеты** — Socket.IO, SockJS
- **3D-космос** — cesium, Dojo
- **Шаблонизация** — KnockoutJS, Handlebars
- **Прочее** — Devextreme, Ajax

### Frontend / Фреймворки
- **React** — Hooks, functional components, реконсиляция, React Native, BEM-react, Formik, Material UI / Ant Design / VKUI / ChakraUI, Router, context, Redux (saga, thunk, Toolkit, RTK Query, Reselect), MobX, Recoil, zustand, react-dnd, react-router-dom, react-final-form, react-hook-form, TanStack Query, enzyme, React Testing Library
- **Vue.js** — Vue 2/3, Composition API, vue-cli, vuex, pinia, vue-router, Vuetify, Element Plus, Quasar
- **Angular** — Dependency Injection, decorators, pipes, directives, life hooks, routing, Angular CLI, NgRx, ngx-formly, ng-zorro, PrimeNG, Protractor, Angular Universal, httpClient, Native Script
- **Svelte**
- **ExtJS**
- **SolidJS**
- **Single-SPA** (микрофронтенды)
- **Blazor**
- **Next.js / Nuxt / Remix / Razzle / Strapi CMS** — SSR/SSG
- **SSR / SSG / SPA / PWA** — подходы

### Frontend / Сборщики, рантайм-оснастка
- **Webpack** (Module Federation), **Vite**, **Parcel**, **Rollup**, **Turborepo**, **Nx** (nrwl/nx), **Gulp**, **Grunt**, **Bower**
- **Транспилеры** — Babel, TypeScript compiler
- **Линтеры** — ESLint, typescript-eslint, TSLint, JSDoc, XO, Prettier
- **Тест-фреймворки JS** — Jest, Karma, Mocha, Chai, Jasmine, Vitest, Cypress, Playwright, Puppeteer, Storybook
- **DI** — InversifyJS

### Backend / Фреймворки по языкам
- **Java** — Spring (Boot, Core, MVC, Webflux, Data, Integration, Security, Actuator, AOP, Cloud, JDBC, r2dbc, Batch), Quarkus, JMIX, Netty, Lagom, Micronaut, Servlets, JSF, zuul, Drools, Akka
- **Java ORM/DB** — Hibernate, JPA, MyBatis, JOOQ, QueryDSL, JDBC, JdbcTemplate, Liquibase, Flyway, EclipseLink
- **Java helpers** — Lombok, MapStruct, Jackson, GSON, Moshi, AspectJ, Mutiny, RxJava, Reactor, Logback, Slf4j, FreeMarker, Apache POI, Apache CAMEL, Apache Ignite, Apache Curator, Hazelcast, Jasperreports
- **Java тесты** — JUnit, JUnit 5, TestNG, Mockito, Spock, Wiremock, restAssured, Jacoco, Testcontainers, Hoverfly, JMeter
- **Python / Web** — Django (DRF, Channels, Filters, ORM), FastAPI, Flask, Sanic, Bottle, Starlette, aiohttp, Pyramid, Pylons, PhalconPHP (PHP ⚠️), Tornado
- **Python / ORM** — SQLAlchemy, Django ORM, Peewee
- **Python / утилиты** — Celery, Pydantic, Alembic, Jinja, Paramiko, Typing, Gunicorn, uvicorn, Daphne, Aura, doctrine, marshmallow, Kombu/Pika, GraphQL (Strawberry/Graphene)
- **Python / DS/ML** — см. «Data Science / ML»
- **PHP** — Laravel (Blade, Lumen, Eloquent), Symfony, Yii, Zend / Laminas, Slim, Codeception, PHPUnit, Composer, APC, KPHP, Swoole
- **Node.js** — Express, NestJS, Moleculer, Strapi
- **Ruby** — Ruby on Rails, Grape, Trailblazer, Sidekiq, Puma, Sinatra, Karafka, Rundeck, Skylight
- **.NET / C#** — ASP.NET (Core, MVC, WebAPI, SignalR), Entity Framework (Core), WCF, MassTransit, Dapper, FluentValidation, Hangfire, MediatR, WPF, WinForms, Blazor, Kusto, linq2db, ADO.NET, NuGet, SpecFlow, NUnit, xUnit, NSubstitute, MsTest, Spring.NET
- **Go** — Gin, Echo, gRPC-Go, GoSEC
- **Swift / iOS** — см. раздел Mobile
- **Kotlin / Android** — см. раздел Mobile

## Mobile-разработка

### iOS
- **Языки** — Swift, Objective-C
- **UI** — UIKit (UITableView, UICollectionView, кастомные UICollectionViewLayout, AutoLayout, Size Classes, AutoResizing), SwiftUI, FLKAutoLayout, SnapKit, PinLayout, FlexLayout, Masonry, Material Design (⚠️ обычно для Android), xib, Storyboard, Interface Builder
- **Reactive** — RxSwift, RxCocoa, RxDataSources, RxViewController, RxKeyboard, RxFeedback, ReactiveSwift, ReactiveKit, Combine
- **Сеть** — Moya, Alamofire, AFNetworking, ReachabilitySwift, URLSession, Starscream
- **БД** — Realm, RealmSwift, RxRealm, SQLite (GRDB), SwiftKeychainWrapper, Keychain, KeychainAccess, Sandbox
- **DI** — Swinject, DITranquillity
- **Утилиты** — SwiftyJSON, Gloss, ObjectMapper, Kingfisher, SDWebImage, SwiftProtobuf, SwiftMessages, PhoneNumberKit, Promises, CocoaPods, Swift Package Manager, R.swift, Sourcery, Swiftgen, CryptoSwift, EFQRCode, Lottie, BSImagePicker, TouchAreaInsets, FlexiblePageControl, InfiniteLayout, youtube-ios-player-helper
- **iOS-фреймворки** — AVKit, AVFoundation, AVAudioEngine, AVCapture, PassKit, StoreKit, Accelerate, Metal, CaptiveNetwork, NetworkExtension, ARKit, RealityKit, SpriteKit, SceneKit, MapKit, Core (Location, Graphics, Animation, Image, Text, Data), Foundation, Contacts, Push Notifications, Local Notifications, Data Protection, Apple SignIn, Apple Password Autofill, Grand Central Dispatch (GCD), Signals, TestFlight
- **Архитектуры** — MVC, MVP, MVVM, MVVM-C, VIPER, Clean Swift (VIP), TCA, UDF, CleanSwift, SurfMVP, Coordinator pattern, Flexible Routing
- **Тесты** — XCTest, XCUITest, KIF, Emcee, Quick, Nimble, RxTest, RxBlocking, SnapshotTesting
- **Аудио/видео** — AudioKit
- **Распространение** — App Store Connect, iTunes Connect, iOS Provisioning Portal, Appcenter
- **IDE** — Xcode, AppCode
- **Сборка** — XcodeGen, SwagGen, Bitrise, Fastlane

### Android
- **Языки** — Kotlin, Java
- **UI** — Views, Compose (Jetpack Compose, Compose Multiplatform), CustomView, compound view, RecyclerView (epoxy), ViewPager, View Binding, ConstraintLayout, Material Design, Adapter Delegates, ScrollingPagerIndicator, MaterialProgressBar, Lottie, appcompat, CardView, CustomTabs, FlowFragments, webview
- **Reactive** — RxJava, RxJava2, rxAndroid, Kotlin Coroutines, Flow
- **Сеть** — Retrofit, OkHttp (LoggingInterceptor, InternetAvailabilityChecker), OkIo, Protobuf Javalite
- **БД / кэш** — Room, Requery, Relinker, SQLDelight, GreenDAO, SQLCipher, SQLite, Encrypted Preferences
- **DI** — Dagger, Dagger 2, Hilt, Koin, Toothpick, Kodein, Assisted Inject
- **Навигация** — Cicerone, Navigation Component
- **Jetpack** — LiveData, ViewModel, DataBinding, Paging Library, WorkManager, Lifecycle, Biometric, ExifInterface, AndroidX
- **Утилиты** — Glide, Picasso, Fresco, Coil, Decoro, ButterKnife, AutoValue, AutoValue Gson, AutoValue Parcel, Moshi, Gson, Zxing (QR), Rootbeer (Root checker), BullyBoo/Armadillo (шифрование), ExoPlayer, AdMob, FacebookSDK, VK SDK, OK SDK
- **Архитектуры** — MVP (Moxy), MVVM, MVI, Single Activity, Clean Architecture
- **Тесты** — JUnit, Espresso, UiAutomator, Kakao, Kaspresso, Robolectric, Earl Grey, Mockito, Hamcrest, Appium
- **Logger** — Timber
- **OS** — Android SDK, Android Studio, API levels, Activity/Fragment Lifecycle, BroadcastReceiver, Content Provider, Service/IntentService/WorkManager, AndroidX, Android TV, Android Leanback, Android BOX, AndroidX, адаптация под различные разрешения и ориентации
- **Сборка** — Gradle (multi-module, custom tasks), adb

### Кросс-платформа
- **Flutter** — Dart, BLoC, Provider, Riverpod, GetIt, AutoRoute, Cubit, Event Loop, Isolates
- **React Native**
- **Kotlin Multiplatform Mobile (KMM)**
- **.NET MAUI** (⚠️ через Blazor тоже)
- **Qt** — Qt, Qt Quick, QML
- **Unity** (игры, но также кросс-десктоп)

## Desktop

- **Qt / Qt Quick** — также для embedded/кросс-платформы
- **Windows Forms, WPF** (.NET)
- **Embarcadero RAD Studio / VCL / Delphi**
- **Electron** (⚠️ не встречается явно в бульоне, но подразумевается)
- **Swing / JavaFX** (JVM desktop)

## Embedded / IoT (субдомен, пересекает Development)

- **Микроконтроллеры** — STM32, ESP32 (ESP-IDF), Nordic BLE
- **SoC** — Broadcom, Intel, Marvel
- **Промышленные интерфейсы** — UART (RS-232/RS-485), SPI, I2C, I2S, CAN, Ethernet, 1-Wire
- **Радиотехнологии** — Bluetooth (Classic + BLE), GSM, LTE, Wi-Fi, LoRa
- **ОС/сборка** — Yocto, GCC, GNU make, CMake, automake, autoconf, waf
- **IoT-протоколы** — MQTT (Mosquitto), LwIP
- **Схемотехника / железо** — EasyEDA, осциллограф, мультиметр
- **Работа с оборудованием** — загрузка/отладка ПО, конфигурирование, радары, лидары, ГНСС
- **Нативные графические API** — OpenGL, Vulkan, Metal (Apple), DirectX
- **Низкоуровневое** — файловые системы, блочные хранилища, драйверы, модули ядра Linux, network stack, sockets, IPC, threads
- **Многозадачность на низком уровне** — mutex/spin-lock, atomic, memory_order, lock-free/wait-free алгоритмы, DPDK

## Game Development / Графика (субдомен)

- **Движки** — Unity (3D, AssetBundles)
- **Графические API** — OpenGL, Vulkan, Apple Metal, DirectX, WebGL (pixijs)
- **Шейдерные языки** — HLSL, GLSL
- **Понятия** — realtime-рендеринг, графический конвейер, архитектура GPU, AR-проекты
- **Компьютерная графика** — основы алгоритмов, линейная алгебра, векторная математика

## Data Science / ML / AI (субдомен, пересекает Development и Analysis)

### Базовые библиотеки Python
- NumPy, Pandas (DataFrame), Matplotlib, Seaborn, SciPy, Statsmodels, Pillow (⚠️ ОреnСV написан с кириллическими символами в исходнике, это OpenCV)

### ML-фреймворки классические
- Scikit-Learn, CatBoost, XGBoost, LightGBM

### Deep Learning
- PyTorch, PyTorch Lightning, TensorFlow, Keras, HuggingFace
- Градиентный бустинг: XGBoost, CatBoost, LightGBM
- Бэггинг, стекинг

### CV / NLP
- OpenCV, TensorRT, NVIDIA Triton, DeepStream
- ABBYY FlexiCapture (OCR)
- Voice Analytics, ASR, TTS, NLP
- Архитектура YOLO, object detection, classification, segmentation

### AI-фреймворки / LLM
- LangChain, PineCone, OpenAI API
- prompt engineering
- SOTA-архитектуры нейронных сетей

### MLOps (пересечение с DevOps)
- MLFlow, KubeFlow, ClearML
- Jupyter, JupyterHub
- Деплой ML-моделей, пайплайны обучения, портирование на edge-девайсы
- Продуктивизация ML-моделей

### Математика
- Линейная алгебра, аналитическая геометрия
- Теория вероятностей
- BigNumber, манипуляции с большими числами
- Прикладная статистика (p-value, FPR, объём выборки)
- Среднее, медиана, перцентили

## Базы данных

### Реляционные SQL
- **PostgreSQL** (Greenplum, Arenadata DB, PostGIS, stolon) — диалект PL/pgSQL
- **MySQL** (Galera, MariaDB, ProxySQL, Percona, percona toolkit)
- **MS SQL Server** — Service Broker, SSRS, SSAS, SSIS, Analysis Services — диалект T-SQL
- **Oracle** — Weblogic, ADF, Exadata, Data Integrator — диалект PL/SQL, ESQL
- **SQLite** (GRDB, SQLDelight)
- **DB2** (IBM SystemI / AS-400, QUERY/400)
- **Firebird**
- **Teradata**
- **SAS** (DDL, DML, PL/SQL-синтаксис)
- **Redshift** (⚠️ AWS)
- **Tarantool** (гибрид)

### NoSQL
- **Документо-ориентированные** — MongoDB, Couchbase, ArangoDB (также графовая), CosmosDB (⚠️ Azure)
- **Key-Value / Cache** — Redis, KeyDB, Memcached, Tarantool, LMDB
- **Колоночные** — ClickHouse, Vertica, Greenplum, Teradata, HBase
- **Графовые** — Neo4j, ArangoDB
- **Time-series** — InfluxDB
- **Полнотекстовый поиск** — Elasticsearch, Solr, Sphinx, OpenSearch, Amazon DynamoDB
- **In-memory / Grid** — Hazelcast, Apache Ignite
- **Специализированные** — Riak (riakcs), Realm, ScyllaDB

### Стандарты SQL и диалекты
- **ANSI SQL-92**, PL/pgSQL, T-SQL, PL/SQL, ESQL, tSQLt
- **MDX** (Multidimensional Expressions)
- **CRUD**

### Навыки SQL
- SELECT, INSERT, UPDATE, DELETE, JOIN (все типы), UNION, GROUP BY, ORDER BY, DISTINCT, WITH/CTE, HAVING
- Агрегатные и оконные функции, подзапросы
- Хранимые процедуры, триггеры, функции, пакеты, задания, курсоры
- Индексы (включая алгоритмы), секционирование, materialized view
- Временные таблицы и табличные переменные
- План запроса, чтение и оптимизация
- Динамический SQL, dblink
- Transactions, уровни изоляции, ACID, нормализация/денормализация, суррогатные ключи, 3NF
- Proектирование под высокую нагрузку, шардирование
- S2T маппинг
- Primary/Secondary index

### ORM
- **Java/JVM** — Hibernate, JPA, JOOQ, QueryDSL, MyBatis, OrmLite, JDBC, JdbcTemplate, R2DBC
- **Python** — SQLAlchemy, Django ORM
- **PHP** — Doctrine, Eloquent (Laravel)
- **.NET** — Entity Framework (Core), Linq2Db, Dapper
- **JS/TS** — TypeORM, Prisma
- **Kotlin** — exposed
- **Android** — Room

### Миграции и схемы
- Flyway, Liquibase, Redgate, Alembic (Python)

### Специализированные инструменты / БД-утилиты
- LVM, Ceph (распределённое хранилище), Minio (S3-совместимое), tSQLt (тестирование T-SQL), Debezium (CDC)

## Архитектурные подходы

### Стили приложений
- **Монолит / Микросервисы / Микроядро** — Microservices Architecture (MSA), MicroKernel
- **Гексагональная архитектура**
- **Clean Architecture**
- **Event-Driven Architecture (EDA)** — Event Bus, Event Sourcing
- **CQRS**
- **DDD**, DDD-lite
- **Serverless**
- **SOA / ESB**
- **BPM**
- **C4 Model**
- **TOGAF**
- **RUP**
- **ICONIX**

### Клиентские архитектуры
- **MVC, MVP, MVVM, MVI, VIPER, MVVM-C**, MVP (Moxy), Clean (VIP), TCA, UDF, CleanSwift, SurfMVP
- **Single Activity** (Android)
- **Single Page Application (SPA)**, SSR, SSG, PWA, universal/isomorphic
- **Flux / Redux паттерн**
- **FSD (Feature Sliced Design)**
- **Server Driven UI**

### Межсервисные паттерны
- **Service Mesh** (Istio, Linkerd, Traefik Mesh, OSM, NSM, Kuma) — см. DevOps
- **API Gateway** (Kong, AWS API Gateway)
- **Service Locator**
- **Adapter Delegates**
- **CDN architectures**

### Другие
- **Massively parallel architecture**
- **Gexa**, **D22**

## Принципы и парадигмы

### Принципы кодирования
- **SOLID**
- **DRY / KISS / YAGNI**
- **Contract First**
- **12 factors**
- **Feature Flags**
- **Everything as Code / Infrastructure as Code / Architecture as Code / Docs as Code**
- **Eventual consistency**
- **Happens-before**
- **CAP-теорема**
- **ACID** (транзакции)
- **Теорема MECE** (⚠️ см. Analysis — работа с требованиями)

### Парадигмы
- **ООП** (ООР)
- **Функциональное программирование (FP)**, RFP
- **Реактивное программирование (RP)**
- **Асинхронное программирование** (async/await, event loop, promises, корутины, Isolates)
- **Многопоточное программирование** (multithreading, memory management)
- **Процедурное**
- **Декларативное**
- **Декораторы, аспекты**

### Паттерны проектирования
- **GoF** (классические 23)
- **GRASP**
- **PageObject, Factory** (⚠️ также QA — паттерны автотестов)
- **Dependency Injection / IoC**
- **Singleton, Delegate**

### Циклы разработки
- **SDLC** (Software Development Lifecycle)
- **PDLC** (Product Development Lifecycle)
- **Activity / Fragment Lifecycle** (Android)
- **V-модель**
- **Waterfall**
- **Trunk-Based Development**
- **Feature Flags release**

## Интеграция и API

### Форматы данных
- **JSON** (JSON.parse, JWT, Jsonnet, JSONPath, JSON Schema, SwiftyJSON)
- **XML** (XSD, XSLT, XPath, DOM)
- **YAML**
- **CSV**
- **Protobuf**
- **Avro**
- **Parquet, ORC**
- **Markdown**, AsciiDoc

### Протоколы API и веб
- **HTTP/HTTPS**, HTTP/2, QUIC
- **REST API** — RESTful WebAPI, OData
- **SOAP** — WSDL, SOAP exchange
- **GraphQL** — Apollo
- **gRPC** — reactor-grpc, JAX-RPC
- **WebSocket** — stomp, RSocket, SignalR, SockJS
- **WebDAV**
- **JAX-RS** (Java REST)
- **JSWP, DDS**

### Спецификации / описание API
- **OpenAPI** (Swagger, Stoplight, openapi-generator)
- **WADL**, **RAML**
- **XMLA** (для OLAP)

### Подходы к проектированию API
- **Contract First**
- **API-first**
- **API Versioning**
- **HATEOAS** (⚠️ не встречается явно, но часть REST-культуры)

### Асинхронные интеграции / Messaging
- **Брокеры сообщений** — Apache Kafka (Connect, Streams, Kafdrop, Akhq, CMAK, KafkaUI, KafkaTool, Kowl), RabbitMQ (Kombu/Pika), Apache Pulsar, NATS, Apache ActiveMQ (ArtemisMQ), ZeroMQ, IBM MQ (WebSphere), TibcoEMS, SonicMQ, OracleAQ
- **Шины данных / ESB** — WSO2, IBM Integration Bus, Apache Camel, Mule, Tibco, Kong (API Gateway)
- **RPC** — gRPC, JAX-RPC
- **Service Broker** (MSSQL)

### Интеграционные паттерны
- **ESB**
- **Service Mesh** (см. DevOps)
- **Event Bus, Event Sourcing**
- **Saga pattern**
- **CDC (Change Data Capture)** — Debezium

### Стриминг / обработка данных
- **Apache Spark** (Cluster, RDD, DataFrame, Spark SQL)
- **Apache Flink**
- **Apache Hadoop** (Hive, Impala, HDFS)
- **Apache Airflow** — DAGs
- **Apache Nifi**
- **Apache Sqoop**
- **Apache Kylin, Superset, Poi**
- **Apache Thrift, Apache Velocity**
- **DataVault** (подход к моделированию хранилищ)

### Конкретные стандарты интеграции
- **ISO 8583-1987, EMV** (финансовые карты)
- **ISO 15022, ISO 20022** (SWIFT)
- **HL7, FHIR, DICOM** (медицина)
- **3-D Secure**
- **FpML**
- **FIX, FAST, SBE** (финансы)
- **Plaza-II** (российская биржа)
- **СМЭВ 3** (государственные системы РФ)

## Системные знания

### Сеть (базовое понимание — углубляется в DevOps)
- OSI 7-уровневая модель
- Stateful vs stateless
- Синхронные vs асинхронные вызовы
- Network programming (TCP/UDP/multicast, sockets)
- Long Poll, WebSocket

### Оптимизация производительности
- Профилирование и поиск узких мест
- Рефакторинг
- Memory management, memory leaks, Promise, async/await
- Кэширование
- Оптимизация UI
- Горизонтальное масштабирование
- Работа с высоконагруженными системами (HL)

### Реверс-инжиниринг
- Reverse engineering

### Командная разработка
- Code review, design review
- Наставничество
- Работа с legacy-кодом
- Межкомандное взаимодействие

### VCS и коллаборация
- **Git** — также GitFlow, trunk-based, feature-branch
- **Mercurial**, **SVN**, **Team Foundation Server (TFS)**
- Git-клиенты GUI — GitKraken, SourceTree
- Bitbucket / GitHub / GitLab / Stash / YouTrack

## Инструменты (сводка всех упомянутых)

### IDE
- **JetBrains-семейство** — IntelliJ IDEA, PyCharm, WebStorm, PhpStorm, Rider, GoLand, RubyMine, AppCode
- **Microsoft** — Visual Studio, VS Code
- **Apple** — Xcode
- **Android Studio**
- **Embarcadero RAD Studio**
- **1С:EDT** (⚠️ см. Разное/1С)
- **LLVM / clang**
- **MsBuild**

### Системы сборки
- **Maven, Gradle, Ant, Ivy** — Java/JVM
- **Rake** — Ruby
- **CMake, GNU make, automake, autoconf, waf, conan.io** — C/C++
- **Gulp, Grunt, Webpack, Vite, Parcel, Rollup, Turborepo, Nx** — JS
- **Fastlane** — mobile
- **werf** — контейнерные сборки

### Пакетные менеджеры
- **npm, pnpm, yarn, nvm**
- **pip, poetry, conda**
- **Composer** — PHP
- **CocoaPods, SPM** — iOS
- **Maven Central / Gradle repos** — Java
- **NuGet** — .NET
- **gem** — Ruby
- **Sonatype Nexus, JFrog Artifactory, Bower** — хранилища артефактов

## Пересечения

- **SQL-навыки** используются также в Analysis (написание отчётов, работа с хранилищами данных) и в QA (тестирование БД). Здесь язык и его диалекты; применение в контексте — там.
- **Паттерны автотестов** (Page Object, Factory) см. также QA.
- **MLOps** — пересечение с DevOps (пайплайны моделей в CI/CD).
- **Безопасная разработка, основы безопасности веб-приложений (XSS, SQL-injection), криптография на прикладном уровне** — пересечение с InfoSec.
- **Вёрстка и UI** — пересечение с Design (реализация макетов).
- **Embedded / IoT, Gamedev, Blockchain** — самодостаточные субдомены, тесно связанные с Development, но с собственными экосистемами.
- **1С-язык и разработка** — см. Разное/1С (вынесено из-за размера и специфики).

## Неоднозначное (листья, требующие решения)

- ⚠️ **Kafka, RabbitMQ** — инструмент разработчика (библиотека-клиент) и объект инфраструктуры (DevOps). Здесь — как протокол/библиотека; в DevOps — как запускаемый сервис.
- ⚠️ **Camunda / BPMS** — платформа моделирования (Analysis) + engine (Development). Оставил в Разное.
- ⚠️ **1С: Сценарное тестирование, Vanessa-Automation** — тесты 1С, см. Разное/1С.
- ⚠️ **Sidekiq, Celery, Apache Airflow** — как библиотеки задач живут в Development (интеграция), как сервисы — в DevOps.
