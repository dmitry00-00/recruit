# DevOps

CI/CD, контейнеры и оркестрация, инфраструктура, облака, мониторинг и сопровождение.

## CI / CD

### CI/CD-платформы
- **Jenkins**
- **GitLab CI/CD**
- **GitHub Actions** (⚠️ не в бульоне явно, но подразумевается)
- **TeamCity** (JetBrains)
- **Azure DevOps / Azure DevOps Server**
- **Bamboo** (Atlassian)
- **GoCD**
- **Octopus Deploy**
- **CircleCI, Drone** (⚠️)
- **werf**

### CI для mobile
- **Fastlane**
- **Bitrise**

### Пайплайны
- Написание pipeline-ов
- Параллелизация задач
- Сборка, тестирование, деплой
- Release management
- CI для автотестов (пересечение с QA)

## Контейнеризация

### Контейнер-рантаймы
- **Docker** (Swarm, Dockerfile, Compose, docker-compose)
- **Podman**
- **containerd**
- **CRI-O**
- **runc**
- **LXC**

### Builder и регистры
- **Dockerfile**
- **werf**
- **Container Registry** (Docker Hub, GitLab Registry, Sonatype Nexus, JFrog Artifactory, Harbor)
- Параметры организации сети, файловой системы и слоёв, тегирование

### Оркестрация
- **Kubernetes (K8s)** — Ingress, Prometheus Operator, kustomize, Helm charts, longhorn
- **Docker Swarm**
- **Nomad** (HashiCorp)
- **OpenShift (Container Platform), OKD**
- **Rancher**
- **Apache Mesos + Marathon, Aurora**
- **Google Kubernetes Engine (GKE)**
- **Fleet**

### K8s-экосистема
- **Helm** (чарты, kustomize)
- **ArgoCD** (GitOps)
- **Istio, Linkerd, Traefik Mesh, Open Service Mesh (OSM), Nginx Service Mesh (NSM), Kuma** — Service Mesh
- **Envoy**
- **Ingress** (NGINX Ingress, Traefik)

## Инфраструктура как код (IaC)

- **Terraform** (HashiCorp)
- **Ansible** (описание конфигураций, роли, плейбуки)
- **Puppet**
- **SaltStack** (Salt)
- **Pulumi** (⚠️ не в бульоне явно)
- **CloudFormation** (AWS)
- **Vagrant**
- **Инструмент сборок** — werf
- **Infrastructure as Code, Everything as Code, Architecture as Code, Docs as Code** — принципы

## Виртуализация

### Гипервизоры и среды
- **VMware** (vSphere, vCloud)
- **KVM / QEMU**
- **Proxmox**
- **OpenVZ**
- **libvirt**
- **Vagrant** (управление окружениями)

### Приватные облака
- **OpenStack** (Nova, Cinder, Neutron)
- **OpenNebula**

## Облачные платформы (публичные)

### AWS
- EC2, S3, Lambda, API Gateway, SNS, AWS Glue, CloudFormation, AWS Command Line, IAM, Redshift (⚠️ также БД)

### Azure
- Azure DevOps, Azure DevOps Server, Azure AD, Azure B2C, CosmosDB (⚠️ также БД)

### Google Cloud
- GCloud, Google Cloud IAM, BigQuery (⚠️ также аналитика), Spanner

### Yandex Cloud
- Yandex Cloud, Cloud IAM

### IBM Cloud / IBM SystemI
- WebSphere, MQ, Integration Bus, DataPower, Cognos, Planning Analytics, ILOG

### Concept
- **CNCF стек** (Cloud-Native Computing Foundation)
- **Cloud-native сервисы**
- **CDN-архитектуры**

## Системы контроля версий (VCS)

- **Git** (как инструмент DevOps-инженера)
- **Mercurial**
- **SVN**
- **Team Foundation Server (TFS)**
- **Платформы** — GitLab, GitHub, Bitbucket, Stash, Gitea, Azure Repos

## Мониторинг

### Метрики
- **Prometheus** (Alert Manager, PromQL)
- **Grafana** (Loki, Promtail, k6)
- **Zabbix**
- **Nagios, Icinga**
- **Telegraf, FluentBit, Fluentd** (data collectors)
- **Victoriametrics**
- **OpenTelemetry** (⚠️ не в бульоне явно)
- **Okmeter**

### APM (Application Performance Monitoring)
- **Dynatrace**
- **AppDynamics**
- **NewRelic**
- **DataDog**
- **Sentry** (Sentry.io)

### Трассировка
- **Jaeger**
- **Zipkin**
- **OpenTracing**

### Логирование
- **ELK / EVK Stack** — Elasticsearch, Logstash, Kibana
- **Graylog / Greylog**
- **Splunk**
- **Loki** (Grafana)
- **Fluentd, FluentBit, Filebeat, JournalBeat**
- **log monitoring Kibana**
- **ArcSight** (SIEM, также InfoSec)

### Alerting
- **Alertmanager** (Prometheus)
- **OpsGenie** (Atlassian)
- **Pager systems**

## Балансировка и сеть

### Балансировщики / Reverse-proxy
- **NGINX** (также web-сервер), Microsoft IIS
- **HAProxy**
- **Traefik**
- **Varnish** (HTTP cache)
- **Keepalived**
- **Envoy** (часть Service Mesh)

### Web-серверы
- **Apache HTTP Server, Apache Tomcat**
- **NGINX, Microsoft IIS**
- **Gunicorn, Daphne, Uvicorn** (Python)
- **Puma** (Ruby)
- **Swoole, KPHP** (PHP)
- **Wildfly** (Java EE)

