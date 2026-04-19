# Analysis

Бизнес-анализ, системный анализ, продуктовая и дата-аналитика, работа с требованиями, хранилища данных, BI.

## Системный и бизнес-анализ

### Цикл работы с требованиями
- Выявление, анализ, документирование, верификация, валидация
- Сбор и проработка бизнес-требований
- Постановка задач на разработку (бэк + фронт)
- Приёмка результата (acceptance)
- Проведение обследований, интервью, коммуникаций с заказчиком
- Декомпозиция и распределение задач между участниками

### Типы требований
- Функциональные требования (ФТ)
- Нефункциональные требования (НФТ)
- Бизнес-требования (БТ)
- Системные требования
- Приёмочные критерии (Acceptance Criteria, AC)

### Виды документов
- **Технические** — ТЗ, ЧТЗ, BRD, ПМИ, Скоуп, ОТАР
- **Пользовательские** — Руководство пользователя, Руководство администратора, Руководство по инсталляции
- **Проектные** — проектная документация, технические и проектные решения, Описание комплекса программ
- **Эксплуатационная** — для поддержки, по организации сопровождения
- **Приёмо-сдаточная**
- **Договорная** — SLA, договоры
- **Тендерная** — техническое задание, методики испытаний
- **Сертификационная** — для сертификации программных продуктов
- **Аудит артефактов консалтинга**

### Артефакты Agile / продуктовые
- **User Story** (US, US+AC)
- **Use Case** (UC, UseCases)
- **Story Mapping / User Story Map** (USM)
- **Job Story (JTBD)**
- **Impact Map**
- **Customer Journey Map (CJM)**, прямой и модифицированный CJM
- **User Flow, Screen Flow**
- **Definition of Done (DoD)**, Definition of Ready (DoR)

### Формализация и методологии
- **BABOK** (сертификат приветствуется)
- **PMBOK**
- **ISO/IEC/IEEE 29148:2018** (SRS)
- **ГОСТ 34.602-89**, ГОСТ 19.201-78, РД 50-34.698-90
- **ГОСТы 34 серии**, ГОСТ (ЕСПД), ЕСКД
- **MECE-структурирование**
- **SIPOC**
- **Теория ограничений Голдратта**

## Нотации моделирования

- **BPMN** (1.x, 2.x)
- **UML**:
  - Sequence, Activity, State Machine
  - Sequence Flow, Data Flow
- **IDEF**, IDEF1x
- **DFD** (Data Flow Diagram)
- **EPC / eEPC** (Event-Driven Process Chain)
- **ER-диаграмма / ERD**
- **DMN** (Decision Model and Notation)
- **ARIS** (как нотация и как платформа)
- **SADT**
- **Archimate / Аrсhimаtе**
- **C4 Model**

### Инструменты моделирования
- **Enterprise Architect** (Sparx)
- **Camunda / Zeebe / Activiti / flowable** (BPM-движки с моделлером)
- **ELMA**
- **Creatio** (⚠️ BPMN ELMA/Creatio)
- **BPMSoft**
- **PlantUML**
- **draw.io**
- **Visio**
- **Aris** (как инструмент)
- **Pega**

## Продуктовая аналитика

### Метрики и KPI
- **Пользовательские** — LTV, MRR, Retention, Churn Rate, DAU, MAU
- **Финансовые** — ROI, unit-экономика
- **Маркетинговые** — CPC, CPM, UA (User Acquisition)
- **Качество данных** — Data Quality metrics

### Подходы и методы
- **CustDev** (Customer Development)
- **JTBD** (Jobs To Be Done)
- **A/B-тесты, A/A-тесты**
- **Стратификация**
- **Bootstrap, CUPED**
- **ICE / RICE** (оценка приоритета)
- **Go-to-Market strategy**
- **Дерево метрик**
- **MVP / MLP**
- **Оценка ёмкости рынка**
- **Разработка профилей целевой аудитории**
- **Постановка гипотез и их проверка**

### Исследования
- Глубинные интервью с пользователями
- Фокус-группы
- Тестирование прототипов на пользователях
- Сквозная аналитика
- Клиентские пути, воронки продаж

