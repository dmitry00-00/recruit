import { db } from './schema';
import type { Position, Vacancy, Candidate, WorkEntry, ResponseEvent, RecruitmentTask } from '@/entities';

export async function seedIfEmpty(): Promise<void> {
  // Seed positions
  const positionsCount = await db.positions.count();
  if (positionsCount === 0) {
    const positionsModule = await import('@/data/defaultPositions.json');
    const now = new Date();
    const positions: Position[] = (positionsModule.default.positions as Record<string, unknown>[]).map(
      (p) => ({
        ...p,
        createdAt: now,
        updatedAt: now,
      } as Position)
    );
    await db.positions.bulkAdd(positions);
    console.log(`[DB] Seeded ${positions.length} default positions`);
  }

  // Seed vacancies
  const vacanciesCount = await db.vacancies.count();
  if (vacanciesCount === 0) {
    const vacModule = await import('@/data/seedVacancies.json');
    const now = new Date();
    const vacancies: Vacancy[] = (vacModule.default.vacancies as Record<string, unknown>[]).map(
      (v) => ({
        ...v,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      } as Vacancy)
    );
    await db.vacancies.bulkAdd(vacancies);
    console.log(`[DB] Seeded ${vacancies.length} vacancies`);
  }

  // Seed candidates and work entries
  const candidatesCount = await db.candidates.count();
  if (candidatesCount === 0) {
    const candModule = await import('@/data/seedCandidates.json');
    const now = new Date();
    const rawCandidates = candModule.default.candidates as Record<string, unknown>[];

    for (const raw of rawCandidates) {
      const workEntriesRaw = (raw.workEntries as Record<string, unknown>[]) || [];

      const candidate: Candidate = {
        id: raw.id as string,
        firstName: raw.firstName as string,
        lastName: raw.lastName as string,
        email: raw.email as string,
        phone: raw.phone as string,
        telegramHandle: raw.telegramHandle as string,
        city: raw.city as string,
        country: raw.country as string,
        workFormat: raw.workFormat as Candidate['workFormat'],
        relocate: raw.relocate as boolean,
        salaryExpected: raw.salaryExpected as number,
        currency: raw.currency as Candidate['currency'],
        notes: raw.notes as string,
        createdAt: now,
        updatedAt: now,
      };

      await db.candidates.add(candidate);

      const workEntries: WorkEntry[] = workEntriesRaw.map((we) => ({
        id: we.id as string,
        candidateId: raw.id as string,
        companyName: we.companyName as string,
        positionId: we.positionId as string,
        grade: we.grade as WorkEntry['grade'],
        startDate: new Date(we.startDate as string),
        endDate: we.endDate ? new Date(we.endDate as string) : undefined,
        isCurrent: we.isCurrent as boolean,
        tools: we.tools as WorkEntry['tools'],
        salary: we.salary as number,
        currency: (we.currency || 'RUB') as WorkEntry['currency'],
      }));

      if (workEntries.length > 0) {
        await db.workEntries.bulkAdd(workEntries);
      }
    }

    console.log(`[DB] Seeded ${rawCandidates.length} candidates with work entries`);
  }

  // Seed response events (demo history)
  const eventsCount = await db.responseEvents.count();
  if (eventsCount === 0) {
    const now = new Date();
    const d = (daysAgo: number, hoursAgo = 0) => new Date(now.getTime() - daysAgo * 86400000 - hoursAgo * 3600000);

    const events: ResponseEvent[] = [
      // Алексей Петров → Яндекс Senior Frontend (полный цикл — принят)
      { id: 'rev_1',  vacancyId: 'vac_frontend_senior_yandex', candidateId: 'cand_alexey_petrov', type: 'candidate_applied',   createdAt: d(30) },
      { id: 'rev_2',  vacancyId: 'vac_frontend_senior_yandex', candidateId: 'cand_alexey_petrov', type: 'recruiter_contacted',  comment: 'Связались через Telegram, договорились на скрининг', createdAt: d(28) },
      { id: 'rev_3',  vacancyId: 'vac_frontend_senior_yandex', candidateId: 'cand_alexey_petrov', type: 'screening_scheduled',  scheduledAt: d(25), createdAt: d(27) },
      { id: 'rev_4',  vacancyId: 'vac_frontend_senior_yandex', candidateId: 'cand_alexey_petrov', type: 'screening_done',       comment: 'Хорошее впечатление, сильный опыт в React', createdAt: d(25) },
      { id: 'rev_5',  vacancyId: 'vac_frontend_senior_yandex', candidateId: 'cand_alexey_petrov', type: 'interview_scheduled',  scheduledAt: d(20), createdAt: d(24) },
      { id: 'rev_6',  vacancyId: 'vac_frontend_senior_yandex', candidateId: 'cand_alexey_petrov', type: 'interview_done',       comment: 'Техническое интервью пройдено успешно. Live coding — отлично', createdAt: d(20) },
      { id: 'rev_7',  vacancyId: 'vac_frontend_senior_yandex', candidateId: 'cand_alexey_petrov', type: 'test_task_sent',       createdAt: d(19) },
      { id: 'rev_8',  vacancyId: 'vac_frontend_senior_yandex', candidateId: 'cand_alexey_petrov', type: 'test_task_received',   comment: 'Тестовое задание выполнено качественно, чистый код', createdAt: d(16) },
      { id: 'rev_9',  vacancyId: 'vac_frontend_senior_yandex', candidateId: 'cand_alexey_petrov', type: 'offer_sent',           comment: 'Оффер: 480 000 ₽, гибрид', createdAt: d(14) },
      { id: 'rev_10', vacancyId: 'vac_frontend_senior_yandex', candidateId: 'cand_alexey_petrov', type: 'offer_accepted',       comment: 'Принял оффер, выход 1 апреля', createdAt: d(12) },

      // Мария Иванова → СберТех Middle Frontend (в процессе — тех. интервью)
      { id: 'rev_11', vacancyId: 'vac_frontend_middle_sber', candidateId: 'cand_maria_ivanova', type: 'candidate_applied',    createdAt: d(14) },
      { id: 'rev_12', vacancyId: 'vac_frontend_middle_sber', candidateId: 'cand_maria_ivanova', type: 'recruiter_contacted',  comment: 'Звонок, обсудили условия', createdAt: d(12) },
      { id: 'rev_13', vacancyId: 'vac_frontend_middle_sber', candidateId: 'cand_maria_ivanova', type: 'screening_scheduled',  scheduledAt: d(9), createdAt: d(11) },
      { id: 'rev_14', vacancyId: 'vac_frontend_middle_sber', candidateId: 'cand_maria_ivanova', type: 'screening_done',       comment: 'Мотивация высокая, зарплатные ожидания в рамках', createdAt: d(9) },
      { id: 'rev_15', vacancyId: 'vac_frontend_middle_sber', candidateId: 'cand_maria_ivanova', type: 'interview_scheduled',  scheduledAt: d(3), createdAt: d(7) },
      { id: 'rev_16', vacancyId: 'vac_frontend_middle_sber', candidateId: 'cand_maria_ivanova', type: 'note',                 comment: 'Ожидаем результаты тех. интервью', createdAt: d(3) },

      // Дмитрий Соколов → Тинькофф Senior Backend (отклонён)
      { id: 'rev_17', vacancyId: 'vac_backend_senior_tinkoff', candidateId: 'cand_dmitry_sokolov', type: 'recruiter_contacted', comment: 'Нашли резюме на hh.ru', createdAt: d(21) },
      { id: 'rev_18', vacancyId: 'vac_backend_senior_tinkoff', candidateId: 'cand_dmitry_sokolov', type: 'screening_scheduled', scheduledAt: d(18), createdAt: d(20) },
      { id: 'rev_19', vacancyId: 'vac_backend_senior_tinkoff', candidateId: 'cand_dmitry_sokolov', type: 'screening_done',      comment: 'Опыт релевантный, но зарплатные ожидания значительно выше бюджета', createdAt: d(18) },
      { id: 'rev_20', vacancyId: 'vac_backend_senior_tinkoff', candidateId: 'cand_dmitry_sokolov', type: 'candidate_rejected',  comment: 'Не сошлись по зарплатным ожиданиям (600к+ vs бюджет 450к)', createdAt: d(17) },

      // Анна Волкова → Ozon Middle Backend Python (в процессе — тестовое)
      { id: 'rev_21', vacancyId: 'vac_backend_middle_python', candidateId: 'cand_anna_volkova', type: 'candidate_applied',   createdAt: d(10) },
      { id: 'rev_22', vacancyId: 'vac_backend_middle_python', candidateId: 'cand_anna_volkova', type: 'recruiter_contacted', comment: 'Откликнулась через Telegram-канал', createdAt: d(9) },
      { id: 'rev_23', vacancyId: 'vac_backend_middle_python', candidateId: 'cand_anna_volkova', type: 'screening_done',      comment: 'Хороший потенциал, знание FastAPI', createdAt: d(7) },
      { id: 'rev_24', vacancyId: 'vac_backend_middle_python', candidateId: 'cand_anna_volkova', type: 'test_task_sent',      createdAt: d(6) },
      { id: 'rev_25', vacancyId: 'vac_backend_middle_python', candidateId: 'cand_anna_volkova', type: 'note',                comment: 'Ждём тестовое задание до конца недели', createdAt: d(4) },

      // Игорь Кузнецов → VK Senior Android (кандидат снял кандидатуру)
      { id: 'rev_26', vacancyId: 'vac_android_senior_vk', candidateId: 'cand_igor_kuznetsov', type: 'recruiter_contacted',    createdAt: d(15) },
      { id: 'rev_27', vacancyId: 'vac_android_senior_vk', candidateId: 'cand_igor_kuznetsov', type: 'screening_done',         comment: 'Сильный кандидат, опыт Android 6+ лет', createdAt: d(13) },
      { id: 'rev_28', vacancyId: 'vac_android_senior_vk', candidateId: 'cand_igor_kuznetsov', type: 'interview_scheduled',    scheduledAt: d(10), createdAt: d(12) },
      { id: 'rev_29', vacancyId: 'vac_android_senior_vk', candidateId: 'cand_igor_kuznetsov', type: 'candidate_withdrawn',    comment: 'Принял контр-оффер от текущего работодателя', createdAt: d(11) },

      // Никита Морозов → Kaspersky Senior Backend C# (оффер отклонён)
      { id: 'rev_30', vacancyId: 'vac_backend_csharp_senior', candidateId: 'cand_nikita_morozov', type: 'candidate_applied',   createdAt: d(25) },
      { id: 'rev_31', vacancyId: 'vac_backend_csharp_senior', candidateId: 'cand_nikita_morozov', type: 'screening_done',      comment: 'Опыт .NET 5 лет, знание микросервисов', createdAt: d(22) },
      { id: 'rev_32', vacancyId: 'vac_backend_csharp_senior', candidateId: 'cand_nikita_morozov', type: 'interview_done',      comment: 'Тех. интервью — хороший уровень, решил 2 из 3 задач', createdAt: d(18) },
      { id: 'rev_33', vacancyId: 'vac_backend_csharp_senior', candidateId: 'cand_nikita_morozov', type: 'offer_sent',          comment: 'Оффер: 380 000 ₽, офис Москва', createdAt: d(15) },
      { id: 'rev_34', vacancyId: 'vac_backend_csharp_senior', candidateId: 'cand_nikita_morozov', type: 'offer_declined',      comment: 'Кандидат выбрал удалённый оффер от другой компании', createdAt: d(13) },

      // Елена Смирнова → Avito Middle Android
      { id: 'rev_35', vacancyId: 'vac_android_middle_avito', candidateId: 'cand_elena_smirnova', type: 'candidate_applied',   createdAt: d(8) },
      { id: 'rev_36', vacancyId: 'vac_android_middle_avito', candidateId: 'cand_elena_smirnova', type: 'recruiter_contacted', comment: 'Первый контакт по email', createdAt: d(7) },
      { id: 'rev_37', vacancyId: 'vac_android_middle_avito', candidateId: 'cand_elena_smirnova', type: 'screening_scheduled', scheduledAt: d(4), createdAt: d(6) },

      // Сергей Фёдоров → Wildberries Senior Fullstack
      { id: 'rev_38', vacancyId: 'vac_fullstack_senior_wildberries', candidateId: 'cand_sergey_fedorov', type: 'candidate_applied', createdAt: d(5) },
      { id: 'rev_39', vacancyId: 'vac_fullstack_senior_wildberries', candidateId: 'cand_sergey_fedorov', type: 'note',              comment: 'Резюме на рассмотрении у техлида', createdAt: d(4) },

      // Ольга Козлова → TechFlow Junior Frontend
      { id: 'rev_40', vacancyId: 'vac_frontend_junior_startup', candidateId: 'cand_olga_kozlova', type: 'candidate_applied',   createdAt: d(3) },
      { id: 'rev_41', vacancyId: 'vac_frontend_junior_startup', candidateId: 'cand_olga_kozlova', type: 'recruiter_contacted', comment: 'Пригласили на скрининг', createdAt: d(2) },

      // Андрей Новиков → Альфа-Банк Senior Backend Java
      { id: 'rev_42', vacancyId: 'vac_backend_senior_java', candidateId: 'cand_andrey_novikov', type: 'recruiter_contacted',  createdAt: d(18) },
      { id: 'rev_43', vacancyId: 'vac_backend_senior_java', candidateId: 'cand_andrey_novikov', type: 'screening_done',       comment: 'Spring Boot, Kafka — подтверждён опыт', createdAt: d(15) },
      { id: 'rev_44', vacancyId: 'vac_backend_senior_java', candidateId: 'cand_andrey_novikov', type: 'interview_scheduled',  scheduledAt: d(1), createdAt: d(5) },

      // Павел Лебедев → Газпромбанк Lead Backend Java
      { id: 'rev_45', vacancyId: 'vac_backend_lead_java', candidateId: 'cand_pavel_lebedev', type: 'candidate_applied',    createdAt: d(12) },
      { id: 'rev_46', vacancyId: 'vac_backend_lead_java', candidateId: 'cand_pavel_lebedev', type: 'screening_done',       comment: '12 лет опыта, руководил командой из 8 человек', createdAt: d(10) },
      { id: 'rev_47', vacancyId: 'vac_backend_lead_java', candidateId: 'cand_pavel_lebedev', type: 'interview_done',       comment: 'System design — отлично, лидерские качества подтверждены', createdAt: d(7) },
      { id: 'rev_48', vacancyId: 'vac_backend_lead_java', candidateId: 'cand_pavel_lebedev', type: 'offer_sent',           comment: 'Оффер: 700 000 ₽, гибрид', createdAt: d(4) },

      // Максим Орлов → Ozon Senior Go Backend
      { id: 'rev_49', vacancyId: 'vac_backend_senior_go', candidateId: 'cand_maxim_orlov', type: 'candidate_applied',  createdAt: d(7) },
      { id: 'rev_50', vacancyId: 'vac_backend_senior_go', candidateId: 'cand_maxim_orlov', type: 'screening_done',     comment: 'Go 4 года, gRPC, Kubernetes', createdAt: d(5) },
      { id: 'rev_51', vacancyId: 'vac_backend_senior_go', candidateId: 'cand_maxim_orlov', type: 'interview_scheduled', scheduledAt: d(-1), createdAt: d(2) },
    ];

    await db.responseEvents.bulkAdd(events);
    console.log(`[DB] Seeded ${events.length} response events`);
  }

  // Seed recruitment tasks (demo)
  const tasksCount = await db.recruitmentTasks.count();
  if (tasksCount === 0) {
    const now = new Date();
    const d = (daysFromNow: number) => new Date(now.getTime() + daysFromNow * 86400000);

    const tasks: RecruitmentTask[] = [
      { id: 'task_1', title: 'Провести тех. интервью с Андреем Новиковым (Альфа-Банк)', vacancyId: 'vac_backend_senior_java', candidateId: 'cand_andrey_novikov', status: 'pending', dueDate: d(0), createdAt: now, updatedAt: now },
      { id: 'task_2', title: 'Ожидание ответа по офферу от Павла Лебедева (Газпромбанк)', vacancyId: 'vac_backend_lead_java', candidateId: 'cand_pavel_lebedev', status: 'in_progress', dueDate: d(0), createdAt: now, updatedAt: now },
      { id: 'task_3', title: 'Скрининг Елены Смирновой для Avito', vacancyId: 'vac_android_middle_avito', candidateId: 'cand_elena_smirnova', status: 'pending', dueDate: d(0), createdAt: now, updatedAt: now },
      { id: 'task_4', title: 'Проверить тестовое задание Анны Волковой (Ozon)', vacancyId: 'vac_backend_middle_python', candidateId: 'cand_anna_volkova', status: 'pending', dueDate: d(1), createdAt: now, updatedAt: now },
      { id: 'task_5', title: 'Тех. интервью Максима Орлова (Ozon Go)', vacancyId: 'vac_backend_senior_go', candidateId: 'cand_maxim_orlov', status: 'pending', dueDate: d(1), createdAt: now, updatedAt: now },
      { id: 'task_6', title: 'Отправить оффер Марии Ивановой (СберТех)', vacancyId: 'vac_frontend_middle_sber', candidateId: 'cand_maria_ivanova', status: 'pending', dueDate: d(2), createdAt: now, updatedAt: now },
      { id: 'task_7', title: 'Найти кандидатов на Senior Angular (Тинькофф)', vacancyId: 'vac_frontend_senior_angular', status: 'pending', dueDate: d(3), createdAt: now, updatedAt: now },
      { id: 'task_8', title: 'Обновить описание вакансии VK Lead Frontend', vacancyId: 'vac_frontend_lead_vk', status: 'pending', dueDate: d(4), createdAt: now, updatedAt: now },
      { id: 'task_9', title: 'Отправить фидбек Дмитрию Соколову', candidateId: 'cand_dmitry_sokolov', status: 'pending', dueDate: d(0), createdAt: now, updatedAt: now },
      { id: 'task_10', title: 'HR-интервью Сергея Фёдорова (Wildberries)', vacancyId: 'vac_fullstack_senior_wildberries', candidateId: 'cand_sergey_fedorov', status: 'pending', dueDate: d(5), createdAt: now, updatedAt: now },
      { id: 'task_11', title: 'Ревью резюме новых кандидатов на Junior Python', vacancyId: 'vac_backend_junior_python', status: 'pending', dueDate: d(2), createdAt: now, updatedAt: now },
      { id: 'task_12', title: 'Закрыть вакансию Яндекс Senior Frontend (принят)', vacancyId: 'vac_frontend_senior_yandex', status: 'done', dueDate: d(-2), createdAt: now, updatedAt: now },
    ];

    await db.recruitmentTasks.bulkAdd(tasks);
    console.log(`[DB] Seeded ${tasks.length} recruitment tasks`);
  }
}