## Сеть (администрирование)

- **Сетевые протоколы** — VLAN, ARP, TCP/IP, DHCP, Multicast, IGMP, LDP, RSVP, MPLS, OSPF, BGP, IS-IS, 802.1Q
- **Протоколы динамической маршрутизации**
- **WAN/LAN**, SDN, NFV
- **Software-defined networking**
- **VPN** (OpenVPN), IPSEC
- **DNS, DHCP, SMTP, SNMP, RSYNC, FTP, SSH, SSL/TLS, Kerberos**
- **Control Plane / Data Plane** (коммутаторы, маршрутизаторы)
- **IP Multicast**
- **Open vSwitch (OVN)**
- **LDAP** (OpenLDAP) — часто в связке с InfoSec

## Системное администрирование

### Linux
- Linux (internals, threads, sockets, ipc)
- Работа с командной строкой
- Makefile
- Abash (базовые команды Unix)
- Разработка драйверов, модулей ядра Linux
- Анализ логов систем

### Windows Server
- Windows Server, Active Directory (AD), WSUS, DFS
- PowerShell

### Файловые системы / хранилища
- **Ceph**
- **LVM**
- **Minio** (S3-совместимое)
- **SAMBA**
- **Rancher / Longhorn**

### Управление пакетами
- **rpm, Rufus**
- Пакетные менеджеры Linux (apt, yum, dnf — ⚠️)

## Хранилище артефактов

- **Sonatype Nexus**
- **JFrog Artifactory**
- **Bower** (⚠️ устаревший для JS)
- **Harbor** (контейнерный регистр)

## Secrets / KMS

- **HashiCorp Vault**
- **KeyCloak** (SSO / IdP)
- **AWS KMS / Secrets Manager**
- **Azure Key Vault**

## Мессенджинг / очереди (инфраструктурный аспект)

Здесь — как запускаемые сервисы; как библиотеки-клиенты см. Development/Интеграция.
- **Apache Kafka** (ZooKeeper) — CMAK
- **RabbitMQ**
- **NATS**
- **ActiveMQ (ArtemisMQ)**
- **IBM MQ / WebSphere MQ**
- **Tibco EMS**
- **ZeroMQ**
- **OracleAQ**
- **Redis Streams** (⚠️)

## SRE-практики

- **SLA / SLI / SLO** — формирование и поддержка
- **Error Budget**
- **Incident response / локализация проблем**
- **Критерии доступности**
- **Post-mortem** (⚠️ не явно)
- **Chaos engineering** (⚠️)
- **Готовность к восстановлению после сбоев**
- **Горизонтально-масштабируемые сервисы, отказоустойчивость**
- **Backup и восстановление** — RMAN, Standby
- **Мониторинг нагрузки, профили нагрузки**

## Оркестраторы задач / планировщики

- **Celery** (⚠️ также Development)
- **Apache Airflow** (DAGs)
- **Sidekiq** (Ruby)
- **Apache Nomad**
- **Temporal** (workflow engine)
- **Cron / systemd timers**
- **JobRunr, Hangfire** (⚠️ Hangfire — .NET)

## Коммуникация инфраструктуры

### Прочее инструменты
- **Consul** (HashiCorp)
- **Apache ZooKeeper, Apache Curator**
- **etcd** (⚠️)
- **Service Discovery patterns**

### Базы как сервис и их сопровождение
- Администрирование PostgreSQL, Oracle, MS SQL, MySQL — см. также Development/БД, но здесь — operational concerns (реплики, secondary, стандбай, бэкапы)

## Инструменты-помощники

- **Putty**
- **WinSCP**
- **WSL**
- **curl, httpx**
- **tmux, screen** (⚠️ не в бульоне, но типичные)

## Сборка и дистрибуция приложений

- **Conan.io** (C++)
- **Bitrise, Fastlane, XcodeGen, SwagGen** — mobile
- **werf** — Docker/K8s orchestrated builds

## Пересечения

- **Kafka, RabbitMQ, NATS** — как сервисы здесь, как библиотеки-клиенты в Development/Интеграция.
- **SonarQube, Fortify** — запуск в пайплайнах здесь, анализ результатов в QA.
- **MLOps пайплайны** (MLFlow, KubeFlow) — инфраструктурно здесь, методологически в Data Science (Development).
- **KeyCloak, Vault, LDAP, SSL/TLS** — пересечение с InfoSec.
- **LDAP, Kerberos, SAML, OAuth2** — аутентификация в DevOps-контексте, но принципы и стандарты — в InfoSec.
- **Fastlane, Bitrise** — CI для mobile, но также мобильная разработка (Development/Mobile).

## Неоднозначное

- ⚠️ **NGINX** — web-сервер, балансировщик, reverse-proxy. Здесь; как web-сервер упоминается и в Development.
- ⚠️ **Service Mesh (Istio, Linkerd и т.д.)** — инфраструктурный слой, но на стыке с архитектурой приложения. Здесь.
- ⚠️ **ClickHouse, Greenplum, Vertica** — колоночные БД. Сопровождение — здесь, использование — в Analysis/DWH или Development/БД.
- ⚠️ **Yocto, GCC, GNU make** — тулинг embedded-разработки. В Development/Embedded.
- ⚠️ **Apache Airflow** — классифицируется как DevOps (оркестрация пайплайнов) и Analysis (ETL-пайплайны). Основной лист — Analysis/ETL, но операционная сторона — здесь.