### Маркетинг и Digital
- **Воронка пользователей** (CPC, LTV, CPM, MAU, DAU, Retention, CDP, SEO, Paid media)
- **Антифрод** — GIVT/SIVT трафик, MRC стандарт фильтрации
- **RTB-реклама** (Real-Time Bidding)
- **Web-аналитика**

## Data / DWH аналитика

### Методологии и модели хранилищ
- **Моделирование данных** — концептуальная, логическая, физическая модели
- **Data Vault** (подход)
- **Anchor Modeling**
- **Enterprise Architect** (как инструмент data-modeling)
- **Star Schema, Snowflake Schema**
- **DWH слои** — RAW, DDS (Detailed Data Store), CDM (Common Data Mart)

### Процессы работы с данными
- **ETL / ELT / CDC**
- **S2T маппинг** (Source-to-Target)
- **Витрины данных**
- **Batch и Streaming обработка**
- **OLTP, OLAP**
- **OLAP-кубы** (SSAS, MDX)
- **Data Governance**
- **Data Quality**
- **НСИ** (нормативно-справочная информация), MDM

### ETL-инструменты
- **Informatica PowerCenter, Informatica Developer**
- **Oracle Golden Gate, Oracle Data Integrator (ODI)**
- **SAS Data Management**
- **Pentaho DI**
- **Apache Nifi**
- **Apache Airflow** (DAGs, оркестрация)
- **Apache Sqoop**
- **Talend**
- **Debezium** (CDC)
- **Mule**
- **Arenadata Streaming**
- **MDM HFLabs**

### BI / Визуализация
- **Tableau**
- **Power BI** (DAX)
- **Qlik** (View, Sense, QlikView)
- **Yandex DataLens**
- **Apache Superset**
- **Google Data Studio**
- **Metabase**
- **SAP Business Objects (BO)**
- **Amplitude**
- **Mixpanel**
- **AppsFlyer**, MyTracker
- **Matomo**
- **Навигатор** (российский BI для трейдинга)
- **PowerBI / Qlik / JDA** (специализированные)

### Аналитика трекинг-систем (SDK для сбора данных)
- **Google Analytics**, Yandex Metrica, MobMetrica
- **Firebase Analytics**, Firebase Crashlytics
- **AppMetrica** (Яндекс), Crashlytics

### Математическое моделирование
- **Matlab**
- **AnyLogistix** (цепи поставок)

## Проектирование интеграций (со стороны аналитика)

- REST API, SOAP, gRPC, WebSocket — проектирование контрактов
- Корпоративные сервисные шины (ESB)
- Очереди сообщений
- Брокеры — RabbitMQ, Kafka (с точки зрения модели данных и потоков)
- Описание API (swagger / openapi)
- Proектирование сущностей и потоков данных
- Проработка интеграций на REST-запросах
- S2T маппинг
- Постановка задач на реализацию интеграций

## Архитектура бизнес-систем

- **Enterprise Architecture** — принципы построения корпоративной архитектуры
- **TOGAF**
- **Микроэкономика** (архитектура предприятия, организационные структуры, процессный подход)
- **Понимание архитектуры взаимодействия информационных систем**
- **Методы проектирования программной архитектуры**
- **GAP-анализ архитектуры**
- **Бизнес-архитектура для холдингов**
- **AS-IS / TO-BE**

### Обследование бизнеса
- Проведение обследования текущих бизнес-процессов и ИТ-архитектуры
- Разработка целевого состояния процессов и ИТ-архитектуры

## Системный анализ (ИТ-аспект)

- Проектирование реляционных моделей данных
- SQL на уровне написания сложных запросов (Joins, агрегаты, подзапросы) — см. также Development/БД
- Понимание микросервисной архитектуры и её отличий от монолитной
- Понимание форматов XML/XSD, JSON, YAML, CSV, Parquet
- Проектирование и описание API
- Описание REST API
- Описание UI (⚠️ пересечение с Design)
- Написание DAG-ов для оркестрации
- Понимание stateful/stateless, синхронных/асинхронных вызовов
- WAN/LAN, сетевые протоколы (на высоком уровне)

## Управление ИТ-проектами (со стороны аналитика и менеджера)

### Методологии управления
- **Agile** (общий зонтик), Lean, XP, OpenUP
- **Scrum** (Scrum Master, Product Owner, Backlog management)
- **Kanban**
- **SAFe** (Scaled Agile Framework)
- **Waterfall**
- **V-модель**
- **PMBOK / PMI**
- **ITIL**
- **RUP**
- **ArchOps**

### Практики управления
- Планирование и контроль исполнения
- Риск-менеджмент
- Управление бюджетом
- Управление изменениями
- Управление скоупом
- Декомпозиция и оценка задач
- Работа с бэклогом (ведение, приоритизация)
- Релиз-менеджмент
- Статистика по процессным метрикам (среднее, медиана, перцентиль)

### Проектная документация PM-а
- SLA
- План-графики проектов
- Протоколирование встреч
- Договорная документация
- Конкурсная документация (тендеры)

### Инструменты PM
См. «Разное / Проектное управление»

## Инструменты (сводка)

### Системы ведения задач / трекеры (пересечение с Разное)
- Jira (с X-RAY), Confluence — Atlassian
- YouTrack, Trello, Asana, Redmine, Kaiten, Clickup, Яндекс Трекер, Bitbucket Issues, Bugzilla

### Моделирование / диаграммирование
- Enterprise Architect (Sparx), PlantUML, Visio, draw.io, Lucidchart, Aris, Archimate tools, Miro, Keynote

### Прототипирование (⚠️ см. также Design)
- Figma, Sketch, Axure RP, Balsamiq, Principle, ProtoPie, InVision (Studio, Inspect), Marvel, Zeplin, Fireworks (Adobe), Moqups, Framer, Timeslot

### Сбор и анализ данных
- SQL (любой клиент — DBeaver, DataGrip, PgAdmin, SSMS)
- Excel (сводные таблицы, формулы, обработка массивов)
- Python для анализа (Pandas, NumPy, Matplotlib, Seaborn)
- Jupyter, JupyterHub

### BI-инструменты (повтор для полноты)
- Tableau, Power BI, Qlik (View/Sense), DataLens, Superset, Metabase, Amplitude

### Office-стек
- **MS Office** — Word, Excel, PowerPoint, Visio, Outlook, Project, SharePoint, Teams, Access, BizTalk
- **Keynote** (Apple)
- **Google Workspace** (Docs, Sheets, Slides, Data Studio)

## Пересечения

- **SQL** как язык — см. Development/БД. Здесь — применение в аналитике.
- **BPMN, UML, ERD** — как нотации живут здесь; как реализация в коде — см. Development.
- **Прототипирование (Figma, Axure)** — пересечение с Design. Аналитик использует low-fidelity прототипы, дизайнер — high-fidelity.
- **BPM-движки (Camunda, Zeebe, Activiti)** — движок как инструмент разработчика в Development, но моделирование процессов — здесь.
- **Продуктовые метрики (LTV, Retention, DAU)** — также см. Разное / Product Management.
- **Data Science** — формально живёт в Development (ML-фреймворки), но опыт работы с данными и обучения моделей — здесь.
- **Описание UI** при системном анализе — пересечение с Design.

## Неоднозначное

- ⚠️ **Pega** — BPM-платформа и аналитический инструмент одновременно.
- ⚠️ **Camunda, ELMA, Creatio, BPMSoft** — BPMS живёт между Analysis (моделирование) и Development (интеграция движка в приложения).
- ⚠️ **SAP (IBP, APO, SNP, BO)** — корпоративный пакет, пересекает Analysis (планирование, отчётность) и Development (интеграция).
- ⚠️ **Terminal Micex Trade SE, QIUK, NTPro, smartFX** — инструменты трейдера, одновременно отраслевой опыт (FinTech) и инструмент аналитика финансового рынка. Вынесено в Разное/Отраслевой/FinTech.
