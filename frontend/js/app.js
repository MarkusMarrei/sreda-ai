// ==============================================================================
// SREDA AI v5 — Client Single Page Application Logic
// Optimized for AMD Ryzen Zen 4 + Radeon 780M Vulkan & Bonsai 2 Family
// ==============================================================================

(function () {
  'use strict';

  // --- STATE ---
  const state = {
    chats: [],
    activeChatId: null,
    activeModelPath: '',
    activeModelName: 'Ternary-Bonsai-2-27B-PTQ1_0.gguf',
    isStreaming: false,
    abortController: null,
    downloadPollInterval: null,
    currentDownload: null,
    systemInfo: null,
    isEngineAlive: false,
    isApiModel: false,
    providersConfig: null,
    apiModels: [],
    profile: {
      firstName: 'Пользователь',
      lastName: '',
      about: '',
      avatarUrl: '/static/assets/icons/user_avatar.png'
    },
    boost: {
      enabled: true,
      is_boosted: false,
      auto_boost_on_launch: true
    },
    skills: [],
    feedsConfig: null,
    editingSkillId: null,
    selectedSlashIndex: 0,
    filteredSkills: [],
    voices: [],
    activeVoiceId: localStorage.getItem('sreda_voice_id') || 'ru_dmitri',
    settings: {
      gpuLayers: 99,
      threads: 8,
      context: 8192,
      flashAttention: true,
      localServer: true,
      serverPort: 1234,
      language: 'ru',
      autoTts: false,
      voiceId: localStorage.getItem('sreda_voice_id') || 'ru_dmitri'
    }
  };

  // Global multimedia state
  let activeAttachment = null;

  // --- DOM REFERENCES ---
  const dom = {
    // Sidebar
    btnNewChat: document.getElementById('btn-new-chat'),
    chatsList: document.getElementById('chats-list'),
    btnOpenModels: document.getElementById('btn-open-models'),
    btnOpenSettings: document.getElementById('btn-open-settings'),

    // User Profile
    userProfileCard: document.getElementById('user-profile-card'),
    sidebarUserAvatar: document.getElementById('sidebar-user-avatar'),
    sidebarUserName: document.getElementById('sidebar-user-name'),
    sidebarUserSub: document.getElementById('sidebar-user-sub'),
    modalProfile: document.getElementById('modal-profile'),
    profilePreviewAvatar: document.getElementById('profile-preview-avatar'),
    profileAvatarInput: document.getElementById('profile-avatar-input'),
    btnResetAvatar: document.getElementById('btn-reset-avatar'),
    inputProfileFirstName: document.getElementById('input-profile-first-name'),
    inputProfileLastName: document.getElementById('input-profile-last-name'),
    inputProfileAbout: document.getElementById('input-profile-about'),
    btnSaveProfile: document.getElementById('btn-save-profile'),

    // Feeds (API / RSS)
    btnOpenFeeds: document.getElementById('btn-open-feeds'),
    modalFeeds: document.getElementById('modal-feeds'),
    tabFeedsApis: document.getElementById('tab-feeds-apis'),
    tabFeedsRss: document.getElementById('tab-feeds-rss'),
    feedsViewApis: document.getElementById('feeds-view-apis'),
    feedsViewRss: document.getElementById('feeds-view-rss'),
    baseApisContainer: document.getElementById('base-apis-container'),
    builtinNewsContainer: document.getElementById('builtin-news-container'),
    customRssContainer: document.getElementById('custom-rss-container'),
    btnToggleAddRss: document.getElementById('btn-toggle-add-rss'),
    addRssForm: document.getElementById('add-rss-form'),
    inputRssName: document.getElementById('input-rss-name'),
    inputRssCategory: document.getElementById('input-rss-category'),
    inputRssUrl: document.getElementById('input-rss-url'),
    btnSaveRss: document.getElementById('btn-save-rss'),
    btnCancelRss: document.getElementById('btn-cancel-rss'),
    feedPingStatus: document.getElementById('feed-ping-status'),

    // Custom APIs
    tabFeedsCustom: document.getElementById('tab-feeds-custom'),
    feedsViewCustom: document.getElementById('feeds-view-custom'),
    btnToggleAddCustomApi: document.getElementById('btn-toggle-add-custom-api'),
    addCustomApiForm: document.getElementById('add-custom-api-form'),
    inputApiName: document.getElementById('input-api-name'),
    selectApiCategory: document.getElementById('select-api-category'),
    inputApiUrl: document.getElementById('input-api-url'),
    selectApiMethod: document.getElementById('select-api-method'),
    selectApiAuthType: document.getElementById('select-api-auth-type'),
    inputApiKey: document.getElementById('input-api-key'),
    inputApiDesc: document.getElementById('input-api-desc'),
    btnCancelCustomApi: document.getElementById('btn-cancel-custom-api'),
    btnSaveCustomApi: document.getElementById('btn-save-custom-api'),
    customApisContainer: document.getElementById('custom-apis-container'),

    // Skills
    btnOpenSkills: document.getElementById('btn-open-skills'),
    modalSkills: document.getElementById('modal-skills'),
    skillsViewList: document.getElementById('skills-view-list'),
    skillsViewEditor: document.getElementById('skills-view-editor'),
    skillsCardsContainer: document.getElementById('skills-cards-container'),
    btnNewSkill: document.getElementById('btn-new-skill'),
    btnBackToSkills: document.getElementById('btn-back-to-skills'),
    skillEditorTitle: document.getElementById('skill-editor-title'),
    skillInputName: document.getElementById('skill-input-name'),
    skillInputTrigger: document.getElementById('skill-input-trigger'),
    skillInputDesc: document.getElementById('skill-input-desc'),
    skillInputPrompt: document.getElementById('skill-input-prompt'),
    btnSaveSkill: document.getElementById('btn-save-skill'),
    btnCancelSkillEdit: document.getElementById('btn-cancel-skill-edit'),
    skillsListFooter: document.getElementById('skills-list-footer'),

    // Slash Popup
    slashPopup: document.getElementById('slash-popup'),

    // Header
    headerChatTitle: document.getElementById('header-chat-title'),
    radarContainer: document.getElementById('radar-container'),
    modelSelectorChip: document.getElementById('model-selector-chip'),
    activeModelName: document.getElementById('active-model-name'),
    modelChipIcon: document.getElementById('model-chip-icon'),
    activeModelBadge: document.getElementById('active-model-badge'),
    btnToggleEngine: document.getElementById('btn-toggle-engine'),
    engineBtnText: document.getElementById('engine-btn-text'),
    btnToggleBoost: document.getElementById('btn-toggle-boost'),
    boostStatusText: document.getElementById('boost-status-text'),
    boostPillIcon: document.getElementById('boost-pill-icon'),
    checkAutoBoost: document.getElementById('check-auto-boost'),
    btnCompactRamNow: document.getElementById('btn-compact-ram-now'),
    boostModalBadge: document.getElementById('boost-modal-badge'),
    pillServerStatus: document.getElementById('pill-server-status'),
    btnToggleAutoTts: document.getElementById('btn-toggle-auto-tts'),
    btnHeaderSettings: document.getElementById('btn-header-settings'),

    // Chat Area
    chatScroll: document.getElementById('chat-scroll'),
    chatEmptyState: document.getElementById('chat-empty-state'),
    messagesContainer: document.getElementById('messages-container'),
    chatInput: document.getElementById('chat-input'),
    btnSendMessage: document.getElementById('btn-send-message'),
    btnAttachFile: document.getElementById('btn-attach-file'),
    btnVoiceInput: document.getElementById('btn-voice-input'),

    // Modals
    modalModels: document.getElementById('modal-models'),
    modalSettings: document.getElementById('modal-settings'),
    modalDlBanner: document.getElementById('modal-download-banner'),
    dlStatusText: document.getElementById('dl-status-text'),
    dlProgressBar: document.getElementById('dl-progress-bar'),
    btnCancelDl: document.getElementById('btn-cancel-dl'),
    headerDlPill: document.getElementById('header-dl-pill'),
    headerDlText: document.getElementById('header-dl-text'),

    // Models Tabs
    bonsaiList: document.getElementById('bonsai-list'),
    hfSearchInput: document.getElementById('hf-search-input'),
    btnHfSearch: document.getElementById('btn-hf-search'),
    hfResultsList: document.getElementById('hf-results-list'),
    installedModelsList: document.getElementById('installed-models-list'),
    installedCount: document.getElementById('installed-count'),
    tabBtnApiModels: document.getElementById('tab-btn-api-models'),
    apiModelsCount: document.getElementById('api-models-count'),
    apiModelsList: document.getElementById('api-models-list'),
    btnGotoApiSettings: document.getElementById('btn-goto-api-settings'),
    btnRefreshModels: document.getElementById('btn-refresh-models'),
    btnOpenFolder: document.getElementById('btn-open-folder'),

    // Settings
    diagCpuGpu: document.getElementById('diag-cpu-gpu'),
    diagRam: document.getElementById('diag-ram'),
    inputGpuLayers: document.getElementById('input-gpu-layers'),
    valGpuLayers: document.getElementById('val-gpu-layers'),
    inputThreads: document.getElementById('input-threads'),
    valThreads: document.getElementById('val-threads'),
    selectContext: document.getElementById('select-context'),
    checkFa: document.getElementById('check-fa'),
    checkLocalServer: document.getElementById('check-local-server'),
    inputServerPort: document.getElementById('input-server-port'),
    selectLang: document.getElementById('select-lang'),
    checkAutoTts: document.getElementById('check-auto-tts'),
    selectVoice: document.getElementById('select-voice'),
    activeVoiceStatus: document.getElementById('active-voice-status'),
    btnDownloadActiveVoice: document.getElementById('btn-download-active-voice'),
    voiceCatalogContainer: document.getElementById('voice-catalog-container'),
    btnOptimizeSettings: document.getElementById('btn-optimize-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings'),

    // Providers Elements
    checkProviderOpenrouter: document.getElementById('check-provider-openrouter'),
    inputOpenrouterKey: document.getElementById('input-openrouter-key'),
    btnToggleShowOpenrouterKey: document.getElementById('btn-toggle-show-openrouter-key'),
    btnTestOpenrouter: document.getElementById('btn-test-openrouter'),
    selectOpenrouterModel: document.getElementById('select-openrouter-model'),

    checkProviderGigachat: document.getElementById('check-provider-gigachat'),
    inputGigachatClientId: document.getElementById('input-gigachat-client-id'),
    inputGigachatSecret: document.getElementById('input-gigachat-secret'),
    btnToggleShowGigachatSecret: document.getElementById('btn-toggle-show-gigachat-secret'),
    inputGigachatKey: document.getElementById('input-gigachat-key'),
    btnToggleShowGigachatKey: document.getElementById('btn-toggle-show-gigachat-key'),
    btnTestGigachat: document.getElementById('btn-test-gigachat'),
    selectGigachatScope: document.getElementById('select-gigachat-scope'),
    selectGigachatModel: document.getElementById('select-gigachat-model'),

    checkProviderCustom: document.getElementById('check-provider-custom'),
    inputCustomName: document.getElementById('input-custom-name'),
    inputCustomUrl: document.getElementById('input-custom-url'),
    inputCustomKey: document.getElementById('input-custom-key'),
    btnToggleShowCustomKey: document.getElementById('btn-toggle-show-custom-key'),
    inputCustomModel: document.getElementById('input-custom-model'),
    btnTestCustom: document.getElementById('btn-test-custom')
  };

  // --- MOJIBAKE RECOVERY & NORMALIZATION ---
  const CP1252_MAP = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
    0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
    0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
    0x017E: 0x9E, 0x0178: 0x9F
  };

  function sanitizeMojibake(text) {
    if (!text || typeof text !== 'string') return text;
    // Check if text looks like corrupted UTF-8 (typical Russian letters misinterpreted as CP1252/Latin-1)
    if (!/[ÐÑâ]/.test(text)) return text;
    try {
      const bytes = [];
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code <= 0x7F) {
          bytes.push(code);
        } else if (CP1252_MAP[code]) {
          bytes.push(CP1252_MAP[code]);
        } else if (code <= 0xFF) {
          bytes.push(code);
        } else {
          return text;
        }
      }
      const fixed = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
      if (/[а-яА-ЯёЁ]/.test(fixed)) {
        return fixed;
      }
    } catch (e) {
      // not valid UTF-8 byte stream
    }
    return text;
  }

  // --- MULTI-LANGUAGE LOCALIZATION (8 LANGUAGES) ---
  // --- I18N (INTERNATIONALIZATION) ---
  const I18N = {
    "ru": {
        "defaultUserName": "Пользователь",
        "appVersionLabel": "Версия:",
        "appAuthorLabel": "Автор:",
        "appAuthorName": "Маркус Маррей",
        "renameChat": "Переименовать диалог",
        "deleteChat": "Удалить диалог",
        "newChat": "Новый диалог",
        "skills": "Скиллы",
        "userRole": "Пользователь",
        "models": "Модели",
        "settings": "Настройки",
        "autoTts": "Автоозвучка",
        "emptyTitle": "Чем я могу помочь вам сегодня?",
        "emptyDesc": "Выберите промпт ниже или начните свободный диалог на любом языке",
        "chipCity": "Города будущего и биоархитектура",
        "chipMusic": "Создать атмосферный ambient-трек",
        "chipTernary": "В чем магия Ternary-квантования Bonsai 2?",
        "chipCode": "Высокопроизводительный код на C++/Rust",
        "chatPlaceholder": "Задайте вопрос, прикрепите документ или используйте /скилл... (Enter для отправки)",
        "sendTooltip": "Отправить сообщение",
        "stopTooltip": "Остановить генерацию",
        "attachTooltip": "Прикрепить файл или документ",
        "voiceTooltip": "Голосовой ввод",
        "modalModelsTitle": "Каталог & Управление моделями",
        "tabBonsai": "Семейство Bonsai 2",
        "tabHf": "Поиск на Hugging Face",
        "tabInstalled": "Установленные на ПК",
        "btnSearch": "Поиск",
        "btnRefresh": "Обновить список",
        "btnOpenFolder": "Открыть папку моделей",
        "btnClose": "Закрыть",
        "searchHfPlaceholder": "Поиск моделей GGUF на Hugging Face (например: qwen2, mistral, llama)...",
        "modalSettingsTitle": "Параметры инференса & Комбайн SREDA AI",
        "tabInference": "Инференс & Оборудование",
        "tabServer": "API Сервер (LM Studio)",
        "tabLanguage": "Язык & Голос",
        "tabProviders": "Внешние API & Модели",
        "hwDiagCpuGpu": "Процессор & Графика",
        "hwDiagRam": "Память RAM",
        "gpuLayersLabel": "Слои в видеокарту (GPU Layers, Radeon 780M Vulkan):",
        "threadsLabel": "Потоки процессора (Ryzen Zen 4):",
        "contextLabel": "Размер контекста (токенов):",
        "flashAttentionLabel": "Flash Attention (-fa on)",
        "flashAttentionDesc": "Экономит до 40% RAM KV-кэша и ускоряет работу с файлами RAG.",
        "presetTitle": "Пресет максимальной производительности",
        "presetDesc": "99 слоев Vulkan, 8 потоков Zen 4, 8K контекст, Flash Attention ON",
        "optimize": "Оптимизировать",
        "apiActive": "Локальный сервер API активен",
        "copyBaseUrl": "Копировать Base URL",
        "testApiBtn": "Тест API",
        "apiPortLabel": "Основной порт API:",
        "snippetsTitle": "Инструкция по подключению:",
        "uiLangLabel": "Язык интерфейса:",
        "autoTtsLabel": "Автоматически озвучивать ответы модели",
        "autoTtsDesc": "При завершении генерации синтезирует речь (Piper TTS / Windows)",
        "cancel": "Отмена",
        "saveSettings": "Сохранить настройки",
        "modalProfileTitle": "Профиль & Персонализация пользователя",
        "avatarTitle": "Ваш аватар в диалогах",
        "avatarDesc": "Формат PNG, JPG или WebP до 5 МБ",
        "uploadPhoto": "Загрузить фото",
        "resetAvatar": "Сбросить",
        "firstNameLabel": "Имя:",
        "lastNameLabel": "Фамилия:",
        "aboutLabel": "О себе:",
        "aboutSub": "(эта информация будет передаваться нейросети для персонализации диалога)",
        "saveProfile": "Сохранить профиль",
        "profileFirstNamePlaceholder": "Имя",
        "profileLastNamePlaceholder": "Фамилия",
        "profileAboutPlaceholder": "Например: архитектор, люблю лаконичный код на Python, разрабатываю 3D сцены в Blender...",
        "modalSkillsTitle": "Библиотека навыков & Скиллы ассистента",
        "btnAddSkill": "Создать скилл",
        "skillsHint": "Скиллы трансформируют модель в профильного эксперта с уникальным набором инструкций.",
        "btnBack": "Назад",
        "skillEditTitle": "Редактирование скилла",
        "skillNameLabel": "Название скилла:",
        "skillTriggerLabel": "Триггер быстрого вызова (/команда):",
        "skillDescLabel": "Краткое описание назначения:",
        "skillPromptLabel": "Системный контекст / Промпт скилла:",
        "saveSkill": "Сохранить скилл",
        "skillsFooterHint": "Введите / в поле ввода диалога для быстрого вызова любого активного скилла.",
        "skillNamePlaceholder": "Blender Python Скриптер",
        "skillTriggerPlaceholder": "/blender",
        "skillDescPlaceholder": "Создание 3D сцен и процедурных генераторов через bpy...",
        "skillPromptPlaceholder": "Ты — ведущий эксперт по Blender Python API (bpy)...",
        "load": "Загрузить",
        "unload": "Выгрузить",
        "starting": "Запуск...",
        "saveSuccess": "✓ Настройки успешно сохранены",
        "profileSaved": "✓ Профиль успешно сохранен",
        "skillSaved": "✓ Скилл успешно сохранен",
        "skillDeleted": "Скилл удален",
        "generationStopped": "Генерация остановлена",
        "copied": "✓ Скопировано в буфер",
        "modalFeedsTitle": "API / RSS — Источники данных в реальном времени",
        "feedsNoKeyBadge": "Без ключей • Локально",
        "tabFeedsBuiltin": "Базовые API (Крипта, Биржа, Погода, Гео)",
        "tabFeedsRss": "Новости & RSS-каналы",
        "tabFeedsCustom": "Пользовательский API",
        "feedsBanner": "Нейросеть обращается к этим API напрямую через инструментные вызовы без тяжелого веб-парсинга и расхода контекста. Все API полностью публичны и не требуют ключей или регистрации.",
        "feedsFooterHint": "Используйте скиллы /market, /weather, /news в чате для мгновенного вызова этих данных",
        "feedActive": "Активен",
        "feedDisabled": "Отключен",
        "providersBanner": "Подключите внешние нейросети через API для работы без нагрузки на видеокарту. Все встроенные функции SREDA AI (RAG с файлами, мультимедиа SD/MusicGen, Live-данные API/RSS, Blender MCP и озвучка) работают с облачными моделями в полном объёме.",
        "enableLabel": "Включить:",
        "openrouterKeyLabel": "API Ключ OpenRouter:",
        "btnTestConnection": "Тест связи",
        "openrouterModelLabel": "Активная модель OpenRouter:",
        "gigachatTitle": "Сбер GigaChat (GigaChad API)",
        "gigachatDesc": "Официальная нейросеть Сбера • SSL Минцифры поддерживается автоматически",
        "gigachatClientIdLabel": "Client ID (Идентификатор клиента из проекта developers.sber.ru):",
        "gigachatSecretLabel": "Client Secret / API-ключ (Секрет клиента из личного кабинета Сбера):",
        "gigachatScopeLabel": "Область доступа (Scope):",
        "gigachatScopePers": "GIGACHAT_API_PERS (Физические лица / Личный)",
        "gigachatScopeCorp": "GIGACHAT_API_B2B (ИП и юрлица / Предоплата)",
        "gigachatModelLabel": "Активная модель GigaChat:",
        "gigachatBase64Toggle": "Или использовать готовые Авторизационные данные (Base64)",
        "gigachatBase64Label": "Авторизационные данные (Base64 из личного кабинета):",
        "customApiTitle": "Пользовательский OpenAI-совместимый API",
        "customApiProviderName": "Название провайдера:",
        "customApiBaseUrl": "Base URL эндпоинта:",
        "customApiKey": "API-Ключ:",
        "customApiModel": "Имя модели (Model ID):",
        "tabApiModels": "☁️ Внешние API",
        "apiModelsBanner": "Облачные модели работают через внешние API (OpenRouter, Сбер GigaChat, Custom) без нагрузки на видеокарту. Встроенные функции SREDA (RAG, картинки, музыка, Live-данные, Blender MCP) работают полностью.",
        "btnConfigureKeys": "Настроить ключи",
        "apiModelsEmpty": "Внешние API-модели пока не активированы. Включите OpenRouter, Сбер GigaChat или Custom API в Настройках.",
        "btnSelectModel": "Выбрать модель",
        "btnModelSelected": "Выбрана",
        "badgeRecommended": "Рекомендовано",
        "badgeActive": "Активна",
        "badgeLocal": "Локальная",
        "badgeApi": "API / Облако",
        "labelSize": "Размер:",
        "labelSpeed": "Скорость инференса:",
        "unitTokensSec": "т/с",
        "btnDownload": "Скачать",
        "btnActivate": "Активировать",
        "btnInstalled": "Установлена",
        "installedEmpty": "В папках моделей пока нет файлов .gguf.<br>Скачайте тернарную модель из вкладки <b>«Линейка Bonsai 2»</b> или найдите на <b>Hugging Face</b>.",
        "sredaBoostTitle": "SREDA Boost — Игровой режим ресурсов",
        "sredaBoostDesc": "Автоматически поднимает приоритет ядра инференса до High, понижает сторонние фоновые процессы и уплотняет ОЗУ для ускорения Radeon 780M UMA.",
        "autoBoostCheckbox": "Авто-Boost при старте инференса",
        "btnPurgeRam": "Очистить ОЗУ сейчас",
        "statusOff": "Выключен",
        "statusActive": "Активен",
        "boostOff": "Boost: Выкл",
        "boostOn": "Boost: Вкл",
        "boostActive": "Boost: Активен",
        "apiReady": "API Готов",
        "activeVoiceLabel": "Активный диктор для выбранного языка:",
        "voiceInstalledBadge": "Установлен",
        "btnDownloadVoice": "Скачать диктора (~60 МБ)",
        "voiceCatalogTitle": "Библиотека дикторов (Piper TTS — локально, без облака):",
        "voiceCatalogDesc": "Вы можете загрузить дикторов на разных языках по мере необходимости.",
        "copySnippet": "Копировать",
        "btnSkip": "Пропустить",
        "feedsTitle": "API / RSS",
        "badgeCloudApi": "API / Облако",
        "badgeFlagship27b": "Флагман 27B",
        "installedDownloadHint": "Скачайте тернарную модель из вкладки «Линейка Bonsai 2» или найдите на Hugging Face.",
        "apiModelsEnableHint": "Включите OpenRouter, Сбер GigaChat или Custom API в",
        "boostHighCpu": "Активен (High CPU)",
        "boostDisabled": "Выключен",
        "customApiKeyLabel": "API Ключ (если требуется):",
        "customApiModelLabel": "Имя модели:",
        "btnCompactRam": "Очистить ОЗУ сейчас",
        "boostCardTitle": "SREDA Boost — Игровой режим ресурсов",
        "boostCardDesc": "Автоматически поднимает приоритет ядра инференса до High, понижает сторонние фоновые процессы и уплотняет ОЗУ для ускорения Radeon 780M UMA.",
        "boostAutoLabel": "Авто-Boost при старте инференса",
        "bonsaiDesc": {
            "bonsai-2-2b-ptq1": "Ультра-легкая тернарная модель Prism ML. Потребление ~400 МБ памяти, мгновенная генерация (60+ т/с).",
            "bonsai-2-4b-ptq1": "Оптимальная модель для встроенных видеоядер и слабых ПК. Отличное понимание русского языка при весе всего 0.88 ГБ.",
            "bonsai-2-9b-ptq1": "Идеальный стандарт для быстрых тестов, рассуждений и кода. Быстрый инференс и стабильная логика при весе 1.86 ГБ.",
            "bonsai-1-8b-pq2": "Классическая модель Bonsai на архитектуре LLaMA-3 (8B) с 2-битным квантованием Prism ML.",
            "bonsai-2-27b-ptq1": "Флагманская тернарная модель Prism ML. Уровень рассуждений 27B при весе 5.54 ГБ. Полный оффлоад в Radeon 780M через Vulkan.",
            "bonsai-2-27b-pq2": "Повышенная точность 2-битного квантования Prism ML. Требует чуть больше памяти (6.71 ГБ), максимальное сохранение тонких деталей."
        },
        "baseApis": {
            "crypto": {
                "name": "Криптовалюта (CoinCap / CoinGecko)",
                "desc": "Котировки в реальном времени, 24ч динамика, объемы торгов и рыночная капитализация."
            },
            "stocks": {
                "name": "Акции, Индексы, Металлы (Yahoo Finance)",
                "desc": "Биржевые котировки акций (AAPL, TSLA, NVDA), фьючерсов на металлы (золото, серебро), сырье и индексы."
            },
            "rates": {
                "name": "Курсы мировых валют (ExchangeRate-API)",
                "desc": "Свежие обменные курсы мировых валют к рублю, доллару и евро (ExchangeRate-API)."
            },
            "weather": {
                "name": "Погода и Прогнозы (Open-Meteo)",
                "desc": "Высокоточный метеорологический API без рекламы и ключей: температура, ветер, осадки, влажность."
            },
            "geocoding": {
                "name": "Геокодинг и Население (Open-Meteo Geo)",
                "desc": "Определение точных географических координат, часовых поясов и численности населения городов мира."
            },
            "countries": {
                "name": "Страны и Столицы (REST Countries)",
                "desc": "Полный энциклопедический справочник по суверенным государствам (флаги, столицы, языки, валюты)."
            },
            "avatars": {
                "name": "Генератор аватаров (Dicebear API)",
                "desc": "Быстрая генерация уникальных векторных аватаров на основе любого текстового сида (Dicebear API)."
            }
        },
        "badgeCompatible": "Совместимо",
        "badgeHighLoad": "Высокая нагрузка",
        "badgeExceedsRam": "Превышает RAM"
    },
    "en": {
        "defaultUserName": "User",
        "appVersionLabel": "Version:",
        "appAuthorLabel": "Author:",
        "appAuthorName": "Markus Marrei",
        "renameChat": "Rename chat",
        "deleteChat": "Delete chat",
        "newChat": "New Chat",
        "skills": "Skills",
        "userRole": "User",
        "models": "Models",
        "settings": "Settings",
        "autoTts": "Auto Voice",
        "emptyTitle": "How can I help you today?",
        "emptyDesc": "Choose a prompt below or start a free conversation in any language",
        "chipCity": "Future cities & bio-architecture",
        "chipMusic": "Create an atmospheric ambient track",
        "chipTernary": "What is the magic of Bonsai 2 Ternary Quantization?",
        "chipCode": "High-performance C++/Rust code",
        "chatPlaceholder": "Ask a question, attach a document or use /skill... (Enter to send)",
        "sendTooltip": "Send message",
        "stopTooltip": "Stop generation",
        "attachTooltip": "Attach file or document",
        "voiceTooltip": "Voice input",
        "modalModelsTitle": "Model Catalog & Management",
        "tabBonsai": "Bonsai 2 Family",
        "tabHf": "Hugging Face Search",
        "tabInstalled": "Installed Locally",
        "btnSearch": "Search",
        "btnRefresh": "Refresh List",
        "btnOpenFolder": "Open Models Folder",
        "btnClose": "Close",
        "searchHfPlaceholder": "Search GGUF models on Hugging Face (e.g., qwen2, mistral, llama)...",
        "modalSettingsTitle": "Inference Parameters & SREDA AI Hub",
        "tabInference": "Inference & Hardware",
        "tabServer": "API Server (LM Studio)",
        "tabLanguage": "Language & Voice",
        "tabProviders": "External APIs & Models",
        "hwDiagCpuGpu": "Processor & Graphics",
        "hwDiagRam": "System Memory (RAM)",
        "gpuLayersLabel": "GPU Offload Layers (Radeon 780M Vulkan):",
        "threadsLabel": "CPU Threads (Ryzen Zen 4):",
        "contextLabel": "Context Window (Tokens):",
        "flashAttentionLabel": "Flash Attention (-fa on)",
        "flashAttentionDesc": "Saves up to 40% RAM KV-cache and accelerates RAG file processing.",
        "presetTitle": "Maximum Performance Preset",
        "presetDesc": "99 Vulkan layers, 8 Zen 4 threads, 8K context, Flash Attention ON",
        "optimize": "Optimize",
        "apiActive": "Local API Server Active",
        "copyBaseUrl": "Copy Base URL",
        "testApiBtn": "Test API",
        "apiPortLabel": "Primary API Port:",
        "snippetsTitle": "Connection Instructions:",
        "uiLangLabel": "Interface Language:",
        "autoTtsLabel": "Automatically read model responses aloud",
        "autoTtsDesc": "Synthesizes speech upon completion of generation (Piper TTS / Windows)",
        "cancel": "Cancel",
        "saveSettings": "Save Settings",
        "modalProfileTitle": "User Profile & Personalization",
        "avatarTitle": "Your Avatar in Conversations",
        "avatarDesc": "Format PNG, JPG or WebP up to 5 MB",
        "uploadPhoto": "Upload Photo",
        "resetAvatar": "Reset",
        "firstNameLabel": "First Name:",
        "lastNameLabel": "Last Name:",
        "aboutLabel": "About me:",
        "aboutSub": "(this information will be provided to the AI for dialogue personalization)",
        "saveProfile": "Save Profile",
        "profileFirstNamePlaceholder": "First Name",
        "profileLastNamePlaceholder": "Last Name",
        "profileAboutPlaceholder": "E.g.: architect, love clean Python code, develop 3D scenes in Blender...",
        "modalSkillsTitle": "Assistant Skills Library",
        "btnAddSkill": "Create Skill",
        "skillsHint": "Skills transform the model into a specialized expert with dedicated instructions.",
        "btnBack": "Back",
        "skillEditTitle": "Edit Skill",
        "skillNameLabel": "Skill Name:",
        "skillTriggerLabel": "Quick Slash Command (/trigger):",
        "skillDescLabel": "Short Description:",
        "skillPromptLabel": "System Context / Skill Prompt:",
        "saveSkill": "Save Skill",
        "skillsFooterHint": "Type / in the chat input for quick access to any active skill.",
        "skillNamePlaceholder": "Blender Python Scripter",
        "skillTriggerPlaceholder": "/blender",
        "skillDescPlaceholder": "Creation of 3D scenes and procedural scripts via bpy...",
        "skillPromptPlaceholder": "You are a senior expert in Blender Python API (bpy)...",
        "load": "Load",
        "unload": "Unload",
        "starting": "Starting...",
        "saveSuccess": "✓ Settings saved successfully",
        "profileSaved": "✓ Profile saved successfully",
        "skillSaved": "✓ Skill saved successfully",
        "skillDeleted": "Skill deleted",
        "generationStopped": "Generation stopped",
        "copied": "✓ Copied to clipboard",
        "modalFeedsTitle": "API / RSS — Real-Time Data Sources",
        "feedsNoKeyBadge": "Keyless • Local",
        "tabFeedsBuiltin": "Base APIs (Crypto, Stocks, Weather, Geo)",
        "tabFeedsRss": "News & RSS Feeds",
        "tabFeedsCustom": "Custom API",
        "feedsBanner": "The neural network calls these APIs directly via tool calls without heavy web parsing or context overhead. All APIs are completely public and require no keys or registration.",
        "feedsFooterHint": "Use /market, /weather, /news skills in chat to instantly trigger these data feeds",
        "feedActive": "Active",
        "feedDisabled": "Disabled",
        "providersBanner": "Connect external AI models via API to run without any GPU workload. All built-in SREDA AI features (file RAG, SD/MusicGen multimedia, Live API/RSS data, Blender MCP, and voice) fully work with cloud models.",
        "enableLabel": "Enable:",
        "openrouterKeyLabel": "OpenRouter API Key:",
        "btnTestConnection": "Test Connection",
        "openrouterModelLabel": "Active OpenRouter Model:",
        "gigachatTitle": "Sber GigaChat (GigaChad API)",
        "gigachatDesc": "Official Sber AI • Digital Ministry SSL supported automatically",
        "gigachatClientIdLabel": "Client ID (from developers.sber.ru project):",
        "gigachatSecretLabel": "Client Secret / API Key (from Sber developer portal):",
        "gigachatScopeLabel": "Access Scope:",
        "gigachatScopePers": "GIGACHAT_API_PERS (Individual / Personal)",
        "gigachatScopeCorp": "GIGACHAT_API_B2B (Legal entities & B2B)",
        "gigachatModelLabel": "Active GigaChat Model:",
        "gigachatBase64Toggle": "Or use prepared Authorization credentials (Base64)",
        "gigachatBase64Label": "Authorization data (Base64 from developer portal):",
        "customApiTitle": "Custom OpenAI-Compatible API",
        "customApiProviderName": "Provider Name:",
        "customApiBaseUrl": "Base Endpoint URL:",
        "customApiKey": "API Key:",
        "customApiModel": "Model ID:",
        "tabApiModels": "☁️ Cloud APIs",
        "apiModelsBanner": "Cloud models run via external APIs (OpenRouter, Sber GigaChat, Custom) with zero GPU load. Built-in SREDA features (RAG, images, music, Live data, Blender MCP) work seamlessly.",
        "btnConfigureKeys": "Configure Keys",
        "apiModelsEmpty": "No cloud API models activated yet. Enable OpenRouter, Sber GigaChat, or Custom API in Settings.",
        "btnSelectModel": "Select Model",
        "btnModelSelected": "Selected",
        "badgeRecommended": "Recommended",
        "badgeActive": "Active",
        "badgeLocal": "Local",
        "badgeApi": "API / Cloud",
        "labelSize": "Size:",
        "labelSpeed": "Inference Speed:",
        "unitTokensSec": "t/s",
        "btnDownload": "Download",
        "btnActivate": "Activate",
        "btnInstalled": "Installed",
        "installedEmpty": "No .gguf model files in models directories yet.<br>Download a ternary model from <b>«Bonsai 2 Family»</b> or find on <b>Hugging Face</b>.",
        "sredaBoostTitle": "SREDA Boost — Game Mode Optimization",
        "sredaBoostDesc": "Automatically elevates inference priority to High, throttles background apps, and trims RAM for GPU/UMA acceleration.",
        "autoBoostCheckbox": "Auto-Boost on inference start",
        "btnPurgeRam": "Clear RAM now",
        "statusOff": "Disabled",
        "statusActive": "Active",
        "boostOff": "Boost: Off",
        "boostOn": "Boost: On",
        "boostActive": "Boost: Active",
        "apiReady": "API Ready",
        "activeVoiceLabel": "Active voice for selected language:",
        "voiceInstalledBadge": "Installed",
        "btnDownloadVoice": "Download Voice (~60 MB)",
        "voiceCatalogTitle": "Voice Library (Piper TTS — Local, No Cloud):",
        "voiceCatalogDesc": "You can download voices in different languages as needed.",
        "copySnippet": "Copy",
        "btnSkip": "Skip",
        "feedsTitle": "API / RSS",
        "badgeCloudApi": "API / Cloud",
        "badgeFlagship27b": "Flagship 27B",
        "installedDownloadHint": "Download a ternary model from the 'Bonsai 2 Family' tab or find one on Hugging Face.",
        "apiModelsEnableHint": "Enable OpenRouter, Sber GigaChat or Custom API in",
        "boostHighCpu": "Active (High CPU)",
        "boostDisabled": "Disabled",
        "customApiKeyLabel": "API Key (if required):",
        "customApiModelLabel": "Model Name:",
        "btnCompactRam": "Clean RAM now",
        "boostCardTitle": "SREDA Boost — Resource Game Mode",
        "boostCardDesc": "Automatically boosts inference core priority to High, lowers background tasks and compacts RAM for accelerated Radeon 780M UMA.",
        "boostAutoLabel": "Auto-Boost on inference launch",
        "bonsaiDesc": {
            "bonsai-2-2b-ptq1": "Ultra-light ternary Prism ML model. Consumes ~400 MB RAM, instant generation (60+ t/s).",
            "bonsai-2-4b-ptq1": "Optimal model for iGPUs and compact PCs. Excellent multi-language reasoning with only 0.88 GB weight.",
            "bonsai-2-9b-ptq1": "Ideal standard for fast tests, reasoning, and coding. Rapid inference and robust logic at 1.86 GB weight.",
            "bonsai-1-8b-pq2": "Classic Bonsai model on LLaMA-3 (8B) architecture with Prism ML 2-bit quantization.",
            "bonsai-2-27b-ptq1": "Flagship ternary Prism ML model. 27B-level reasoning at only 5.54 GB weight. Full GPU offload via Vulkan.",
            "bonsai-2-27b-pq2": "Enhanced 2-bit quantization precision by Prism ML. Requires slightly more RAM (6.71 GB), maximum fine-detail preservation."
        },
        "baseApis": {
            "crypto": {
                "name": "Cryptocurrency (CoinCap / CoinGecko)",
                "desc": "Real-time quotes, 24h dynamics, trading volumes and market capitalization."
            },
            "stocks": {
                "name": "Stocks, Indices, Metals (Yahoo Finance)",
                "desc": "Stock quotes (AAPL, TSLA, NVDA), metal futures (gold, silver), commodities and indices."
            },
            "rates": {
                "name": "World Currency Rates (ExchangeRate-API)",
                "desc": "Fresh exchange rates of world currencies against RUB, USD and EUR (ExchangeRate-API)."
            },
            "weather": {
                "name": "Weather & Forecasts (Open-Meteo)",
                "desc": "High-precision keyless meteorological API: temperature, wind, precipitation, humidity."
            },
            "geocoding": {
                "name": "Geocoding & Population (Open-Meteo Geo)",
                "desc": "Determination of exact geographical coordinates, timezones and population of world cities."
            },
            "countries": {
                "name": "Countries & Capitals (REST Countries)",
                "desc": "Comprehensive encyclopedic reference on sovereign states (flags, capitals, languages, currencies)."
            },
            "avatars": {
                "name": "Avatar Generator (Dicebear API)",
                "desc": "Fast generation of unique vector avatars based on any text seed (Dicebear API)."
            }
        },
        "badgeCompatible": "Compatible",
        "badgeHighLoad": "High Load",
        "badgeExceedsRam": "Exceeds RAM"
    },
    "de": {
        "defaultUserName": "Benutzer",
        "appVersionLabel": "Version:",
        "appAuthorLabel": "Autor:",
        "appAuthorName": "Markus Marrei",
        "renameChat": "Chat umbenennen",
        "deleteChat": "Chat löschen",
        "newChat": "Neuer Chat",
        "skills": "Fähigkeiten",
        "userRole": "Benutzer",
        "models": "Modelle",
        "settings": "Einstellungen",
        "autoTts": "Sprachausgabe",
        "emptyTitle": "Wie kann ich Ihnen heute helfen?",
        "emptyDesc": "Wählen Sie einen Prompt unten oder starten Sie ein Gespräch in jeder Sprache",
        "chipCity": "Zukunftsstädte & Bioarchitektur",
        "chipMusic": "Atmosphärischen Ambient-Track erstellen",
        "chipTernary": "Was ist die Magie der Bonsai 2 Ternary-Quantisierung?",
        "chipCode": "Hochleistungsfähiger C++/Rust-Code",
        "chatPlaceholder": "Frage stellen, Datei anhängen oder /skill nutzen... (Enter zum Senden)",
        "sendTooltip": "Nachricht senden",
        "stopTooltip": "Generierung stoppen",
        "attachTooltip": "Datei anhängen",
        "voiceTooltip": "Spracheingabe",
        "modalModelsTitle": "Modellkatalog & Verwaltung",
        "tabBonsai": "Bonsai 2 Familie",
        "tabHf": "Hugging Face Suche",
        "tabInstalled": "Lokal installiert",
        "btnSearch": "Suchen",
        "btnRefresh": "Aktualisieren",
        "btnOpenFolder": "Modellordner öffnen",
        "btnClose": "Schließen",
        "searchHfPlaceholder": "GGUF-Modelle auf Hugging Face suchen (z. B. qwen2, mistral)...",
        "modalSettingsTitle": "Inferenzparameter & SREDA AI Zentrale",
        "tabInference": "Inferenz & Hardware",
        "tabServer": "API-Server (LM Studio)",
        "tabLanguage": "Sprache & Stimme",
        "tabProviders": "Externe APIs & Modelle",
        "hwDiagCpuGpu": "Prozessor & Grafik",
        "hwDiagRam": "Arbeitsspeicher (RAM)",
        "gpuLayersLabel": "GPU-Schichten (Radeon 780M Vulkan):",
        "threadsLabel": "CPU-Threads (Ryzen Zen 4):",
        "contextLabel": "Kontextgröße (Tokens):",
        "flashAttentionLabel": "Flash Attention (-fa on)",
        "flashAttentionDesc": "Spart bis zu 40% RAM KV-Cache und beschleunigt RAG-Dateien.",
        "presetTitle": "Maximale Leistungsvoreinstellung",
        "presetDesc": "99 Vulkan-Schichten, 8 Zen 4 Threads, 8K Kontext, Flash Attention AN",
        "optimize": "Optimieren",
        "apiActive": "Lokaler API-Server aktiv",
        "copyBaseUrl": "Basis-URL kopieren",
        "testApiBtn": "API testen",
        "apiPortLabel": "Haupt-API-Port:",
        "snippetsTitle": "Verbindungsanleitung:",
        "uiLangLabel": "Oberflächensprache:",
        "autoTtsLabel": "Antworten automatisch vorlesen",
        "autoTtsDesc": "Sprachsynthese nach Abschluss der Generierung (Piper TTS / Windows)",
        "cancel": "Abbrechen",
        "saveSettings": "Einstellungen speichern",
        "modalProfileTitle": "Benutzerprofil & Personalisierung",
        "avatarTitle": "Ihr Avatar im Chat",
        "avatarDesc": "Format PNG, JPG oder WebP bis 5 MB",
        "uploadPhoto": "Foto hochladen",
        "resetAvatar": "Zurücksetzen",
        "firstNameLabel": "Vorname:",
        "lastNameLabel": "Nachname:",
        "aboutLabel": "Über mich:",
        "aboutSub": "(wird an die KI übermittelt, um den Dialog zu personalisieren)",
        "saveProfile": "Profil speichern",
        "profileFirstNamePlaceholder": "Vorname",
        "profileLastNamePlaceholder": "Nachname",
        "profileAboutPlaceholder": "Z. B.: Architekt, erstelle 3D-Szenen in Blender...",
        "modalSkillsTitle": "Bibliothek für Fähigkeiten (Skills)",
        "btnAddSkill": "Fähigkeit erstellen",
        "skillsHint": "Fähigkeiten verwandeln das Modell in einen spezialisierten Experten.",
        "btnBack": "Zurück",
        "skillEditTitle": "Fähigkeit bearbeiten",
        "skillNameLabel": "Name der Fähigkeit:",
        "skillTriggerLabel": "Slash-Befehl (/trigger):",
        "skillDescLabel": "Kurzbeschreibung:",
        "skillPromptLabel": "Systemkontext / Prompt:",
        "saveSkill": "Fähigkeit speichern",
        "skillsFooterHint": "Geben Sie / im Chat-Eingabefeld ein für schnellen Zugriff auf Fähigkeiten.",
        "skillNamePlaceholder": "Blender Python Entwickler",
        "skillTriggerPlaceholder": "/blender",
        "skillDescPlaceholder": "Erstellung von 3D-Szenen und prozeduralen Skripten...",
        "skillPromptPlaceholder": "Du bist ein führender Experte für die Blender Python API...",
        "load": "Laden",
        "unload": "Entladen",
        "starting": "Startet...",
        "saveSuccess": "✓ Einstellungen erfolgreich gespeichert",
        "profileSaved": "✓ Profil erfolgreich gespeichert",
        "skillSaved": "✓ Fähigkeit erfolgreich gespeichert",
        "skillDeleted": "Fähigkeit gelöscht",
        "generationStopped": "Generierung gestoppt",
        "copied": "✓ In Zwischenablage kopiert",
        "modalFeedsTitle": "API / RSS — Echtzeit-Datenquellen",
        "feedsNoKeyBadge": "Ohne Schlüssel • Lokal",
        "tabFeedsBuiltin": "Basis-APIs (Krypto, Aktien, Wetter, Geo)",
        "tabFeedsRss": "Nachrichten & RSS-Feeds",
        "tabFeedsCustom": "Benutzerdefinierte API",
        "feedsBanner": "Das neuronale Netz greift direkt über Tool-Aufrufe auf diese APIs zu, ohne rechenintensives Web-Parsing oder Kontextverlust. Alle APIs sind vollständig öffentlich und erfordern keine Schlüssel oder Registrierung.",
        "feedsFooterHint": "Nutzen Sie /market, /weather, /news im Chat für den sofortigen Datenabruf",
        "feedActive": "Aktiv",
        "feedDisabled": "Deaktiviert",
        "providersBanner": "Verbinden Sie externe KI-Modelle über API, um ohne GPU-Last zu arbeiten. Alle integrierten SREDA AI-Funktionen (Datei-RAG, SD/MusicGen-Multimedia, Live-API/RSS-Daten, Blender MCP und Sprachausgabe) funktionieren uneingeschränkt mit Cloud-Modellen.",
        "enableLabel": "Aktivieren:",
        "openrouterKeyLabel": "OpenRouter API-Schlüssel:",
        "btnTestConnection": "Verbindung testen",
        "openrouterModelLabel": "Aktives OpenRouter-Modell:",
        "gigachatTitle": "Sber GigaChat (GigaChad API)",
        "gigachatDesc": "Offizielle Sber-KI • SSL-Zertifikate werden automatisch unterstützt",
        "gigachatClientIdLabel": "Client-ID (aus developers.sber.ru Projekt):",
        "gigachatSecretLabel": "Client-Secret / API-Schlüssel (aus dem Sber-Portal):",
        "gigachatScopeLabel": "Zugriffsbereich (Scope):",
        "gigachatScopePers": "GIGACHAT_API_PERS (Privatpersonen / Persönlich)",
        "gigachatScopeCorp": "GIGACHAT_API_B2B (Geschäftskunden & B2B)",
        "gigachatModelLabel": "Aktives GigaChat-Modell:",
        "gigachatBase64Toggle": "Oder fertige Autorisierungsdaten verwenden (Base64)",
        "gigachatBase64Label": "Autorisierungsdaten (Base64 aus Entwicklerportal):",
        "customApiTitle": "Benutzerdefinierte OpenAI-kompatible API",
        "customApiProviderName": "Provider-Name:",
        "customApiBaseUrl": "Basis-Endpunkt-URL:",
        "customApiKey": "API-Schlüssel:",
        "customApiModel": "Modell-ID (Model ID):",
        "tabApiModels": "☁️ Cloud-APIs",
        "apiModelsBanner": "Cloud-Modelle laufen über externe APIs ohne GPU-Auslastung. Integrierte SREDA-Funktionen funktionieren nahtlos.",
        "btnConfigureKeys": "Schlüssel konfigurieren",
        "apiModelsEmpty": "Noch keine Cloud-API-Modelle aktiviert. Aktivieren Sie OpenRouter, Sber GigaChat oder Custom API in den Einstellungen.",
        "btnSelectModel": "Modell wählen",
        "btnModelSelected": "Ausgewählt",
        "badgeRecommended": "Empfohlen",
        "badgeActive": "Aktiv",
        "badgeLocal": "Lokal",
        "badgeApi": "API / Cloud",
        "labelSize": "Größe:",
        "labelSpeed": "Inferenzgeschwindigkeit:",
        "unitTokensSec": "t/s",
        "btnDownload": "Herunterladen",
        "btnActivate": "Aktivieren",
        "btnInstalled": "Installiert",
        "installedEmpty": "Noch keine .gguf-Modelldateien in den Modellordnern.<br>Laden Sie ein ternäres Modell aus dem Tab <b>«Bonsai 2-Familie»</b> herunter oder suchen Sie auf <b>Hugging Face</b>.",
        "sredaBoostTitle": "SREDA Boost — Spielmodus-Ressourcenoptimierung",
        "sredaBoostDesc": "Erhöht automatisch die Inferenzpriorität auf High, drosselt Hintergrundprozesse und bereinigt den RAM für GPU/UMA.",
        "autoBoostCheckbox": "Auto-Boost beim Inferenzstart",
        "btnPurgeRam": "RAM jetzt bereinigen",
        "statusOff": "Deaktiviert",
        "statusActive": "Aktiv",
        "boostOff": "Boost: Aus",
        "boostOn": "Boost: Ein",
        "boostActive": "Boost: Aktiv",
        "apiReady": "API Bereit",
        "activeVoiceLabel": "Aktive Stimme für die ausgewählte Sprache:",
        "voiceInstalledBadge": "Installiert",
        "btnDownloadVoice": "Stimme herunterladen (~60 MB)",
        "voiceCatalogTitle": "Stimmenbibliothek (Piper TTS — Lokal, ohne Cloud):",
        "voiceCatalogDesc": "Sie können Stimmen in verschiedenen Sprachen nach Bedarf herunterladen.",
        "copySnippet": "Kopieren",
        "btnSkip": "Überspringen",
        "feedsTitle": "API / RSS",
        "badgeCloudApi": "API / Cloud",
        "badgeFlagship27b": "Flaggschiff 27B",
        "installedDownloadHint": "Laden Sie ein ternäres Modell aus dem Reiter 'Bonsai 2-Reihe' herunter oder suchen Sie auf Hugging Face.",
        "apiModelsEnableHint": "Aktivieren Sie OpenRouter, Sber GigaChat oder Custom API in den",
        "boostHighCpu": "Aktiv (High CPU)",
        "boostDisabled": "Deaktiviert",
        "customApiKeyLabel": "API-Schlüssel (falls erforderlich):",
        "customApiModelLabel": "Modellname:",
        "btnCompactRam": "RAM jetzt bereinigen",
        "boostCardTitle": "SREDA Boost — Ressourcen-Spielmodus",
        "boostCardDesc": "Erhöht automatisch die Inferenzkern-Priorität auf High, drosselt Hintergrundprozesse und komprimiert den RAM für beschleunigte Radeon 780M UMA.",
        "boostAutoLabel": "Auto-Boost beim Start der Inferenz",
        "bonsaiDesc": {
            "bonsai-2-2b-ptq1": "Ultraleichtes ternäres Prism ML-Modell. Verbraucht ~400 MB RAM, sofortige Generierung (60+ t/s).",
            "bonsai-2-4b-ptq1": "Optimales Modell für iGPUs und kompakte PCs. Hervorragendes Sprachverständnis bei nur 0.88 GB.",
            "bonsai-2-9b-ptq1": "Idealer Standard für schnelle Tests, Logik und Code. Schnelle Inferenz und solide Logik bei 1.86 GB.",
            "bonsai-1-8b-pq2": "Klassisches Bonsai-Modell auf LLaMA-3 (8B)-Architektur mit Prism ML 2-Bit-Quantisierung.",
            "bonsai-2-27b-ptq1": "Flaggschiff-Ternärmodell von Prism ML. 27B-Denkvermögen bei nur 5.54 GB Gewicht. Vollständiges GPU-Offload über Vulkan.",
            "bonsai-2-27b-pq2": "Erhöhte 2-Bit-Quantisierungspräzision von Prism ML. Benötigt 6.71 GB RAM, maximale Detailtreue."
        },
        "baseApis": {
            "crypto": {
                "name": "Kryptowährung (CoinCap / CoinGecko)",
                "desc": "Echtzeitkurse, 24-Stunden-Dynamik, Handelsvolumen und Marktkapitalisierung."
            },
            "stocks": {
                "name": "Aktien, Indizes, Metalle (Yahoo Finance)",
                "desc": "Börsenkurse (AAPL, TSLA, NVDA), Metall-Futures (Gold, Silber), Rohstoffe und Indizes."
            },
            "rates": {
                "name": "Weltwährungskurse (ExchangeRate-API)",
                "desc": "Aktuelle Wechselkurse von Weltwährungen gegenüber Rubel, Dollar und Euro (ExchangeRate-API)."
            },
            "weather": {
                "name": "Wetter & Vorhersagen (Open-Meteo)",
                "desc": "Hochpräzise meteorologische API ohne Werbung und Schlüssel: Temperatur, Wind, Niederschlag, Luftfeuchtigkeit."
            },
            "geocoding": {
                "name": "Geokodierung & Bevölkerung (Open-Meteo Geo)",
                "desc": "Bestimmung exakter geografischer Koordinaten, Zeitzonen und Einwohnerzahlen von Weltstädten."
            },
            "countries": {
                "name": "Länder & Hauptstädte (REST Countries)",
                "desc": "Vollständiges enzyklopädisches Nachschlagewerk zu souveränen Staaten (Flaggen, Hauptstädte, Sprachen, Währungen)."
            },
            "avatars": {
                "name": "Avatar-Generator (Dicebear API)",
                "desc": "Schnelle Generierung einzigartiger Vektor-Avatare basierend auf einem beliebigen Text-Seed (Dicebear API)."
            }
        },
        "badgeCompatible": "Kompatibel",
        "badgeHighLoad": "Hohe Auslastung",
        "badgeExceedsRam": "Übersteigt RAM"
    },
    "fr": {
        "defaultUserName": "Utilisateur",
        "appVersionLabel": "Version :",
        "appAuthorLabel": "Auteur :",
        "appAuthorName": "Markus Marrei",
        "renameChat": "Renommer la discussion",
        "deleteChat": "Supprimer la discussion",
        "newChat": "Nouvelle conversation",
        "skills": "Compétences",
        "userRole": "Utilisateur",
        "models": "Modèles",
        "settings": "Paramètres",
        "autoTts": "Lecture vocale",
        "emptyTitle": "Comment puis-je vous aider aujourd'hui ?",
        "emptyDesc": "Choisissez une invite ci-dessous ou commencez une conversation libre",
        "chipCity": "Villes du futur et bio-architecture",
        "chipMusic": "Créer une piste ambiante atmosphérique",
        "chipTernary": "Quelle est la magie de la quantification ternaire Bonsai 2 ?",
        "chipCode": "Code C++/Rust haute performance",
        "chatPlaceholder": "Posez une question, joignez un fichier ou utilisez /skill... (Entrée pour envoyer)",
        "sendTooltip": "Envoyer le message",
        "stopTooltip": "Arrêter la génération",
        "attachTooltip": "Joindre un fichier",
        "voiceTooltip": "Saisie vocale",
        "modalModelsTitle": "Catalogue & Gestion des modèles",
        "tabBonsai": "Famille Bonsai 2",
        "tabHf": "Recherche Hugging Face",
        "tabInstalled": "Installés localement",
        "btnSearch": "Rechercher",
        "btnRefresh": "Actualiser",
        "btnOpenFolder": "Ouvrir dossier modèles",
        "btnClose": "Fermer",
        "searchHfPlaceholder": "Rechercher des modèles GGUF sur Hugging Face (ex: qwen2, mistral)...",
        "modalSettingsTitle": "Paramètres d'inférence & Station SREDA AI",
        "tabInference": "Inférence & Matériel",
        "tabServer": "Serveur API (LM Studio)",
        "tabLanguage": "Langue & Voix",
        "tabProviders": "APIs externes & Modèles",
        "hwDiagCpuGpu": "Processeur & Graphiques",
        "hwDiagRam": "Mémoire vive (RAM)",
        "gpuLayersLabel": "Couches GPU (Radeon 780M Vulkan):",
        "threadsLabel": "Threads CPU (Ryzen Zen 4):",
        "contextLabel": "Fenêtre de contexte (Tokens):",
        "flashAttentionLabel": "Flash Attention (-fa on)",
        "flashAttentionDesc": "Économise jusqu'à 40% de RAM KV-cache et accélère le RAG.",
        "presetTitle": "Préréglage de performance maximale",
        "presetDesc": "99 couches Vulkan, 8 threads Zen 4, contexte 8K, Flash Attention ON",
        "optimize": "Optimiser",
        "apiActive": "Serveur API local actif",
        "copyBaseUrl": "Copier l'URL de base",
        "testApiBtn": "Tester l'API",
        "apiPortLabel": "Port API principal :",
        "snippetsTitle": "Instructions de connexion :",
        "uiLangLabel": "Langue de l'interface :",
        "autoTtsLabel": "Lecture vocale automatique des réponses",
        "autoTtsDesc": "Synthèse vocale à la fin de la génération (Piper TTS / Windows)",
        "cancel": "Annuler",
        "saveSettings": "Enregistrer les paramètres",
        "modalProfileTitle": "Profil utilisateur & Personnalisation",
        "avatarTitle": "Votre avatar de discussion",
        "avatarDesc": "Format PNG, JPG ou WebP jusqu'à 5 Mo",
        "uploadPhoto": "Télécharger photo",
        "resetAvatar": "Réinitialiser",
        "firstNameLabel": "Prénom :",
        "lastNameLabel": "Nom :",
        "aboutLabel": "À propos de moi :",
        "aboutSub": "(cette information sera partagée avec l'IA pour personnaliser le dialogue)",
        "saveProfile": "Enregistrer le profil",
        "profileFirstNamePlaceholder": "Prénom",
        "profileLastNamePlaceholder": "Nom",
        "profileAboutPlaceholder": "Ex. : architecte, développe des scènes 3D sous Blender...",
        "modalSkillsTitle": "Bibliothèque de compétences",
        "btnAddSkill": "Créer une compétence",
        "skillsHint": "Les compétences transforment le modèle en expert avec des instructions dédiées.",
        "btnBack": "Retour",
        "skillEditTitle": "Modifier la compétence",
        "skillNameLabel": "Nom de la compétence :",
        "skillTriggerLabel": "Commande rapide (/déclencheur) :",
        "skillDescLabel": "Description courte :",
        "skillPromptLabel": "Contexte système / Prompt :",
        "saveSkill": "Enregistrer la compétence",
        "skillsFooterHint": "Tapez / dans le champ de saisie pour accéder rapidement aux compétences.",
        "skillNamePlaceholder": "Scripteur Python Blender",
        "skillTriggerPlaceholder": "/blender",
        "skillDescPlaceholder": "Création de scènes 3D et générateurs procéduraux...",
        "skillPromptPlaceholder": "Vous êtes un expert de haut niveau de l'API Blender Python (bpy)...",
        "load": "Charger",
        "unload": "Décharger",
        "starting": "Démarrage...",
        "saveSuccess": "✓ Paramètres enregistrés avec succès",
        "profileSaved": "✓ Profil enregistré avec succès",
        "skillSaved": "✓ Compétence enregistrée avec succès",
        "skillDeleted": "Compétence supprimée",
        "generationStopped": "Génération arrêtée",
        "copied": "✓ Copié dans le presse-papiers",
        "modalFeedsTitle": "API / RSS — Sources de données en temps réel",
        "feedsNoKeyBadge": "Sans clé • Local",
        "tabFeedsBuiltin": "APIs de base (Crypto, Bourse, Météo, Géo)",
        "tabFeedsRss": "Actualités & Flux RSS",
        "tabFeedsCustom": "API personnalisée",
        "feedsBanner": "Le réseau neuronal interroge ces API directement via des appels d'outils sans parsing web lourd ni surconsommation de contexte. Toutes les API sont totalement publiques et ne requièrent ni clé ni inscription.",
        "feedsFooterHint": "Utilisez les compétences /market, /weather, /news dans le chat pour afficher instantanément ces données",
        "feedActive": "Actif",
        "feedDisabled": "Désactivé",
        "providersBanner": "Connectez des IA externes via API pour fonctionner sans charge GPU. Toutes les fonctionnalités intégrées de SREDA AI (RAG fichiers, multimédia SD/MusicGen, données Live API/RSS, Blender MCP et synthèse vocale) fonctionnent pleinement avec les modèles cloud.",
        "enableLabel": "Activer :",
        "openrouterKeyLabel": "Clé API OpenRouter :",
        "btnTestConnection": "Tester la connexion",
        "openrouterModelLabel": "Modèle actif OpenRouter :",
        "gigachatTitle": "Sber GigaChat (GigaChad API)",
        "gigachatDesc": "IA officielle de Sber • Certificats SSL pris en charge automatiquement",
        "gigachatClientIdLabel": "Client ID (identifiant du projet developers.sber.ru) :",
        "gigachatSecretLabel": "Client Secret / Clé API (depuis le portail Sber) :",
        "gigachatScopeLabel": "Portée d'accès (Scope) :",
        "gigachatScopePers": "GIGACHAT_API_PERS (Particuliers / Personnel)",
        "gigachatScopeCorp": "GIGACHAT_API_B2B (Entreprises & B2B)",
        "gigachatModelLabel": "Modèle actif GigaChat :",
        "gigachatBase64Toggle": "Ou utiliser les données d'autorisation prêtes (Base64)",
        "gigachatBase64Label": "Données d'autorisation (Base64 depuis le portail) :",
        "customApiTitle": "API personnalisé compatible OpenAI",
        "customApiProviderName": "Nom du fournisseur :",
        "customApiBaseUrl": "URL de base du point de terminaison :",
        "customApiKey": "Clé API :",
        "customApiModel": "Identifiant du modèle (Model ID) :",
        "tabApiModels": "☁️ APIs Cloud",
        "apiModelsBanner": "Les modèles cloud fonctionnent via des API externes (OpenRouter, Sber GigaChat, Custom) sans charge GPU. Les fonctionnalités intégrées de SREDA fonctionnent pleinement.",
        "btnConfigureKeys": "Configurer les clés",
        "apiModelsEmpty": "Aucun modèle d'API cloud n'est encore activé. Activez OpenRouter, Sber GigaChat ou Custom API dans les Paramètres.",
        "btnSelectModel": "Choisir le modèle",
        "btnModelSelected": "Sélectionné",
        "badgeRecommended": "Recommandé",
        "badgeActive": "Actif",
        "badgeLocal": "Locale",
        "badgeApi": "API / Cloud",
        "labelSize": "Taille :",
        "labelSpeed": "Vitesse d'inférence :",
        "unitTokensSec": "t/s",
        "btnDownload": "Télécharger",
        "btnActivate": "Activer",
        "btnInstalled": "Installé",
        "installedEmpty": "Aucun fichier de modèle .gguf dans les dossiers de modèles.<br>Téléchargez un modèle ternaire depuis l'onglet <b>«Famille Bonsai 2»</b> ou cherchez sur <b>Hugging Face</b>.",
        "sredaBoostTitle": "SREDA Boost — Mode jeu pour les ressources",
        "sredaBoostDesc": "Élève automatiquement la priorité d'inférence à High, réduit les processus d'arrière-plan et libère la RAM pour accélérer le GPU/UMA.",
        "autoBoostCheckbox": "Auto-Boost au démarrage de l'inférence",
        "btnPurgeRam": "Vider la RAM maintenant",
        "statusOff": "Désactivé",
        "statusActive": "Actif",
        "boostOff": "Boost: Désactivé",
        "boostOn": "Boost: Activé",
        "boostActive": "Boost: Actif",
        "apiReady": "API Prêt",
        "activeVoiceLabel": "Voix active pour la langue sélectionnée :",
        "voiceInstalledBadge": "Installé",
        "btnDownloadVoice": "Télécharger la voix (~60 Mo)",
        "voiceCatalogTitle": "Bibliothèque de voix (Piper TTS — Locale, sans cloud) :",
        "voiceCatalogDesc": "Vous pouvez télécharger des voix dans différentes langues selon vos besoins.",
        "copySnippet": "Copier",
        "btnSkip": "Passer",
        "feedsTitle": "API / RSS",
        "badgeCloudApi": "API / Cloud",
        "badgeFlagship27b": "Modèle phare 27B",
        "installedDownloadHint": "Téléchargez un modèle ternaire depuis l'onglet 'Famille Bonsai 2' ou recherchez sur Hugging Face.",
        "apiModelsEnableHint": "Activez OpenRouter, Sber GigaChat ou Custom API dans les",
        "boostHighCpu": "Actif (High CPU)",
        "boostDisabled": "Désactivé",
        "customApiKeyLabel": "Clé API (si nécessaire) :",
        "customApiModelLabel": "Nom du modèle :",
        "btnCompactRam": "Nettoyer la RAM maintenant",
        "boostCardTitle": "SREDA Boost — Mode jeu pour les ressources",
        "boostCardDesc": "Augmente automatiquement la priorité du cœur d'inférence à Élevée, réduit les processus d'arrière-plan et compresse la RAM pour accélérer la Radeon 780M UMA.",
        "boostAutoLabel": "Auto-Boost au lancement de l'inférence",
        "bonsaiDesc": {
            "bonsai-2-2b-ptq1": "Modèle ternaire ultra-léger Prism ML. Consommation ~400 Mo, génération instantanée (60+ t/s).",
            "bonsai-2-4b-ptq1": "Modèle optimal pour les iGPU et PC compacts. Excellent raisonnement multilingue pour seulement 0.88 Go.",
            "bonsai-2-9b-ptq1": "Standard idéal pour les tests rapides, le raisonnement et le code. Inférence rapide et logique stable (1.86 Go).",
            "bonsai-1-8b-pq2": "Modèle classique Bonsai sur architecture LLaMA-3 (8B) avec quantification 2-bit Prism ML.",
            "bonsai-2-27b-ptq1": "Modèle ternaire phare de Prism ML. Raisonnement de niveau 27B pour seulement 5.54 Go. Déchargement GPU complet via Vulkan.",
            "bonsai-2-27b-pq2": "Précision améliorée de la quantification 2-bit par Prism ML. Nécessite 6.71 Go, préservation maximale des nuances."
        },
        "baseApis": {
            "crypto": {
                "name": "Crypto-monnaie (CoinCap / CoinGecko)",
                "desc": "Cotations en temps réel, dynamique 24h, volumes d'échanges et capitalisation boursière."
            },
            "stocks": {
                "name": "Actions, Indices, Métaux (Yahoo Finance)",
                "desc": "Cotations boursières (AAPL, TSLA, NVDA), contrats à terme sur métaux (or, argent), matières premières et indices."
            },
            "rates": {
                "name": "Taux de change mondiaux (ExchangeRate-API)",
                "desc": "Taux de change récents des devises mondiales par rapport au rouble, dollar et euro (ExchangeRate-API)."
            },
            "weather": {
                "name": "Météo & Prévisions (Open-Meteo)",
                "desc": "API météorologique de haute précision sans publicité ni clé : température, vent, précipitations, humidité."
            },
            "geocoding": {
                "name": "Géocodage & Population (Open-Meteo Geo)",
                "desc": "Détermination des coordonnées géographiques exactes, des fuseaux horaires et de la population des villes du monde."
            },
            "countries": {
                "name": "Pays & Capitales (REST Countries)",
                "desc": "Guide encyclopédique complet sur les États souverains (drapeaux, capitales, langues, devises)."
            },
            "avatars": {
                "name": "Générateur d'avatars (Dicebear API)",
                "desc": "Génération rapide d'avatars vectoriels uniques basés sur n'importe quel texte graine (Dicebear API)."
            }
        },
        "badgeCompatible": "Compatible",
        "badgeHighLoad": "Charge élevée",
        "badgeExceedsRam": "Dépasse la RAM"
    },
    "es": {
        "defaultUserName": "Usuario",
        "appVersionLabel": "Versión:",
        "appAuthorLabel": "Autor:",
        "appAuthorName": "Markus Marrei",
        "renameChat": "Renombrar chat",
        "deleteChat": "Eliminar chat",
        "newChat": "Nuevo chat",
        "skills": "Habilidades",
        "userRole": "Usuario",
        "models": "Modelos",
        "settings": "Ajustes",
        "autoTts": "Voz automática",
        "emptyTitle": "¿Cómo puedo ayudarte hoy?",
        "emptyDesc": "Elige un prompt a continuación o inicia una conversación libre",
        "chipCity": "Ciudades del futuro y bioarquitectura",
        "chipMusic": "Crear una pista ambient atmosférica",
        "chipTernary": "¿Cuál es la magia de la cuantización ternaria Bonsai 2?",
        "chipCode": "Código C++/Rust de alto rendimiento",
        "chatPlaceholder": "Haz una pregunta, adjunta un archivo o usa /skill... (Enter para enviar)",
        "sendTooltip": "Enviar mensaje",
        "stopTooltip": "Detener generación",
        "attachTooltip": "Adjuntar archivo",
        "voiceTooltip": "Entrada de voz",
        "modalModelsTitle": "Catálogo & Gestión de modelos",
        "tabBonsai": "Familia Bonsai 2",
        "tabHf": "Búsqueda en Hugging Face",
        "tabInstalled": "Instalados localmente",
        "btnSearch": "Buscar",
        "btnRefresh": "Actualizar",
        "btnOpenFolder": "Abrir carpeta de modelos",
        "btnClose": "Cerrar",
        "searchHfPlaceholder": "Buscar modelos GGUF en Hugging Face (ej. qwen2, mistral)...",
        "modalSettingsTitle": "Parámetros de inferencia & Estación SREDA AI",
        "tabInference": "Inferencia & Hardware",
        "tabServer": "Servidor API (LM Studio)",
        "tabLanguage": "Idioma & Voz",
        "tabProviders": "APIs externas & Modelos",
        "hwDiagCpuGpu": "Procesador & Gráficos",
        "hwDiagRam": "Memoria RAM",
        "gpuLayersLabel": "Capas en GPU (Radeon 780M Vulkan):",
        "threadsLabel": "Hilos de CPU (Ryzen Zen 4):",
        "contextLabel": "Ventana de contexto (Tokens):",
        "flashAttentionLabel": "Flash Attention (-fa on)",
        "flashAttentionDesc": "Ahorra hasta 40% de RAM KV-cache y agiliza archivos RAG.",
        "presetTitle": "Ajuste de máximo rendimiento",
        "presetDesc": "99 capas Vulkan, 8 hilos Zen 4, contexto 8K, Flash Attention ON",
        "optimize": "Optimizar",
        "apiActive": "Servidor API local activo",
        "copyBaseUrl": "Copiar URL Base",
        "testApiBtn": "Probar API",
        "apiPortLabel": "Puerto API principal:",
        "snippetsTitle": "Instrucciones de conexión:",
        "uiLangLabel": "Idioma de la interfaz:",
        "autoTtsLabel": "Leer automáticamente respuestas en voz alta",
        "autoTtsDesc": "Síntesis de voz al completar la generación (Piper TTS / Windows)",
        "cancel": "Cancelar",
        "saveSettings": "Guardar ajustes",
        "modalProfileTitle": "Perfil de usuario & Personalización",
        "avatarTitle": "Tu avatar en conversaciones",
        "avatarDesc": "Formato PNG, JPG o WebP hasta 5 MB",
        "uploadPhoto": "Subir foto",
        "resetAvatar": "Restablecer",
        "firstNameLabel": "Nombre:",
        "lastNameLabel": "Apellido:",
        "aboutLabel": "Sobre mí:",
        "aboutSub": "(esta información se compartirá con la IA para personalizar el diálogo)",
        "saveProfile": "Guardar perfil",
        "profileFirstNamePlaceholder": "Nombre",
        "profileLastNamePlaceholder": "Apellido",
        "profileAboutPlaceholder": "Ej.: arquitecto, desarrollo escenas 3D en Blender...",
        "modalSkillsTitle": "Biblioteca de habilidades",
        "btnAddSkill": "Crear habilidad",
        "skillsHint": "Las habilidades transforman el modelo en un experto con instrucciones dedicadas.",
        "btnBack": "Volver",
        "skillEditTitle": "Editar habilidad",
        "skillNameLabel": "Nombre de la habilidad:",
        "skillTriggerLabel": "Comando rápido (/trigger):",
        "skillDescLabel": "Descripción corta:",
        "skillPromptLabel": "Contexto del sistema / Prompt:",
        "saveSkill": "Guardar habilidad",
        "skillsFooterHint": "Escribe / en el chat para acceder rápidamente a las habilidades.",
        "skillNamePlaceholder": "Scripter Python de Blender",
        "skillTriggerPlaceholder": "/blender",
        "skillDescPlaceholder": "Creación de escenas 3D y generadores procedimentales...",
        "skillPromptPlaceholder": "Eres un experto líder en la API Python de Blender (bpy)...",
        "load": "Cargar",
        "unload": "Descargar",
        "starting": "Iniciando...",
        "saveSuccess": "✓ Ajustes guardados con éxito",
        "profileSaved": "✓ Perfil guardado con éxito",
        "skillSaved": "✓ Habilidad guardada con éxito",
        "skillDeleted": "Habilidad eliminada",
        "generationStopped": "Generación detenida",
        "copied": "✓ Copiado al portapapeles",
        "modalFeedsTitle": "API / RSS — Fuentes de datos en tiempo real",
        "feedsNoKeyBadge": "Sin claves • Local",
        "tabFeedsBuiltin": "APIs básicas (Cripto, Bolsa, Clima, Geo)",
        "tabFeedsRss": "Noticias y Canales RSS",
        "tabFeedsCustom": "API personalizada",
        "feedsBanner": "La red neuronal consulta estas APIs directamente mediante llamadas de herramientas sin análisis web pesado ni consumo excesivo de contexto. Todas las APIs son totalmente públicas y no requieren claves ni registro.",
        "feedsFooterHint": "Use los comandos /market, /weather, /news en el chat para obtener estos datos al instante",
        "feedActive": "Activo",
        "feedDisabled": "Desactivado",
        "providersBanner": "Conecte modelos de IA externos a través de API para operar sin carga de GPU. Todas las funciones integradas de SREDA AI (RAG de archivos, multimedia SD/MusicGen, datos en vivo de API/RSS, Blender MCP y voz) funcionan plenamente con modelos en la nube.",
        "enableLabel": "Activar:",
        "openrouterKeyLabel": "Clave API de OpenRouter:",
        "btnTestConnection": "Probar conexión",
        "openrouterModelLabel": "Modelo activo de OpenRouter:",
        "gigachatTitle": "Sber GigaChat (GigaChad API)",
        "gigachatDesc": "IA oficial de Sber • Certificados SSL compatibles automáticamente",
        "gigachatClientIdLabel": "Client ID (del proyecto developers.sber.ru):",
        "gigachatSecretLabel": "Client Secret / Clave API (del portal de Sber):",
        "gigachatScopeLabel": "Ámbito de acceso (Scope):",
        "gigachatScopePers": "GIGACHAT_API_PERS (Particulares / Personal)",
        "gigachatScopeCorp": "GIGACHAT_API_B2B (Empresas y B2B)",
        "gigachatModelLabel": "Modelo activo de GigaChat:",
        "gigachatBase64Toggle": "O usar datos de autorización preparados (Base64)",
        "gigachatBase64Label": "Datos de autorización (Base64 del portal de desarrolladores):",
        "customApiTitle": "API personalizada compatible con OpenAI",
        "customApiProviderName": "Nombre del proveedor:",
        "customApiBaseUrl": "URL base del endpoint:",
        "customApiKey": "Clave API:",
        "customApiModel": "ID del modelo (Model ID):",
        "tabApiModels": "☁️ APIs en la nube",
        "apiModelsBanner": "Los modelos en la nube se ejecutan a través de API externas sin carga en la GPU. Las funciones integradas de SREDA funcionan perfectamente.",
        "btnConfigureKeys": "Configurar claves",
        "apiModelsEmpty": "Aún no se han activado modelos de API en la nube. Habilite OpenRouter, Sber GigaChat o Custom API en Configuración.",
        "btnSelectModel": "Seleccionar modelo",
        "btnModelSelected": "Seleccionado",
        "badgeRecommended": "Recomendado",
        "badgeActive": "Activo",
        "badgeLocal": "Local",
        "badgeApi": "API / Nube",
        "labelSize": "Tamaño:",
        "labelSpeed": "Velocidad de inferencia:",
        "unitTokensSec": "t/s",
        "btnDownload": "Descargar",
        "btnActivate": "Activar",
        "btnInstalled": "Instalado",
        "installedEmpty": "Aún no hay archivos .gguf en las carpetas de modelos.<br>Descargue un modelo ternario de <b>«Familia Bonsai 2»</b> o busque en <b>Hugging Face</b>.",
        "sredaBoostTitle": "SREDA Boost — Modo juego de recursos",
        "sredaBoostDesc": "Eleva automáticamente la prioridad de inferencia a High, ralentiza procesos en segundo plano y libera RAM para acelerar GPU/UMA.",
        "autoBoostCheckbox": "Auto-Boost al iniciar inferencia",
        "btnPurgeRam": "Limpiar RAM ahora",
        "statusOff": "Desactivado",
        "statusActive": "Activo",
        "boostOff": "Boost: Desactivado",
        "boostOn": "Boost: Activado",
        "boostActive": "Boost: Activo",
        "apiReady": "API Listo",
        "activeVoiceLabel": "Voz activa para el idioma seleccionado:",
        "voiceInstalledBadge": "Instalado",
        "btnDownloadVoice": "Descargar voz (~60 MB)",
        "voiceCatalogTitle": "Biblioteca de voces (Piper TTS — Local, sin nube):",
        "voiceCatalogDesc": "Puede descargar voces en diferentes idiomas según sea necesario.",
        "copySnippet": "Copiar",
        "btnSkip": "Omitir",
        "feedsTitle": "API / RSS",
        "badgeCloudApi": "API / Nube",
        "badgeFlagship27b": "Insignia 27B",
        "installedDownloadHint": "Descargue un modelo ternario de la pestaña 'Familia Bonsai 2' o búsquelo en Hugging Face.",
        "apiModelsEnableHint": "Habilite OpenRouter, Sber GigaChat o Custom API en los",
        "boostHighCpu": "Activo (High CPU)",
        "boostDisabled": "Desactivado",
        "customApiKeyLabel": "Clave API (si se requiere):",
        "customApiModelLabel": "Nombre del modelo:",
        "btnCompactRam": "Limpiar RAM ahora",
        "boostCardTitle": "SREDA Boost — Modo juego de recursos",
        "boostCardDesc": "Aumenta automáticamente la prioridad del núcleo de inferencia a Alta, reduce tareas en segundo plano y compacta la RAM para acelerar Radeon 780M UMA.",
        "boostAutoLabel": "Auto-Boost al iniciar inferencia",
        "bonsaiDesc": {
            "bonsai-2-2b-ptq1": "Modelo ternario ultraligero Prism ML. Consume ~400 MB de RAM, generación instantánea (60+ t/s).",
            "bonsai-2-4b-ptq1": "Modelo óptimo para GPU integradas y PC compactas. Excelente comprensión con solo 0.88 GB.",
            "bonsai-2-9b-ptq1": "Estándar ideal para pruebas rápidas, razonamiento y código. Inferencia rápida y lógica sólida (1.86 GB).",
            "bonsai-1-8b-pq2": "Modelo clásico Bonsai sobre arquitectura LLaMA-3 (8B) con cuantización de 2 bits de Prism ML.",
            "bonsai-2-27b-ptq1": "Modelo ternario insignia de Prism ML. Razonamiento de nivel 27B con solo 5.54 GB. Descarga completa a GPU mediante Vulkan.",
            "bonsai-2-27b-pq2": "Precisión mejorada de cuantización de 2 bits de Prism ML. Requiere 6.71 GB, máxima conservación de detalles."
        },
        "baseApis": {
            "crypto": {
                "name": "Criptomonedas (CoinCap / CoinGecko)",
                "desc": "Cotizaciones en tiempo real, dinámica de 24h, volúmenes y capitalización de mercado."
            },
            "stocks": {
                "name": "Acciones, Índices, Metales (Yahoo Finance)",
                "desc": "Cotizaciones de acciones (AAPL, TSLA, NVDA), futuros de metales (oro, plata), materias primas e índices."
            },
            "rates": {
                "name": "Tipos de cambio mundiales (ExchangeRate-API)",
                "desc": "Tipos de cambio actualizados de monedas mundiales frente al rublo, dólar y euro (ExchangeRate-API)."
            },
            "weather": {
                "name": "Clima y Pronósticos (Open-Meteo)",
                "desc": "API meteorológica de alta precisión sin publicidad ni claves: temperatura, viento, precipitación, humedad."
            },
            "geocoding": {
                "name": "Geocodificación y Población (Open-Meteo Geo)",
                "desc": "Determinación de coordenadas geográficas exactas, husos horarios y población de ciudades del mundo."
            },
            "countries": {
                "name": "Países y Capitales (REST Countries)",
                "desc": "Guía enciclopédica completa de estados soberanos (banderas, capitales, idiomas, monedas)."
            },
            "avatars": {
                "name": "Generador de avatares (Dicebear API)",
                "desc": "Generación rápida de avatares vectoriales únicos basados en cualquier semilla de texto (Dicebear API)."
            }
        },
        "badgeCompatible": "Compatible",
        "badgeHighLoad": "Carga alta",
        "badgeExceedsRam": "Excede la RAM"
    },
    "pt": {
        "defaultUserName": "Usuário",
        "appVersionLabel": "Versão:",
        "appAuthorLabel": "Autor:",
        "appAuthorName": "Markus Marrei",
        "renameChat": "Renomear conversa",
        "deleteChat": "Excluir conversa",
        "newChat": "Novo chat",
        "skills": "Habilidades",
        "userRole": "Usuário",
        "models": "Modelos",
        "settings": "Configurações",
        "autoTts": "Voz automática",
        "emptyTitle": "Como posso ajudar você hoje?",
        "emptyDesc": "Escolha um prompt abaixo ou inicie uma conversa livre",
        "chipCity": "Cidades do futuro e bioarquitetura",
        "chipMusic": "Criar uma faixa ambient atmosférica",
        "chipTernary": "Qual a mágica da quantização ternária Bonsai 2?",
        "chipCode": "Código C++/Rust de alto desempenho",
        "chatPlaceholder": "Faça uma pergunta, anexe um arquivo ou use /skill... (Enter para enviar)",
        "sendTooltip": "Enviar mensagem",
        "stopTooltip": "Interromper geração",
        "attachTooltip": "Anexar arquivo",
        "voiceTooltip": "Entrada de voz",
        "modalModelsTitle": "Catálogo & Gerenciamento de modelos",
        "tabBonsai": "Família Bonsai 2",
        "tabHf": "Busca no Hugging Face",
        "tabInstalled": "Instalados localmente",
        "btnSearch": "Buscar",
        "btnRefresh": "Atualizar",
        "btnOpenFolder": "Abrir pasta de modelos",
        "btnClose": "Fechar",
        "searchHfPlaceholder": "Buscar modelos GGUF no Hugging Face (ex: qwen2, mistral)...",
        "modalSettingsTitle": "Parâmetros de inferência & Estação SREDA AI",
        "tabInference": "Inferência & Hardware",
        "tabServer": "Servidor API (LM Studio)",
        "tabLanguage": "Idioma & Voz",
        "tabProviders": "APIs externas & Modelos",
        "hwDiagCpuGpu": "Processador & Gráficos",
        "hwDiagRam": "Memória RAM",
        "gpuLayersLabel": "Camadas na GPU (Radeon 780M Vulkan):",
        "threadsLabel": "Threads de CPU (Ryzen Zen 4):",
        "contextLabel": "Janela de contexto (Tokens):",
        "flashAttentionLabel": "Flash Attention (-fa on)",
        "flashAttentionDesc": "Economiza até 40% da memória KV-cache e agiliza arquivos RAG.",
        "presetTitle": "Predefinição de desempenho máximo",
        "presetDesc": "99 camadas Vulkan, 8 threads Zen 4, contexto 8K, Flash Attention ON",
        "optimize": "Otimizar",
        "apiActive": "Servidor API local ativo",
        "copyBaseUrl": "Copiar URL Base",
        "testApiBtn": "Testar API",
        "apiPortLabel": "Porta principal da API:",
        "snippetsTitle": "Instruções de conexão:",
        "uiLangLabel": "Idioma da interface:",
        "autoTtsLabel": "Ler automaticamente respostas em voz alta",
        "autoTtsDesc": "Síntese de voz ao concluir a geração (Piper TTS / Windows)",
        "cancel": "Cancelar",
        "saveSettings": "Salvar configurações",
        "modalProfileTitle": "Perfil do usuário & Personalização",
        "avatarTitle": "Seu avatar nas conversas",
        "avatarDesc": "Formato PNG, JPG ou WebP até 5 MB",
        "uploadPhoto": "Enviar foto",
        "resetAvatar": "Redefinir",
        "firstNameLabel": "Nome:",
        "lastNameLabel": "Sobrenome:",
        "aboutLabel": "Sobre mim:",
        "aboutSub": "(esta informação será enviada à IA para personalizar o diálogo)",
        "saveProfile": "Salvar perfil",
        "profileFirstNamePlaceholder": "Nome",
        "profileLastNamePlaceholder": "Sobrenome",
        "profileAboutPlaceholder": "Ex.: arquiteto, crio cenas 3D no Blender...",
        "modalSkillsTitle": "Biblioteca de habilidades",
        "btnAddSkill": "Criar habilidade",
        "skillsHint": "Habilidades transformam o modelo em um especialista dedicado.",
        "btnBack": "Voltar",
        "skillEditTitle": "Editar habilidade",
        "skillNameLabel": "Nome da habilidade:",
        "skillTriggerLabel": "Comando rápido (/trigger):",
        "skillDescLabel": "Descrição curta:",
        "skillPromptLabel": "Contexto do sistema / Prompt:",
        "saveSkill": "Salvar habilidade",
        "skillsFooterHint": "Digite / no chat para acesso rápido às habilidades ativas.",
        "skillNamePlaceholder": "Scripter Python no Blender",
        "skillTriggerPlaceholder": "/blender",
        "skillDescPlaceholder": "Criação de cenas 3D e scripts procedurais...",
        "skillPromptPlaceholder": "Você é um especialista na API Python do Blender (bpy)...",
        "load": "Carregar",
        "unload": "Descarregar",
        "starting": "Iniciando...",
        "saveSuccess": "✓ Configurações salvas com sucesso",
        "profileSaved": "✓ Perfil salvo com sucesso",
        "skillSaved": "✓ Habilidade salva com sucesso",
        "skillDeleted": "Habilidade excluída",
        "generationStopped": "Geração interrompida",
        "copied": "✓ Copiado para a área de transferência",
        "modalFeedsTitle": "API / RSS — Fontes de dados em tempo real",
        "feedsNoKeyBadge": "Sem chaves • Local",
        "tabFeedsBuiltin": "APIs básicas (Cripto, Ações, Clima, Geo)",
        "tabFeedsRss": "Notícias e Canais RSS",
        "tabFeedsCustom": "API personalizada",
        "feedsBanner": "A rede neural consulta essas APIs diretamente por chamadas de ferramentas sem raspagem web pesada ou desperdício de contexto. Todas as APIs são totalmente públicas e não exigem chaves ou cadastro.",
        "feedsFooterHint": "Use as habilidades /market, /weather, /news no chat para invocar esses dados instantaneamente",
        "feedActive": "Ativo",
        "feedDisabled": "Desativado",
        "providersBanner": "Conecte IAs externas via API para funcionar sem sobrecarga na GPU. Todos os recursos integrados do SREDA AI (RAG de arquivos, multimídia SD/MusicGen, dados ao vivo API/RSS, Blender MCP e voz) funcionam perfeitamente com modelos em nuvem.",
        "enableLabel": "Ativar:",
        "openrouterKeyLabel": "Chave de API do OpenRouter:",
        "btnTestConnection": "Testar conexão",
        "openrouterModelLabel": "Modelo ativo do OpenRouter:",
        "gigachatTitle": "Sber GigaChat (GigaChad API)",
        "gigachatDesc": "IA oficial do Sber • Certificados SSL suportados automaticamente",
        "gigachatClientIdLabel": "Client ID (do projeto developers.sber.ru):",
        "gigachatSecretLabel": "Client Secret / Chave de API (do portal Sber):",
        "gigachatScopeLabel": "Escopo de acesso (Scope):",
        "gigachatScopePers": "GIGACHAT_API_PERS (Pessoas Físicas / Pessoal)",
        "gigachatScopeCorp": "GIGACHAT_API_B2B (Empresas e B2B)",
        "gigachatModelLabel": "Modelo ativo do GigaChat:",
        "gigachatBase64Toggle": "Ou use credenciais de autorização prontas (Base64)",
        "gigachatBase64Label": "Dados de autorização (Base64 do portal de desenvolvedores):",
        "customApiTitle": "API personalizada compatível com OpenAI",
        "customApiProviderName": "Nome do provedor:",
        "customApiBaseUrl": "URL base do endpoint:",
        "customApiKey": "Chave de API:",
        "customApiModel": "ID do modelo (Model ID):",
        "tabApiModels": "☁️ APIs em nuvem",
        "apiModelsBanner": "Modelos em nuvem funcionam por meio de APIs externas sem carga na GPU. Os recursos integrados do SREDA funcionam perfeitamente.",
        "btnConfigureKeys": "Configurar chaves",
        "apiModelsEmpty": "Nenhum modelo de API em nuvem ativado ainda. Ative OpenRouter, Sber GigaChat ou Custom API em Configurações.",
        "btnSelectModel": "Selecionar modelo",
        "btnModelSelected": "Selecionado",
        "badgeRecommended": "Recomendado",
        "badgeActive": "Ativo",
        "badgeLocal": "Local",
        "badgeApi": "API / Nuvem",
        "labelSize": "Tamanho:",
        "labelSpeed": "Velocidade de inferência:",
        "unitTokensSec": "t/s",
        "btnDownload": "Baixar",
        "btnActivate": "Ativar",
        "btnInstalled": "Instalado",
        "installedEmpty": "Ainda não há arquivos de modelo .gguf nas pastas de modelos.<br>Baixe um modelo ternário na guia <b>«Família Bonsai 2»</b> ou encontre no <b>Hugging Face</b>.",
        "sredaBoostTitle": "SREDA Boost — Modo de jogo de recursos",
        "sredaBoostDesc": "Eleva automaticamente a prioridade de inferência para High, reduz processos em segundo plano e compacta a RAM para acelerar a GPU/UMA.",
        "autoBoostCheckbox": "Auto-Boost ao iniciar inferência",
        "btnPurgeRam": "Limpar RAM agora",
        "statusOff": "Desativado",
        "statusActive": "Ativo",
        "boostOff": "Boost: Desligado",
        "boostOn": "Boost: Ligado",
        "boostActive": "Boost: Ativo",
        "apiReady": "API Pronto",
        "activeVoiceLabel": "Voz ativa para o idioma selecionado:",
        "voiceInstalledBadge": "Instalado",
        "btnDownloadVoice": "Baixar voz (~60 MB)",
        "voiceCatalogTitle": "Biblioteca de vozes (Piper TTS — Local, sem nuvem):",
        "voiceCatalogDesc": "Você pode baixar vozes em diferentes idiomas conforme necessário.",
        "copySnippet": "Copiar",
        "btnSkip": "Pular",
        "feedsTitle": "API / RSS",
        "badgeCloudApi": "API / Nuvem",
        "badgeFlagship27b": "Carro-chefe 27B",
        "installedDownloadHint": "Baixe um modelo ternário na aba 'Família Bonsai 2' ou encontre-o no Hugging Face.",
        "apiModelsEnableHint": "Ative o OpenRouter, Sber GigaChat ou Custom API nas",
        "boostHighCpu": "Ativo (High CPU)",
        "boostDisabled": "Desativado",
        "customApiKeyLabel": "Chave de API (se necessário):",
        "customApiModelLabel": "Nome do modelo:",
        "btnCompactRam": "Limpar RAM agora",
        "boostCardTitle": "SREDA Boost — Modo de jogo de recursos",
        "boostCardDesc": "Aumenta automaticamente a prioridade do núcleo de inferência para Alta, reduz tarefas em segundo plano e compacta a RAM para acelerar Radeon 780M UMA.",
        "boostAutoLabel": "Auto-Boost ao iniciar inferência",
        "bonsaiDesc": {
            "bonsai-2-2b-ptq1": "Modelo ternário ultraleve Prism ML. Consome ~400 MB de RAM, geração instantânea (60+ t/s).",
            "bonsai-2-4b-ptq1": "Modelo ideal para iGPUs e PCs compactos. Excelente compreensão com apenas 0.88 GB.",
            "bonsai-2-9b-ptq1": "Padrão ideal para testes rápidos, raciocínio e código. Inferência rápida e lógica sólida (1.86 GB).",
            "bonsai-1-8b-pq2": "Modelo clássico Bonsai na arquitetura LLaMA-3 (8B) com quantização de 2 bits Prism ML.",
            "bonsai-2-27b-ptq1": "Modelo ternário topo de linha Prism ML. Raciocínio de nível 27B com apenas 5.54 GB. Descarregamento total para GPU via Vulkan.",
            "bonsai-2-27b-pq2": "Precisão aprimorada de quantização de 2 bits Prism ML. Requer 6.71 GB, máxima preservação de detalhes."
        },
        "baseApis": {
            "crypto": {
                "name": "Criptomoeda (CoinCap / CoinGecko)",
                "desc": "Cotações em tempo real, dinâmica de 24h, volumes de negociação e capitalização de mercado."
            },
            "stocks": {
                "name": "Ações, Índices, Metais (Yahoo Finance)",
                "desc": "Cotações de ações (AAPL, TSLA, NVDA), futuros de metais (ouro, prata), commodities e índices."
            },
            "rates": {
                "name": "Taxas de câmbio mundiais (ExchangeRate-API)",
                "desc": "Taxas de câmbio atualizadas de moedas mundiais em relação ao rublo, dólar e euro (ExchangeRate-API)."
            },
            "weather": {
                "name": "Clima e Previsões (Open-Meteo)",
                "desc": "API meteorológica de alta precisão sem anúncios nem chaves: temperatura, vento, precipitação, umidade."
            },
            "geocoding": {
                "name": "Geocodificação e População (Open-Meteo Geo)",
                "desc": "Determinação de coordenadas geográficas exatas, fusos horários e população de cidades do mundo."
            },
            "countries": {
                "name": "Países e Capitais (REST Countries)",
                "desc": "Guia enciclopédico abrangente sobre estados soberanos (bandeiras, capitais, idiomas, moedas)."
            },
            "avatars": {
                "name": "Gerador de avatares (Dicebear API)",
                "desc": "Geração rápida de avatares vetoriais exclusivos com base em qualquer semente de texto (Dicebear API)."
            }
        },
        "badgeCompatible": "Compatível",
        "badgeHighLoad": "Carga alta",
        "badgeExceedsRam": "Excede a RAM"
    },
    "it": {
        "defaultUserName": "Utente",
        "appVersionLabel": "Versione:",
        "appAuthorLabel": "Autore:",
        "appAuthorName": "Markus Marrei",
        "newChat": "Nuova chat",
        "skills": "Abilità",
        "userRole": "Utente",
        "models": "Modelli",
        "settings": "Impostazioni",
        "autoTts": "Voce automatica",
        "emptyTitle": "Come posso aiutarti oggi?",
        "emptyDesc": "Scegli un prompt qui sotto o inizia una conversazione libera in qualsiasi lingua",
        "chipCity": "Città del futuro e bioarchitettura",
        "chipMusic": "Crea una traccia ambient atmosferica",
        "chipTernary": "Qual è la magia della quantizzazione ternaria Bonsai 2?",
        "chipCode": "Codice C++/Rust ad alte prestazioni",
        "chatPlaceholder": "Fai una domanda, allega un documento o usa /skill... (Invio per inviare)",
        "sendTooltip": "Invia messaggio",
        "stopTooltip": "Interrompi generazione",
        "attachTooltip": "Allega file o documento",
        "voiceTooltip": "Input vocale",
        "modalModelsTitle": "Catalogo & Gestione modelli",
        "tabBonsai": "Famiglia Bonsai 2",
        "tabHf": "Ricerca su Hugging Face",
        "tabInstalled": "Installati localmente",
        "btnSearch": "Cerca",
        "btnRefresh": "Aggiorna lista",
        "btnOpenFolder": "Apri cartella modelli",
        "btnClose": "Chiudi",
        "searchHfPlaceholder": "Cerca modelli GGUF su Hugging Face (es. qwen2, mistral, llama)...",
        "modalSettingsTitle": "Parametri di inferenza & Hub SREDA AI",
        "tabInference": "Inferenza & Hardware",
        "tabServer": "Server API (LM Studio)",
        "tabLanguage": "Lingua & Voce",
        "tabProviders": "API esterne & Modelli",
        "hwDiagCpuGpu": "Processore & Grafica",
        "hwDiagRam": "Memoria RAM",
        "gpuLayersLabel": "Layer su GPU (Radeon 780M Vulkan):",
        "threadsLabel": "Thread CPU (Ryzen Zen 4):",
        "contextLabel": "Finestra di contesto (Token):",
        "flashAttentionLabel": "Flash Attention (-fa on)",
        "flashAttentionDesc": "Risparmia fino al 40% di RAM KV-cache e velocizza l'elaborazione RAG.",
        "presetTitle": "Preset massime prestazioni",
        "presetDesc": "99 layer Vulkan, 8 thread Zen 4, contesto 8K, Flash Attention ATTIVO",
        "optimize": "Ottimizza",
        "apiActive": "Server API locale attivo",
        "copyBaseUrl": "Copia URL Base",
        "testApiBtn": "Test API",
        "apiPortLabel": "Porta API principale:",
        "snippetsTitle": "Istruzioni di connessione:",
        "uiLangLabel": "Lingua interfaccia:",
        "autoTtsLabel": "Leggi automaticamente le risposte ad alta voce",
        "autoTtsDesc": "Sintesi vocale al termine della generazione (Piper TTS / Windows)",
        "cancel": "Annulla",
        "saveSettings": "Salva impostazioni",
        "modalProfileTitle": "Profilo utente & Personalizzazione",
        "avatarTitle": "Il tuo avatar nelle conversazioni",
        "avatarDesc": "Formato PNG, JPG o WebP fino a 5 MB",
        "uploadPhoto": "Carica foto",
        "resetAvatar": "Reimposta",
        "firstNameLabel": "Nome:",
        "lastNameLabel": "Cognome:",
        "aboutLabel": "Su di me:",
        "aboutSub": "(queste informazioni saranno fornite all'IA per personalizzare il dialogo)",
        "saveProfile": "Salva profilo",
        "profileFirstNamePlaceholder": "Nome",
        "profileLastNamePlaceholder": "Cognome",
        "profileAboutPlaceholder": "Es.: architetto, amo il codice Python pulito, creo scene 3D in Blender...",
        "modalSkillsTitle": "Libreria abilità dell'assistente",
        "btnAddSkill": "Crea abilità",
        "skillsHint": "Le abilità trasformano il modello in un esperto con istruzioni dedicate.",
        "btnBack": "Indietro",
        "skillEditTitle": "Modifica abilità",
        "skillNameLabel": "Nome abilità:",
        "skillTriggerLabel": "Comando rapido (/trigger):",
        "skillDescLabel": "Breve descrizione:",
        "skillPromptLabel": "Contesto di sistema / Prompt abilità:",
        "saveSkill": "Salva abilità",
        "skillsFooterHint": "Digita / nel campo di input per accedere rapidamente alle abilità attive.",
        "skillNamePlaceholder": "Scripter Python per Blender",
        "skillTriggerPlaceholder": "/blender",
        "skillDescPlaceholder": "Creazione di scene 3D e script procedurali via bpy...",
        "skillPromptPlaceholder": "Sei un esperto di alto livello dell'API Python di Blender (bpy)...",
        "load": "Carica",
        "unload": "Scarica",
        "starting": "Avvio in corso...",
        "saveSuccess": "✓ Impostazioni salvate con successo",
        "profileSaved": "✓ Profilo salvato con successo",
        "skillSaved": "✓ Abilità salvata con successo",
        "skillDeleted": "Abilità eliminata",
        "generationStopped": "Generazione interrotta",
        "copied": "✓ Copiato negli appunti",
        "modalFeedsTitle": "API / RSS — Fonti dati in tempo reale",
        "feedsNoKeyBadge": "Senza chiavi • Locale",
        "tabFeedsBuiltin": "API di base (Cripto, Borsa, Meteo, Geo)",
        "tabFeedsRss": "Notizie e Feed RSS",
        "tabFeedsCustom": "API personalizzata",
        "feedsBanner": "La rete neurale interroga queste API direttamente tramite chiamate di strumenti, senza pesante web parsing o spreco di contesto. Tutte le API sono completamente pubbliche e non richiedono chiavi o registrazione.",
        "feedsFooterHint": "Usa i comandi /market, /weather, /news nella chat per richiamare istantaneamente questi dati",
        "feedActive": "Attivo",
        "feedDisabled": "Disattivato",
        "providersBanner": "Collega IA esterne tramite API per lavorare senza carico sulla GPU. Tutte le funzionalità integrate di SREDA AI (RAG con file, multimediale SD/MusicGen, dati in tempo reale API/RSS, Blender MCP e voce) funzionano perfettamente con i modelli cloud.",
        "enableLabel": "Attiva:",
        "openrouterKeyLabel": "Chiave API OpenRouter:",
        "btnTestConnection": "Test connessione",
        "openrouterModelLabel": "Modello attivo OpenRouter:",
        "gigachatTitle": "Sber GigaChat (GigaChad API)",
        "gigachatDesc": "IA ufficiale di Sber • Certificati SSL supportati automaticamente",
        "gigachatClientIdLabel": "Client ID (dal progetto developers.sber.ru):",
        "gigachatSecretLabel": "Client Secret / Chiave API (dal portale Sber):",
        "gigachatScopeLabel": "Ambito di accesso (Scope):",
        "gigachatScopePers": "GIGACHAT_API_PERS (Persone fisiche / Personale)",
        "gigachatScopeCorp": "GIGACHAT_API_B2B (Aziende e B2B)",
        "gigachatModelLabel": "Modello attivo GigaChat:",
        "gigachatBase64Toggle": "Oppure usa credenziali di autorizzazione pronte (Base64)",
        "gigachatBase64Label": "Dati di autorizzazione (Base64 dal portale sviluppatori):",
        "customApiTitle": "API personalizzata compatibile con OpenAI",
        "customApiProviderName": "Nome del provider:",
        "customApiBaseUrl": "URL base dell'endpoint:",
        "customApiKey": "Chiave API:",
        "customApiModel": "ID modello (Model ID):",
        "tabApiModels": "☁️ API Cloud",
        "apiModelsBanner": "I modelli cloud operano tramite API esterne senza carico sulla GPU. Le funzioni integrate di SREDA funzionano perfettamente.",
        "btnConfigureKeys": "Configura chiavi",
        "apiModelsEmpty": "Nessun modello API cloud ancora attivato. Abilita OpenRouter, Sber GigaChat o Custom API nelle Impostazioni.",
        "btnSelectModel": "Seleziona modello",
        "btnModelSelected": "Selezionato",
        "badgeRecommended": "Consigliato",
        "badgeActive": "Attivo",
        "badgeLocal": "Locale",
        "badgeApi": "API / Cloud",
        "labelSize": "Dimensione:",
        "labelSpeed": "Velocità di inferenza:",
        "unitTokensSec": "t/s",
        "btnDownload": "Scarica",
        "btnActivate": "Attiva",
        "btnInstalled": "Installato",
        "installedEmpty": "Nessun file di modello .gguf ancora presente nelle cartelle.<br>Scarica un modello ternario dalla scheda <b>«Famiglia Bonsai 2»</b> o cerca su <b>Hugging Face</b>.",
        "sredaBoostTitle": "SREDA Boost — Modalità gioco per le risorse",
        "sredaBoostDesc": "Aumenta automaticamente la priorità di inferenza a High, riduce i processi in background e ottimizza la RAM per accelerare la GPU/UMA.",
        "autoBoostCheckbox": "Auto-Boost all'avvio dell'inferenza",
        "btnPurgeRam": "Libera RAM adesso",
        "statusOff": "Disattivato",
        "statusActive": "Attivo",
        "boostOff": "Boost: Disattivo",
        "boostOn": "Boost: Attivo",
        "boostActive": "Boost: Attivo",
        "apiReady": "API Pronto",
        "activeVoiceLabel": "Voce attiva per la lingua selezionata:",
        "voiceInstalledBadge": "Installato",
        "btnDownloadVoice": "Scarica voce (~60 MB)",
        "voiceCatalogTitle": "Libreria voci (Piper TTS — Locale, senza cloud):",
        "voiceCatalogDesc": "Puoi scaricare voci in diverse lingue secondo necessità.",
        "copySnippet": "Copia",
        "btnSkip": "Salta",
        "feedsTitle": "API / RSS",
        "badgeCloudApi": "API / Cloud",
        "badgeFlagship27b": "Ammiraglia 27B",
        "installedDownloadHint": "Scarica un modello ternario dalla scheda 'Famiglia Bonsai 2' o cercalo su Hugging Face.",
        "apiModelsEnableHint": "Abilita OpenRouter, Sber GigaChat o Custom API nelle",
        "boostHighCpu": "Attivo (High CPU)",
        "boostDisabled": "Disattivato",
        "customApiKeyLabel": "Chiave API (se richiesta):",
        "customApiModelLabel": "Nome del modello:",
        "btnCompactRam": "Pulisci RAM ora",
        "boostCardTitle": "SREDA Boost — Modalità gioco per risorse",
        "boostCardDesc": "Aumenta automaticamente la priorità del motore di inferenza su Alta, riduce i processi in background e compatta la RAM per accelerare la Radeon 780M UMA.",
        "boostAutoLabel": "Auto-Boost all'avvio dell'inferenza",
        "bonsaiDesc": {
            "bonsai-2-2b-ptq1": "Modello ternario ultraleggero Prism ML. Consumo ~400 MB di RAM, generazione istantanea (60+ t/s).",
            "bonsai-2-4b-ptq1": "Modello ottimale per iGPU e PC compatti. Ottima comprensione con solo 0.88 GB.",
            "bonsai-2-9b-ptq1": "Standard ideale per test rapidi, ragionamento e programmazione. Inferenza rapida e logica solida (1.86 GB).",
            "bonsai-1-8b-pq2": "Modello classico Bonsai su architettura LLaMA-3 (8B) con quantizzazione a 2 bit Prism ML.",
            "bonsai-2-27b-ptq1": "Modello ternario di punta Prism ML. Ragionamento di livello 27B con soli 5.54 GB. Offload completo su GPU tramite Vulkan.",
            "bonsai-2-27b-pq2": "Precisione migliorata della quantizzazione a 2 bit di Prism ML. Richiede 6.71 GB di RAM, massima fedeltà dei dettagli."
        },
        "baseApis": {
            "crypto": {
                "name": "Criptovaluta (CoinCap / CoinGecko)",
                "desc": "Quotazioni in tempo reale, dinamica 24h, volumi di scambio e capitalizzazione di mercato."
            },
            "stocks": {
                "name": "Azioni, Indici, Metalli (Yahoo Finance)",
                "desc": "Quotazioni azionarie (AAPL, TSLA, NVDA), futures su metalli (oro, argento), materie prime e indici."
            },
            "rates": {
                "name": "Tassi di cambio mondiali (ExchangeRate-API)",
                "desc": "Tassi di cambio aggiornati delle valute mondiali rispetto a rublo, dollaro ed euro (ExchangeRate-API)."
            },
            "weather": {
                "name": "Meteo e Previsioni (Open-Meteo)",
                "desc": "API meteorologica ad alta precisione senza pubblicità o chiavi: temperatura, vento, precipitazioni, umidità."
            },
            "geocoding": {
                "name": "Geocodifica e Popolazione (Open-Meteo Geo)",
                "desc": "Determinazione di coordinate geografiche esatte, fusi orari e popolazione delle città del mondo."
            },
            "countries": {
                "name": "Paesi e Capitali (REST Countries)",
                "desc": "Guida enciclopedica completa sugli stati sovrani (bandiere, capitali, lingue, valute)."
            },
            "avatars": {
                "name": "Generatore di avatar (Dicebear API)",
                "desc": "Generazione rapida di avatar vettoriali unici basati su qualsiasi seed di testo (Dicebear API)."
            }
        },
        "badgeCompatible": "Compatibile",
        "badgeHighLoad": "Carico elevato",
        "badgeExceedsRam": "Supera la RAM"
    },
    "ja": {
        "defaultUserName": "ユーザー",
        "appVersionLabel": "バージョン:",
        "appAuthorLabel": "著者:",
        "appAuthorName": "Markus Marrei",
        "renameChat": "チャット名を変更",
        "deleteChat": "チャットを削除",
        "newChat": "新しいチャット",
        "skills": "スキル",
        "userRole": "ユーザー",
        "models": "モデル",
        "settings": "設定",
        "autoTts": "自動音声",
        "emptyTitle": "今日はどのようなお手伝いをしましょうか？",
        "emptyDesc": "以下のプロンプトを選択するか、自由に対話を開始してください",
        "chipCity": "未来都市とバイオアーキテクチャ",
        "chipMusic": "アンビエントトラックの作成",
        "chipTernary": "Bonsai 2のTernary量子化の秘密とは？",
        "chipCode": "高性能C++/Rustコードの実装",
        "chatPlaceholder": "質問を入力、ファイルを添付、または /スキル を使用... (Enterで送信)",
        "sendTooltip": "メッセージを送信",
        "stopTooltip": "生成を停止",
        "attachTooltip": "ファイルを添付",
        "voiceTooltip": "音声入力",
        "modalModelsTitle": "モデルカタログ & 管理",
        "tabBonsai": "Bonsai 2 ファミリー",
        "tabHf": "Hugging Face 検索",
        "tabInstalled": "インストール済み",
        "btnSearch": "検索",
        "btnRefresh": "更新",
        "btnOpenFolder": "モデルフォルダを開く",
        "btnClose": "閉じる",
        "searchHfPlaceholder": "Hugging FaceでGGUFモデルを検索 (例: qwen2, mistral)...",
        "modalSettingsTitle": "推論パラメータ & SREDA AI ワークステーション",
        "tabInference": "推論 & ハードウェア",
        "tabServer": "APIサーバー (LM Studio)",
        "tabLanguage": "言語 & 音声",
        "tabProviders": "外部API & モデル",
        "hwDiagCpuGpu": "プロセッサ & グラフィックス",
        "hwDiagRam": "システムメモリ (RAM)",
        "gpuLayersLabel": "GPUオフロード層 (Radeon 780M Vulkan):",
        "threadsLabel": "CPUスレッド数 (Ryzen Zen 4):",
        "contextLabel": "コンテキストウィンドウ (トークン):",
        "flashAttentionLabel": "Flash Attention (-fa on)",
        "flashAttentionDesc": "KVキャッシュRAMを最大40%節約し、RAG処理を高速化します。",
        "presetTitle": "最高性能プリセット",
        "presetDesc": "Vulkan 99層, Zen 4 8スレッド, 8Kコンテキスト, Flash Attention ON",
        "optimize": "最適化",
        "apiActive": "ローカルAPIサーバー稼働中",
        "copyBaseUrl": "ベースURLをコピー",
        "testApiBtn": "APIテスト",
        "apiPortLabel": "メインAPIポート:",
        "snippetsTitle": "接続ガイド:",
        "uiLangLabel": "インターフェース言語:",
        "autoTtsLabel": "応答を自動的に音声読み上げ",
        "autoTtsDesc": "生成完了時に音声合成を実行します (Piper TTS / Windows)",
        "cancel": "キャンセル",
        "saveSettings": "設定を保存",
        "modalProfileTitle": "ユーザープロファイル & パーソナライズ",
        "avatarTitle": "チャット内のアバター",
        "avatarDesc": "PNG, JPG, WebP 形式 (最大5MB)",
        "uploadPhoto": "写真をアップロード",
        "resetAvatar": "リセット",
        "firstNameLabel": "名:",
        "lastNameLabel": "姓:",
        "aboutLabel": "自己紹介:",
        "aboutSub": "(この情報はAIに共有され、対話がパーソナライズされます)",
        "saveProfile": "プロファイルを保存",
        "profileFirstNamePlaceholder": "名",
        "profileLastNamePlaceholder": "姓",
        "profileAboutPlaceholder": "例: 建築家、Blenderで3Dシーンを制作...",
        "modalSkillsTitle": "アシスタントスキルライブラリ",
        "btnAddSkill": "スキルを作成",
        "skillsHint": "スキルによってモデルが特定の専門エキスパートに変身します。",
        "btnBack": "戻る",
        "skillEditTitle": "スキルの編集",
        "skillNameLabel": "スキル名:",
        "skillTriggerLabel": "スラッシュコマンド (/trigger):",
        "skillDescLabel": "簡単な説明:",
        "skillPromptLabel": "システムプロンプト:",
        "saveSkill": "スキルを保存",
        "skillsFooterHint": "入力欄で / を入力すると、有効なスキルを素早く呼び出せます。",
        "skillNamePlaceholder": "Blender Python スクリプター",
        "skillTriggerPlaceholder": "/blender",
        "skillDescPlaceholder": "bpyによる3Dシーンおよびプロシージャル作成...",
        "skillPromptPlaceholder": "あなたはBlender Python API (bpy) のトップエキスパートです...",
        "load": "ロード",
        "unload": "アンロード",
        "starting": "起動中...",
        "saveSuccess": "✓ 設定を保存しました",
        "profileSaved": "✓ プロファイルを保存しました",
        "skillSaved": "✓ スキルを保存しました",
        "skillDeleted": "スキルを削除しました",
        "generationStopped": "生成を停止しました",
        "copied": "✓ クリップボードにコピーしました",
        "modalFeedsTitle": "API / RSS — リアルタイムデータソース",
        "feedsNoKeyBadge": "キー不要 • ローカル",
        "tabFeedsBuiltin": "基本API (暗号資産、株式、天気、地理)",
        "tabFeedsRss": "ニュース & RSSフィード",
        "tabFeedsCustom": "カスタムAPI",
        "feedsBanner": "ニューラルネットワークは、重いWebスクレイピングやコンテキスト消費なしに、ツール呼び出しを介してこれらのAPIに直接アクセスします。すべてのAPIは完全公開されており、キーや登録は不要です。",
        "feedsFooterHint": "チャットで /market, /weather, /news スキルを使用して、これらのデータを即座に呼び出します",
        "feedActive": "アクティブ",
        "feedDisabled": "無効",
        "providersBanner": "API経由で外部AIを接続し、GPU負荷なしで動作させます。SREDA AIのすべての機能（ファイルRAG、SD/MusicGenマルチメディア、API/RSSライブデータ、Blender MCP、音声合成）は、クラウドモデルで完全に使用可能です。",
        "enableLabel": "有効化:",
        "openrouterKeyLabel": "OpenRouter APIキー:",
        "btnTestConnection": "接続テスト",
        "openrouterModelLabel": "アクティブOpenRouterモデル:",
        "gigachatTitle": "Sber GigaChat (GigaChad API)",
        "gigachatDesc": "公式Sber AI • ロシアデジタル省SSL証明書を自動サポート",
        "gigachatClientIdLabel": "Client ID (developers.sber.ru プロジェクトより):",
        "gigachatSecretLabel": "Client Secret / APIキー (Sberポータルより):",
        "gigachatScopeLabel": "アクセススコープ (Scope):",
        "gigachatScopePers": "GIGACHAT_API_PERS (個人 / パーソナル)",
        "gigachatScopeCorp": "GIGACHAT_API_B2B (法人およびB2B)",
        "gigachatModelLabel": "アクティブGigaChatモデル:",
        "gigachatBase64Toggle": "または準備された認証データ (Base64) を使用",
        "gigachatBase64Label": "認証データ (ポータルからのBase64):",
        "customApiTitle": "カスタムOpenAI互換API",
        "customApiProviderName": "プロバイダー名:",
        "customApiBaseUrl": "ベースエンドポイントURL:",
        "customApiKey": "APIキー:",
        "customApiModel": "モデルID (Model ID):",
        "tabApiModels": "☁️ クラウドAPI",
        "apiModelsBanner": "クラウドモデルはGPU負荷なしで外部API経由で動作します。SREDAのすべての機能がシームレスに機能します。",
        "btnConfigureKeys": "キーを設定",
        "apiModelsEmpty": "クラウドAPIモデルはまだ有効化されていません。設定でOpenRouter、Sber GigaChat、またはカスタムAPIを有効にしてください。",
        "btnSelectModel": "モデルを選択",
        "btnModelSelected": "選択済み",
        "badgeRecommended": "推奨",
        "badgeActive": "アクティブ",
        "badgeLocal": "ローカル",
        "badgeApi": "API / クラウド",
        "labelSize": "サイズ:",
        "labelSpeed": "推論速度:",
        "unitTokensSec": "t/s",
        "btnDownload": "ダウンロード",
        "btnActivate": "アクティブ化",
        "btnInstalled": "インストール済み",
        "installedEmpty": "モデルフォルダに.ggufファイルがまだありません。<br><b>「Bonsai 2ファミリー」</b>タブから三値モデルをダウンロードするか、<b>Hugging Face</b>で検索してください。",
        "sredaBoostTitle": "SREDA Boost — ゲームモードリソース最適化",
        "sredaBoostDesc": "推論コアの優先度を自動的にHighに引き上げ、バックグラウンドプロセスを抑制してRAMを圧縮し、GPU/UMAを高速化します。",
        "autoBoostCheckbox": "推論開始時に自動Boost",
        "btnPurgeRam": "今すぐRAMを解放",
        "statusOff": "無効",
        "statusActive": "アクティブ",
        "boostOff": "Boost: オフ",
        "boostOn": "Boost: オン",
        "boostActive": "Boost: アクティブ",
        "apiReady": "API 準備完了",
        "activeVoiceLabel": "選択した言語のアクティブ音声:",
        "voiceInstalledBadge": "インストール済み",
        "btnDownloadVoice": "音声をダウンロード (~60 MB)",
        "voiceCatalogTitle": "音声ライブラリ (Piper TTS — ローカル、クラウド不要):",
        "voiceCatalogDesc": "必要に応じてさまざまな言語の音声をダウンロードできます。",
        "copySnippet": "コピー",
        "btnSkip": "スキップ",
        "feedsTitle": "API / RSS",
        "badgeCloudApi": "API / クラウド",
        "badgeFlagship27b": "フラッグシップ 27B",
        "installedDownloadHint": "「Bonsai 2シリーズ」タブから3値化モデルをダウンロードするか、Hugging Faceで検索してください。",
        "apiModelsEnableHint": "でOpenRouter、Sber GigaChatまたはカスタムAPIを有効にしてください:",
        "boostHighCpu": "アクティブ (High CPU)",
        "boostDisabled": "無効",
        "customApiKeyLabel": "APIキー (必要な場合):",
        "customApiModelLabel": "モデル名:",
        "btnCompactRam": "今すぐRAMを解放",
        "boostCardTitle": "SREDA Boost — リソースゲームモード",
        "boostCardDesc": "推論コアの優先度を自動的にHighに引き上げ、バックグラウンドプロセスを抑制し、RAMを最適化してRadeon 780M UMAを高速化します。",
        "boostAutoLabel": "推論開始時の自動Boost",
        "bonsaiDesc": {
            "bonsai-2-2b-ptq1": "超軽量三値Prism MLモデル。メモリ消費約400MB、瞬時生成 (60+ t/s)。",
            "bonsai-2-4b-ptq1": "内蔵GPUや軽量PCに最適なモデル。わずか0.88GBで優れた言語理解。",
            "bonsai-2-9b-ptq1": "高速テスト、推論、コーディングの理想的な標準。1.86GBで高速推論と安定した論理。",
            "bonsai-1-8b-pq2": "Prism ML 2ビット量子化を採用したLLaMA-3 (8B) アーキテクチャのクラシックBonsaiモデル。",
            "bonsai-2-27b-ptq1": "フラッグシップ三値Prism MLモデル。わずか5.54GBで27B級の推論力。Vulkan経由でGPUに完全オフロード。",
            "bonsai-2-27b-pq2": "Prism MLによる高精度2ビット量子化。6.71GBのメモリを要し、微細なニュアンスを最大限に保持。"
        },
        "baseApis": {
            "crypto": {
                "name": "暗号資産 (CoinCap / CoinGecko)",
                "desc": "リアルタイム相場、24時間変動、取引高、時価総額。"
            },
            "stocks": {
                "name": "株式、指数、貴金属 (Yahoo Finance)",
                "desc": "株式相場 (AAPL, TSLA, NVDA)、金属先物 (金、銀)、コモディティ、市場指数。"
            },
            "rates": {
                "name": "世界為替レート (ExchangeRate-API)",
                "desc": "ルーブル、米ドル、ユーロに対する世界各国の最新為替レート (ExchangeRate-API)。"
            },
            "weather": {
                "name": "天気と予報 (Open-Meteo)",
                "desc": "広告やキーのない高精度気象API: 気温、風、降水量、湿度。"
            },
            "geocoding": {
                "name": "ジオコーディングと人口 (Open-Meteo Geo)",
                "desc": "世界の都市の正確な地理座標、タイムゾーン、人口の特定。"
            },
            "countries": {
                "name": "国と首都 (REST Countries)",
                "desc": "主権国家に関する包括的な百科事典的参考資料 (国旗、首都、言語、通貨)。"
            },
            "avatars": {
                "name": "アバタージェネレーター (Dicebear API)",
                "desc": "任意のテキストシードに基づくユニークなベクターアバターの高速生成 (Dicebear API)。"
            }
        },
        "badgeCompatible": "互換性あり",
        "badgeHighLoad": "高負荷",
        "badgeExceedsRam": "RAM超過"
    },
    "ko": {
        "defaultUserName": "사용자",
        "appVersionLabel": "버전:",
        "appAuthorLabel": "저자:",
        "appAuthorName": "Markus Marrei",
        "newChat": "새 대화",
        "skills": "스킬",
        "userRole": "사용자",
        "models": "모델",
        "settings": "설정",
        "autoTts": "자동 음성",
        "emptyTitle": "오늘 무엇을 도와드릴까요?",
        "emptyDesc": "아래 프롬프트를 선택하거나 자유롭게 대화를 시작하세요",
        "chipCity": "미래 도시와 바이오 아키텍처",
        "chipMusic": "분위기 있는 앰비언트 트랙 제작",
        "chipTernary": "Bonsai 2 삼진 양자화의 특징은?",
        "chipCode": "고성능 C++/Rust 코드 개발",
        "chatPlaceholder": "질문 입력, 파일 첨부 또는 /스킬 사용... (Enter로 전송)",
        "sendTooltip": "메시지 전송",
        "stopTooltip": "생성 중지",
        "attachTooltip": "파일 첨부",
        "voiceTooltip": "음성 입력",
        "modalModelsTitle": "모델 카탈로그 & 관리",
        "tabBonsai": "Bonsai 2 패밀리",
        "tabHf": "Hugging Face 검색",
        "tabInstalled": "로컬 설치됨",
        "btnSearch": "검색",
        "btnRefresh": "새로고침",
        "btnOpenFolder": "모델 폴더 열기",
        "btnClose": "닫기",
        "searchHfPlaceholder": "Hugging Face에서 GGUF 모델 검색 (예: qwen2, mistral)...",
        "modalSettingsTitle": "추론 매개변수 & SREDA AI 워크스테이션",
        "tabInference": "추론 & 하드웨어",
        "tabServer": "API 서버 (LM Studio)",
        "tabLanguage": "언어 & 음성",
        "tabProviders": "외부 API & 모델",
        "hwDiagCpuGpu": "프로세서 & 그래픽",
        "hwDiagRam": "시스템 메모리 (RAM)",
        "gpuLayersLabel": "GPU 오프로드 레이어 (Radeon 780M Vulkan):",
        "threadsLabel": "CPU 스레드 (Ryzen Zen 4):",
        "contextLabel": "컨텍스트 윈도우 (토큰):",
        "flashAttentionLabel": "Flash Attention (-fa on)",
        "flashAttentionDesc": "KV 캐시 RAM을 최대 40% 절약하고 RAG 처리를 가속화합니다.",
        "presetTitle": "최고 성능 프리셋",
        "presetDesc": "Vulkan 99레이어, Zen 4 8스레드, 8K 컨텍스트, Flash Attention 켜짐",
        "optimize": "최적화",
        "apiActive": "로컬 API 서버 활성화됨",
        "copyBaseUrl": "기본 URL 복사",
        "testApiBtn": "API 테스트",
        "apiPortLabel": "기본 API 포트:",
        "snippetsTitle": "연결 가이드:",
        "uiLangLabel": "인터페이스 언어:",
        "autoTtsLabel": "응답 자동 음성 읽기",
        "autoTtsDesc": "생성 완료 시 음성 합성 실행 (Piper TTS / Windows)",
        "cancel": "취소",
        "saveSettings": "설정 저장",
        "modalProfileTitle": "사용자 프로필 & 맞춤설정",
        "avatarTitle": "대화창 내 아바타",
        "avatarDesc": "PNG, JPG, WebP 형식 (최대 5MB)",
        "uploadPhoto": "사진 업로드",
        "resetAvatar": "초기화",
        "firstNameLabel": "이름:",
        "lastNameLabel": "성:",
        "aboutLabel": "자기소개:",
        "aboutSub": "(이 정보는 AI에게 전달되어 대화가 개인화됩니다)",
        "saveProfile": "프로필 저장",
        "profileFirstNamePlaceholder": "이름",
        "profileLastNamePlaceholder": "성",
        "profileAboutPlaceholder": "예: 건축가, Blender에서 3D 씬을 제작합니다...",
        "modalSkillsTitle": "어시스턴트 스킬 라이브러리",
        "btnAddSkill": "스킬 생성",
        "skillsHint": "스킬은 전용 지침을 통해 모델을 전문 전문가로 전환합니다.",
        "btnBack": "뒤로",
        "skillEditTitle": "스킬 편집",
        "skillNameLabel": "스킬 이름:",
        "skillTriggerLabel": "슬래시 명령어 (/trigger):",
        "skillDescLabel": "간단한 설명:",
        "skillPromptLabel": "시스템 프롬프트:",
        "saveSkill": "스킬 저장",
        "skillsFooterHint": "입력창에 /를 입력하면 활성 스킬에 빠르게 접근할 수 있습니다.",
        "skillNamePlaceholder": "Blender Python 스크립터",
        "skillTriggerPlaceholder": "/blender",
        "skillDescPlaceholder": "bpy를 이용한 3D 씬 및 절차적 생성...",
        "skillPromptPlaceholder": "당신은 Blender Python API (bpy)의 최고 전문가입니다...",
        "load": "로드",
        "unload": "언로드",
        "starting": "시작 중...",
        "saveSuccess": "✓ 설정이 성공적으로 저장되었습니다",
        "profileSaved": "✓ 프로필이 성공적으로 저장되었습니다",
        "skillSaved": "✓ 스킬이 성공적으로 저장되었습니다",
        "skillDeleted": "스킬이 삭제되었습니다",
        "generationStopped": "생성이 중지되었습니다",
        "copied": "✓ 클립보드에 복사되었습니다",
        "modalFeedsTitle": "API / RSS — 실시간 데이터 소스",
        "feedsNoKeyBadge": "키 불필요 • 로컬",
        "tabFeedsBuiltin": "기본 API (암호화폐, 주식, 날씨, 지리)",
        "tabFeedsRss": "뉴스 및 RSS 피드",
        "tabFeedsCustom": "사용자 지정 API",
        "feedsBanner": "신경망은 무거운 웹 파싱이나 컨텍스트 낭비 없이 도구 호출을 통해 이러한 API에 직접 접근합니다. 모든 API는 완전히 공개되어 있으며 키나 등록이 필요하지 않습니다.",
        "feedsFooterHint": "채팅에서 /market, /weather, /news 스킬을 사용하여 이러한 데이터를 즉시 호출하세요",
        "feedActive": "활성",
        "feedDisabled": "비활성화됨",
        "providersBanner": "GPU 부담 없이 작동하도록 API를 통해 외부 AI를 연결하세요. SREDA AI의 모든 내장 기능(파일 RAG, SD/MusicGen 멀티미디어, 실시간 API/RSS 데이터, Blender MCP 및 음성 지원)이 클라우드 모델과 완벽하게 호환됩니다.",
        "enableLabel": "활성화:",
        "openrouterKeyLabel": "OpenRouter API 키:",
        "btnTestConnection": "연결 테스트",
        "openrouterModelLabel": "활성 OpenRouter 모델:",
        "gigachatTitle": "Sber GigaChat (GigaChad API)",
        "gigachatDesc": "Sber 공식 인공지능 • 디지털부 SSL 자동 지원",
        "gigachatClientIdLabel": "Client ID (developers.sber.ru 프로젝트 ID):",
        "gigachatSecretLabel": "Client Secret / API 키 (Sber 포털):",
        "gigachatScopeLabel": "접근 범위 (Scope):",
        "gigachatScopePers": "GIGACHAT_API_PERS (개인용)",
        "gigachatScopeCorp": "GIGACHAT_API_B2B (기업 및 B2B)",
        "gigachatModelLabel": "활성 GigaChat 모델:",
        "gigachatBase64Toggle": "또는 준비된 인증 데이터 (Base64) 사용",
        "gigachatBase64Label": "인증 데이터 (개발자 포털의 Base64):",
        "customApiTitle": "사용자 지정 OpenAI 호환 API",
        "customApiProviderName": "제공업체 이름:",
        "customApiBaseUrl": "기본 엔드포인트 URL:",
        "customApiKey": "API 키:",
        "customApiModel": "모델 ID (Model ID):",
        "tabApiModels": "☁️ 클라우드 API",
        "apiModelsBanner": "클라우드 모델은 GPU 부하 없이 외부 API를 통해 작동합니다. SREDA 내장 기능이 완벽하게 지원됩니다.",
        "btnConfigureKeys": "키 설정",
        "apiModelsEmpty": "아직 활성화된 클라우드 API 모델이 없습니다. 설정에서 OpenRouter, Sber GigaChat 또는 사용자 지정 API를 활성화하세요.",
        "btnSelectModel": "모델 선택",
        "btnModelSelected": "선택됨",
        "badgeRecommended": "추천",
        "badgeActive": "활성",
        "badgeLocal": "로컬",
        "badgeApi": "API / 클라우드",
        "labelSize": "크기:",
        "labelSpeed": "추론 속도:",
        "unitTokensSec": "t/s",
        "btnDownload": "다운로드",
        "btnActivate": "활성화",
        "btnInstalled": "설치됨",
        "installedEmpty": "모델 폴더에 아직 .gguf 모델 파일이 없습니다.<br><b>«Bonsai 2 제품군»</b> 탭에서 3진 모델을 다운로드하거나 <b>Hugging Face</b>에서 검색하세요.",
        "sredaBoostTitle": "SREDA Boost — 게임 모드 리소스 최적화",
        "sredaBoostDesc": "추론 코어의 우선순위를 자동으로 High로 높이고, 백그라운드 프로세스를 억제하며 RAM을 압축하여 GPU/UMA 속도를 향상시킵니다.",
        "autoBoostCheckbox": "추론 시작 시 자동 부스트",
        "btnPurgeRam": "지금 RAM 정리",
        "statusOff": "비활성화됨",
        "statusActive": "활성",
        "boostOff": "Boost: 꺼짐",
        "boostOn": "Boost: 켜짐",
        "boostActive": "Boost: 활성",
        "apiReady": "API 준비완료",
        "activeVoiceLabel": "선택한 언어의 활성 음성:",
        "voiceInstalledBadge": "설치됨",
        "btnDownloadVoice": "음성 다운로드 (~60 MB)",
        "voiceCatalogTitle": "음성 라이브러리 (Piper TTS — 오프라인 로컬):",
        "voiceCatalogDesc": "필요에 따라 다양한 언어의 음성을 다운로드할 수 있습니다.",
        "copySnippet": "복사",
        "btnSkip": "건너뛰기",
        "feedsTitle": "API / RSS",
        "badgeCloudApi": "API / 클라우드",
        "badgeFlagship27b": "플래그십 27B",
        "installedDownloadHint": "'Bonsai 2 제품군' 탭에서 3진 모델을 다운로드하거나 Hugging Face에서 찾으세요.",
        "apiModelsEnableHint": "다음에서 OpenRouter, Sber GigaChat 또는 Custom API를 활성화하세요:",
        "boostHighCpu": "활성 (High CPU)",
        "boostDisabled": "비활성화",
        "customApiKeyLabel": "API 키 (필요한 경우):",
        "customApiModelLabel": "모델 이름:",
        "btnCompactRam": "지금 RAM 정리",
        "boostCardTitle": "SREDA Boost — 리소스 게임 모드",
        "boostCardDesc": "추론 코어 우선순위를 High로 자동 승격하고 백그라운드 프로세스를 낮추며 RAM을 압축하여 Radeon 780M UMA를 가속합니다.",
        "boostAutoLabel": "추론 시작 시 자동 Boost",
        "bonsaiDesc": {
            "bonsai-2-2b-ptq1": "초경량 3진 Prism ML 모델. ~400MB 메모리 사용, 즉각적인 생성 (60+ t/s).",
            "bonsai-2-4b-ptq1": "내장 GPU 및 소형 PC에 최적화된 모델. 단 0.88GB의 크기로 뛰어난 언어 이해력.",
            "bonsai-2-9b-ptq1": "빠른 테스트, 추론 및 코딩을 위한 이상적인 표준. 1.86GB의 가벼운 크기로 빠른 추론과 안정적인 논리.",
            "bonsai-1-8b-pq2": "Prism ML 2비트 양자화가 적용된 LLaMA-3 (8B) 아키텍처 기반 클래식 Bonsai 모델.",
            "bonsai-2-27b-ptq1": "플래그십 3진 Prism ML 모델. 단 5.54GB 크기로 27B급 추론 성능 제공. Vulkan을 통한 완벽한 GPU 오프로드.",
            "bonsai-2-27b-pq2": "Prism ML의 향상된 2비트 정밀 양자화. 6.71GB 메모리 필요, 세부 디테일의 극대화된 보존."
        },
        "baseApis": {
            "crypto": {
                "name": "암호화폐 (CoinCap / CoinGecko)",
                "desc": "실시간 시세, 24시간 변동, 거래량 및 시가총액."
            },
            "stocks": {
                "name": "주식, 지수, 귀금속 (Yahoo Finance)",
                "desc": "주식 시세 (AAPL, TSLA, NVDA), 금속 선물 (금, 은), 원자재 및 지수."
            },
            "rates": {
                "name": "세계 환율 (ExchangeRate-API)",
                "desc": "루블, 달러, 유로 대비 세계 각국 통화의 최신 환율 (ExchangeRate-API)."
            },
            "weather": {
                "name": "날씨 및 일기예보 (Open-Meteo)",
                "desc": "광고 및 키가 없는 고정밀 기상 API: 기온, 바람, 강수량, 습도."
            },
            "geocoding": {
                "name": "지오코딩 및 인구 (Open-Meteo Geo)",
                "desc": "세계 도시의 정확한 지리 좌표, 시간대 및 인구 파악."
            },
            "countries": {
                "name": "국가 및 수도 (REST Countries)",
                "desc": "주권 국가에 대한 종합 백과사전 레퍼런스 (국기, 수도, 언어, 통화)."
            },
            "avatars": {
                "name": "아바타 생성기 (Dicebear API)",
                "desc": "모든 텍스트 시드를 기반으로 한 고유한 벡터 아바타의 빠른 생성 (Dicebear API)."
            }
        },
        "badgeCompatible": "호환됨",
        "badgeHighLoad": "높은 부하",
        "badgeExceedsRam": "RAM 초과"
    }
};

  function detectBrowserLanguage() {
    const supported = ['ru', 'en', 'de', 'fr', 'es', 'pt', 'it', 'ja', 'ko'];
    const candidates = [];
    if (navigator.languages && navigator.languages.length) {
      for (let i = 0; i < navigator.languages.length; i++) {
        if (navigator.languages[i]) {
          candidates.push(navigator.languages[i].toLowerCase());
        }
      }
    }
    if (navigator.language) {
      candidates.push(navigator.language.toLowerCase());
    }
    for (const c of candidates) {
      const primary = c.split('-')[0];
      if (supported.includes(primary)) {
        return primary;
      }
    }
    return 'ru';
  }

  // Helper to safely set text on an element or child span, preserving icons
  function setNodeText(target, text) {
    if (!text) return;
    const el = (typeof target === 'string') ? document.querySelector(target) : target;
    if (!el) return;
    const span = el.querySelector('span');
    if (span) {
      span.textContent = text;
      return;
    }
    // If element contains child nodes (e.g. <i> icon), only update the text node
    let updated = false;
    for (let i = 0; i < el.childNodes.length; i++) {
      const node = el.childNodes[i];
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
        node.textContent = (i > 0 ? ' ' : '') + text;
        updated = true;
        break;
      }
    }
    if (!updated) {
      el.textContent = text;
    }
  }

  function applyLanguage(lang) {
    if (!lang || !I18N[lang]) lang = 'ru';
    state.settings.language = lang;
    const dict = I18N[lang] || I18N.ru;

    // --- 1. DIRECT DOM TRANSLATIONS (Guaranteed to work regardless of HTML caching) ---

    // Sidebar
    setNodeText(dom.btnNewChat, dict.newChat);
    const authorEl = document.getElementById('settings-author-name');
    if (authorEl && dict.appAuthorName) {
      authorEl.textContent = dict.appAuthorName;
    }
    if (dom.sidebarUserName) {
      const curName = (state.profile && state.profile.firstName) ? state.profile.firstName.trim() : '';
      if (!curName || curName === 'Маркус' || curName === 'Пользователь' || curName === 'User' || curName === 'Benutzer' || curName === 'Utilisateur') {
        dom.sidebarUserName.textContent = dict.defaultUserName || 'Пользователь';
      }
    }
    setNodeText(dom.btnOpenSkills, dict.skills);
    if (dom.sidebarUserSub) dom.sidebarUserSub.textContent = dict.userRole;
    setNodeText(dom.btnOpenModels, dict.models);
    setNodeText(dom.btnOpenSettings, dict.settings);

    // Header
    setNodeText(dom.btnToggleAutoTts, dict.autoTts);
    if (dom.engineBtnText) {
      dom.engineBtnText.textContent = state.isEngineAlive ? (dict.unload || 'Выгрузить') : (dict.load || 'Загрузить');
    }

    // Default chat title in header
    if (dom.headerChatTitle) {
      const defaultTitles = [
        'Новый диалог', 'New Chat', 'Neuer Chat', 'Nouvelle conversation',
        'Nuevo chat', 'Novo chat', 'Nuova chat', '新しいチャット', '새 대화', 'Диалог SREDA AI'
      ];
      const chat = (typeof getActiveChat === 'function') ? getActiveChat() : null;
      if (!chat || !chat.title || defaultTitles.includes(chat.title)) {
        const newTitle = dict.newChat || 'Новый диалог';
        dom.headerChatTitle.textContent = newTitle;
        if (chat) {
          chat.title = newTitle;
          if (typeof renderChatsList === 'function') renderChatsList();
        }
      }
    }

    // Settings Modal
    setNodeText('#modal-settings .modal-title span', dict.modalSettingsTitle);
    setNodeText('[data-tab="tab-set-inference"]', dict.tabInference);
    setNodeText('[data-tab="tab-set-server"]', dict.tabServer);
    setNodeText('[data-tab="tab-set-language"]', dict.tabLanguage);
    setNodeText('[data-tab="tab-set-providers"]', dict.tabProviders);
    setNodeText('#tab-set-inference [data-i18n="hwDiagCpuGpu"]', dict.hwDiagCpuGpu);
    setNodeText('#tab-set-inference [data-i18n="hwDiagRam"]', dict.hwDiagRam);
    setNodeText('#tab-set-inference [data-i18n="gpuLayersLabel"]', dict.gpuLayersLabel);
    setNodeText('#tab-set-inference [data-i18n="threadsLabel"]', dict.threadsLabel);
    setNodeText('#tab-set-inference [data-i18n="contextLabel"]', dict.contextLabel);
    setNodeText('#tab-set-inference [data-i18n="flashAttentionLabel"]', dict.flashAttentionLabel);
    setNodeText('#tab-set-inference [data-i18n="flashAttentionDesc"]', dict.flashAttentionDesc);
    setNodeText('#tab-set-inference [data-i18n="presetTitle"]', dict.presetTitle);
    setNodeText('#tab-set-inference [data-i18n="presetDesc"]', dict.presetDesc);
    setNodeText(dom.btnOptimizeSettings, dict.optimize);

    // Settings: Server Tab
    setNodeText('#tab-set-server [data-i18n="apiActive"]', dict.apiActive);
    setNodeText('#btn-copy-api-url', dict.copyBaseUrl);
    setNodeText('#btn-ping-api', dict.testApiBtn);
    setNodeText('#tab-set-server [data-i18n="apiPortLabel"]', dict.apiPortLabel);
    setNodeText('#tab-set-server [data-i18n="snippetsTitle"]', dict.snippetsTitle);

    // Settings: Language Tab
    setNodeText('#tab-set-language [data-i18n="uiLangLabel"]', dict.uiLangLabel);
    setNodeText('#tab-set-language [data-i18n="autoTtsLabel"]', dict.autoTtsLabel);
    setNodeText('#tab-set-language [data-i18n="autoTtsDesc"]', dict.autoTtsDesc);
    setNodeText('#modal-settings .modal-footer .btn-close-modal', dict.cancel);
    setNodeText(dom.btnSaveSettings, dict.saveSettings);

    // Models Modal
    setNodeText('#modal-models .modal-title span', dict.modalModelsTitle);
    setNodeText('[data-tab="tab-bonsai"]', dict.tabBonsai);
    setNodeText('[data-tab="tab-hf"]', dict.tabHf);
    setNodeText('[data-tab="tab-installed"] span:first-child', dict.tabInstalled);
    setNodeText(dom.btnHfSearch, dict.btnSearch);
    setNodeText(dom.btnRefreshModels, dict.btnRefresh);
    setNodeText(dom.btnOpenFolder, dict.btnOpenFolder);
    setNodeText('#modal-models .modal-footer .btn-close-modal', dict.btnClose);

    // User Profile Modal
    setNodeText('#modal-profile .modal-title span', dict.modalProfileTitle);
    setNodeText('#modal-profile [data-i18n="avatarTitle"]', dict.avatarTitle);
    setNodeText('#modal-profile [data-i18n="avatarDesc"]', dict.avatarDesc);
    setNodeText('label[for="profile-avatar-input"]', dict.uploadPhoto);
    setNodeText(dom.btnResetAvatar, dict.resetAvatar);
    setNodeText('#modal-profile [data-i18n="firstNameLabel"]', dict.firstNameLabel);
    setNodeText('#modal-profile [data-i18n="lastNameLabel"]', dict.lastNameLabel);
    setNodeText('#modal-profile [data-i18n="aboutLabel"]', dict.aboutLabel);
    setNodeText('#modal-profile [data-i18n="aboutSub"]', dict.aboutSub);
    setNodeText('#modal-profile .modal-footer .btn-close-modal', dict.cancel);
    setNodeText(dom.btnSaveProfile, dict.saveProfile);

    // Skills Modal
    setNodeText('#modal-skills .modal-title span', dict.modalSkillsTitle);
    setNodeText(dom.btnNewSkill, dict.btnAddSkill);
    setNodeText('#modal-skills [data-i18n="skillsHint"]', dict.skillsHint);
    setNodeText(dom.btnBackToSkills, dict.btnBack);
    setNodeText(dom.skillEditorTitle, dict.skillEditTitle);
    setNodeText('#modal-skills [data-i18n="skillNameLabel"]', dict.skillNameLabel);
    setNodeText('#modal-skills [data-i18n="skillTriggerLabel"]', dict.skillTriggerLabel);
    setNodeText('#modal-skills [data-i18n="skillDescLabel"]', dict.skillDescLabel);
    setNodeText('#modal-skills [data-i18n="skillPromptLabel"]', dict.skillPromptLabel);
    setNodeText(dom.btnCancelSkillEdit, dict.cancel);
    setNodeText(dom.btnSaveSkill, dict.saveSkill);
    setNodeText(dom.skillsListFooter, dict.skillsFooterHint);
    setNodeText('#modal-skills .modal-footer .btn-close-modal', dict.btnClose);

    // Empty Chat State & Quick Chips
    setNodeText('.empty-title', dict.emptyTitle);
    setNodeText('.empty-desc', dict.emptyDesc);
    const chips = document.querySelectorAll('.quick-chip');
    if (chips.length >= 4) {
      setNodeText(chips[0], dict.chipCity);
      setNodeText(chips[1], dict.chipMusic);
      setNodeText(chips[2], dict.chipTernary);
      setNodeText(chips[3], dict.chipCode);
    }

    // --- 2. SECONDARY PASS ON ALL [data-i18n] ATTRIBUTES ---
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        setNodeText(el, dict[key]);
      }
    });

    // --- 3. INPUT PLACEHOLDERS ---
    if (dom.chatInput && dict.chatPlaceholder) {
      dom.chatInput.placeholder = dict.chatPlaceholder;
    }
    if (dom.hfSearchInput && dict.searchHfPlaceholder) {
      dom.hfSearchInput.placeholder = dict.searchHfPlaceholder;
    }
    if (dom.inputProfileFirstName && dict.profileFirstNamePlaceholder) {
      dom.inputProfileFirstName.placeholder = dict.profileFirstNamePlaceholder;
    }
    if (dom.inputProfileLastName && dict.profileLastNamePlaceholder) {
      dom.inputProfileLastName.placeholder = dict.profileLastNamePlaceholder;
    }
    if (dom.inputProfileAbout && dict.profileAboutPlaceholder) {
      dom.inputProfileAbout.placeholder = dict.profileAboutPlaceholder;
    }
    if (dom.skillInputName && dict.skillNamePlaceholder) {
      dom.skillInputName.placeholder = dict.skillNamePlaceholder;
    }
    if (dom.skillInputTrigger && dict.skillTriggerPlaceholder) {
      dom.skillInputTrigger.placeholder = dict.skillTriggerPlaceholder;
    }
    if (dom.skillInputDesc && dict.skillDescPlaceholder) {
      dom.skillInputDesc.placeholder = dict.skillDescPlaceholder;
    }
    if (dom.skillInputPrompt && dict.skillPromptPlaceholder) {
      dom.skillInputPrompt.placeholder = dict.skillPromptPlaceholder;
    }

    // --- 4. TOOLTIPS ---
    if (dom.btnSendMessage) {
      dom.btnSendMessage.title = state.isStreaming ? (dict.stopTooltip || 'Остановить') : (dict.sendTooltip || 'Отправить');
    }
    if (dom.btnAttachFile && dict.attachTooltip) {
      dom.btnAttachFile.title = dict.attachTooltip;
    }
    if (dom.btnVoiceInput && dict.voiceTooltip) {
      dom.btnVoiceInput.title = dict.voiceTooltip;
    }
    if (dom.btnToggleAutoTts && dict.autoTts) {
      dom.btnToggleAutoTts.title = dict.autoTts;
    }

    // Dynamic slider units
    if (dom.valGpuLayers && state.settings.gpuLayers !== undefined) {
      const unit = (lang === 'ru') ? 'слоев' : ((lang === 'it' || lang === 'pt' || lang === 'es') ? 'layer' : 'layers');
      dom.valGpuLayers.textContent = `${state.settings.gpuLayers} ${unit}`;
    }
    if (dom.valThreads && state.settings.threads !== undefined) {
      const unit = (lang === 'ru') ? 'потоков' : ((lang === 'it' || lang === 'pt' || lang === 'es') ? 'thread' : 'threads');
      dom.valThreads.textContent = `${state.settings.threads} ${unit}`;
    }

    if (dom.selectLang) {
      dom.selectLang.value = lang;
    }

    // Dynamic re-renders of active UI modules on language change
    try {
      renderBoostStatus();
    } catch (e) {}
    try {
      setEngineIndicator(state.isEngineAlive ? 'running' : 'stopped', state.activeModelPath);
    } catch (e) {}
    try {
      renderBaseApis();
    } catch (e) {}
    try {
      if (typeof loadBonsaiCatalog === 'function') loadBonsaiCatalog();
    } catch (e) {}
    try {
      if (typeof loadApiModels === 'function') loadApiModels();
    } catch (e) {}
    try {
      if (typeof loadInstalledModels === 'function') loadInstalledModels();
    } catch (e) {}
  }

  // --- INITIALIZATION ---
  function init() {
    // Ensure comfortable workstation width if launched in app mode
    try {
      if (window.outerWidth < 1450 && screen.availWidth >= 1400) {
        const targetWidth = Math.min(1650, screen.availWidth - 20);
        const targetHeight = Math.min(960, screen.availHeight - 40);
        window.resizeTo(targetWidth, targetHeight);
      }
    } catch (e) {}

    loadSettings();
    loadProfile();
    loadSkills();
    loadChats();
    setupEventListeners();
    setupVoiceInput();
    loadVoiceCatalog();
    setupProfileAndSkills();
    setupSlashCommands();
    setupApiServerTab();
    fetchSystemInfo();
    loadProviderConfig();
    loadApiModels();
    checkEngineStatus();
    fetchBoostStatus();
    loadInstalledModels();
    checkActiveDownload();
  }

  async function checkActiveDownload() {
    try {
      const res = await fetch('/api/models/hf/download_progress');
      const p = await res.json();
      if (p && p.status === 'downloading') {
        state.currentDownload = p;
        startDownloadProgressPolling();
      }
    } catch (e) {}
  }

  // --- LOCAL STORAGE ---
  function loadSettings() {
    let hasSaved = false;
    try {
      const saved = localStorage.getItem('sreda_settings');
      if (saved) {
        state.settings = { ...state.settings, ...JSON.parse(saved) };
        hasSaved = true;
      }
    } catch (e) {
      console.warn('Could not load settings:', e);
    }

    // Restore active model selection (local or cloud API)
    try {
      const savedModelPath = localStorage.getItem('sreda_active_model_path');
      const savedModelName = localStorage.getItem('sreda_active_model_name');
      if (savedModelPath) {
        state.activeModelPath = savedModelPath;
        if (savedModelName) state.activeModelName = savedModelName;
        if (savedModelPath.startsWith('api:')) {
          state.isApiModel = true;
          if (dom.activeModelName) dom.activeModelName.textContent = state.activeModelName;
          if (dom.modelChipIcon) {
            if (savedModelPath.startsWith('api:gigachat:')) {
              dom.modelChipIcon.className = '';
              dom.modelChipIcon.innerHTML = '<span style="display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 4px; background: rgba(16, 185, 129, 0.22); border: 1px solid #10B981; font-size: 11.5px; font-weight: 900; color: #10B981; line-height: 1; vertical-align: middle; box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);">G</span>';
            } else {
              dom.modelChipIcon.innerHTML = '';
              dom.modelChipIcon.className = 'fa-solid fa-cloud';
              dom.modelChipIcon.style.color = '#10B981';
            }
          }
          if (dom.activeModelBadge) {
            dom.activeModelBadge.className = 'badge-model-api';
            const dictInit = I18N[state.settings.language || 'ru'] || I18N.ru;
            dom.activeModelBadge.textContent = dictInit.badgeCloudApi || 'API / Cloud';
          }
          setEngineIndicator('ready', savedModelPath);
        }
      }
    } catch (e) {}

    // Auto-detect browser language if not previously saved or valid
    if (!hasSaved || !state.settings.language) {
      state.settings.language = detectBrowserLanguage();
    }

    applySettingsToUI();
    applyLanguage(state.settings.language);
  }

  function saveSettings() {
    try {
      localStorage.setItem('sreda_settings', JSON.stringify(state.settings));
    } catch (e) {
      console.warn('Could not save settings:', e);
    }
  }

  function applySettingsToUI() {
    if (dom.inputGpuLayers) dom.inputGpuLayers.value = state.settings.gpuLayers;
    if (dom.valGpuLayers) dom.valGpuLayers.textContent = `${state.settings.gpuLayers} слоев`;
    if (dom.inputThreads) dom.inputThreads.value = state.settings.threads;
    if (dom.valThreads) dom.valThreads.textContent = `${state.settings.threads} потоков`;
    if (dom.selectContext) dom.selectContext.value = state.settings.context.toString();
    if (dom.checkFa) dom.checkFa.checked = state.settings.flashAttention;
    if (dom.checkLocalServer) dom.checkLocalServer.checked = state.settings.localServer;
    if (dom.inputServerPort) dom.inputServerPort.value = state.settings.serverPort;
    if (dom.selectLang) dom.selectLang.value = state.settings.language;
    if (dom.checkAutoTts) dom.checkAutoTts.checked = state.settings.autoTts;
    if (dom.btnToggleAutoTts) {
      dom.btnToggleAutoTts.classList.toggle('active', !!state.settings.autoTts);
    }
    applyLanguage(state.settings.language || 'ru');
  }

  // --- USER PROFILE & PERSONALIZATION ---
  function loadProfile() {
    try {
      const saved = localStorage.getItem('sreda_user_profile');
      if (saved) {
        state.profile = { ...state.profile, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Could not load user profile:', e);
    }
    applyProfileToUI();
  }

  function saveProfile() {
    try {
      localStorage.setItem('sreda_user_profile', JSON.stringify(state.profile));
    } catch (e) {
      console.warn('Could not save user profile:', e);
    }
    applyProfileToUI();
  }

  function applyProfileToUI() {
    const fullName = [state.profile.firstName, state.profile.lastName].filter(Boolean).join(' ') || 'Пользователь';
    if (dom.sidebarUserName) dom.sidebarUserName.textContent = fullName;
    if (dom.sidebarUserAvatar) dom.sidebarUserAvatar.src = state.profile.avatarUrl || '/static/assets/icons/user_avatar.png';
    if (dom.profilePreviewAvatar) dom.profilePreviewAvatar.src = state.profile.avatarUrl || '/static/assets/icons/user_avatar.png';
    if (dom.inputProfileFirstName) dom.inputProfileFirstName.value = state.profile.firstName || '';
    if (dom.inputProfileLastName) dom.inputProfileLastName.value = state.profile.lastName || '';
    if (dom.inputProfileAbout) dom.inputProfileAbout.value = state.profile.about || '';

    // Update existing user avatars in active chat messages
    document.querySelectorAll('.message-row.user .msg-avatar').forEach(img => {
      img.src = state.profile.avatarUrl || '/static/assets/icons/user_avatar.png';
    });
  }

  // --- SKILLS & SYSTEM DIRECTIVES ---
  const DEFAULT_SKILLS = [
    {
      id: 'skill_code',
      name: 'Архитектор Кода & Рефакторинг',
      trigger: 'code',
      description: 'Пишет чистый, высокоэффективный модульный код, алгоритмы и юнит-тесты',
      prompt: 'Ты — элитный программный инженер и архитектор ПО. Твоя задача — писать чистый, поддерживаемый, документированный и безопасный код с пояснением ключевых архитектурных решений, обработкой краевых случаев и примерами тестов.'
    },
    {
      id: 'skill_bpmn',
      name: 'Аналитик & Моделирование BPMN',
      trigger: 'bpmn',
      description: 'Проектирует бизнес-процессы, дорожки (Swimlanes), шлюзы и XML-схемы',
      prompt: 'Ты — старший бизнес-аналитик и эксперт по нотации BPMN 2.0. Декомпозируй процессы на пулы, дорожки, события (Start/End/Boundary), задачи (User/Service/Script) и развилки (Exclusive/Parallel). Формируй четкие структурированные шаги и спецификации.'
    },
    {
      id: 'skill_summary',
      name: 'Суммаризатор & Выжимка',
      trigger: 'summary',
      description: 'Выделяет главную суть, факты, тезисы и ключевые выводы без воды',
      prompt: 'Ты — аналитик контента. Твоя цель — сделать максимально емкую, структурированную выжимку из предоставленного текста: выдели 3-5 ключевых тезисов, факты, цифры и главный вывод в формате маркированного списка.'
    },
    {
      id: 'skill_writer',
      name: 'Копирайтер & Редактор',
      trigger: 'writer',
      description: 'Создает увлекательные статьи, пресс-релизы и сценарии живым языком',
      prompt: 'Ты — профессиональный редактор и копирайтер высшего класса. Пиши живым языком, используй четкий ритм текста, метафоры и убедительную аргументацию. Избегай шаблонных фраз и клише.'
    },
    {
      id: 'skill_image',
      name: 'Художник & SD Generator',
      trigger: 'image',
      description: 'Генерирует фотореалистичные арты и концепты через движок sd.cpp Vulkan',
      prompt: 'Ты — элитный концепт-художник и промпт-инженер SREDA AI. Твоя задача — преобразовывать любые запросы пользователя в кинематографичные, детализированные промпты на английском для генератора sd.cpp. Всегда вызывай тег [TOOL_CALL: generate_image(prompt="...")] с указанием освещения, стиля, оптики (octane render, unreal engine 5, 8k, cinematic lighting, 85mm lens).'
    },
    {
      id: 'skill_vision',
      name: 'Зрение & Анализ Изображений',
      trigger: 'vision',
      description: 'Анализирует прикрепленные изображения, композицию, палитру и детали сцены',
      prompt: 'Ты — эксперт компьютерного зрения SREDA AI. Твоя задача — исследовать прикрепленные пользователем изображения, опираясь на визуальный анализ, определять ключевые объекты, цвета, композицию и подробно отвечать на любые вопросы о картинке.'
    },
    {
      id: 'skill_music',
      name: 'Композитор & Музыка (MusicGen Small)',
      trigger: 'music',
      description: 'Нейросетевая генерация музыкальных композиций и соло (гитара, скрипка, пианино, саундтреки) через модель MusicGen Small (Meta AI 24-Layer)',
      prompt: 'Ты — профессиональный композитор и музыкальный продюсер SREDA AI. При создании любых мелодий, композиций и игре на инструментах (гитара, скрипка, фортепиано, саксофон, барабаны) ВСЕГДА используй тег: [TOOL_CALL: generate_music(prompt="...детальное музыкальное описание на английском, жанр, инструменты, темп...", duration=5)]. Описывай композицию живо и выразительно.'
    },
    {
      id: 'skill_sound',
      name: 'Саунд-Дизайнер (AudioLDM Neural Diffusion)',
      trigger: 'sound',
      description: 'Генерация реалистичных звуковых эффектов (лай собаки, мяуканье кошки, топот шагов, дождь, бытовые и природные звуки) через диффузионную нейросеть AudioLDM',
      prompt: 'Ты — мастер звукового дизайна и саунд-дизайнер SREDA AI. Для генерации звуков живой природы, животных (мяуканье кошки, лай собаки), топота шагов, шума дождя, скрипа дверей, выстрелов или сигналов ВСЕГДА используй тег: [TOOL_CALL: generate_sound(prompt="...описание звука...", duration=3)]. Отвечай естественно и атмосферно.'
    },
    {
      id: 'skill_blender',
      name: 'Blender 3D & MCP Studio',
      trigger: 'blender',
      description: 'Управление сценой Blender 3D, создание объектов, материалов, камер и выполнение bpy через MCP',
      prompt: 'Ты — профессиональный 3D-художник, визуализатор и разработчик скриптов bpy для Blender 3D. Твоя задача — проектировать 3D-сцены, создавать объекты и материалы через протокол Model Context Protocol (MCP).\nДля управления Blender вызывай теги:\n- [MCP_CALL: server="blender", port=9876, tool="blender_execute_script", args={"code": "import bpy\\n# код bpy для создания объектов или анимации\\n"}]\n- [MCP_CALL: server="blender", port=9876, tool="blender_object_create", args={"type": "cube", "name": "Box", "location": [0,0,0], "scale": [1,1,1]}]\nВсегда объясняй пользователю логику построения 3D-сцены и ключевые параметры.'
    },
    {
      id: 'skill_mcp',
      name: 'Универсальный клиент MCP',
      trigger: 'mcp',
      description: 'Подключение и вызов инструментов любых серверов Model Context Protocol (JSON-RPC 2.0)',
      prompt: 'Ты — эксперт интеграции протокола Model Context Protocol (MCP). Ты умеешь взаимодействовать с внешними серверами (Blender, Figma, SQLite, FS) по локальным портам.\nДля вызова инструментов MCP используй формат тега:\n[MCP_CALL: server="имя_сервера", port=порт, tool="имя_инструмента", args={"параметр": "значение"}]\nПеред вызовом поясняй пользователю, какой инструмент запускается и для чего.'
    },
    {
      id: 'skill_market',
      name: 'Финансовый аналитик & Криптовалюта',
      trigger: 'market',
      description: 'Котировки крипты (CoinCap/CoinGecko), акций, драгметаллов и курсы мировых валют в реальном времени',
      prompt: 'Ты — элитный финансовый аналитик и трейдер SREDA AI. Для получения актуальных котировок, цен и курсов валют в реальном времени ВСЕГДА вызывай инструментный тег:\n- Для криптовалют: [TOOL_CALL: fetch_data(source="crypto", query="bitcoin")] (или ethereum, sol, ton)\n- Для акций и металлов: [TOOL_CALL: fetch_data(source="stocks", query="AAPL")] (или TSLA, NVDA, золото, нефть, SP500, Мосбиржа)\n- Для курсов валют: [TOOL_CALL: fetch_data(source="rates", query="USD")] (или EUR, RUB, CNY)\nДавай точную аналитику, тренды и ключевые ценовые уровни.'
    },
    {
      id: 'skill_weather',
      name: 'Метеоролог & Географ',
      trigger: 'weather',
      description: 'Прогнозы погоды, температура, осадки (Open-Meteo) и гео-справочник стран и городов',
      prompt: 'Ты — эксперт-метеоролог и географ SREDA AI. Для получения точных прогнозов погоды и географических сведений в реальном времени ВСЕГДА вызывай инструментные теги:\n- Для прогноза погоды: [TOOL_CALL: fetch_data(source="weather", query="Москва")] (или Санкт-Петербург, Сочи, Лондон, Токио, Дубай)\n- Для сведений о странах и столицах: [TOOL_CALL: fetch_data(source="country", query="Япония")] (или Германия, Бразилия, Россия)\nПоясняй температуру, влажность, осадки, ветер и давай практические рекомендации.'
    },
    {
      id: 'skill_news',
      name: 'Новостной дайджест & Тренды',
      trigger: 'news',
      description: 'Мониторинг Hacker News, мировых инфоповодов GDELT и чтение пользовательских RSS-лент',
      prompt: 'Ты — главный редактор и аналитик новостей SREDA AI. Для получения свежих новостей, технологий и мировых событий в реальном времени ВСЕГДА вызывай инструментные теги:\n- Для IT-новостей и стартапов: [TOOL_CALL: fetch_news(source="hackernews")]\n- Для мировых событий и трендов: [TOOL_CALL: fetch_news(source="gdelt", query="AI")]\n- Для конкретной RSS-ленты: [TOOL_CALL: fetch_rss(url="https://habr.com/ru/rss/best/daily/?fl=ru")]\nФормируй структурированную выжимку, выделяй суть и приводи ссылки на первоисточники.'
    }
  ];

  function loadSkills() {
    try {
      const saved = localStorage.getItem('sreda_skills');
      if (saved) {
        state.skills = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not load skills:', e);
    }
    if (!state.skills || state.skills.length === 0) {
      state.skills = [...DEFAULT_SKILLS];
    } else {
      // Auto-merge newly added default skills (like blender, mcp)
      for (const defSkill of DEFAULT_SKILLS) {
        const existingIdx = state.skills.findIndex(s => s.id === defSkill.id || s.trigger === defSkill.trigger);
        if (existingIdx === -1) {
          state.skills.push(defSkill);
        } else {
          state.skills[existingIdx].name = defSkill.name;
          state.skills[existingIdx].description = defSkill.description;
          state.skills[existingIdx].prompt = defSkill.prompt;
          state.skills[existingIdx].trigger = defSkill.trigger;
        }
      }
    }
    saveSkills();
  }

  function saveSkills() {
    try {
      localStorage.setItem('sreda_skills', JSON.stringify(state.skills));
    } catch (e) {
      console.warn('Could not save skills:', e);
    }
    renderSkillsList();
  }

  function renderSkillsList() {
    if (!dom.skillsCardsContainer) return;
    dom.skillsCardsContainer.innerHTML = '';

    state.skills.forEach(skill => {
      const card = document.createElement('div');
      card.className = 'skill-card';

      card.innerHTML = `
        <div style="flex: 1; overflow: hidden;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="skill-trigger-badge">/${escapeHtml(skill.trigger)}</span>
            <span style="font-weight: 700; font-size: 13.5px; color: #fff;">${escapeHtml(skill.name)}</span>
          </div>
          <div style="font-size: 11.5px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(skill.description)}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <button class="sreda-btn-secondary btn-edit-skill" style="padding: 6px 12px; font-size: 11px;">
            <i class="fa-solid fa-file-lines"></i>
            <span>Открыть</span>
          </button>
          <button class="sreda-btn-secondary btn-delete-skill" style="padding: 6px 10px; font-size: 11px; color: var(--accent-red);" title="Удалить скилл">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;

      card.querySelector('.btn-edit-skill').onclick = (e) => {
        e.stopPropagation();
        openSkillEditor(skill.id);
      };
      card.onclick = () => openSkillEditor(skill.id);

      card.querySelector('.btn-delete-skill').onclick = (e) => {
        e.stopPropagation();
        deleteSkill(skill.id);
      };

      dom.skillsCardsContainer.appendChild(card);
    });
  }

  function openSkillEditor(skillId) {
    state.editingSkillId = skillId;
    if (skillId) {
      const s = state.skills.find(x => x.id === skillId);
      if (s) {
        dom.skillEditorTitle.textContent = `Документ скилла: /${s.trigger}`;
        dom.skillInputName.value = s.name || '';
        dom.skillInputTrigger.value = s.trigger || '';
        dom.skillInputDesc.value = s.description || '';
        dom.skillInputPrompt.value = s.prompt || '';
      }
    } else {
      dom.skillEditorTitle.textContent = 'Создание нового скилла';
      dom.skillInputName.value = '';
      dom.skillInputTrigger.value = '';
      dom.skillInputDesc.value = '';
      dom.skillInputPrompt.value = '';
    }

    if (dom.skillsViewList) dom.skillsViewList.style.display = 'none';
    if (dom.skillsViewEditor) dom.skillsViewEditor.style.display = 'block';
    if (dom.skillsListFooter) dom.skillsListFooter.style.display = 'none';
  }

  function closeSkillEditor() {
    if (dom.skillsViewEditor) dom.skillsViewEditor.style.display = 'none';
    if (dom.skillsViewList) dom.skillsViewList.style.display = 'block';
    if (dom.skillsListFooter) dom.skillsListFooter.style.display = 'flex';
    state.editingSkillId = null;
  }

  function saveSkillFromEditor() {
    const name = dom.skillInputName ? dom.skillInputName.value.trim() : '';
    let trigger = dom.skillInputTrigger ? dom.skillInputTrigger.value.trim().replace(/^\/+/, '').toLowerCase() : '';
    const desc = dom.skillInputDesc ? dom.skillInputDesc.value.trim() : '';
    const prompt = dom.skillInputPrompt ? dom.skillInputPrompt.value.trim() : '';

    if (!trigger) {
      showToast('Введите слэш-команду (например: code, bpmn)', 'warning');
      return;
    }
    if (!name) {
      showToast('Введите название скилла', 'warning');
      return;
    }
    if (!prompt) {
      showToast('Заполните инструкцию для нейросети', 'warning');
      return;
    }

    if (state.editingSkillId) {
      const idx = state.skills.findIndex(s => s.id === state.editingSkillId);
      if (idx !== -1) {
        state.skills[idx] = {
          ...state.skills[idx],
          name,
          trigger,
          description: desc,
          prompt
        };
      }
    } else {
      state.skills.push({
        id: 'skill_' + Date.now(),
        name,
        trigger,
        description: desc,
        prompt
      });
    }

    saveSkills();
    closeSkillEditor();
    showToast(`✓ Скилл /${trigger} успешно сохранен!`, 'success');
  }

  function deleteSkill(skillId) {
    const s = state.skills.find(x => x.id === skillId);
    const trigger = s ? s.trigger : '';
    state.skills = state.skills.filter(x => x.id !== skillId);
    saveSkills();
    showToast(`Скилл /${trigger} удален`, 'info');
  }

  function loadChats() {
    try {
      let saved = localStorage.getItem('sreda_v5_chats');
      if (!saved) {
        // Fallback: check if legacy chats exist
        saved = localStorage.getItem('sreda_v4_chats') || localStorage.getItem('sreda_chats');
      }
      if (saved) {
        state.chats = JSON.parse(saved);
        // Clean out any corrupted mojibake from legacy versions
        if (Array.isArray(state.chats)) {
          for (const c of state.chats) {
            if (c.title && /[ÐÑâ]/.test(c.title)) {
              c.title = 'Диалог SREDA AI';
            }
            if (Array.isArray(c.messages)) {
              for (const m of c.messages) {
                if (m.content && /[ÐÑâ]/.test(m.content)) {
                  m.content = 'Привет! Я интеллектуальный ассистент SREDA AI v5 на базе модели Bonsai 2 (27B). Чем я могу помочь вам сегодня?';
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not load chats:', e);
    }

    if (!state.chats || state.chats.length === 0) {
      createNewChat();
    } else {
      state.activeChatId = state.chats[0].id;
      renderChatsList();
      renderActiveChat();
    }
  }

  function saveChats() {
    try {
      localStorage.setItem('sreda_v5_chats', JSON.stringify(state.chats));
    } catch (e) {
      console.warn('Could not save chats:', e);
    }
  }

  // --- CHAT MANAGEMENT ---
  function createNewChat() {
    const newChat = {
      id: 'chat_' + Date.now(),
      title: 'Новый диалог',
      createdAt: Date.now(),
      messages: []
    };
    state.chats.unshift(newChat);
    state.activeChatId = newChat.id;
    saveChats();
    renderChatsList();
    renderActiveChat();
    if (dom.chatInput) dom.chatInput.focus();
  }

  function getActiveChat() {
    return state.chats.find(c => c.id === state.activeChatId) || state.chats[0];
  }

  function selectChat(id) {
    if (state.isStreaming) return;
    state.activeChatId = id;
    renderChatsList();
    renderActiveChat();
  }

  function deleteChat(id, e) {
    if (e) e.stopPropagation();
    if (state.chats.length <= 1) {
      state.chats = [];
      createNewChat();
      return;
    }
    state.chats = state.chats.filter(c => c.id !== id);
    if (state.activeChatId === id) {
      state.activeChatId = state.chats[0].id;
    }
    saveChats();
    renderChatsList();
    renderActiveChat();
  }

  function startRenameChat(id, itemEl, titleEl, e) {
    if (e) e.stopPropagation();
    const chat = state.chats.find(c => c.id === id);
    if (!chat) return;

    if (itemEl.querySelector('.chat-rename-input')) return;

    const currentTitle = chat.title || 'Новый диалог';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'chat-rename-input';
    input.value = currentTitle;

    const actionsEl = itemEl.querySelector('.chat-item-actions');
    if (actionsEl) actionsEl.style.display = 'none';

    itemEl.replaceChild(input, titleEl);
    input.focus();
    input.select();

    let committed = false;
    const finishRename = () => {
      if (committed) return;
      committed = true;
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== chat.title) {
        chat.title = newTitle;
        saveChats();
        if (state.activeChatId === chat.id && dom.headerChatTitle) {
          dom.headerChatTitle.textContent = newTitle;
        }
      }
      renderChatsList();
    };

    const cancelRename = () => {
      if (committed) return;
      committed = true;
      renderChatsList();
    };

    input.onclick = (ev) => ev.stopPropagation();
    input.onkeydown = (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        finishRename();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        cancelRename();
      }
    };
    input.onblur = () => {
      finishRename();
    };
  }

  function renderChatsList() {
    if (!dom.chatsList) return;
    dom.chatsList.innerHTML = '';
    const dict = typeof getI18nDict === 'function' ? getI18nDict() : {};
    const renameTitle = dict.renameChat || 'Переименовать диалог';
    const deleteTitle = dict.deleteChat || 'Удалить диалог';

    state.chats.forEach(chat => {
      const item = document.createElement('div');
      item.className = 'chat-item' + (chat.id === state.activeChatId ? ' active' : '');
      item.onclick = () => selectChat(chat.id);

      const title = document.createElement('div');
      title.className = 'chat-item-title';
      title.textContent = chat.title || (dict.newChat || 'Новый диалог');

      const actions = document.createElement('div');
      actions.className = 'chat-item-actions';

      const editBtn = document.createElement('i');
      editBtn.className = 'fa-solid fa-pen chat-item-action chat-item-edit';
      editBtn.title = renameTitle;
      editBtn.onclick = (e) => startRenameChat(chat.id, item, title, e);

      const delBtn = document.createElement('i');
      delBtn.className = 'fa-solid fa-trash chat-item-action chat-item-delete';
      delBtn.title = deleteTitle;
      delBtn.onclick = (e) => deleteChat(chat.id, e);

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      item.appendChild(title);
      item.appendChild(actions);
      dom.chatsList.appendChild(item);
    });
  }

  function renderActiveChat() {
    let chat = getActiveChat();
    if (!chat) {
      createNewChat();
      chat = getActiveChat();
    }
    if (!chat) return;

    if (dom.headerChatTitle) {
      dom.headerChatTitle.textContent = chat.title || 'Новый диалог';
    }

    if (!chat.messages || chat.messages.length === 0) {
      if (dom.chatEmptyState) dom.chatEmptyState.style.display = 'flex';
      if (dom.messagesContainer) {
        dom.messagesContainer.style.display = 'none';
        dom.messagesContainer.innerHTML = '';
      }
    } else {
      if (dom.chatEmptyState) dom.chatEmptyState.style.display = 'none';
      if (dom.messagesContainer) {
        dom.messagesContainer.style.display = 'block';
        dom.messagesContainer.innerHTML = '';
        chat.messages.forEach(msg => appendMessageElement(msg, false));
        scrollToBottom();
      }
    }
  }

  function scrollToBottom() {
    if (dom.chatScroll) {
      dom.chatScroll.scrollTop = dom.chatScroll.scrollHeight;
    }
  }

  // --- MESSAGE RENDERING ---
  function appendMessageElement(msg, isAnimated = false) {
    if (!dom.messagesContainer) return null;

    if (dom.chatEmptyState) dom.chatEmptyState.style.display = 'none';
    dom.messagesContainer.style.display = 'block';

    const row = document.createElement('div');
    row.className = `message-row ${msg.role}`;

    // Avatar
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'msg-avatar-container';
    const avatar = document.createElement('img');
    avatar.className = 'msg-avatar';
    avatar.src = msg.role === 'user'
      ? (state.profile.avatarUrl || '/static/assets/icons/user_avatar.png')
      : '/static/assets/icons/ai_avatar.png';
    avatar.alt = msg.role;
    avatarContainer.appendChild(avatar);

    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    // Skill badge if present on user message
    if (msg.skill) {
      const skillBadge = document.createElement('div');
      skillBadge.className = 'skill-trigger-badge';
      skillBadge.style.marginBottom = '8px';
      skillBadge.style.display = 'inline-flex';
      skillBadge.style.alignItems = 'center';
      skillBadge.style.gap = '6px';
      skillBadge.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> /${escapeHtml(msg.skill.trigger)} • ${escapeHtml(msg.skill.name)}`;
      bubble.appendChild(skillBadge);
    }

    // Text content
    const textDiv = document.createElement('div');
    textDiv.className = 'msg-text';

    if (msg.role === 'assistant') {
      try {
        const cleanText = cleanMessageText(msg.content);
        textDiv.innerHTML = window.marked ? window.marked.parse(cleanText) : escapeHtml(cleanText);
        enhanceCodeBlocks(textDiv);
      } catch (e) {
        textDiv.textContent = cleanMessageText(msg.content);
      }
    } else {
      textDiv.textContent = msg.content;
    }

    // Attached file preview (Image, Document or Media Audio/Video)
    if (msg.attachment) {
      const cat = (msg.attachment.doc_category || '').toLowerCase();
      const fn = (msg.attachment.filename || '').toLowerCase();
      const isMedia = cat === 'audio' || cat === 'video' || /\.(mp3|wav|ogg|m4a|aac|flac|mp4|mov|mkv)$/i.test(fn);

      if (isMedia) {
        const mediaBox = document.createElement('div');
        mediaBox.className = 'media-rag-audio-player';
        const isVideo = cat === 'video' || /\.(mp4|mov|mkv)$/i.test(fn);
        const durSec = msg.attachment.duration_sec ? Math.round(msg.attachment.duration_sec) : null;
        const durText = durSec ? `~${durSec} сек` : '';
        const trimText = msg.attachment.was_trimmed ? ' (до 5 мин)' : '';
        const audioSrc = msg.attachment.file_url || msg.attachment.url || '';

        mediaBox.innerHTML = `
          <div style="font-size: 11.5px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid ${isVideo ? 'fa-file-video' : 'fa-file-audio'}" style="color: var(--accent-red)"></i>
            <span>${escapeHtml(msg.attachment.filename || 'Медиазапись')}</span>
            <span style="font-size: 10px; color: var(--text-muted); margin-left: auto;">
              ${durText}${trimText}
            </span>
          </div>
          ${audioSrc ? `<audio controls src="${audioSrc}" style="width: 100%; height: 32px; border-radius: 4px; margin-top: 4px;"></audio>` : ''}
          <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4; margin-top: 2px;">
            <i class="fa-solid fa-quote-left" style="font-size: 9px; color: var(--accent-red); margin-right: 4px;"></i>
            <i>"${escapeHtml((msg.attachment.preview || msg.attachment.text || 'Аудиодорожка транскрибирована Whisper').slice(0, 150))}"</i>
          </div>
        `;
        bubble.appendChild(mediaBox);
      } else if (msg.attachment.type === 'document') {
        const docBadge = document.createElement('div');
        docBadge.className = 'msg-attached-doc';
        let iconClass = 'fa-file-lines text';
        if (fn.endsWith('.docx') || fn.endsWith('.doc')) iconClass = 'fa-file-word word';
        else if (fn.endsWith('.pdf')) iconClass = 'fa-file-pdf pdf';
        docBadge.innerHTML = `<i class="fa-solid ${iconClass}"></i> <div><b>${escapeHtml(msg.attachment.filename)}</b> <span style="color:var(--text-muted);font-size:11px;">(${msg.attachment.char_count || 0} симв.)</span></div>`;
        bubble.appendChild(docBadge);
      } else if (msg.attachment.url) {
        const attachImg = document.createElement('img');
        attachImg.className = 'msg-attached-image';
        attachImg.src = msg.attachment.url;
        attachImg.alt = msg.attachment.filename || 'Attached Image';
        attachImg.title = 'Нажмите, чтобы открыть оригинал';
        attachImg.onclick = () => window.open(msg.attachment.url, '_blank');
        bubble.appendChild(attachImg);
      }
    }

    bubble.appendChild(textDiv);

    // Media tool calls preview (if any)
    if (msg.tools && msg.tools.length > 0) {
      const toolsContainer = renderMediaToolsCard(msg.tools);
      bubble.appendChild(toolsContainer);
    }

    // MCP tool calls preview (if any)
    if (msg.mcp_calls && msg.mcp_calls.length > 0) {
      const mcpContainer = renderMcpToolsCard(msg.mcp_calls);
      bubble.appendChild(mcpContainer);
    }

    // Assistant Footer: Telemetry & Actions
    if (msg.role === 'assistant') {
      const footer = document.createElement('div');
      footer.className = 'msg-footer';

      const footerLeft = document.createElement('div');
      footerLeft.className = 'msg-footer-left';

      if (msg.telemetry) {
        footerLeft.innerHTML = `<span>⚡ ${msg.telemetry.speed || 12} т/с • ${msg.telemetry.tokens || 0} токенов • ${state.activeModelName.replace('.gguf', '')}</span>`;
      } else {
        footerLeft.innerHTML = `<span>SREDA AI Workstation</span>`;
      }

      const footerActions = document.createElement('div');
      footerActions.className = 'msg-footer-actions';
      if (isAnimated) {
        footerActions.style.display = 'none';
      }

      // TTS Play button
      const ttsBtn = document.createElement('i');
      ttsBtn.className = 'fa-solid fa-volume-high msg-action-btn';
      ttsBtn.title = 'Озвучить ответ (TTS)';
      ttsBtn.onclick = () => speakText(msg.content, bubble, ttsBtn);

      // Copy button
      const copyBtn = document.createElement('i');
      copyBtn.className = 'fa-solid fa-copy msg-action-btn';
      copyBtn.title = 'Скопировать текст';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(cleanMessageText(msg.content)).then(() => {
          showToast('✓ Текст скопирован в буфер обмена', 'success');
        });
      };

      footerActions.appendChild(ttsBtn);
      footerActions.appendChild(copyBtn);

      footer.appendChild(footerLeft);
      footer.appendChild(footerActions);
      bubble.appendChild(footer);
    }

    row.appendChild(avatarContainer);
    row.appendChild(bubble);
    dom.messagesContainer.appendChild(row);

    return { row, bubble, textDiv };
  }

  function enhanceCodeBlocks(container) {
    if (!container) return;
    const pres = container.querySelectorAll('pre');
    pres.forEach(pre => {
      if (pre.parentElement && pre.parentElement.classList.contains('code-block-container')) return;

      const code = pre.querySelector('code');
      const langMatch = code ? (code.className.match(/language-([a-zA-Z0-9_-]+)/) || code.className.match(/lang-([a-zA-Z0-9_-]+)/)) : null;
      let lang = langMatch ? langMatch[1].toUpperCase() : 'КОД';
      if (lang === 'HTML' || lang === 'HTM') lang = 'HTML';
      else if (lang === 'JS' || lang === 'JAVASCRIPT') lang = 'JavaScript';
      else if (lang === 'PY' || lang === 'PYTHON') lang = 'Python';
      else if (lang === 'CSS') lang = 'CSS';
      else if (lang === 'JSON') lang = 'JSON';

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-container';

      const header = document.createElement('div');
      header.className = 'code-block-header';
      header.innerHTML = `
        <span class="code-lang-label"><i class="fa-solid fa-code" style="color: var(--accent-red); margin-right: 5px;"></i>${escapeHtml(lang)}</span>
        <button class="btn-copy-code" type="button" title="Скопировать только этот фрагмент кода">
          <i class="fa-regular fa-copy"></i>
          <span>Копировать код</span>
        </button>
      `;

      const copyBtn = header.querySelector('.btn-copy-code');
      copyBtn.onclick = async (e) => {
        e.stopPropagation();
        const textToCopy = code ? code.innerText : pre.innerText;
        try {
          await navigator.clipboard.writeText(textToCopy);
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Скопировано!</span>`;
          showToast('✓ Код скопирован в буфер обмена', 'success');
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> <span>Копировать код</span>`;
          }, 2000);
        } catch (err) {
          showToast('Не удалось скопировать код', 'error');
        }
      };

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
    });
  }

  function cleanMessageText(text) {
    if (!text) return '';
    return text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/\[TOOL_CALL:[\s\S]*?\]/gi, '')
      .replace(/\[(?:IMAGE_GEN|VIDEO_GEN|MUSIC_GEN|SOUND_GEN|MCP_CALL):[\s\S]*?\]/gi, '')
      .replace(/\[[A-Z_]+:\s*[^\x5d]+\]/gi, '')
      .replace(/\[(?:TOOL_CALL|IMAGE_GEN|VIDEO_GEN|MUSIC_GEN|SOUND_GEN|MCP_CALL)[^\x5d]*$/gi, '')
      .trim();
  }

  function normalizeToolCall(tool) {
    let type = (tool.type || '').toLowerCase();
    if (type === 'generate_image') type = 'image';
    if (type === 'generate_sound') type = 'sound';
    if (type === 'generate_music') type = 'music';
    let prompt = '';
    let duration = 5;
    if (tool.args) {
      prompt = tool.args.prompt || tool.args.query || tool.args.url || '';
      duration = tool.args.duration || 5;
    }
    return { type, prompt, duration, args: tool.args || {}, raw: tool.raw || '' };;
  }

  function renderMediaToolsCard(tools, autoExecute = true) {
    const card = document.createElement('div');
    card.style.marginTop = '12px';
    card.style.padding = '12px 14px';
    card.style.background = 'var(--bg-elevated)';
    card.style.border = '1px solid var(--accent-red)';
    card.style.borderRadius = '8px';
    card.style.boxShadow = '0 0 10px var(--accent-red-glow)';

    tools.forEach(rawTool => {
      const tool = normalizeToolCall(rawTool);
      const row = document.createElement('div');
      row.style.marginBottom = '8px';

      let icon = 'fa-wand-magic-sparkles';
      let title = 'Мультимодальная генерация';
      if (tool.type === 'image') { icon = 'fa-image'; title = '🎨 Генерация изображения (sd.cpp Vulkan)'; }
      if (tool.type === 'video') { icon = 'fa-video'; title = '🎬 Генерация видео'; }
      if (tool.type === 'music') { icon = 'fa-music'; title = '🎵 Музыкальная композиция (MusicGen Small Meta AI)'; }
      if (tool.type === 'sound') { icon = 'fa-volume-high'; title = '🔊 Саунд-дизайн и эффекты (AudioLDM Neural Diffusion)'; }
      if (tool.type === 'fetch_data' || tool.type === 'fetch_news' || tool.type === 'fetch_rss') {
        icon = 'fa-satellite-dish';
        title = '⚡ Запрос актуальных данных в реальном времени';
      }

      row.innerHTML = `
        <div style="font-weight: 600; color: #fff; font-size: 12px; margin-bottom: 4px;">
          <i class="fa-solid ${icon}" style="color: var(--accent-red); margin-right: 6px;"></i>
          ${title}
        </div>
        <div style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 8px;">
          Промпт: <i>"${escapeHtml(tool.prompt)}"</i>
        </div>
      `;

      const genBtn = document.createElement('button');
      genBtn.className = 'sreda-btn-primary';
      genBtn.style.padding = '6px 14px';
      genBtn.style.fontSize = '11px';
      genBtn.innerHTML = `<i class="fa-solid fa-play"></i> Запустить генерацию`;
      genBtn.onclick = () => executeToolGeneration(tool, row);

      row.appendChild(genBtn);
      card.appendChild(row);

      // Auto-start generation immediately so user gets audio/art without waiting
      if (autoExecute) {
        setTimeout(() => executeToolGeneration(tool, row), 60);
      }
    });

    return card;
  }

  async function executeToolGeneration(tool, container) {
    const btn = container.querySelector('button');
    let spinText = 'Генерация...';
    if (tool.type === 'music') spinText = 'Создание музыки (MusicGen Small Meta AI)...';
    else if (tool.type === 'sound') spinText = 'Синтез звукового эффекта (AudioLDM)...';
    else if (tool.type === 'image') spinText = 'Рендеринг арта (sd.cpp Vulkan)...';
    else if (tool.type === 'fetch_data' || tool.type === 'fetch_news' || tool.type === 'fetch_rss') {
      spinText = 'Запрос live-данных...';
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${spinText}`;
    }

    // Handle Live Data & RSS Tool Calls
    if (tool.type === 'fetch_data' || tool.type === 'fetch_news' || tool.type === 'fetch_rss') {
      try {
        let source = (tool.args && tool.args.source) || '';
        if (!source) {
          if (tool.type === 'fetch_news') source = 'hackernews';
          else if (tool.type === 'fetch_rss') source = 'rss';
          else source = 'crypto';
        }
        let query = tool.prompt || (tool.args && (tool.args.query || tool.args.url)) || '';
        let limit = (tool.args && tool.args.limit) ? parseInt(tool.args.limit, 10) : 0;
        if (!limit && query) {
          const m = query.match(/(?:топ|top)[-\s]*(\d+)|(\d+)[-\s]*(?:новост|статей)/i);
          if (m) limit = parseInt(m[1] || m[2], 10);
        }
        if (!limit) limit = 7;

        const res = await fetch('/api/feeds/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source, query, limit })
        });
        const data = await res.json();
        renderLiveDataCard(container, source, query, data);
        return;
      } catch (err) {
        showToast('Ошибка загрузки live-данных: ' + err.message, 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Повторить запрос`;
        }
        return;
      }
    }

    try {
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tool.type, prompt: tool.prompt, duration: tool.duration || 5 })
      });
      const data = await res.json();
      const mediaUrl = data.url || data.file_url;

      if (data.success && mediaUrl) {
        if (tool.type === 'image') {
          container.innerHTML = `
            <div class="generated-media-card">
              <div class="media-preview-container">
                <img src="${mediaUrl}" alt="${escapeHtml(tool.prompt)}" class="generated-image" onclick="window.open('${mediaUrl}', '_blank')" />
              </div>
              <div class="media-meta-row">
                <span class="media-badge"><i class="fa-solid fa-microchip"></i> sd.cpp • Vulkan Radeon 780M (${data.duration_sec || 3.5}с)</span>
                <a href="${mediaUrl}" download="sreda_ai_art.png" class="sreda-btn-secondary media-download-btn">
                  <i class="fa-solid fa-download"></i> Скачать PNG
                </a>
              </div>
            </div>
          `;
        } else if (tool.type === 'music') {
          container.innerHTML = `
            <div class="generated-media-card">
              <div class="media-audio-player">
                <audio controls src="${mediaUrl}" style="width: 100%; border-radius: 6px;"></audio>
              </div>
              <div class="media-meta-row">
                <span class="media-badge"><i class="fa-solid fa-music"></i> ${escapeHtml(data.engine || "MusicGen Small (Meta AI)")} (${data.duration_sec || 5.0}с)</span>
                <a href="${mediaUrl}" download="sreda_ai_music.wav" class="sreda-btn-secondary media-download-btn">
                  <i class="fa-solid fa-download"></i> Скачать WAV
                </a>
              </div>
            </div>
          `;
        } else if (tool.type === 'sound') {
          container.innerHTML = `
            <div class="generated-media-card">
              <div class="media-audio-player">
                <audio controls src="${mediaUrl}" style="width: 100%; border-radius: 6px;"></audio>
              </div>
              <div class="media-meta-row">
                <span class="media-badge"><i class="fa-solid fa-waveform"></i> ${escapeHtml(data.engine || "AudioLDM Neural Diffusion")} (${data.duration_sec || 3.0}с)</span>
                <a href="${mediaUrl}" download="sreda_ai_sound.wav" class="sreda-btn-secondary media-download-btn">
                  <i class="fa-solid fa-download"></i> Скачать WAV
                </a>
              </div>
            </div>
          `;
        }
      } else {
        showToast(data.error || 'Ошибка при генерации медиа', 'warning');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Повторить генерацию`;
        }
      }
    } catch (e) {
      showToast('Сетевая ошибка при генерации: ' + e.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Повторить генерацию`;
      }
    }
  }


  function renderLiveDataCard(container, source, query, data) {
    if (!data || !data.success) {
      container.innerHTML = `
        <div class="live-data-card" style="border-color: rgba(239, 68, 68, 0.4);">
          <div class="live-data-header">
            <span style="color: var(--accent-red);"><i class="fa-solid fa-triangle-exclamation"></i> Ошибка источника "${escapeHtml(source)}"</span>
            <span class="live-data-badge" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border-color: #EF4444;">Offline</span>
          </div>
          <div style="font-size: 11.5px; color: var(--text-secondary);">${escapeHtml((data && data.error) || 'Не удалось получить данные')}</div>
        </div>
      `;
      return;
    }

    const s = (source || '').toLowerCase();
    let cardContent = '';

    if (s.includes('crypto') || data.service === 'CoinCap' || data.service === 'CoinGecko') {
      const priceFmt = data.price_usd >= 1 ? Number(data.price_usd).toLocaleString() : data.price_usd;
      const isUp = (data.change_24h_percent || 0) >= 0;
      cardContent = `
        <div class="live-data-card">
          <div class="live-data-header">
            <span><i class="fa-brands fa-bitcoin" style="color: #F59E0B; margin-right: 6px;"></i> ${escapeHtml(data.name || 'Криптовалюта')} (${escapeHtml(data.symbol || 'USD')})</span>
            <span class="live-data-badge"><i class="fa-solid fa-circle-dot" style="font-size: 8px; color: #10B981; margin-right: 4px;"></i>${escapeHtml(data.service)} • Live</span>
          </div>
          <div class="live-stat-grid">
            <div class="live-stat-item">
              <div class="live-stat-label">Текущая цена</div>
              <div class="live-stat-value">$${priceFmt}</div>
            </div>
            <div class="live-stat-item">
              <div class="live-stat-label">Динамика (24ч)</div>
              <div class="live-stat-value ${isUp ? 'live-stat-change-up' : 'live-stat-change-down'}">
                ${isUp ? '+' : ''}${data.change_24h_percent}%
              </div>
            </div>
            <div class="live-stat-item">
              <div class="live-stat-label">Капитализация</div>
              <div class="live-stat-value">${data.market_cap_usd ? '$' + data.market_cap_usd + ' млрд' : '—'}</div>
            </div>
          </div>
        </div>
      `;
    } else if (s.includes('weather') || data.service === 'Open-Meteo') {
      cardContent = `
        <div class="live-data-card">
          <div class="live-data-header">
            <span><i class="fa-solid fa-cloud-sun" style="color: #60A5FA; margin-right: 6px;"></i> Погода: ${escapeHtml(data.city || query)} (${escapeHtml(data.country || '')})</span>
            <span class="live-data-badge"><i class="fa-solid fa-circle-dot" style="font-size: 8px; color: #10B981; margin-right: 4px;"></i>Open-Meteo • Live</span>
          </div>
          <div class="live-stat-grid">
            <div class="live-stat-item">
              <div class="live-stat-label">Температура</div>
              <div class="live-stat-value" style="color: #60A5FA;">${data.temperature_c > 0 ? '+' : ''}${data.temperature_c}°C</div>
            </div>
            <div class="live-stat-item">
              <div class="live-stat-label">Состояние</div>
              <div class="live-stat-value" style="font-size: 12px; font-weight: normal;">${escapeHtml(data.weather_desc || 'Ясно')}</div>
            </div>
            <div class="live-stat-item">
              <div class="live-stat-label">Ветер & Влажность</div>
              <div class="live-stat-value" style="font-size: 12px; font-weight: normal;">${data.wind_speed_kmh} км/ч • ${data.humidity_percent}%</div>
            </div>
          </div>
        </div>
      `;
    } else if (s.includes('stock') || data.service === 'Yahoo Finance') {
      const isUp = (data.change_percent || 0) >= 0;
      cardContent = `
        <div class="live-data-card">
          <div class="live-data-header">
            <span><i class="fa-solid fa-chart-line" style="color: #10B981; margin-right: 6px;"></i> ${escapeHtml(data.name || data.symbol)} [${escapeHtml(data.symbol)}]</span>
            <span class="live-data-badge">Yahoo Finance • Live</span>
          </div>
          <div class="live-stat-grid">
            <div class="live-stat-item">
              <div class="live-stat-label">Котировка</div>
              <div class="live-stat-value">${data.price} ${escapeHtml(data.currency || 'USD')}</div>
            </div>
            <div class="live-stat-item">
              <div class="live-stat-label">Динамика</div>
              <div class="live-stat-value ${isUp ? 'live-stat-change-up' : 'live-stat-change-down'}">
                ${isUp ? '+' : ''}${data.change_percent}%
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (s.includes('country') || data.service === 'REST Countries') {
      cardContent = `
        <div class="live-data-card">
          <div class="live-data-header">
            <span>${data.flag_emoji || '🌍'} ${escapeHtml(data.country || query)}</span>
            <span class="live-data-badge">REST Countries</span>
          </div>
          <div class="live-stat-grid">
            <div class="live-stat-item">
              <div class="live-stat-label">Столица</div>
              <div class="live-stat-value" style="font-size: 12.5px;">${escapeHtml(data.capital || '—')}</div>
            </div>
            <div class="live-stat-item">
              <div class="live-stat-label">Население</div>
              <div class="live-stat-value" style="font-size: 12.5px;">${data.population ? Number(data.population).toLocaleString() : '—'}</div>
            </div>
            <div class="live-stat-item">
              <div class="live-stat-label">Валюта</div>
              <div class="live-stat-value" style="font-size: 12px; font-weight: normal;">${escapeHtml(data.currencies || '—')}</div>
            </div>
          </div>
        </div>
      `;
    } else if (s.includes('news') || s.includes('hackernews') || s.includes('gdelt') || s.includes('rss')) {
      const stories = data.stories || data.articles || data.items || [];
      const count = stories.length;
      let feedTitle = data.feed_title;
      if (!feedTitle) {
        if (s.includes('hackernews')) {
          feedTitle = `Hacker News Top (${count})`;
        } else if (data.query) {
          feedTitle = `Новости: ${data.query} (${count})`;
        } else {
          feedTitle = `Новости & События (${count})`;
        }
      }

      // Render up to 10 articles dynamically (supports top-5, top-7, top-10)
      const itemsHtml = stories.slice(0, 10).map((it, i) => {
        const itemTitle = it.title || 'Новость';
        const itemUrl = it.url || it.link || '#';
        const itemDomain = it.domain || (itemUrl.startsWith('http') ? new URL(itemUrl).hostname : '');
        return `
          <div style="padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 11.5px;">
            <a href="${itemUrl}" target="_blank" style="color: #fff; text-decoration: none; font-weight: 600; display: block; margin-bottom: 3px; line-height: 1.35;" onmouseover="this.style.color='var(--accent-red)'" onmouseout="this.style.color='#fff'">
              ${i+1}. ${escapeHtml(itemTitle)}
            </a>
            <div style="display: flex; gap: 8px; color: var(--text-muted); font-size: 10px;">
              ${itemDomain ? `<span><i class="fa-solid fa-link"></i> ${escapeHtml(itemDomain)}</span>` : ''}
              ${it.score ? `<span>★ ${it.score} pts</span>` : ''}
              ${it.date ? `<span><i class="fa-regular fa-clock"></i> ${escapeHtml(it.date)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

      cardContent = `
        <div class="live-data-card">
          <div class="live-data-header">
            <span><i class="fa-solid fa-newspaper" style="color: var(--accent-red); margin-right: 6px;"></i> ${escapeHtml(feedTitle)}</span>
            <span class="live-data-badge"><i class="fa-solid fa-circle-dot" style="font-size: 8px; color: #10B981; margin-right: 4px;"></i>${escapeHtml(data.service || 'Live Feed')}</span>
          </div>
          <div style="margin-top: 8px; max-height: 420px; overflow-y: auto; padding-right: 4px;">
            ${itemsHtml || '<div style="color:var(--text-muted);font-size:11px;">Нет актуальных статей</div>'}
          </div>
        </div>
      `;
    } else {
      cardContent = `
        <div class="live-data-card">
          <div class="live-data-header">
            <span><i class="fa-solid fa-satellite-dish" style="color: var(--accent-red); margin-right: 6px;"></i> ${escapeHtml(data.service || source)}</span>
            <span class="live-data-badge">Live</span>
          </div>
          <div style="font-size: 12px; color: #fff; white-space: pre-wrap; line-height: 1.4;">${escapeHtml(data.text_summary || JSON.stringify(data, null, 2))}</div>
        </div>
      `;
    }

    container.innerHTML = cardContent;
  }


  // --- PHASE 5: API / RSS DATA HUB MODULE ---
  async function loadFeedsConfig() {
    try {
      const res = await fetch('/api/feeds/config');
      if (res.ok) {
        state.feedsConfig = await res.json();
      }
    } catch (e) {
      console.warn('Could not load feeds config:', e);
    }
    renderBaseApis();
    renderNewsAndRss();
    renderCustomApis();
  }

  async function saveFeedsConfig() {
    if (!state.feedsConfig) return;
    try {
      await fetch('/api/feeds/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.feedsConfig)
      });
    } catch (e) {
      console.warn('Could not save feeds config:', e);
    }
  }

  function renderBaseApis() {
    if (!dom.baseApisContainer || !state.feedsConfig) return;
    dom.baseApisContainer.innerHTML = '';

    const apisMeta = {
      crypto: { icon: 'fa-coins', color: '#F59E0B', testQ: 'bitcoin', desc: 'Котировки в реальном времени, 24ч динамика, объемы торгов и рыночная капитализация.' },
      stocks: { icon: 'fa-arrow-trend-up', color: '#10B981', testQ: 'AAPL', desc: 'Биржевые котировки акций (AAPL, TSLA, NVDA), фьючерсов на металлы (золото, серебро), сырье и индексы.' },
      rates: { icon: 'fa-money-bill-transfer', color: '#3B82F6', testQ: 'USD', desc: 'Свежие обменные курсы мировых валют к рублю, доллару и евро (ExchangeRate-API).' },
      weather: { icon: 'fa-cloud-sun', color: '#60A5FA', testQ: 'Москва', desc: 'Высокоточный метеорологический API без рекламы и ключей: температура, ветер, осадки, влажность.' },
      geocoding: { icon: 'fa-location-dot', color: '#EC4899', testQ: 'Санкт-Петербург', desc: 'Определение точных географических координат, часовых поясов и численности населения городов мира.' },
      countries: { icon: 'fa-earth-americas', color: '#8B5CF6', testQ: 'Япония', desc: 'Полный энциклопедический справочник по суверенным государствам (флаги, столицы, языки, валюты).' },
      avatars: { icon: 'fa-user-astronaut', color: '#14B8A6', testQ: 'Marcus', desc: 'Быстрая генерация уникальных векторных аватаров на основе любого текстового сида (Dicebear API).' }
    };

    const apis = state.feedsConfig.apis || {};
    const dict = I18N[state.settings.language || 'ru'] || I18N.ru;

    Object.keys(apis).forEach(key => {
      const item = apis[key];
      const meta = apisMeta[key] || { icon: 'fa-bolt', color: 'var(--accent-red)', testQ: '', desc: '' };

      const apiI18n = (dict.baseApis && dict.baseApis[key]) ? dict.baseApis[key] : null;
      const displayName = apiI18n ? apiI18n.name : item.name;
      const displayDesc = apiI18n ? apiI18n.desc : (meta.desc || '');

      const card = document.createElement('div');
      card.className = 'feed-card';
      card.innerHTML = `
        <div class="feed-card-header">
          <div class="feed-card-title">
            <i class="fa-solid ${meta.icon}" style="color: ${meta.color}; width: 18px; text-align: center;"></i>
            <span>${escapeHtml(displayName)}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="feed-btn-ping btn-ping-${key}">
              <i class="fa-solid fa-satellite-dish"></i> Ping
            </button>
            <label style="display: flex; align-items: center; cursor: pointer; gap: 6px;">
              <input type="checkbox" class="toggle-feed-${key}" ${item.enabled ? 'checked' : ''} style="width: 17px; height: 17px; accent-color: var(--accent-red); cursor: pointer;">
              <span class="feed-badge ${item.enabled ? 'active' : 'inactive'}">${item.enabled ? (dict.feedActive || 'Активен') : (dict.feedDisabled || 'Отключен')}</span>
            </label>
          </div>
        </div>
        <div style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.4;">
          ${escapeHtml(displayDesc)}
        </div>
      `;

      const pingBtn = card.querySelector(`.btn-ping-${key}`);
      pingBtn.onclick = () => testFeedSource(key, meta.testQ, pingBtn);

      const toggleInput = card.querySelector(`.toggle-feed-${key}`);
      const badge = card.querySelector('.feed-badge');
      toggleInput.onchange = () => {
        item.enabled = toggleInput.checked;
        badge.className = `feed-badge ${item.enabled ? 'active' : 'inactive'}`;
        badge.textContent = item.enabled ? 'Активен' : 'Отключен';
        saveFeedsConfig();
        showToast(`${item.name}: ${item.enabled ? 'включен' : 'отключен'}`, 'info');
      };

      dom.baseApisContainer.appendChild(card);
    });
  }

  function renderNewsAndRss() {
    if (!state.feedsConfig) return;

    // 1. Builtin News
    if (dom.builtinNewsContainer) {
      dom.builtinNewsContainer.innerHTML = '';
      const newsMeta = {
        hackernews: { icon: 'fa-y-combinator', color: '#F97316', testQ: '', desc: 'Официальный Firebase API Y Combinator: заголовки, очки и ссылки лучших IT-статей без авторизации.' },
        gdelt: { icon: 'fa-newspaper', color: '#38BDF8', testQ: 'technology', desc: 'Глобальная открытая база данных, мониторящая мировые СМИ каждые 15 минут по ключевым словам.' }
      };

      const news = state.feedsConfig.news || {};
      Object.keys(news).forEach(key => {
        const item = news[key];
        const meta = newsMeta[key] || { icon: 'fa-globe', color: 'var(--accent-red)', testQ: '', desc: '' };

        const card = document.createElement('div');
        card.className = 'feed-card';
        card.innerHTML = `
          <div class="feed-card-header">
            <div class="feed-card-title">
              <i class="fa-solid ${meta.icon}" style="color: ${meta.color}; width: 18px; text-align: center;"></i>
              <span>${escapeHtml(item.name)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="feed-btn-ping btn-ping-${key}">
                <i class="fa-solid fa-satellite-dish"></i> Ping
              </button>
              <label style="display: flex; align-items: center; cursor: pointer; gap: 6px;">
                <input type="checkbox" class="toggle-news-${key}" ${item.enabled ? 'checked' : ''} style="width: 17px; height: 17px; accent-color: var(--accent-red); cursor: pointer;">
                <span class="feed-badge ${item.enabled ? 'active' : 'inactive'}">${item.enabled ? 'Активен' : 'Отключен'}</span>
              </label>
            </div>
          </div>
          <div style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.4;">
            ${meta.desc}
          </div>
        `;

        const pingBtn = card.querySelector(`.btn-ping-${key}`);
        pingBtn.onclick = () => testFeedSource(key, meta.testQ, pingBtn);

        const toggleInput = card.querySelector(`.toggle-news-${key}`);
        const badge = card.querySelector('.feed-badge');
        toggleInput.onchange = () => {
          item.enabled = toggleInput.checked;
          badge.className = `feed-badge ${item.enabled ? 'active' : 'inactive'}`;
          badge.textContent = item.enabled ? 'Активен' : 'Отключен';
          saveFeedsConfig();
          showToast(`${item.name}: ${item.enabled ? 'включен' : 'отключен'}`, 'info');
        };

        dom.builtinNewsContainer.appendChild(card);
      });
    }

    // 2. Custom User RSS Feeds
    if (dom.customRssContainer) {
      dom.customRssContainer.innerHTML = '';
      const customList = state.feedsConfig.custom_rss || [];

      if (customList.length === 0) {
        dom.customRssContainer.innerHTML = `
          <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px; background: var(--bg-surface); border-radius: 8px;">
            Нет добавленных RSS-каналов. Нажмите "+ Добавить RSS-канал" выше для подключения любого потока.
          </div>
        `;
      } else {
        customList.forEach((rss) => {
          const card = document.createElement('div');
          card.className = 'feed-card';
          card.innerHTML = `
            <div class="feed-card-header">
              <div class="feed-card-title">
                <i class="fa-solid fa-rss" style="color: var(--accent-yellow); width: 18px; text-align: center;"></i>
                <span>${escapeHtml(rss.name)}</span>
                <span class="feed-badge" style="margin-left: 6px;">${escapeHtml(rss.category || 'rss')}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button class="feed-btn-ping btn-ping-rss">
                  <i class="fa-solid fa-satellite-dish"></i> Ping
                </button>
                <label style="display: flex; align-items: center; cursor: pointer; gap: 6px;">
                  <input type="checkbox" class="toggle-rss" ${rss.enabled ? 'checked' : ''} style="width: 17px; height: 17px; accent-color: var(--accent-red); cursor: pointer;">
                  <span class="feed-badge ${rss.enabled ? 'active' : 'inactive'}">${rss.enabled ? 'Активен' : 'Отключен'}</span>
                </label>
                <button class="feed-btn-delete btn-del-rss" title="Удалить этот канал">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(rss.url)}
            </div>
          `;

          const pingBtn = card.querySelector('.btn-ping-rss');
          pingBtn.onclick = () => testFeedSource('rss', rss.url, pingBtn);

          const toggleInput = card.querySelector('.toggle-rss');
          const badge = card.querySelector('.feed-badge:not([style*="margin-left"])');
          toggleInput.onchange = () => {
            rss.enabled = toggleInput.checked;
            badge.className = `feed-badge ${rss.enabled ? 'active' : 'inactive'}`;
            badge.textContent = rss.enabled ? 'Активен' : 'Отключен';
            saveFeedsConfig();
          };

          const delBtn = card.querySelector('.btn-del-rss');
          delBtn.onclick = () => {
            state.feedsConfig.custom_rss = state.feedsConfig.custom_rss.filter(r => r.id !== rss.id);
            saveFeedsConfig();
            renderNewsAndRss();
            showToast(`RSS-канал "${rss.name}" удален`, 'info');
          };

          dom.customRssContainer.appendChild(card);
        });
      }
    }
  }
  function renderCustomApis() {
    if (!state.feedsConfig) return;
    if (dom.customApisContainer) {
      dom.customApisContainer.innerHTML = '';
      const customList = state.feedsConfig.custom_apis || [];

      if (customList.length === 0) {
        dom.customApisContainer.innerHTML = `
          <div style="padding: 18px; text-align: center; color: var(--text-muted); font-size: 12px; background: var(--bg-surface); border-radius: 8px;">
            Нет подключенных пользовательских API. Нажмите "+ Добавить свой API" выше, чтобы подключить внешний REST сервис.
          </div>
        `;
      } else {
        const catIcons = {
          weather: 'fa-cloud-sun',
          finance: 'fa-chart-line',
          crypto: 'fa-coins',
          news: 'fa-newspaper',
          custom: 'fa-plug'
        };
        customList.forEach((api) => {
          const icon = catIcons[api.category] || 'fa-plug';
          const card = document.createElement('div');
          card.className = 'feed-card';
          let displayUrl = api.url || '';
          if (api.key) {
            displayUrl = displayUrl.replace(api.key, '••••••••');
          }
          card.innerHTML = `
            <div class="feed-card-header">
              <div class="feed-card-title">
                <i class="fa-solid ${icon}" style="color: #10B981; width: 18px; text-align: center;"></i>
                <span>${escapeHtml(api.name)}</span>
                <span class="feed-badge" style="margin-left: 6px; background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3);">${escapeHtml(api.category || 'custom')}</span>
                <span class="feed-badge" style="margin-left: 4px; font-family: var(--font-mono);">${escapeHtml(api.method || 'GET')}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button class="feed-btn-ping btn-ping-custom">
                  <i class="fa-solid fa-satellite-dish"></i> Ping
                </button>
                <label style="display: flex; align-items: center; cursor: pointer; gap: 6px;">
                  <input type="checkbox" class="toggle-custom-api" ${api.enabled ? 'checked' : ''} style="width: 17px; height: 17px; accent-color: var(--accent-red); cursor: pointer;">
                  <span class="feed-badge ${api.enabled ? 'active' : 'inactive'}">${api.enabled ? 'Активен' : 'Отключен'}</span>
                </label>
                <button class="feed-btn-delete btn-del-custom-api" title="Удалить этот API">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px;">
              ${escapeHtml(displayUrl)}
            </div>
            ${api.description ? `<div style="font-size: 11.5px; color: var(--text-secondary);">${escapeHtml(api.description)}</div>` : ''}
          `;

          const pingBtn = card.querySelector('.btn-ping-custom');
          pingBtn.onclick = () => testCustomApiSource(api, pingBtn);

          const toggleInput = card.querySelector('.toggle-custom-api');
          const badge = card.querySelector('.feed-badge:not([style*="margin-left"])');
          toggleInput.onchange = () => {
            api.enabled = toggleInput.checked;
            badge.className = `feed-badge ${api.enabled ? 'active' : 'inactive'}`;
            badge.textContent = api.enabled ? 'Активен' : 'Отключен';
            saveFeedsConfig();
            showToast(`${api.name}: ${api.enabled ? 'включен' : 'отключен'}`, 'info');
          };

          const delBtn = card.querySelector('.btn-del-custom-api');
          delBtn.onclick = () => {
            state.feedsConfig.custom_apis = state.feedsConfig.custom_apis.filter(a => a.id !== api.id);
            saveFeedsConfig();
            renderCustomApis();
            showToast(`API "${api.name}" удален`, 'info');
          };

          dom.customApisContainer.appendChild(card);
        });
      }
    }
  }

  async function testCustomApiSource(apiConfig, btnElement) {
    if (btnElement) {
      btnElement.disabled = true;
      btnElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Ping...`;
    }

    try {
      const res = await fetch('/api/feeds/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'custom', query: 'test', api_config: apiConfig })
      });
      const data = await res.json();

      if (btnElement) {
        btnElement.disabled = false;
        btnElement.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Ping (${data.latency_ms || 0}ms)`;
      }

      if (dom.feedPingStatus) {
        dom.feedPingStatus.style.display = 'block';
        const timestamp = new Date().toLocaleTimeString();
        if (data.success) {
          dom.feedPingStatus.innerHTML = `
            <div>[${timestamp}] <b>${escapeHtml(apiConfig.name)}</b>: Успешный ответ (${data.latency_ms}ms) ✓</div>
            <div style="color: #cbd5e1; margin-top: 4px; white-space: pre-wrap; max-height: 120px; overflow-y: auto;">${escapeHtml(data.text_summary || JSON.stringify(data.data, null, 2))}</div>
          `;
          showToast(`✓ API "${apiConfig.name}" доступен (${data.latency_ms}ms)`, 'success');
        } else {
          dom.feedPingStatus.innerHTML = `
            <div style="color: #ef4444;">[${timestamp}] <b>${escapeHtml(apiConfig.name)}</b>: Ошибка (${data.latency_ms}ms) ✗</div>
            <div style="color: #fca5a5; margin-top: 4px;">${escapeHtml(data.error || 'Ошибка запроса')}</div>
          `;
          showToast(`Ошибка API: ${data.error}`, 'warning');
        }
      }
    } catch (e) {
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Ошибка`;
      }
      showToast(`Сетевая ошибка: ${e.message}`, 'error');
    }
  }


  async function testFeedSource(source, query, btnElement) {
    if (btnElement) {
      btnElement.disabled = true;
      btnElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Ping...`;
    }

    try {
      const res = await fetch('/api/feeds/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, query: query || '' })
      });
      const data = await res.json();

      if (btnElement) {
        btnElement.disabled = false;
        btnElement.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Ping (${data.latency_ms || 0}ms)`;
      }

      if (dom.feedPingStatus) {
        dom.feedPingStatus.style.display = 'block';
        const timestamp = new Date().toLocaleTimeString();
        dom.feedPingStatus.innerHTML = `
          <div style="color:#fff;font-weight:bold;margin-bottom:4px;">
            [${timestamp}] Источник: ${source.toUpperCase()} (${data.service || ''}) • Пинг: ${data.latency_ms || 0} мс • Статус: ${data.success ? 'УСПЕШНО' : 'ОШИБКА'}
          </div>
          <div style="white-space:pre-wrap;color:#a3e635;">${escapeHtml(data.text_summary || JSON.stringify(data, null, 2))}</div>
        `;
        dom.feedPingStatus.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      if (data.success) {
        showToast(`✓ Ping ${source}: ${data.latency_ms} мс (HTTP 200 OK)`, 'success');
      } else {
        showToast(`Ошибка ${source}: ${data.error || 'не удалось загрузить'}`, 'warning');
      }
    } catch (e) {
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Ошибка`;
      }
      showToast(`Сетевая ошибка пинга: ${e.message}`, 'error');
    }
  }

  // --- MCP PROTOCOL & BLENDER 3D ACTIONS ---
  function renderMcpToolsCard(mcpCalls) {
    const card = document.createElement('div');
    card.style.marginTop = '12px';
    card.style.padding = '12px 14px';
    card.style.background = 'rgba(234, 118, 0, 0.08)';
    card.style.border = '1px solid #ea7600';
    card.style.borderRadius = '8px';
    card.style.boxShadow = '0 0 12px rgba(234, 118, 0, 0.25)';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '10px';
    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #fff; font-size: 12.5px;">
        <i class="fa-solid fa-cube" style="color: #ea7600;"></i>
        <span>Model Context Protocol • Blender 3D Action</span>
      </div>
      <span style="font-size: 10px; padding: 2px 6px; background: rgba(234, 118, 0, 0.2); color: #ea7600; border-radius: 4px; font-weight: bold;">MCP JSON-RPC</span>
    `;
    card.appendChild(header);

    mcpCalls.forEach(call => {
      const row = document.createElement('div');
      row.style.marginBottom = '10px';
      row.style.background = 'var(--bg-main)';
      row.style.padding = '10px';
      row.style.borderRadius = '6px';
      row.style.border = '1px solid var(--border)';

      const isScript = call.tool === 'blender_execute_script';
      const codePreview = isScript ? (call.args.code || '') : JSON.stringify(call.args, null, 2);

      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="font-size: 12px; font-weight: 600; color: #ea7600; font-family: var(--font-mono);">
            <i class="fa-solid fa-terminal" style="margin-right: 4px;"></i>${escapeHtml(call.tool)}
          </div>
          <div style="font-size: 10.5px; color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(call.url)}</div>
        </div>
        <pre style="background: rgba(0,0,0,0.4); padding: 8px; border-radius: 4px; font-size: 11px; color: #d1d5db; max-height: 140px; overflow-y: auto; margin-bottom: 8px; font-family: var(--font-mono);">${escapeHtml(codePreview)}</pre>
        <div class="mcp-action-row" style="display: flex; align-items: center; gap: 10px;">
          <button class="sreda-btn-primary btn-exec-mcp" style="background: #ea7600; border-color: #ea7600; padding: 6px 12px; font-size: 11px;">
            <i class="fa-solid fa-play"></i> Выполнить в Blender (MCP)
          </button>
          <div class="mcp-exec-status" style="font-size: 11px; color: var(--text-muted);"></div>
        </div>
      `;

      const execBtn = row.querySelector('.btn-exec-mcp');
      const statusDiv = row.querySelector('.mcp-exec-status');

      execBtn.onclick = async () => {
        execBtn.disabled = true;
        execBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Выполнение в Blender...';
        statusDiv.textContent = 'Отправка команды на порт 9876...';
        try {
          const res = await fetch('/api/mcp/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              server_url: call.url,
              tool_name: call.tool,
              arguments: call.args
            })
          });
          const data = await res.json();
          if (data.success) {
            execBtn.innerHTML = '<i class="fa-solid fa-check"></i> Выполнено!';
            execBtn.style.background = 'var(--accent-green)';
            statusDiv.innerHTML = `<span style="color: var(--accent-green);">✓ Успешно выполнено в Blender 3D!</span>`;
            showToast('✓ Действие MCP успешно выполнено в Blender 3D', 'success');
          } else {
            execBtn.disabled = false;
            execBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Повторить';
            statusDiv.innerHTML = `<span style="color: var(--accent-red);">⚠ ${escapeHtml(data.error || 'Ошибка')}</span>`;
            showToast(`Ошибка MCP: ${data.error}`, 'error');
          }
        } catch (err) {
          execBtn.disabled = false;
          execBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Повторить';
          statusDiv.innerHTML = `<span style="color: var(--accent-red);">⚠ Ошибка соединения: ${escapeHtml(err.message)}</span>`;
          showToast(`Ошибка вызова MCP: ${err.message}`, 'error');
        }
      };

      card.appendChild(row);
    });

    return card;
  }

  // --- SEND MESSAGE & SSE STREAMING ---
  async function sendMessage() {
    if (state.isStreaming) {
      // Abort active stream
      if (state.abortController) {
        state.abortController.abort();
      }
      return;
    }

    const text = (dom.chatInput ? dom.chatInput.value : '').trim();
    if (!text && !activeAttachment) return;

    hideSlashPopup();

    const chat = getActiveChat();
    if (!chat) return;

    // Detect Slash Skill
    let activeSkill = null;
    let textToSend = text;
    const slashMatch = text.match(/^\/([a-zA-Z0-9_\-]+)(?:\s+([\s\S]*))?$/);
    if (slashMatch) {
      const triggerName = slashMatch[1].toLowerCase();
      const matchedSkill = state.skills.find(s => s.trigger.toLowerCase() === triggerName);
      if (matchedSkill) {
        activeSkill = matchedSkill;
        textToSend = slashMatch[2] ? slashMatch[2].trim() : `Активирован скилл /${matchedSkill.trigger} (${matchedSkill.name}). Пожалуйста, укажи задачу.`;
      }
    }

    // Add user message with attachment and vision context
    let attachmentData = null;
    let visionContextPrompt = '';
    if (activeAttachment) {
      attachmentData = {
        type: activeAttachment.type,
        doc_category: activeAttachment.doc_category,
        url: activeAttachment.url,
        file_url: activeAttachment.url,
        filename: activeAttachment.filename,
        char_count: activeAttachment.char_count,
        duration_sec: activeAttachment.duration_sec,
        was_trimmed: activeAttachment.was_trimmed,
        preview: activeAttachment.preview
      };
      visionContextPrompt = activeAttachment.vision_context || '';
      activeAttachment = null;
      const previewBox = document.getElementById('attachment-preview-box');
      if (previewBox) {
        previewBox.innerHTML = '';
        previewBox.style.display = 'none';
      }
      const fileInput = document.getElementById('file-attachment-input');
      if (fileInput) fileInput.value = '';
    }

    if (!textToSend && attachmentData) {
      textToSend = 'Опиши и подробно проанализируй прикрепленное изображение.';
    }

    const userMsg = {
      role: 'user',
      content: textToSend,
      attachment: attachmentData,
      vision_context: visionContextPrompt,
      skill: activeSkill ? { trigger: activeSkill.trigger, name: activeSkill.name } : null,
      timestamp: Date.now()
    };
    chat.messages.push(userMsg);

    // Auto-title chat on first message
    if (chat.title === 'Новый диалог' || chat.messages.length === 1) {
      chat.title = textToSend.length > 28 ? textToSend.slice(0, 28) + '...' : textToSend;
      if (dom.headerChatTitle) dom.headerChatTitle.textContent = chat.title;
      renderChatsList();
    }

    // Clear input
    if (dom.chatInput) {
      dom.chatInput.value = '';
      dom.chatInput.style.height = 'auto';
    }

    // Render user message
    appendMessageElement(userMsg, true);
    scrollToBottom();
    saveChats();

    // Prepare assistant placeholder
    const assistantMsg = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      telemetry: { speed: 0, tokens: 0 }
    };

    const rendered = appendMessageElement(assistantMsg, true);
    if (!rendered) return;

    const { textDiv, bubble, row } = rendered;
    if (row) row.classList.add('generating');
    textDiv.innerHTML = '<span class="streaming-dots"><i class="fa-solid fa-circle-notch fa-spin"></i> Размышление...</span>';

    // Toggle Send button to Stop button
    setStreamingState(true);

    state.abortController = new AbortController();
    const startTime = Date.now();
    let accumulatedContent = '';
    let tokenCount = 0;
    let detectedTools = [];
    let detectedMcpCalls = [];

    try {
      const messagesPayload = chat.messages
        .filter(m => m !== assistantMsg)
        .map(m => {
          let content = m.content;
          if (m.vision_context) {
            content = m.content + "\n" + m.vision_context;
          }
          return { role: m.role, content: content };
        });

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesPayload,
          model_path: state.activeModelPath,
          temperature: 0.7,
          top_p: 0.9,
          user_profile: state.profile,
          skill_prompt: activeSkill ? activeSkill.prompt : '',
          language: state.settings.language || 'ru'
        }),
        signal: state.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') break;

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'reasoning') {
              if (!accumulatedContent) {
                textDiv.innerHTML = '<span class="streaming-dots"><i class="fa-solid fa-brain fa-fade" style="color: var(--accent-red)"></i> Анализ контекста и рассуждение...</span>';
              }
            } else if (data.type === 'token') {
              const tokenStr = data.content;
              accumulatedContent += tokenStr;
              tokenCount++;

              // Update markdown render with cleaned text
              const displayStream = cleanMessageText(accumulatedContent);
              textDiv.innerHTML = window.marked
                ? window.marked.parse(displayStream)
                : escapeHtml(displayStream);

              // Live telemetry update
              const elapsedSec = (Date.now() - startTime) / 1000;
              const liveSpeed = (tokenCount / Math.max(0.1, elapsedSec)).toFixed(1);

              const footerLeft = bubble.querySelector('.msg-footer-left');
              if (footerLeft) {
                footerLeft.innerHTML = `<span>⚡ ${liveSpeed} т/с • ${tokenCount} токенов • ${state.activeModelName.replace('.gguf', '')}</span>`;
              }
              scrollToBottom();
            } else if (data.type === 'done') {
              if (data.tools) detectedTools = data.tools;
              if (data.mcp_calls) detectedMcpCalls = data.mcp_calls;
              assistantMsg.telemetry = {
                tokens: data.tokens || tokenCount,
                speed: data.speed || 0
              };
            } else if (data.type === 'error') {
              textDiv.innerHTML += `<div style="color: var(--accent-red); margin-top: 8px;">⚠ Ошибка инференса: ${escapeHtml(data.message)}</div>`;
            }
          } catch (err) {
            // Non-JSON or partial
          }
        }
      }

      // Finish streaming
      assistantMsg.content = cleanMessageText(accumulatedContent);
      assistantMsg.tools = detectedTools;
      assistantMsg.mcp_calls = detectedMcpCalls;
      chat.messages.push(assistantMsg);
      saveChats();

      // Render tools card if any
      if (detectedTools.length > 0) {
        const toolsCard = renderMediaToolsCard(detectedTools);
        bubble.appendChild(toolsCard);
      }

      // Render MCP actions card if any
      if (detectedMcpCalls.length > 0) {
        const mcpCard = renderMcpToolsCard(detectedMcpCalls);
        bubble.appendChild(mcpCard);
      }

      // Auto-TTS if enabled
      if (state.settings.autoTts && accumulatedContent) {
        speakText(accumulatedContent, bubble);
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        assistantMsg.content = accumulatedContent + ' [Остановлено пользователем]';
        chat.messages.push(assistantMsg);
        saveChats();
        textDiv.innerHTML = window.marked ? window.marked.parse(assistantMsg.content) : assistantMsg.content;
      } else {
        textDiv.innerHTML = `<div style="color: var(--accent-red);">⚠ Ошибка соединения с llama-server: ${escapeHtml(err.message)}</div>`;
      }
    } finally {
      if (row) {
        row.classList.remove('generating');
        const actions = row.querySelector('.msg-footer-actions');
        if (actions) actions.style.display = 'flex';
      }
      enhanceCodeBlocks(textDiv);
      setStreamingState(false);
      scrollToBottom();
    }
  }

  function setStreamingState(isStreaming) {
    state.isStreaming = isStreaming;
    if (dom.btnSendMessage) {
      const dict = typeof getI18nDict === 'function' ? getI18nDict() : {};
      if (isStreaming) {
        dom.btnSendMessage.classList.add('is-streaming');
        dom.btnSendMessage.innerHTML = '<i class="fa-solid fa-stop"></i>';
        dom.btnSendMessage.style.backgroundColor = '';
        dom.btnSendMessage.title = dict.stopTooltip || 'Остановить генерацию';
      } else {
        dom.btnSendMessage.classList.remove('is-streaming');
        dom.btnSendMessage.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        dom.btnSendMessage.style.backgroundColor = '';
        dom.btnSendMessage.title = dict.sendTooltip || 'Отправить сообщение';
      }
    }
  }

  // --- AUDIO SUBSYSTEM (STT / TTS / CUSTOM PLAYER) ---

  // 1. Web Audio WAV Encoding for Whisper.cpp (16kHz 16-bit Mono PCM)
  function downsampleBuffer(buffer, inputSampleRate, outputSampleRate = 16000) {
    if (inputSampleRate === outputSampleRate) return buffer;
    const ratio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0, count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  function encodeWAV(samples, sampleRate = 16000) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono channel
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  // Microphone Voice Input (Whisper.cpp)
  let voiceRecordingState = {
    isRecording: false,
    audioContext: null,
    mediaStream: null,
    processor: null,
    source: null,
    pcmChunks: []
  };

  async function startVoiceRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Ваш браузер не поддерживает захват микрофона через Web Audio', 'error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const chunks = [];

      let hasSpoken = false;
      let lastSpeechTime = Date.now();
      const recordStartTime = Date.now();
      const SILENCE_THRESHOLD = 0.007; // Sensitive threshold for normal speech and whispered input
      const SILENCE_TIMEOUT_MS = 3000;  // 3s silence after speech -> auto-stop and transcribe
      const MAX_INITIAL_SILENCE_MS = 5500; // 5.5s silence if user did not speak -> auto-stop

      processor.onaudioprocess = (e) => {
        if (!voiceRecordingState.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(inputData));

        // VAD: calculate RMS volume
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);

        const now = Date.now();
        if (rms > SILENCE_THRESHOLD) {
          hasSpoken = true;
          lastSpeechTime = now;
          if (dom.btnVoiceInput) {
            dom.btnVoiceInput.style.transform = 'scale(1.08)';
          }
        } else {
          if (dom.btnVoiceInput) {
            dom.btnVoiceInput.style.transform = '';
          }
          if (hasSpoken && (now - lastSpeechTime > SILENCE_TIMEOUT_MS)) {
            // User paused for 3 seconds -> automatically stop and process speech
            stopVoiceRecording();
          } else if (!hasSpoken && (now - recordStartTime > MAX_INITIAL_SILENCE_MS)) {
            // Nothing spoken within 5.5 seconds -> auto-close
            stopVoiceRecording();
          }
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      voiceRecordingState = {
        isRecording: true,
        audioContext: ctx,
        mediaStream: stream,
        processor: processor,
        source: source,
        pcmChunks: chunks,
        inputSampleRate: ctx.sampleRate
      };

      if (dom.btnVoiceInput) {
        dom.btnVoiceInput.classList.add('recording');
        dom.btnVoiceInput.title = 'Идет запись речи... Нажмите для завершения и распознавания';
      }
      showToast('🎙 Слушаю вас... Говорите в микрофон', 'info');
    } catch (err) {
      console.error('Mic access error:', err);
      showToast('Ошибка доступа к микрофону: ' + err.message, 'error');
    }
  }

  async function stopVoiceRecording() {
    if (!voiceRecordingState.isRecording) return;
    voiceRecordingState.isRecording = false;

    if (dom.btnVoiceInput) {
      dom.btnVoiceInput.classList.remove('recording');
      dom.btnVoiceInput.title = 'Голосовой ввод (Whisper.cpp)';
    }

    try {
      if (voiceRecordingState.processor) voiceRecordingState.processor.disconnect();
      if (voiceRecordingState.source) voiceRecordingState.source.disconnect();
      if (voiceRecordingState.mediaStream) {
        voiceRecordingState.mediaStream.getTracks().forEach(t => t.stop());
      }
      if (voiceRecordingState.audioContext) {
        await voiceRecordingState.audioContext.close();
      }
    } catch (e) {
      console.warn(e);
    }

    const chunks = voiceRecordingState.pcmChunks;
    if (!chunks || chunks.length === 0) {
      showToast('Запись не содержит данных', 'info');
      return;
    }

    let totalLen = 0;
    for (let c of chunks) totalLen += c.length;
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (let c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }

    const inRate = voiceRecordingState.inputSampleRate || 44100;
    const finalSamples = downsampleBuffer(merged, inRate, 16000);
    const wavBlob = encodeWAV(finalSamples, 16000);

    if (wavBlob.size < 6000) {
      showToast('Слишком короткая запись', 'info');
      return;
    }

    showToast('⚡ Распознавание речи (Whisper.cpp)...', 'info');

    const formData = new FormData();
    formData.append('file', wavBlob, 'input_mic.wav');
    formData.append('language', state.settings.language || 'auto');

    try {
      const res = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.text) {
        const cur = dom.chatInput.value.trim();
        dom.chatInput.value = cur ? (cur + ' ' + data.text) : data.text;
        dom.chatInput.style.height = 'auto';
        dom.chatInput.style.height = Math.min(dom.chatInput.scrollHeight, 200) + 'px';
        dom.chatInput.focus();
        dom.chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        showToast(`✓ Распознано: "${data.text.slice(0, 40)}${data.text.length > 40 ? '...' : ''}" (${data.elapsed_sec}с)`, 'success');
      } else if (data.success && !data.text) {
        showToast('Речь не обнаружена (тишина)', 'info');
      } else {
        showToast('Ошибка распознавания: ' + (data.error || 'неизвестно'), 'error');
      }
    } catch (err) {
      console.error('STT request failed:', err);
      showToast('Ошибка соединения с сервисом Whisper', 'error');
    }
  }

  function setupVoiceInput() {
    if (dom.btnVoiceInput) {
      dom.btnVoiceInput.onclick = () => {
        if (voiceRecordingState.isRecording) {
          stopVoiceRecording();
        } else {
          startVoiceRecording();
        }
      };
    }
  }

  // 2. Custom Cybernetic Audio Player & Piper TTS
  let activeAudioInstance = null;

  function createAudioPlayerElement(audioUrl, voiceName, parentBubble) {
    if (parentBubble) {
      const oldPlayer = parentBubble.querySelector('.sreda-audio-player');
      if (oldPlayer) oldPlayer.remove();
    }

    const playerEl = document.createElement('div');
    playerEl.className = 'sreda-audio-player';
    playerEl.dataset.audioUrl = audioUrl;

    const audio = new Audio(audioUrl);
    audio.playbackRate = 1.0;

    const btnToggle = document.createElement('button');
    btnToggle.className = 'player-btn-toggle';
    btnToggle.title = 'Воспроизвести / Пауза';
    btnToggle.innerHTML = '<i class="fa-solid fa-play"></i>';

    const bodyEl = document.createElement('div');
    bodyEl.className = 'player-body';

    const metaEl = document.createElement('div');
    metaEl.className = 'player-meta';

    const voiceTag = document.createElement('span');
    voiceTag.className = 'player-voice-tag';
    voiceTag.innerHTML = `<i class="fa-solid fa-microphone"></i> ${escapeHtml(voiceName || 'Piper TTS')}`;

    const timeEl = document.createElement('span');
    timeEl.className = 'player-time';
    timeEl.textContent = '0:00 / 0:00';

    metaEl.appendChild(voiceTag);
    metaEl.appendChild(timeEl);

    const progressTrack = document.createElement('div');
    progressTrack.className = 'player-progress-track';

    const progressFill = document.createElement('div');
    progressFill.className = 'player-progress-fill';
    progressTrack.appendChild(progressFill);

    bodyEl.appendChild(metaEl);
    bodyEl.appendChild(progressTrack);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'player-actions';

    const speedBtn = document.createElement('button');
    speedBtn.className = 'player-speed-btn';
    speedBtn.textContent = '1.0x';
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.8];
    let speedIdx = 0;
    speedBtn.onclick = (e) => {
      e.stopPropagation();
      speedIdx = (speedIdx + 1) % speeds.length;
      const rate = speeds[speedIdx];
      audio.playbackRate = rate;
      speedBtn.textContent = `${rate.toFixed(1)}x`;
    };

    const dlLink = document.createElement('a');
    dlLink.className = 'player-download-btn';
    dlLink.href = audioUrl;
    dlLink.download = 'sreda_speech.wav';
    dlLink.title = 'Скачать аудиозапись (.wav)';
    dlLink.innerHTML = '<i class="fa-solid fa-download"></i>';

    actionsEl.appendChild(speedBtn);
    actionsEl.appendChild(dlLink);

    playerEl.appendChild(btnToggle);
    playerEl.appendChild(bodyEl);
    playerEl.appendChild(actionsEl);

    function formatTime(sec) {
      if (isNaN(sec) || !isFinite(sec) || sec <= 0) return '0:00';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    const updateTimeDisplay = () => {
      const dur = (audio.duration && isFinite(audio.duration)) ? audio.duration : 0;
      timeEl.textContent = `${formatTime(audio.currentTime)} / ${formatTime(dur)}`;
    };

    audio.onloadedmetadata = updateTimeDisplay;
    audio.ondurationchange = updateTimeDisplay;
    audio.oncanplay = updateTimeDisplay;

    audio.ontimeupdate = () => {
      if (!audio.duration || !isFinite(audio.duration)) return;
      const pct = Math.min(100, (audio.currentTime / audio.duration) * 100);
      progressFill.style.width = `${pct}%`;
      updateTimeDisplay();
    };

    audio.onerror = (e) => {
      console.warn('Audio playback error:', e, audio.error);
      timeEl.textContent = 'Ошибка звука';
      btnToggle.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
      playerEl.classList.remove('playing');
    };

    audio.onended = () => {
      playerEl.classList.remove('playing');
      btnToggle.innerHTML = '<i class="fa-solid fa-play"></i>';
      progressFill.style.width = '0%';
      updateTimeDisplay();
      if (activeAudioInstance === audio) activeAudioInstance = null;
    };

    btnToggle.onclick = (e) => {
      if (e) e.stopPropagation();
      if (audio.paused) {
        if (activeAudioInstance && activeAudioInstance !== audio) {
          activeAudioInstance.pause();
        }
        activeAudioInstance = audio;
        playerEl.classList.add('playing');
        btnToggle.innerHTML = '<i class="fa-solid fa-pause"></i>';
        audio.play().catch(err => {
          console.warn('Playback error:', err);
          playerEl.classList.remove('playing');
          btnToggle.innerHTML = '<i class="fa-solid fa-play"></i>';
          showToast('Браузер ожидает взаимодействия для воспроизведения звука', 'info');
        });
      } else {
        audio.pause();
        playerEl.classList.remove('playing');
        btnToggle.innerHTML = '<i class="fa-solid fa-play"></i>';
      }
    };

    progressTrack.onclick = (e) => {
      if (e) e.stopPropagation();
      const rect = progressTrack.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (audio.duration && isFinite(audio.duration)) {
        audio.currentTime = pos * audio.duration;
      }
    };

    if (parentBubble) {
      const footer = parentBubble.querySelector('.msg-footer');
      if (footer) {
        parentBubble.insertBefore(playerEl, footer);
      } else {
        parentBubble.appendChild(playerEl);
      }
    }

    // Auto-play attempt
    if (activeAudioInstance && activeAudioInstance !== audio) {
      activeAudioInstance.pause();
    }
    activeAudioInstance = audio;
    audio.play().then(() => {
      playerEl.classList.add('playing');
      btnToggle.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }).catch(e => {
      // Browser autoplay policy prevented instant unmuted play without user gesture
      console.log('Autoplay deferred:', e);
      playerEl.classList.remove('playing');
      btnToggle.innerHTML = '<i class="fa-solid fa-play"></i>';
    });

    return playerEl;
  }

  async function speakText(text, parentBubble = null, triggerBtn = null) {
    if (!text) return;
    const cleanText = cleanMessageText(text)
                          .replace(/```[\s\S]*?```/g, '')
                          .replace(/[*_#~>`]/g, '')
                          .trim();
    if (!cleanText) return;

    // If parentBubble not passed, resolve to the latest assistant message bubble
    if (!parentBubble) {
      const allBubbles = document.querySelectorAll('.message-row.assistant .msg-bubble');
      if (allBubbles.length > 0) {
        parentBubble = allBubbles[allBubbles.length - 1];
      }
    }

    if (triggerBtn) {
      triggerBtn.className = 'fa-solid fa-spinner fa-spin msg-action-btn';
    }

    try {
      const res = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          lang: state.settings.language || 'ru',
          voice_id: state.settings.voiceId || null
        })
      });
      const data = await res.json();

      if (triggerBtn) {
        triggerBtn.className = 'fa-solid fa-volume-high msg-action-btn';
      }

      if (data.code === 'voice_missing') {
        showToast(`Диктор для языка [${state.settings.language.toUpperCase()}] не установлен`, 'info');
        openSettingsTabLanguage(data.voice);
        return;
      }

      if (data.success && data.audio_url) {
        createAudioPlayerElement(data.audio_url, data.voice_name, parentBubble);
      } else {
        showToast('Ошибка синтеза речи: ' + (data.error || 'неизвестно'), 'error');
      }
    } catch (err) {
      console.error('TTS request error:', err);
      if (triggerBtn) {
        triggerBtn.className = 'fa-solid fa-volume-high msg-action-btn';
      }
      showToast('Ошибка соединения с сервисом Piper TTS', 'error');
    }
  }

  function openSettingsTabLanguage(highlightVoice = null) {
    if (dom.modalSettings) {
      dom.modalSettings.style.display = 'flex';
      document.querySelectorAll('#modal-settings .modal-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === 'tab-set-language');
      });
      document.querySelectorAll('#modal-settings .tab-pane').forEach(p => {
        p.style.display = (p.id === 'tab-set-language') ? 'block' : 'none';
      });

      if (highlightVoice && dom.voiceCatalogContainer) {
        setTimeout(() => {
          const card = document.getElementById(`voice-card-${highlightVoice.id}`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.outline = '2px solid var(--accent-red)';
            setTimeout(() => card.style.outline = '', 3000);
          }
        }, 150);
      }
    }
  }

  // 3. Voice Catalog Management
  async function loadVoiceCatalog() {
    try {
      const res = await fetch('/api/audio/voices');
      const data = await res.json();
      if (data && data.voices) {
        state.voices = data.voices;
        renderVoiceCatalog();
        updateActiveVoiceSelector();
      }
    } catch (e) {
      console.warn('Failed to load voice catalog:', e);
    }
  }

  function updateActiveVoiceSelector() {
    if (!dom.selectVoice || !state.voices) return;
    const curLang = state.settings.language || 'ru';
    const langVoices = state.voices.filter(v => v.lang === curLang);

    dom.selectVoice.innerHTML = '';
    if (langVoices.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Нет доступных дикторов';
      dom.selectVoice.appendChild(opt);
    } else {
      langVoices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.name} (${v.installed ? '✓ Установлен' : 'Требуется загрузка ~60 МБ'})`;
        dom.selectVoice.appendChild(opt);
      });

      if (langVoices.some(v => v.id === state.settings.voiceId)) {
        dom.selectVoice.value = state.settings.voiceId;
      } else {
        dom.selectVoice.value = langVoices[0].id;
        state.settings.voiceId = langVoices[0].id;
      }
    }

    refreshActiveVoiceDownloadButton();
  }

  function refreshActiveVoiceDownloadButton() {
    if (!dom.selectVoice || !dom.btnDownloadActiveVoice) return;
    const selectedId = dom.selectVoice.value;
    const voice = (state.voices || []).find(v => v.id === selectedId);

    if (voice && !voice.installed) {
      if (dom.activeVoiceStatus) dom.activeVoiceStatus.style.display = 'none';
      dom.btnDownloadActiveVoice.style.display = 'inline-flex';
      dom.btnDownloadActiveVoice.onclick = () => downloadVoice(voice.id, dom.btnDownloadActiveVoice);
    } else {
      dom.btnDownloadActiveVoice.style.display = 'none';
      if (dom.activeVoiceStatus) dom.activeVoiceStatus.style.display = 'inline-flex';
    }
  }

  function renderVoiceCatalog() {
    if (!dom.voiceCatalogContainer || !state.voices) return;
    dom.voiceCatalogContainer.innerHTML = '';

    const langNames = {
      ru: 'Русский', en: 'English', de: 'Deutsch', fr: 'Français',
      es: 'Español', pt: 'Português', it: 'Italiano', ja: '日本語', ko: '한국어'
    };

    state.voices.forEach(v => {
      const card = document.createElement('div');
      card.id = `voice-card-${v.id}`;
      card.className = `voice-catalog-card ${state.settings.voiceId === v.id ? 'active-speaker' : ''}`;

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '10px';

      const icon = document.createElement('i');
      icon.className = `fa-solid ${v.gender === 'female' ? 'fa-venus' : 'fa-mars'}`;
      icon.style.color = 'var(--accent-red)';
      icon.style.fontSize = '14px';

      const info = document.createElement('div');
      info.innerHTML = `
        <div style="font-size: 13px; font-weight: 600; color: #fff;">${escapeHtml(v.name)}</div>
        <div style="font-size: 11px; color: var(--text-muted);">${langNames[v.lang] || v.lang.toUpperCase()} • ${v.quality || 'medium'} • ~${v.size_mb || 60} МБ</div>
      `;

      left.appendChild(icon);
      left.appendChild(info);

      const right = document.createElement('div');
      if (v.installed) {
        right.innerHTML = `
          <span class="voice-badge-installed">
            <i class="fa-solid fa-check"></i> Установлен
          </span>
        `;
      } else {
        const dlBtn = document.createElement('button');
        dlBtn.className = 'voice-btn-download';
        dlBtn.innerHTML = '<i class="fa-solid fa-download"></i> Скачать (~60 МБ)';
        dlBtn.onclick = () => downloadVoice(v.id, dlBtn);
        right.appendChild(dlBtn);
      }

      card.appendChild(left);
      card.appendChild(right);
      dom.voiceCatalogContainer.appendChild(card);
    });
  }

  async function downloadVoice(voiceId, btnEl) {
    if (btnEl) {
      btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Скачивание...';
      btnEl.disabled = true;
    }
    showToast('Загрузка модели диктора с Hugging Face (~60 МБ)...', 'info');

    try {
      const res = await fetch('/api/audio/voices/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_id: voiceId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✓ Диктор успешно установлен и готов к озвучке!', 'success');
        await loadVoiceCatalog();
      } else if (modalId === 'modal-feeds') {
        loadFeedsConfig();
      } else {
        showToast('Ошибка загрузки: ' + (data.error || 'неизвестно'), 'error');
        if (btnEl) {
          btnEl.innerHTML = '<i class="fa-solid fa-download"></i> Скачать (~60 МБ)';
          btnEl.disabled = false;
        }
      }
    } catch (e) {
      showToast('Ошибка связи с сервером при загрузке диктора', 'error');
      if (btnEl) {
        btnEl.innerHTML = '<i class="fa-solid fa-download"></i> Скачать (~60 МБ)';
        btnEl.disabled = false;
      }
    }
  }

  // --- SREDA BOOST & HARDWARE OPTIMIZATION ---
  async function fetchBoostStatus() {
    try {
      const res = await fetch('/api/boost/status');
      const data = await res.json();
      state.boost = data;
      renderBoostStatus();
    } catch (e) {
      console.warn('Failed to fetch boost status:', e);
    }
  }

  function renderBoostStatus() {
    const isBoosted = !!(state.boost && (state.boost.is_boost_active || state.boost.is_boosted));

    const dict = I18N[state.settings.language || 'ru'] || I18N.ru;
    if (dom.btnToggleBoost) {
      if (isBoosted) {
        dom.btnToggleBoost.className = 'header-pill-btn header-pill-boost active';
        dom.btnToggleBoost.innerHTML = `<i class="fa-solid fa-bolt" style="color: #fbbf24;"></i> <span id="boost-status-text">${dict.boostActive || 'Boost: Active'}</span>`;
        dom.btnToggleBoost.title = dict.boostTooltipActive || 'SREDA Boost Active';
      } else {
        dom.btnToggleBoost.className = 'header-pill-btn header-pill-boost';
        dom.btnToggleBoost.innerHTML = `<i class="fa-solid fa-bolt" style="color: var(--text-muted);"></i> <span id="boost-status-text">${dict.boostOff || 'Boost: Off'}</span>`;
        dom.btnToggleBoost.title = dict.boostTooltipOff || 'SREDA Boost Off';
      }
    }

    if (dom.boostModalBadge) {
      if (isBoosted) {
        dom.boostModalBadge.textContent = dict.boostHighCpu || 'Active (High CPU)';
        dom.boostModalBadge.style.background = 'rgba(245, 158, 11, 0.2)';
        dom.boostModalBadge.style.color = '#f59e0b';
      } else {
        dom.boostModalBadge.textContent = dict.boostDisabled || 'Disabled';
        dom.boostModalBadge.style.background = 'rgba(255, 255, 255, 0.08)';
        dom.boostModalBadge.style.color = 'var(--text-muted)';
      }
    }

    if (dom.checkAutoBoost) {
      const autoOn = !(state.boost && state.boost.auto_boost_on_launch === false);
      dom.checkAutoBoost.checked = autoOn;
    }
  }

  async function compactRamNow() {
    showToast('Очистка неактивной памяти фоновых приложений...', 'info');
    try {
      const res = await fetch('/api/boost/compact-ram', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const freed = (data.freed_ram_mb !== undefined) ? data.freed_ram_mb : (data.freed_mb || 0);
        const count = (data.processes_compacted !== undefined) ? data.processes_compacted : (data.count || 0);
        showToast(`⚡ SREDA Boost: освобождено ${freed} МБ ОЗУ (${count} процессов)!`, 'success');
        fetchSystemInfo();
        fetchBoostStatus();
      } else {
        showToast('Не удалось очистить память: ' + (data.error || 'ошибка'), 'warning');
      }
    } catch (e) {
      showToast('Ошибка при очистке памяти: ' + e.message, 'error');
    }
  }

  async function toggleBoost() {
    const isBoosted = !!(state.boost && (state.boost.is_boost_active || state.boost.is_boosted));

    if (isBoosted) {
      // Deactivate Boost
      if (dom.btnToggleBoost) {
        dom.btnToggleBoost.className = 'header-pill-btn header-pill-boost loading';
        dom.btnToggleBoost.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Сброс...</span>';
      }
      try {
        const res = await fetch('/api/boost/deactivate', { method: 'POST' });
        const data = await res.json();
        if (state.boost) {
          state.boost.is_boost_active = false;
          state.boost.is_boosted = false;
        }
        renderBoostStatus();
        fetchSystemInfo();
        showToast('SREDA Boost выключен. Приоритеты фоновых приложений восстановлены.', 'info');
      } catch (e) {
        showToast('Ошибка при выключении Boost: ' + e.message, 'error');
        fetchBoostStatus();
      }
    } else {
      // Activate Boost
      if (dom.btnToggleBoost) {
        dom.btnToggleBoost.className = 'header-pill-btn header-pill-boost loading';
        dom.btnToggleBoost.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Оптимизация...</span>';
      }
      try {
        const res = await fetch('/api/boost/activate', { method: 'POST' });
        const data = await res.json();
        if (state.boost) {
          state.boost = { ...state.boost, ...data, is_boost_active: true, is_boosted: true };
        }
        renderBoostStatus();
        fetchSystemInfo();
        const freedMb = data.freed_ram_mb || data.freed_mb || 0;
        const msg = freedMb > 0
          ? `⚡ SREDA Boost: Активен! Освобождено ${freedMb} МБ ОЗУ, повышен приоритет CPU.`
          : `⚡ SREDA Boost: Активен! Приоритет CPU повышен, фоновые приложения оптимизированы.`;
        showToast(msg, 'success');
      } catch (e) {
        showToast('Ошибка при активации Boost: ' + e.message, 'error');
        fetchBoostStatus();
      }
    }
  }

  // --- HARDWARE & ENGINE STATUS ---
  async function fetchSystemInfo() {
    try {
      const res = await fetch('/api/system');
      const data = await res.json();
      state.systemInfo = data;

      if (dom.diagCpuGpu) {
        dom.diagCpuGpu.textContent = `${data.gpu_name} • Zen 4 (${data.logical_cores} потоков)`;
      }
      if (dom.diagRam) {
        dom.diagRam.textContent = `${data.available_ram_gb} ГБ свободно из ${data.total_ram_gb} ГБ (${data.memory_load_percent}% задействовано)`;
      }
    } catch (e) {
      console.warn('Failed to fetch system info:', e);
    }
  }

  async function checkEngineStatus() {
    // If active model is an external API model, keep radar green and active
    if (state.isApiModel || (state.activeModelPath && state.activeModelPath.startsWith('api:'))) {
      setEngineIndicator('ready', state.activeModelPath);
      return;
    }
    try {
      const res = await fetch('/api/engine/status');
      const data = await res.json();

      if (data.is_alive) {
        setEngineIndicator('ready', data.active_model);
      } else {
        setEngineIndicator('standby', data.active_model);
      }
    } catch (e) {
      setEngineIndicator('offline', '');
    }
  }

  function setEngineIndicator(status, modelPath) {
    // If API model is active, radar is ALWAYS green and ready without VRAM
    if (state.isApiModel || (state.activeModelPath && state.activeModelPath.startsWith('api:'))) {
      state.isApiModel = true;
      state.isEngineAlive = true;

      if (dom.modelChipIcon) {
        if (state.activeModelPath && state.activeModelPath.startsWith('api:gigachat:')) {
          dom.modelChipIcon.className = '';
          dom.modelChipIcon.innerHTML = '<span style="display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 4px; background: rgba(16, 185, 129, 0.22); border: 1px solid #10B981; font-size: 11.5px; font-weight: 900; color: #10B981; line-height: 1; vertical-align: middle; box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);">G</span>';
        } else {
          dom.modelChipIcon.innerHTML = '';
          dom.modelChipIcon.className = 'fa-solid fa-cloud';
          dom.modelChipIcon.style.color = '#10B981';
        }
      }
      const dict = I18N[state.settings.language || 'ru'] || I18N.ru;
      if (dom.activeModelBadge) {
        dom.activeModelBadge.className = 'badge-model-api';
        dom.activeModelBadge.textContent = dict.badgeCloudApi || 'API / Cloud';
      }

      if (dom.btnToggleEngine) {
        dom.btnToggleEngine.className = 'header-pill-btn header-pill-engine api-ready';
        dom.btnToggleEngine.innerHTML = `<i class="fa-solid fa-cloud" style="color: #10B981;"></i> <span>${dict.apiReady || 'API Ready'}</span>`;
        dom.btnToggleEngine.title = dict.tooltipApiReady || 'Cloud model active';
      }

      if (dom.radarContainer) {
        const core = dom.radarContainer.querySelector('.radar-core');
        const wave = dom.radarContainer.querySelector('.radar-wave');
        if (core) core.style.backgroundColor = 'var(--accent-green)';
        if (wave) {
          wave.style.borderColor = 'var(--accent-green)';
          wave.style.display = 'block';
        }
        dom.radarContainer.title = `Облачная модель активна: ${state.activeModelName} (VRAM свободен)`;
      }
      return;
    }

    state.isApiModel = false;
    state.isEngineAlive = (status === 'ready');

    if (dom.modelChipIcon) {
      dom.modelChipIcon.innerHTML = '';
      dom.modelChipIcon.className = 'fa-solid fa-microchip';
      dom.modelChipIcon.style.color = 'var(--accent-red)';
    }
    const dictLocal = I18N[state.settings.language || 'ru'] || I18N.ru;
    if (dom.activeModelBadge) {
      dom.activeModelBadge.className = 'badge-model-local';
      dom.activeModelBadge.textContent = dictLocal.badgeLocal || 'Локальная';
    }

    if (modelPath) {
      const name = modelPath.split('\\').pop().split('/').pop();
      state.activeModelName = name;
      state.activeModelPath = modelPath;
      if (dom.activeModelName) dom.activeModelName.textContent = name;
    }

    // Update Header Engine Start/Stop Button
    if (dom.btnToggleEngine) {
      if (status === 'ready') {
        dom.btnToggleEngine.className = 'header-pill-btn header-pill-engine running';
        dom.btnToggleEngine.innerHTML = '<i class="fa-solid fa-power-off"></i> <span id="engine-btn-text">Выгрузить</span>';
        dom.btnToggleEngine.title = 'Модель загружена в VRAM. Нажмите, чтобы остановить инференс и освободить память';
      } else if (status === 'starting') {
        dom.btnToggleEngine.className = 'header-pill-btn header-pill-engine loading';
        dom.btnToggleEngine.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span id="engine-btn-text">Запуск...</span>';
        dom.btnToggleEngine.title = 'Инициализация VRAM и запуск llama-server...';
      } else {
        dom.btnToggleEngine.className = 'header-pill-btn header-pill-engine';
        dom.btnToggleEngine.innerHTML = '<i class="fa-solid fa-play"></i> <span id="engine-btn-text">Запустить</span>';
        dom.btnToggleEngine.title = 'Движок выгружен. Нажмите, чтобы запустить модель в VRAM';
      }
    }

    if (!dom.radarContainer) return;
    const core = dom.radarContainer.querySelector('.radar-core');
    const wave = dom.radarContainer.querySelector('.radar-wave');

    if (status === 'ready') {
      if (core) core.style.backgroundColor = 'var(--accent-green)';
      if (wave) {
        wave.style.borderColor = 'var(--accent-green)';
        wave.style.display = 'block';
      }
      dom.radarContainer.title = `Модель готова: ${state.activeModelName}`;
    } else if (status === 'standby') {
      if (core) core.style.backgroundColor = 'var(--accent-yellow)';
      if (wave) wave.style.display = 'none';
      dom.radarContainer.title = 'Движок ожидает запрос (автозапуск при отправке)';
    } else {
      if (core) core.style.backgroundColor = 'var(--accent-red)';
      if (wave) wave.style.display = 'none';
      dom.radarContainer.title = 'Движок остановлен';
    }
  }

  async function toggleEngine() {
    if (state.isApiModel) {
      showToast(`Модель ${state.activeModelName} работает через API (без расхода VRAM). Для смены откройте Каталог.`, 'info');
      openModal('modal-models');
      return;
    }
    if (state.isEngineAlive) {
      showToast('Выгрузка модели и освобождение памяти (RAM/VRAM)...', 'info');
      try {
        await fetch('/api/engine/stop', { method: 'POST' });
        showToast('✓ Модель успешно выгружена из памяти', 'success');
        fetchBoostStatus();
        fetchSystemInfo();
        checkEngineStatus();
        loadInstalledModels();
        loadBonsaiCatalog();
      } catch (e) {
        showToast('Ошибка выгрузки модели: ' + e.message, 'error');
      }
    } else {
      if (!state.activeModelPath) {
        showToast('Выберите модель в каталоге для запуска', 'warning');
        openModal('modal-models');
        return;
      }
      activateModel(state.activeModelPath);
    }
  }

  // --- EXTERNAL CLOUD API PROVIDERS (OPENROUTER, GIGACHAT, CUSTOM) ---
  async function loadProviderConfig() {
    try {
      const res = await fetch('/api/providers/config');
      const cfg = await res.json();
      state.providersConfig = cfg;

      // OpenRouter
      if (dom.checkProviderOpenrouter) dom.checkProviderOpenrouter.checked = !!cfg.openrouter?.enabled;
      if (dom.inputOpenrouterKey) dom.inputOpenrouterKey.value = cfg.openrouter?.api_key || '';
      if (dom.selectOpenrouterModel && cfg.openrouter?.model) dom.selectOpenrouterModel.value = cfg.openrouter.model;

      // GigaChat
      if (dom.checkProviderGigachat) dom.checkProviderGigachat.checked = !!cfg.gigachat?.enabled;
      if (dom.inputGigachatClientId) dom.inputGigachatClientId.value = cfg.gigachat?.client_id || '';
      if (dom.inputGigachatSecret) dom.inputGigachatSecret.value = cfg.gigachat?.client_secret || '';
      if (dom.inputGigachatKey) dom.inputGigachatKey.value = cfg.gigachat?.auth_key || '';
      if (dom.selectGigachatScope && cfg.gigachat?.scope) dom.selectGigachatScope.value = cfg.gigachat.scope;
      if (dom.selectGigachatModel && cfg.gigachat?.model) dom.selectGigachatModel.value = cfg.gigachat.model;

      // Custom
      if (dom.checkProviderCustom) dom.checkProviderCustom.checked = !!cfg.custom?.enabled;
      if (dom.inputCustomName) dom.inputCustomName.value = cfg.custom?.name || 'Пользовательский API';
      if (dom.inputCustomUrl) dom.inputCustomUrl.value = cfg.custom?.base_url || 'https://api.deepseek.com/v1';
      if (dom.inputCustomKey) dom.inputCustomKey.value = cfg.custom?.api_key || '';
      if (dom.inputCustomModel) dom.inputCustomModel.value = cfg.custom?.model || 'deepseek-chat';
    } catch (e) {
      console.warn('Could not load provider config:', e);
    }
  }

  async function saveProviderConfig() {
    const cfg = {
      openrouter: {
        enabled: dom.checkProviderOpenrouter ? dom.checkProviderOpenrouter.checked : false,
        api_key: dom.inputOpenrouterKey ? dom.inputOpenrouterKey.value.trim() : '',
        model: dom.selectOpenrouterModel ? dom.selectOpenrouterModel.value : 'deepseek/deepseek-chat',
        available_models: state.providersConfig?.openrouter?.available_models || []
      },
      gigachat: {
        enabled: dom.checkProviderGigachat ? dom.checkProviderGigachat.checked : false,
        client_id: dom.inputGigachatClientId ? dom.inputGigachatClientId.value.trim() : '',
        client_secret: dom.inputGigachatSecret ? dom.inputGigachatSecret.value.trim() : '',
        auth_key: dom.inputGigachatKey ? dom.inputGigachatKey.value.trim() : '',
        scope: dom.selectGigachatScope ? dom.selectGigachatScope.value : 'GIGACHAT_API_PERS',
        model: dom.selectGigachatModel ? dom.selectGigachatModel.value : 'GigaChat-2-Max',
        available_models: state.providersConfig?.gigachat?.available_models || []
      },
      custom: {
        enabled: dom.checkProviderCustom ? dom.checkProviderCustom.checked : false,
        name: dom.inputCustomName ? dom.inputCustomName.value.trim() : 'Пользовательский API',
        base_url: dom.inputCustomUrl ? dom.inputCustomUrl.value.trim() : 'https://api.deepseek.com/v1',
        api_key: dom.inputCustomKey ? dom.inputCustomKey.value.trim() : '',
        model: dom.inputCustomModel ? dom.inputCustomModel.value.trim() : 'deepseek-chat',
        available_models: state.providersConfig?.custom?.available_models || []
      }
    };

    try {
      const res = await fetch('/api/providers/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg)
      });
      const data = await res.json();
      state.providersConfig = data.config;
      loadApiModels();
      return true;
    } catch (e) {
      console.warn('Could not save provider config:', e);
      return false;
    }
  }

  async function testProvider(provider) {
    showToast(`Проверка подключения к ${provider.toUpperCase()}...`, 'info');
    try {
      let url = `/api/providers/test/${provider}`;
      let body = {};
      if (provider === 'openrouter') {
        body = { api_key: dom.inputOpenrouterKey ? dom.inputOpenrouterKey.value.trim() : '' };
      } else if (provider === 'gigachat') {
        body = {
          client_id: dom.inputGigachatClientId ? dom.inputGigachatClientId.value.trim() : '',
          client_secret: dom.inputGigachatSecret ? dom.inputGigachatSecret.value.trim() : '',
          auth_key: dom.inputGigachatKey ? dom.inputGigachatKey.value.trim() : '',
          scope: dom.selectGigachatScope ? dom.selectGigachatScope.value : 'GIGACHAT_API_PERS'
        };
      } else if (provider === 'custom') {
        body = {
          base_url: dom.inputCustomUrl ? dom.inputCustomUrl.value.trim() : '',
          api_key: dom.inputCustomKey ? dom.inputCustomKey.value.trim() : '',
          model: dom.inputCustomModel ? dom.inputCustomModel.value.trim() : ''
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✓ ${data.message}`, 'success');
        saveProviderConfig();
      } else {
        showToast(`Ошибка: ${data.error}`, 'error');
      }
    } catch (e) {
      showToast(`Сетевая ошибка при проверке: ${e.message}`, 'error');
    }
  }

  async function loadApiModels() {
    try {
      const res = await fetch('/api/providers/models');
      const models = await res.json();
      state.apiModels = models;

      if (dom.apiModelsCount) dom.apiModelsCount.textContent = models.length;
      if (!dom.apiModelsList) return;

      dom.apiModelsList.innerHTML = '';
      const dict = I18N[state.settings.language || 'ru'] || I18N.ru;
      if (models.length === 0) {
        dom.apiModelsList.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
            ${dict.apiModelsEmpty || 'Внешние API-модели пока не активированы.'}<br>
            ${dict.apiModelsEnableHint || 'Включите OpenRouter, Сбер GigaChat или Custom API в'} <a href="#" id="link-goto-providers" style="color: #10B981; text-decoration: underline;">${dict.settings || 'Настройках'}</a>.
          </div>
        `;
        const link = dom.apiModelsList.querySelector('#link-goto-providers');
        if (link) {
          link.onclick = (e) => {
            e.preventDefault();
            closeModal('modal-models');
            openModal('modal-settings');
            switchTab('modal-settings', 'tab-set-providers');
          };
        }
        return;
      }

      models.forEach(m => {
        const isCurrent = (state.activeModelPath === m.id);
        const card = document.createElement('div');
        card.style.padding = '14px 16px';
        card.style.background = 'var(--bg-elevated)';
        card.style.border = isCurrent ? '1px solid var(--accent-green)' : '1px solid var(--border)';
        card.style.borderRadius = '10px';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.style.gap = '14px';

        let providerIcon = '';
        if (m.provider === 'gigachat' || (m.id && m.id.startsWith('api:gigachat:'))) {
          providerIcon = '<span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: rgba(16, 185, 129, 0.16); border: 1.5px solid rgba(16, 185, 129, 0.5); font-size: 15px; font-weight: 900; color: #10B981; line-height: 1; flex-shrink: 0; box-shadow: 0 0 8px rgba(16, 185, 129, 0.3);">G</span>';
        } else if (m.provider === 'openrouter') {
          providerIcon = '<span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: #10B981; flex-shrink: 0;"><i class="fa-solid fa-globe"></i></span>';
        } else {
          providerIcon = '<span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.35); color: #a855f7; flex-shrink: 0;"><i class="fa-solid fa-network-wired"></i></span>';
        }

        card.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; overflow: hidden;">
            ${providerIcon}
            <div style="flex: 1; overflow: hidden;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-weight: 700; font-size: 13.5px; color: #fff;">${escapeHtml(m.name)}</span>
                <span class="badge-model-api"><i class="fa-solid fa-cloud"></i> ${dict.badgeCloudApi || 'API / Облако'}</span>
                ${isCurrent ? `<span style="font-size: 10px; padding: 2px 6px; background: rgba(16, 185, 129, 0.2); color: var(--accent-green); border-radius: 4px; font-weight: bold;">${dict.badgeActive || 'Активна'}</span>` : ''}
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
                ${escapeHtml(m.description)} • <b style="color: #10B981;">${escapeHtml(m.provider_title)}</b>
              </div>
            </div>
          </div>
          <div style="flex-shrink: 0;">
            <button class="${isCurrent ? 'sreda-btn-secondary' : 'sreda-btn-primary'} btn-select-api-model" style="padding: 8px 16px; font-size: 12px;">
              ${isCurrent ? `<i class="fa-solid fa-check"></i> ${dict.btnModelSelected || 'Выбрана'}` : `<i class="fa-solid fa-play"></i> ${dict.btnSelectModel || 'Выбрать модель'}`}
            </button>
          </div>
        `;

        const btn = card.querySelector('.btn-select-api-model');
        if (btn) {
          btn.onclick = () => activateApiModel(m);
        }

        dom.apiModelsList.appendChild(card);
      });
    } catch (e) {
      console.warn('Could not load API models:', e);
    }
  }

  function activateApiModel(m) {
    state.activeModelPath = m.id;
    state.activeModelName = m.name;
    state.isApiModel = true;

    localStorage.setItem('sreda_active_model_path', m.id);
    localStorage.setItem('sreda_active_model_name', m.name);

    if (dom.activeModelName) dom.activeModelName.textContent = m.name;
    if (dom.modelChipIcon) {
      if ((m.provider === 'gigachat') || (m.id && m.id.startsWith('api:gigachat:'))) {
        dom.modelChipIcon.className = '';
        dom.modelChipIcon.innerHTML = '<span style="display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 4px; background: rgba(16, 185, 129, 0.22); border: 1px solid #10B981; font-size: 11.5px; font-weight: 900; color: #10B981; line-height: 1; vertical-align: middle; box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);">G</span>';
      } else {
        dom.modelChipIcon.innerHTML = '';
        dom.modelChipIcon.className = 'fa-solid fa-cloud';
        dom.modelChipIcon.style.color = '#10B981';
      }
    }
    if (dom.activeModelBadge) {
      dom.activeModelBadge.className = 'badge-model-api';
      const dictAct = I18N[state.settings.language || 'ru'] || I18N.ru;
      dom.activeModelBadge.textContent = dictAct.badgeCloudApi || 'API / Cloud';
    }

    // Instantly set Radar GREEN and active
    setEngineIndicator('ready', m.id);

    showToast(`✓ Выбрана облачная модель: ${m.name}! Готова к генерации.`, 'success');
    closeModal('modal-models');
    loadApiModels();
    loadInstalledModels();
  }

  // --- MODELS MODAL ---
  async function loadBonsaiCatalog() {
    if (!dom.bonsaiList) return;
    const dict = I18N[state.settings.language || 'ru'] || I18N.ru;

    try {
      let catalog = state.bonsaiCatalog;
      if (!catalog) {
        dom.bonsaiList.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;"><i class="fa-solid fa-spinner fa-spin"></i> ' + (dict.loadingBonsai || 'Загрузка линейки Bonsai 2...') + '</div>';
        const res = await fetch('/api/models/bonsai');
        catalog = await res.json();
        state.bonsaiCatalog = catalog;
      }

      dom.bonsaiList.innerHTML = '';
      catalog.forEach(item => {
        const card = document.createElement('div');
        card.style.padding = '14px 16px';
        card.style.background = 'var(--bg-elevated)';
        card.style.border = item.is_active ? '1px solid var(--accent-green)' : '1px solid var(--border)';
        card.style.borderRadius = '10px';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.style.gap = '14px';

        const info = document.createElement('div');
        info.style.flex = '1';

        const titleRow = document.createElement('div');
        titleRow.style.display = 'flex';
        titleRow.style.alignItems = 'center';
        titleRow.style.gap = '8px';
        titleRow.style.marginBottom = '4px';

        titleRow.innerHTML = `
          <span style="font-weight: 700; font-size: 14px; color: #fff;">${escapeHtml(item.name)}</span>
          <span class="badge-model-local"><i class="fa-solid fa-microchip"></i> ${dict.badgeLocal || 'Локальная'}</span>
          <span style="padding: 2px 6px; background: rgba(239, 68, 68, 0.15); border: 1px solid var(--accent-red); border-radius: 4px; font-size: 10px; color: var(--accent-red); font-weight: 600;">${item.quantization}</span>
          ${item.recommended ? `<span style="padding: 2px 6px; background: rgba(16, 185, 129, 0.15); border: 1px solid var(--accent-green); border-radius: 4px; font-size: 10px; color: var(--accent-green); font-weight: 600;">⭐ ${dict.badgeRecommended || 'Рекомендовано'}</span>` : ''}
        `;

        const desc = document.createElement('div');
        desc.style.fontSize = '12px';
        desc.style.color = 'var(--text-secondary)';
        desc.style.marginBottom = '6px';
        desc.textContent = (dict.bonsaiDesc && dict.bonsaiDesc[item.id]) ? dict.bonsaiDesc[item.id] : item.description;

        const speedText = (item.speed || '').replace('т/с', dict.unitTokensSec || 'т/с');
        const meta = document.createElement('div');
        meta.style.fontSize = '11px';
        meta.style.color = 'var(--text-muted)';
        meta.innerHTML = `${dict.labelSize || 'Размер:'} <b style="color: #fff;">${item.size_text}</b> • ${dict.labelSpeed || 'Скорость инференса:'} <b style="color: var(--accent-green);">${speedText}</b>`;

        info.appendChild(titleRow);
        info.appendChild(desc);
        info.appendChild(meta);

        // Action button
        const safeFnId = item.filename.replace(/[^a-zA-Z0-9_-]/g, '_');
        const isThisDownloading = state.currentDownload &&
                                  state.currentDownload.status === 'downloading' &&
                                  state.currentDownload.filename === item.filename;

        const actionCol = document.createElement('div');
        actionCol.id = `action-col-${safeFnId}`;

        if (isThisDownloading) {
          const p = state.currentDownload;
          actionCol.innerHTML = `
            <div style="min-width: 180px; text-align: right;">
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; margin-bottom: 4px; gap: 8px;">
                <span style="color: var(--accent-red); font-weight: 700;" class="card-dl-pct"><i class="fa-solid fa-spinner fa-spin"></i> ${p.progress_percent}%</span>
                <span style="color: var(--text-muted); font-size: 10px;" class="card-dl-spd">${p.speed_mb_s} МБ/с</span>
              </div>
              <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.12); border-radius: 3px; overflow: hidden; margin-bottom: 4px;">
                <div class="card-dl-bar" style="width: ${p.progress_percent}%; height: 100%; background: linear-gradient(90deg, #ef4444, #f97316); border-radius: 3px; transition: width 0.2s;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted);">
                <span class="card-dl-mb">${p.downloaded_mb} / ${p.total_mb} МБ</span>
                <button class="card-dl-cancel" style="background: none; border: none; color: var(--accent-red); font-size: 10px; cursor: pointer; text-decoration: underline; padding: 0;">Отмена</button>
              </div>
            </div>
          `;
          const cancelBtn = actionCol.querySelector('.card-dl-cancel');
          if (cancelBtn) cancelBtn.onclick = (e) => { e.stopPropagation(); cancelDownload(); };
        } else if (item.is_active) {
          actionCol.innerHTML = `
            <div style="padding: 6px 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid var(--accent-green); color: var(--accent-green); border-radius: 6px; font-size: 11px; font-weight: bold; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-check"></i> ${dict.badgeActive || 'Активна'}
            </div>
          `;
        } else if (item.is_downloaded) {
          const actBtn = document.createElement('button');
          actBtn.className = 'sreda-btn-primary';
          actBtn.style.padding = '8px 14px';
          actBtn.style.fontSize = '12px';
          actBtn.innerHTML = `<i class="fa-solid fa-play"></i> ${dict.btnActivate || 'Запустить в движок'}`;
          actBtn.onclick = () => activateModel(item.local_path);
          actionCol.appendChild(actBtn);
        } else {
          const dlBtn = document.createElement('button');
          dlBtn.className = 'sreda-btn-secondary';
          dlBtn.style.padding = '8px 14px';
          dlBtn.style.fontSize = '12px';
          if (state.currentDownload && state.currentDownload.status === 'downloading') {
            dlBtn.style.opacity = '0.5';
            dlBtn.title = dict.downloadInProgress || 'Другая модель сейчас скачивается';
          }
          dlBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> ${dict.btnDownload || 'Скачать'} (${item.size_text})`;
          dlBtn.onclick = () => downloadModel(item.download_url, item.filename);
          actionCol.appendChild(dlBtn);
        }

        card.appendChild(info);
        card.appendChild(actionCol);
        dom.bonsaiList.appendChild(card);
      });
    } catch (e) {
      dom.bonsaiList.innerHTML = `<div style="color: var(--accent-red); font-size: 13px;">Ошибка загрузки каталога: ${e.message}</div>`;
    }
  }

  async function loadInstalledModels() {
    if (!dom.installedModelsList) return;
    try {
      const res = await fetch('/api/models/local');
      const models = await res.json();

      if (dom.installedCount) dom.installedCount.textContent = models.length;
      dom.installedModelsList.innerHTML = '';

      if (models.length === 0) {
        dom.installedModelsList.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
            В папках моделей пока нет файлов .gguf.<br>
            Скачайте тернарную модель из вкладки <b>«Линейка Bonsai 2»</b> или найдите на <b>Hugging Face</b>.
          </div>
        `;
        return;
      }

      models.forEach(m => {
        const item = document.createElement('div');
        item.style.padding = '12px 14px';
        item.style.background = 'var(--bg-elevated)';
        item.style.border = (m.path === state.activeModelPath) ? '1px solid var(--accent-green)' : '1px solid var(--border)';
        item.style.borderRadius = '8px';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';

        const isCurrent = (m.path === state.activeModelPath);

        const dictInst = I18N[state.settings.language || 'ru'] || I18N.ru;
        item.innerHTML = `
          <div style="flex: 1; overflow: hidden; margin-right: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
              <span style="font-weight: 600; font-size: 13px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(m.name)}</span>
              <span class="badge-model-local"><i class="fa-solid fa-microchip"></i> ${dictInst.badgeLocal || 'Локальная'}</span>
              ${m.name.includes('27B') ? `<span style="font-size: 10px; padding: 1px 6px; background: rgba(239, 68, 68, 0.2); color: var(--accent-red); border-radius: 4px; font-weight: bold;">${dictInst.badgeFlagship27b || 'Флагман 27B'}</span>` : ''}
              ${isCurrent ? `<span style="font-size: 10px; padding: 1px 6px; background: rgba(16, 185, 129, 0.2); color: var(--accent-green); border-radius: 4px; font-weight: bold;">${dictInst.badgeActive || 'Активна'}</span>` : ''}
            </div>
            <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(m.path)} • <b style="color: var(--text-secondary);">${m.size_gb} GB</b>
            </div>
          </div>
        `;

        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.alignItems = 'center';
        actionsDiv.style.gap = '8px';
        actionsDiv.style.flexShrink = '0';

        const actBtn = document.createElement('button');
        actBtn.className = isCurrent ? 'sreda-btn-secondary' : 'sreda-btn-primary';
        actBtn.style.padding = '6px 14px';
        actBtn.style.fontSize = '11.5px';
        actBtn.style.whiteSpace = 'nowrap';
        const dictActB = I18N[state.settings.language || 'ru'] || I18N.ru;
        actBtn.innerHTML = isCurrent ? `<i class="fa-solid fa-check"></i> ${dictActB.btnModelSelected || 'Выбрана'}` : `<i class="fa-solid fa-bolt"></i> ${dictActB.btnActivate || 'Активировать'}`;
        actBtn.onclick = () => activateModel(m.path);

        const delBtn = document.createElement('button');
        delBtn.className = 'model-btn-delete';
        delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Удалить';
        delBtn.title = `Удалить файл модели (${m.size_gb} ГБ) с диска`;
        delBtn.onclick = (e) => {
          e.stopPropagation();
          deleteInstalledModel(m);
        };

        actionsDiv.appendChild(actBtn);
        actionsDiv.appendChild(delBtn);
        item.appendChild(actionsDiv);
        dom.installedModelsList.appendChild(item);
      });

      // Default active model if none set
      if (!state.activeModelPath && models.length > 0) {
        const preferred = models.find(m => m.name.toLowerCase().includes('27b')) || models[0];
        state.activeModelPath = preferred.path;
        state.activeModelName = preferred.name;
        if (dom.activeModelName) dom.activeModelName.textContent = preferred.name;
      }
    } catch (e) {
      console.warn('Failed to load local models:', e);
    }
  }

  async function deleteInstalledModel(m) {
    const isCurrent = (m.path === state.activeModelPath);
    const warning = isCurrent ? '\nВнимание: эта модель сейчас активна. Инференс будет выгружен из памяти.' : '';
    const confirmed = window.confirm(`Вы действительно хотите удалить модель:\n\n"${m.name}" (${m.size_gb} ГБ)?${warning}\n\nФайл будет удален с диска безвозвратно.`);
    if (!confirmed) return;

    showToast(`Удаление модели ${m.name}...`, 'info');
    try {
      const res = await fetch('/api/models/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_path: m.path })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✓ Модель ${m.name} успешно удалена с диска`, 'success');
        if (isCurrent) {
          state.activeModelPath = '';
          state.activeModelName = 'Модель не выбрана';
          if (dom.activeModelName) dom.activeModelName.textContent = 'Модель не выбрана';
          setEngineIndicator('offline', '');
        }
        await loadInstalledModels();
        await loadBonsaiCatalog();
      } else {
        showToast('Ошибка удаления: ' + (data.error || 'неизвестно'), 'error');
      }
    } catch (e) {
      showToast('Ошибка связи с сервером при удалении модели', 'error');
    }
  }

  async function activateModel(path) {
    state.isApiModel = false;
    if (dom.modelChipIcon) {
      dom.modelChipIcon.innerHTML = '';
      dom.modelChipIcon.className = 'fa-solid fa-microchip';
      dom.modelChipIcon.style.color = 'var(--accent-red)';
    }
    showToast(`Запуск модели в llama-server (Radeon 780M Vulkan)...`, 'info');
    try {
      const res = await fetch('/api/engine/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_path: path,
          gpu_layers: state.settings.gpuLayers,
          threads: state.settings.threads,
          context: state.settings.context,
          flash_attention: state.settings.flashAttention
        })
      });
      const data = await res.json();
      if (data.success) {
        state.activeModelPath = path;
        state.activeModelName = path.split('\\').pop().split('/').pop();
        if (dom.activeModelName) dom.activeModelName.textContent = state.activeModelName;
        setEngineIndicator('ready', path);
        let boostMsg = '';
        if (data.boost && data.boost.success) {
          if (state.boost) {
            state.boost.is_boost_active = true;
            state.boost.is_boosted = true;
          }
          const freed = data.boost.freed_ram_mb || data.boost.freed_mb || (data.boost.compact_ram && data.boost.compact_ram.freed_mb) || 0;
          if (freed > 0) {
            boostMsg = ` | ⚡ Boost: освобождено ${freed} МБ ОЗУ!`;
          }
        }
        showToast(`✓ Модель ${state.activeModelName} активирована!${boostMsg}`, 'success');
        fetchBoostStatus();
        fetchSystemInfo();
        closeModal('modal-models');
        loadInstalledModels();
        loadBonsaiCatalog();
      } else {
        showToast(`Ошибка запуска модели: ${data.message}`, 'error');
      }
    } catch (e) {
      showToast(`Сетевая ошибка: ${e.message}`, 'error');
    }
  }

  // --- HUGGING FACE SEARCH & DOWNLOAD ---
  async function searchHuggingFace() {
    if (!dom.hfSearchInput || !dom.hfResultsList) return;
    const q = dom.hfSearchInput.value.trim() || 'gguf';

    dom.hfResultsList.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;"><i class="fa-solid fa-spinner fa-spin"></i> Поиск репозиториев на Hugging Face...</div>';

    try {
      const res = await fetch(`/api/models/hf/search?q=${encodeURIComponent(q)}`);
      const models = await res.json();

      dom.hfResultsList.innerHTML = '';
      if (models.length === 0) {
        dom.hfResultsList.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">Репозиториев не найдено.</div>';
        return;
      }

      models.forEach(m => {
        const card = document.createElement('div');
        card.style.padding = '12px 14px';
        card.style.background = 'var(--bg-elevated)';
        card.style.border = '1px solid var(--border)';
        card.style.borderRadius = '8px';

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="font-weight: 700; font-size: 13.5px; color: #fff;">${escapeHtml(m.id)}</div>
            <div style="font-size: 11px; color: var(--text-muted); display: flex; gap: 10px;">
              <span><i class="fa-solid fa-download"></i> ${m.downloads}</span>
              <span><i class="fa-solid fa-heart" style="color: var(--accent-red)"></i> ${m.likes}</span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(m.pipeline_tag || 'text-generation')}</span>
            <button class="sreda-btn-secondary btn-inspect-hf" style="padding: 4px 10px; font-size: 11px;" data-repo="${escapeHtml(m.id)}">
              <i class="fa-solid fa-list-check"></i> Показать GGUF файлы
            </button>
          </div>
          <div class="repo-files-container" style="display: none; margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px;"></div>
        `;

        const inspectBtn = card.querySelector('.btn-inspect-hf');
        const filesContainer = card.querySelector('.repo-files-container');

        inspectBtn.onclick = () => inspectRepoFiles(m.id, filesContainer, inspectBtn);
        dom.hfResultsList.appendChild(card);
      });
    } catch (e) {
      dom.hfResultsList.innerHTML = `<div style="color: var(--accent-red); font-size: 13px;">Ошибка поиска: ${e.message}</div>`;
    }
  }

  async function inspectRepoFiles(repoId, container, btn) {
    if (container.style.display === 'block') {
      container.style.display = 'none';
      btn.innerHTML = `<i class="fa-solid fa-list-check"></i> Показать GGUF файлы`;
      return;
    }

    container.style.display = 'block';
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 11.5px;"><i class="fa-solid fa-spinner fa-spin"></i> Получение списка файлов квантования...</div>';
    btn.innerHTML = `<i class="fa-solid fa-chevron-up"></i> Скрыть файлы`;

    try {
      const res = await fetch(`/api/models/hf/repo_files?repo_id=${encodeURIComponent(repoId)}`);
      const files = await res.json();

      container.innerHTML = '';
      if (files.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 11px;">В репозитории нет прямых файлов .gguf</div>';
        return;
      }

      files.forEach(f => {
        const fileRow = document.createElement('div');
        fileRow.style.padding = '6px 8px';
        fileRow.style.display = 'flex';
        fileRow.style.alignItems = 'center';
        fileRow.style.justifyContent = 'space-between';
        fileRow.style.fontSize = '12px';
        fileRow.style.borderBottom = '1px solid var(--border)';

        const dict = I18N[state.settings.language || 'ru'] || I18N.ru;
        const displaySize = f.size_text || (f.size_gb ? (f.size_gb + ' ГБ') : (f.size_bytes ? ((f.size_bytes / (1024*1024*1024)).toFixed(2) + ' ГБ') : ''));
        const isRecommended = (f.compatibility === 'recommended') || (f.is_compatible === true && f.compatibility !== 'warning' && f.compatibility !== 'not_recommended');
        const isWarning = (f.compatibility === 'warning');

        let compatBadge = '';
        if (isRecommended) {
          compatBadge = `<span style="font-size: 10px; padding: 2px 6px; background: rgba(16, 185, 129, 0.15); border: 1px solid var(--accent-green); color: var(--accent-green); border-radius: 4px; font-weight: bold;">✓ ${dict.badgeCompatible || 'Совместимо'} (${displaySize})</span>`;
        } else if (isWarning) {
          compatBadge = `<span style="font-size: 10px; padding: 2px 6px; background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; color: #f59e0b; border-radius: 4px; font-weight: bold;">⚠ ${dict.badgeHighLoad || 'Высокая нагрузка'} (${displaySize})</span>`;
        } else {
          compatBadge = `<span style="font-size: 10px; padding: 2px 6px; background: rgba(239, 68, 68, 0.15); border: 1px solid var(--accent-red); color: var(--accent-red); border-radius: 4px; font-weight: bold;">⚠ ${dict.badgeExceedsRam || 'Превышает RAM'} (${displaySize})</span>`;
        }

        fileRow.innerHTML = `
          <div style="flex: 1; overflow: hidden; margin-right: 10px;">
            <div style="color: #fff; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(f.filename)}</div>
            <div style="margin-top: 2px;">${compatBadge}</div>
          </div>
        `;

        const dlBtn = document.createElement('button');
        dlBtn.className = 'sreda-btn-primary';
        dlBtn.style.padding = '5px 12px';
        dlBtn.style.fontSize = '11px';
        dlBtn.style.flexShrink = '0';
        dlBtn.style.whiteSpace = 'nowrap';
        dlBtn.innerHTML = `<i class="fa-solid fa-download"></i> Скачать`;
        dlBtn.onclick = () => downloadModel(f.download_url, f.filename);

        fileRow.appendChild(dlBtn);
        container.appendChild(fileRow);
      });
    } catch (e) {
      container.innerHTML = `<div style="color: var(--accent-red); font-size: 11px;">Ошибка: ${e.message}</div>`;
    }
  }

  async function downloadModel(url, filename) {
    try {
      state.currentDownload = {
        status: 'downloading',
        filename: filename,
        progress_percent: 0.1,
        downloaded_mb: 0.0,
        total_mb: 0.0,
        speed_mb_s: 0.0
      };

      if (dom.modalDlBanner) dom.modalDlBanner.style.display = 'block';
      if (dom.dlProgressBar) dom.dlProgressBar.style.width = '1%';
      if (dom.dlStatusText) dom.dlStatusText.textContent = `Подключение к Hugging Face: ${filename}...`;
      if (dom.headerDlPill) dom.headerDlPill.style.display = 'inline-flex';
      if (dom.headerDlText) dom.headerDlText.textContent = `0.1%`;

      startDownloadProgressPolling();
      loadBonsaiCatalog();

      const res = await fetch('/api/models/hf/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, filename })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Начато скачивание ${filename}`, 'info');
      } else {
        showToast('Скачивание уже запущено для другого файла', 'warning');
      }
    } catch (e) {
      showToast('Ошибка запуска скачивания: ' + e.message, 'error');
      state.currentDownload = null;
      if (dom.modalDlBanner) dom.modalDlBanner.style.display = 'none';
      if (dom.headerDlPill) dom.headerDlPill.style.display = 'none';
      loadBonsaiCatalog();
    }
  }

  function startDownloadProgressPolling() {
    if (state.downloadPollInterval) clearInterval(state.downloadPollInterval);
    if (dom.modalDlBanner) dom.modalDlBanner.style.display = 'block';
    if (dom.headerDlPill) dom.headerDlPill.style.display = 'inline-flex';

    state.downloadPollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/models/hf/download_progress');
        const p = await res.json();

        if (p.status === 'downloading') {
          state.currentDownload = p;
          if (dom.modalDlBanner) dom.modalDlBanner.style.display = 'block';
          if (dom.dlProgressBar) dom.dlProgressBar.style.width = `${p.progress_percent}%`;
          if (dom.dlStatusText) {
            dom.dlStatusText.textContent = `Скачивание ${p.filename}: ${p.progress_percent}% (${p.downloaded_mb} / ${p.total_mb} МБ, ${p.speed_mb_s} МБ/с)`;
          }

          if (dom.headerDlPill) dom.headerDlPill.style.display = 'inline-flex';
          if (dom.headerDlText) {
            dom.headerDlText.textContent = `${p.progress_percent}% (${p.speed_mb_s} МБ/с)`;
          }

          // Dynamically update corresponding Bonsai 2 card
          const safeFnId = p.filename.replace(/[^a-zA-Z0-9_-]/g, '_');
          const col = document.getElementById(`action-col-${safeFnId}`);
          if (col) {
            const bar = col.querySelector('.card-dl-bar');
            const pct = col.querySelector('.card-dl-pct');
            const spd = col.querySelector('.card-dl-spd');
            const mb = col.querySelector('.card-dl-mb');
            if (bar) bar.style.width = `${p.progress_percent}%`;
            if (pct) pct.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${p.progress_percent}%`;
            if (spd) spd.textContent = `${p.speed_mb_s} МБ/с`;
            if (mb) mb.textContent = `${p.downloaded_mb} / ${p.total_mb} МБ`;
          } else {
            loadBonsaiCatalog();
          }
        } else if (p.status === 'completed') {
          clearInterval(state.downloadPollInterval);
          state.currentDownload = null;
          if (dom.modalDlBanner) dom.modalDlBanner.style.display = 'none';
          if (dom.headerDlPill) dom.headerDlPill.style.display = 'none';
          showToast(`✓ Модель ${p.filename} успешно скачана!`, 'success');
          loadInstalledModels();
          loadBonsaiCatalog();
        } else if (p.status === 'cancelled' || p.status === 'error') {
          clearInterval(state.downloadPollInterval);
          state.currentDownload = null;
          if (dom.modalDlBanner) dom.modalDlBanner.style.display = 'none';
          if (dom.headerDlPill) dom.headerDlPill.style.display = 'none';
          if (p.status === 'error') showToast(`Ошибка скачивания: ${p.error}`, 'error');
          else showToast('Скачивание отменено', 'info');
          loadBonsaiCatalog();
        } else {
          // idle
          if (!state.currentDownload || state.currentDownload.status !== 'downloading') {
            clearInterval(state.downloadPollInterval);
            state.currentDownload = null;
            if (dom.modalDlBanner) dom.modalDlBanner.style.display = 'none';
            if (dom.headerDlPill) dom.headerDlPill.style.display = 'none';
          }
        }
      } catch (e) {
        // network polling error
      }
    }, 500);
  }

  async function cancelDownload() {
    try {
      await fetch('/api/models/hf/cancel_download', { method: 'POST' });
      clearInterval(state.downloadPollInterval);
      state.currentDownload = null;
      if (dom.modalDlBanner) dom.modalDlBanner.style.display = 'none';
      if (dom.headerDlPill) dom.headerDlPill.style.display = 'none';
      showToast('Скачивание отменено', 'info');
      loadBonsaiCatalog();
    } catch (e) {
      console.warn(e);
    }
  }

  // --- SETTINGS & OPTIMIZATION ---
  function applyOptimizationPreset() {
    state.settings.gpuLayers = 99;
    state.settings.threads = 8;
    state.settings.context = 8192;
    state.settings.flashAttention = true;
    saveSettings();
    applySettingsToUI();

    showToast('✓ Все параметры оптимизированы для AMD Radeon 780M (Vulkan) + Zen 4!', 'success');

    // If engine is running, restart with new optimized settings
    if (state.activeModelPath) {
      activateModel(state.activeModelPath);
    }
  }

  function saveSettingsFromUI() {
    if (dom.inputGpuLayers) state.settings.gpuLayers = parseInt(dom.inputGpuLayers.value, 10);
    if (dom.inputThreads) state.settings.threads = parseInt(dom.inputThreads.value, 10);
    if (dom.selectContext) state.settings.context = parseInt(dom.selectContext.value, 10);
    if (dom.checkFa) state.settings.flashAttention = dom.checkFa.checked;
    if (dom.checkLocalServer) state.settings.localServer = dom.checkLocalServer.checked;
    if (dom.inputServerPort) state.settings.serverPort = parseInt(dom.inputServerPort.value, 10) || 1234;
    if (dom.selectLang) state.settings.language = dom.selectLang.value;
    if (dom.checkAutoTts) state.settings.autoTts = dom.checkAutoTts.checked;
    if (dom.selectVoice && dom.selectVoice.value) {
      state.settings.voiceId = dom.selectVoice.value;
      localStorage.setItem('sreda_voice_id', state.settings.voiceId);
    }

    saveSettings();
    saveProviderConfig();
    applyLanguage(state.settings.language);
    const dict = I18N[state.settings.language] || I18N.ru;
    showToast(dict.saveSuccess || '✓ Настройки успешно сохранены', 'success');
    closeModal('modal-settings');

    if (state.activeModelPath && state.isEngineAlive) {
      activateModel(state.activeModelPath);
    }
  }

  // --- MODAL CONTROLS ---
  function openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) {
      m.classList.add('open');
      if (modalId === 'modal-models') {
        loadBonsaiCatalog();
        loadInstalledModels();
      } else if (modalId === 'modal-settings') {
        fetchSystemInfo();
        applySettingsToUI();
        loadVoiceCatalog();
      } else if (modalId === 'modal-feeds') {
        loadFeedsConfig();
      }
    }
  }

  function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('open');
  }

  // --- USER PROFILE & SKILLS EVENT BINDINGS ---
  function setupProfileAndSkills() {
    // Open Profile Modal on Card Click
    if (dom.userProfileCard) {
      dom.userProfileCard.onclick = () => {
        applyProfileToUI();
        openModal('modal-profile');
      };
    }

    // Avatar Upload File Handling
    if (dom.profileAvatarInput) {
      dom.profileAvatarInput.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (dom.profilePreviewAvatar) dom.profilePreviewAvatar.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      };
    }

    // Reset Avatar to Default
    if (dom.btnResetAvatar) {
      dom.btnResetAvatar.onclick = () => {
        if (dom.profilePreviewAvatar) dom.profilePreviewAvatar.src = '/static/assets/icons/user_avatar.png';
      };
    }

    // Save Profile
    if (dom.btnSaveProfile) {
      dom.btnSaveProfile.onclick = () => {
        state.profile.firstName = dom.inputProfileFirstName ? dom.inputProfileFirstName.value.trim() : '';
        state.profile.lastName = dom.inputProfileLastName ? dom.inputProfileLastName.value.trim() : '';
        state.profile.about = dom.inputProfileAbout ? dom.inputProfileAbout.value.trim() : '';
        state.profile.avatarUrl = dom.profilePreviewAvatar ? dom.profilePreviewAvatar.src : '/static/assets/icons/user_avatar.png';

        saveProfile();
        closeModal('modal-profile');
        showToast('✓ Профиль сохранен. Модель адаптирована под ваши данные!', 'success');
      };
    }


    // Open Feeds (API / RSS) Modal
    if (dom.btnOpenFeeds) {
      dom.btnOpenFeeds.onclick = () => {
        loadFeedsConfig();
        openModal('modal-feeds');
      };
    }

    // Feeds 3-Tab Switching (Base APIs, News & RSS, Custom User APIs)
    function switchFeedsTab(targetBtn) {
      const tabs = [
        { btn: dom.tabFeedsApis, view: dom.feedsViewApis },
        { btn: dom.tabFeedsRss, view: dom.feedsViewRss },
        { btn: dom.tabFeedsCustom, view: dom.feedsViewCustom }
      ];
      tabs.forEach(t => {
        if (!t.btn) return;
        if (t.btn === targetBtn) {
          t.btn.classList.add('active');
          t.btn.style.borderBottom = '2px solid var(--accent-red)';
          if (t.view) t.view.style.display = 'block';
        } else {
          t.btn.classList.remove('active');
          t.btn.style.borderBottom = 'none';
          if (t.view) t.view.style.display = 'none';
        }
      });
    }

    if (dom.tabFeedsApis) dom.tabFeedsApis.onclick = () => switchFeedsTab(dom.tabFeedsApis);
    if (dom.tabFeedsRss) dom.tabFeedsRss.onclick = () => switchFeedsTab(dom.tabFeedsRss);
    if (dom.tabFeedsCustom) dom.tabFeedsCustom.onclick = () => switchFeedsTab(dom.tabFeedsCustom);

    // Toggle Add RSS Form
    if (dom.btnToggleAddRss) {
      dom.btnToggleAddRss.onclick = () => {
        if (!dom.addRssForm) return;
        const isHidden = dom.addRssForm.style.display === 'none' || !dom.addRssForm.style.display;
        dom.addRssForm.style.display = isHidden ? 'block' : 'none';
      };
    }

    if (dom.btnCancelRss) {
      dom.btnCancelRss.onclick = () => {
        if (dom.addRssForm) dom.addRssForm.style.display = 'none';
      };
    }

    // Save New RSS Feed
    if (dom.btnSaveRss) {
      dom.btnSaveRss.onclick = async () => {
        const name = dom.inputRssName ? dom.inputRssName.value.trim() : '';
        const url = dom.inputRssUrl ? dom.inputRssUrl.value.trim() : '';
        const category = dom.inputRssCategory ? dom.inputRssCategory.value.trim() : 'custom';

        if (!name || !url) {
          showToast('Укажите название и URL потока RSS', 'warning');
          return;
        }

        dom.btnSaveRss.disabled = true;
        dom.btnSaveRss.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Проверка...`;

        try {
          const testRes = await fetch('/api/feeds/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'rss', query: url })
          });
          const testData = await testRes.json();

          if (!testData.success) {
            showToast(`Ошибка проверки RSS: ${testData.error}`, 'warning');
            dom.btnSaveRss.disabled = false;
            dom.btnSaveRss.innerHTML = `<i class="fa-solid fa-check"></i> Сохранить и проверить`;
            return;
          }

          if (!state.feedsConfig) state.feedsConfig = { custom_rss: [] };
          if (!state.feedsConfig.custom_rss) state.feedsConfig.custom_rss = [];

          state.feedsConfig.custom_rss.push({
            id: 'rss_' + Date.now(),
            name,
            url,
            category: category || 'rss',
            enabled: true
          });

          await saveFeedsConfig();
          renderNewsAndRss();

          if (dom.addRssForm) dom.addRssForm.style.display = 'none';
          if (dom.inputRssName) dom.inputRssName.value = '';
          if (dom.inputRssUrl) dom.inputRssUrl.value = '';

          showToast(`✓ RSS-канал "${name}" успешно подключен (${testData.count || 0} записей)!`, 'success');
        } catch (e) {
          showToast(`Ошибка: ${e.message}`, 'error');
        } finally {
          dom.btnSaveRss.disabled = false;
          dom.btnSaveRss.innerHTML = `<i class="fa-solid fa-check"></i> Сохранить и проверить`;
        }
      };
    }
    // Toggle Add Custom API Form
    if (dom.btnToggleAddCustomApi) {
      dom.btnToggleAddCustomApi.onclick = () => {
        if (!dom.addCustomApiForm) return;
        const isHidden = dom.addCustomApiForm.style.display === 'none' || !dom.addCustomApiForm.style.display;
        dom.addCustomApiForm.style.display = isHidden ? 'block' : 'none';
      };
    }

    if (dom.btnCancelCustomApi) {
      dom.btnCancelCustomApi.onclick = () => {
        if (dom.addCustomApiForm) dom.addCustomApiForm.style.display = 'none';
      };
    }

    // Save New Custom API
    if (dom.btnSaveCustomApi) {
      dom.btnSaveCustomApi.onclick = async () => {
        const name = dom.inputApiName ? dom.inputApiName.value.trim() : '';
        const url = dom.inputApiUrl ? dom.inputApiUrl.value.trim() : '';
        const category = dom.selectApiCategory ? dom.selectApiCategory.value : 'custom';
        const method = dom.selectApiMethod ? dom.selectApiMethod.value : 'GET';
        const auth_type = dom.selectApiAuthType ? dom.selectApiAuthType.value : 'param';
        const key = dom.inputApiKey ? dom.inputApiKey.value.trim() : '';
        const description = dom.inputApiDesc ? dom.inputApiDesc.value.trim() : '';

        if (!name || !url) {
          showToast('Укажите название и URL эндпоинта API', 'warning');
          return;
        }

        const newApi = {
          id: 'api_' + Date.now(),
          name,
          url,
          category,
          method,
          auth_type,
          key,
          description: description || `Пользовательский API ${name}`,
          enabled: true
        };

        dom.btnSaveCustomApi.disabled = true;
        dom.btnSaveCustomApi.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Проверка...`;

        try {
          const testRes = await fetch('/api/feeds/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'custom', query: 'test', api_config: newApi })
          });
          const testData = await testRes.json();

          if (!testData.success) {
            const proceed = confirm(`Предупреждение при проверке API:\n${testData.error}\n\nВсё равно сохранить этот API?`);
            if (!proceed) {
              dom.btnSaveCustomApi.disabled = false;
              dom.btnSaveCustomApi.innerHTML = `<i class="fa-solid fa-check"></i> Сохранить и проверить`;
              return;
            }
          }

          if (!state.feedsConfig) state.feedsConfig = {};
          if (!state.feedsConfig.custom_apis) state.feedsConfig.custom_apis = [];

          state.feedsConfig.custom_apis.push(newApi);
          await saveFeedsConfig();
          renderCustomApis();

          if (dom.addCustomApiForm) dom.addCustomApiForm.style.display = 'none';
          if (dom.inputApiName) dom.inputApiName.value = '';
          if (dom.inputApiUrl) dom.inputApiUrl.value = '';
          if (dom.inputApiKey) dom.inputApiKey.value = '';
          if (dom.inputApiDesc) dom.inputApiDesc.value = '';

          showToast(`✓ API "${name}" успешно подключен!`, 'success');
        } catch (e) {
          showToast(`Ошибка: ${e.message}`, 'error');
        } finally {
          dom.btnSaveCustomApi.disabled = false;
          dom.btnSaveCustomApi.innerHTML = `<i class="fa-solid fa-check"></i> Сохранить и проверить`;
        }
      };
    }


    // Open Skills Modal
    if (dom.btnOpenSkills) {
      dom.btnOpenSkills.onclick = () => {
        closeSkillEditor();
        renderSkillsList();
        openModal('modal-skills');
      };
    }
    if (dom.btnNewSkill) dom.btnNewSkill.onclick = () => openSkillEditor(null);
    if (dom.btnBackToSkills) dom.btnBackToSkills.onclick = closeSkillEditor;
    if (dom.btnCancelSkillEdit) dom.btnCancelSkillEdit.onclick = closeSkillEditor;
    if (dom.btnSaveSkill) dom.btnSaveSkill.onclick = saveSkillFromEditor;
  }

  // --- SLASH COMMANDS POPUP & AUTOCOMPLETE ---
  function setupSlashCommands() {
    if (!dom.chatInput || !dom.slashPopup) return;

    dom.chatInput.addEventListener('input', () => {
      const val = dom.chatInput.value;
      if (val.startsWith('/')) {
        const afterSlash = val.slice(1);
        // Only show suggestions before a space
        if (!afterSlash.includes(' ')) {
          const query = afterSlash.toLowerCase();
          state.filteredSkills = state.skills.filter(s =>
            s.trigger.toLowerCase().includes(query) ||
            s.name.toLowerCase().includes(query)
          );
          state.selectedSlashIndex = 0;
          renderSlashPopup();
          return;
        }
      }
      hideSlashPopup();
    });

    dom.chatInput.addEventListener('keydown', (e) => {
      if (dom.slashPopup && dom.slashPopup.style.display !== 'none' && state.filteredSkills.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          state.selectedSlashIndex = (state.selectedSlashIndex + 1) % state.filteredSkills.length;
          renderSlashPopup();
          return;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          state.selectedSlashIndex = (state.selectedSlashIndex - 1 + state.filteredSkills.length) % state.filteredSkills.length;
          renderSlashPopup();
          return;
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const chosen = state.filteredSkills[state.selectedSlashIndex];
          if (chosen) {
            selectSlashSkill(chosen);
          }
          return;
        } else if (e.key === 'Escape') {
          hideSlashPopup();
          return;
        }
      }
    });

    // Close slash popup if clicked outside
    document.addEventListener('click', (e) => {
      if (dom.slashPopup && !dom.slashPopup.contains(e.target) && e.target !== dom.chatInput) {
        hideSlashPopup();
      }
    });
  }

  function renderSlashPopup() {
    if (!dom.slashPopup) return;
    if (state.filteredSkills.length === 0) {
      hideSlashPopup();
      return;
    }

    dom.slashPopup.innerHTML = '';
    state.filteredSkills.forEach((skill, idx) => {
      const item = document.createElement('div');
      item.className = 'slash-item' + (idx === state.selectedSlashIndex ? ' selected' : '');
      item.innerHTML = `
        <span class="skill-trigger-badge">/${escapeHtml(skill.trigger)}</span>
        <div style="flex: 1; overflow: hidden;">
          <div style="font-weight: 600; color: #fff; font-size: 12.5px;">${escapeHtml(skill.name)}</div>
          <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(skill.description)}</div>
        </div>
      `;
      item.onmousedown = (e) => {
        e.preventDefault();
        selectSlashSkill(skill);
      };
      dom.slashPopup.appendChild(item);
    });

    dom.slashPopup.style.display = 'flex';
  }

  function hideSlashPopup() {
    if (dom.slashPopup) dom.slashPopup.style.display = 'none';
  }

  function selectSlashSkill(skill) {
    if (!dom.chatInput) return;
    dom.chatInput.value = `/${skill.trigger} `;
    hideSlashPopup();
    dom.chatInput.focus();
  }

  // --- LM STUDIO STYLE API SERVER TAB ---
  function setupApiServerTab() {
    const btnCopyUrl = document.getElementById('btn-copy-api-url');
    const inputUrl = document.getElementById('api-base-url-input');
    const btnPing = document.getElementById('btn-ping-api');
    const resultDiv = document.getElementById('api-test-result');

    const tabContinue = document.getElementById('tab-code-continue');
    const tabPython = document.getElementById('tab-code-python');
    const tabCurl = document.getElementById('tab-code-curl');
    const codePreview = document.getElementById('api-code-preview');
    const btnCopySnippet = document.getElementById('btn-copy-snippet');

    const snippets = {
      continue: `// Вставьте в .continue/config.json в VS Code:
{
  "models": [
    {
      "title": "SREDA AI Bonsai 2",
      "provider": "openai",
      "model": "sreda-ai",
      "apiBase": "http://127.0.0.1:1234/v1",
      "apiKey": "not-needed"
    }
  ]
}`,
      python: `# Установка: pip install openai
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:1234/v1",
    api_key="not-needed"
)

response = client.chat.completions.create(
    model="sreda-ai",
    messages=[{"role": "user", "content": "Привет, SREDA AI!"}],
    temperature=0.7
)
print(response.choices[0].message.content)`,
      curl: `# Тестовый запрос через командную строку Windows:
curl http://127.0.0.1:1234/v1/chat/completions ^
  -H "Content-Type: application/json" ^
  -d "{\\"model\\": \\"sreda-ai\\", \\"messages\\": [{\\"role\\": \\"user\\", \\"content\\": \\"Привет!\\"}]}"`
    };

    let activeSnippet = 'continue';

    function setSnippet(key) {
      activeSnippet = key;
      if (codePreview) codePreview.textContent = snippets[key];
      [tabContinue, tabPython, tabCurl].forEach(btn => {
        if (btn) btn.classList.remove('active');
      });
      if (key === 'continue' && tabContinue) tabContinue.classList.add('active');
      if (key === 'python' && tabPython) tabPython.classList.add('active');
      if (key === 'curl' && tabCurl) tabCurl.classList.add('active');
    }

    if (codePreview) setSnippet('continue');

    if (tabContinue) tabContinue.onclick = () => setSnippet('continue');
    if (tabPython) tabPython.onclick = () => setSnippet('python');
    if (tabCurl) tabCurl.onclick = () => setSnippet('curl');

    if (btnCopySnippet) {
      btnCopySnippet.onclick = () => {
        navigator.clipboard.writeText(snippets[activeSnippet]).then(() => {
          showToast('✓ Код скопирован в буфер обмена', 'success');
        });
      };
    }

    if (btnCopyUrl && inputUrl) {
      btnCopyUrl.onclick = () => {
        navigator.clipboard.writeText(inputUrl.value.trim()).then(() => {
          showToast('✓ Base URL скопирован: http://127.0.0.1:1234/v1', 'success');
        });
      };
    }

    if (btnPing && resultDiv) {
      btnPing.onclick = async () => {
        btnPing.disabled = true;
        btnPing.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Проверка...';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<span style="color: var(--text-muted)">Отправка запроса к http://127.0.0.1:1234/v1/models...</span>';
        const startT = Date.now();
        try {
          const res = await fetch('http://127.0.0.1:1234/v1/models');
          const elapsed = Date.now() - startT;
          if (res.ok) {
            const data = await res.json();
            const count = (data.data && data.data.length) || 1;
            resultDiv.innerHTML = `<span style="color: var(--accent-green); font-weight: 600;">✓ HTTP 200 OK (${elapsed}мс)</span> • Обнаружено моделей: <b>${count}</b> (порт 1234 готов для VS Code)`;
          } else {
            resultDiv.innerHTML = `<span style="color: var(--accent-red);">⚠ HTTP ${res.status}: ${res.statusText}</span>`;
          }
        } catch (err) {
          try {
            const res2 = await fetch('/v1/models');
            const elapsed2 = Date.now() - startT;
            if (res2.ok) {
              const data2 = await res2.json();
              const count2 = (data2.data && data2.data.length) || 1;
              resultDiv.innerHTML = `<span style="color: var(--accent-green); font-weight: 600;">✓ HTTP 200 OK (${elapsed2}мс)</span> • Обнаружено моделей: <b>${count2}</b> (порт 8000/1234 активен)`;
            } else {
              resultDiv.innerHTML = `<span style="color: var(--accent-red);">⚠ Ошибка: ${err.message}</span>`;
            }
          } catch (e2) {
            resultDiv.innerHTML = `<span style="color: var(--accent-red);">⚠ Ошибка соединения: ${err.message}</span>`;
          }
        } finally {
          btnPing.disabled = false;
          btnPing.innerHTML = '<i class="fa-solid fa-bolt"></i> Тест API';
        }
      };
    }
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Sidebar
    if (dom.btnNewChat) dom.btnNewChat.onclick = createNewChat;
    if (dom.btnOpenModels) dom.btnOpenModels.onclick = () => openModal('modal-models');
    if (dom.btnOpenSettings) dom.btnOpenSettings.onclick = () => openModal('modal-settings');

    // Header
    if (dom.modelSelectorChip) dom.modelSelectorChip.onclick = () => openModal('modal-models');
    if (dom.btnToggleEngine) dom.btnToggleEngine.onclick = toggleEngine;
    if (dom.btnToggleBoost) dom.btnToggleBoost.onclick = toggleBoost;
    if (dom.btnCompactRamNow) dom.btnCompactRamNow.onclick = compactRamNow;
    if (dom.checkAutoBoost) {
      dom.checkAutoBoost.onchange = async () => {
        const val = dom.checkAutoBoost.checked;
        if (state.boost) state.boost.auto_boost_on_launch = val;
        await fetch('/api/boost/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auto_boost_on_launch: val })
        });
        renderBoostStatus();
        showToast(val ? 'SREDA Boost: Авто-режим включен' : 'SREDA Boost: Авто-режим отключен', 'info');
      };
    }
    if (dom.btnHeaderSettings) dom.btnHeaderSettings.onclick = () => openModal('modal-settings');

    if (dom.btnToggleAutoTts) {
      dom.btnToggleAutoTts.onclick = () => {
        state.settings.autoTts = !state.settings.autoTts;
        saveSettings();
        dom.btnToggleAutoTts.classList.toggle('active', !!state.settings.autoTts);
        if (dom.checkAutoTts) dom.checkAutoTts.checked = state.settings.autoTts;
        showToast(state.settings.autoTts ? 'Автоозвучка включена' : 'Автоозвучка выключена', 'info');
      };
    }

    if (dom.checkAutoTts) {
      dom.checkAutoTts.onchange = () => {
        state.settings.autoTts = dom.checkAutoTts.checked;
        saveSettings();
        if (dom.btnToggleAutoTts) dom.btnToggleAutoTts.classList.toggle('active', !!state.settings.autoTts);
      };
    }

    if (dom.selectVoice) {
      dom.selectVoice.onchange = () => {
        state.settings.voiceId = dom.selectVoice.value;
        localStorage.setItem('sreda_voice_id', state.settings.voiceId);
        refreshActiveVoiceDownloadButton();
        renderVoiceCatalog();
      };
    }

    if (dom.pillServerStatus) {
      dom.pillServerStatus.onclick = () => {
        const url = `http://127.0.0.1:${state.settings.serverPort || 1234}/v1`;
        navigator.clipboard.writeText(url).then(() => {
          showToast(`✓ Base URL скопирован в буфер: ${url}`, 'success');
        }).catch(() => {
          showToast(`Локальный API сервер активен на ${url}`, 'info');
        });
      };
    }

    // Immediate language change with real-time reactive feedback
    if (dom.selectLang) {
      const handleLangChange = () => {
        const chosen = dom.selectLang.value;
        state.settings.language = chosen;
        applyLanguage(chosen);
        updateActiveVoiceSelector();
        renderVoiceCatalog();
        saveSettings();
        const dict = I18N[chosen] || I18N.ru;
        const langName = dom.selectLang.options[dom.selectLang.selectedIndex] ? dom.selectLang.options[dom.selectLang.selectedIndex].text : chosen.toUpperCase();
        showToast(`${dict.uiLangLabel || 'Язык:'} ${langName}`, 'info');
      };
      dom.selectLang.onchange = handleLangChange;
      dom.selectLang.oninput = handleLangChange;
    }

    // Chat Send / Stop Action
    if (dom.btnSendMessage) {
      const onSendOrStop = (e) => {
        if (e) e.preventDefault();
        if (state.isStreaming) {
          if (state.abortController) {
            state.abortController.abort();
          }
          setStreamingState(false);
          showToast('Генерация остановлена', 'info');
        } else {
          sendMessage();
        }
      };
      dom.btnSendMessage.onclick = onSendOrStop;
    }
    if (dom.chatInput) {
      dom.chatInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      };

      // Auto-grow textarea
      dom.chatInput.oninput = () => {
        dom.chatInput.style.height = 'auto';
        dom.chatInput.style.height = Math.min(140, dom.chatInput.scrollHeight) + 'px';
      };
    }

    // Quick prompt chips
    document.querySelectorAll('.quick-chip').forEach(chip => {
      chip.onclick = () => {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt && dom.chatInput) {
          dom.chatInput.value = prompt;
          sendMessage();
        }
      };
    });

    // Voice input
    setupVoiceInput();

  function setupFileAttachment() {
    const attachBtn = document.getElementById('btn-attach-file');
    const fileInput = document.getElementById('file-attachment-input');
    const previewBox = document.getElementById('attachment-preview-box');
    if (!attachBtn || !fileInput || !previewBox) return;

    attachBtn.onclick = () => {
      fileInput.value = '';
      fileInput.click();
    };

    fileInput.onchange = async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);
      const isDoc = /\.(docx?|pdf|txt|md|markdown|json|csv|py)$/i.test(file.name);
      const isMedia = /\.(mp3|wav|ogg|m4a|aac|flac|mp4|mov|mkv)$/i.test(file.name);

      if (!isImg && !isDoc && !isMedia) {
        showToast('Поддерживаются медиа (MP3, WAV, MP4), документы (Word, PDF, TXT) и изображения', 'warning');
        return;
      }

      previewBox.style.display = 'flex';
      previewBox.innerHTML = `
        <div class="attachment-pill">
          <i class="fa-solid fa-spinner fa-spin" style="color: var(--accent-red);"></i>
          <div class="attachment-info">
            <span class="attachment-name">${escapeHtml(file.name)}</span>
            <span class="attachment-tag" style="color: var(--text-muted);">${isImg ? 'Анализ зрения...' : 'Чтение документа (RAG)...'}</span>
          </div>
        </div>
      `;

      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/multimedia/upload_image', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          const docCat = (data && data.doc_category) || (isMedia ? 'audio' : (isDocType ? 'document' : 'image'));
          activeAttachment = {
            type: data.type || (isImg ? 'image' : 'document'),
            doc_category: docCat,
            url: data.url || data.file_url,
            filename: file.name,
            char_count: (data.analysis && data.analysis.char_count) || data.char_count || 0,
            duration_sec: data.analysis && data.analysis.duration_sec,
            was_trimmed: data.analysis && data.analysis.was_trimmed,
            preview: data.analysis && data.analysis.preview,
            analysis: data.analysis,
            vision_context: data.vision_context
          };

          const isDocType = data.type === 'document';
          let iconHtml = `<img src="${data.url}" class="attachment-thumb" />`;
          if (isDocType) {
            let iconClass = 'fa-file-lines text';
            const fn = file.name.toLowerCase();
            if (fn.endsWith('.docx') || fn.endsWith('.doc')) iconClass = 'fa-file-word word';
            else if (fn.endsWith('.pdf')) iconClass = 'fa-file-pdf pdf';
            iconHtml = `<div class="attachment-doc-icon ${iconClass.split(' ')[1]}"><i class="fa-solid ${iconClass.split(' ')[0]}"></i></div>`;
          }

                    let tagText = '✓ Зрение активно';
          if (docCat === 'audio' || docCat === 'video' || isMedia) {
            const isVid = docCat === 'video' || /\.(mp4|mov|mkv)$/i.test(file.name);
            const dur = data.analysis && data.analysis.duration_sec ? ` (~${Math.round(data.analysis.duration_sec)}с)` : '';
            tagText = isVid ? `✓ Видео RAG${dur}` : `✓ Аудио RAG Whisper${dur}`;
          } else if (isDocType) {
            tagText = `✓ Документ (${(file.size / 1024).toFixed(1)} КБ)`;
          }

          previewBox.innerHTML = `
            <div class="attachment-pill">
              ${iconHtml}
              <div class="attachment-info">
                <span class="attachment-name">${escapeHtml(file.name)}</span>
                <span class="attachment-tag">${tagText}</span>
              </div>
              <button type="button" class="attachment-remove-btn" title="Удалить"><i class="fa-solid fa-xmark"></i></button>
            </div>
          `;

          const removeBtn = previewBox.querySelector('.attachment-remove-btn');
          if (removeBtn) {
            removeBtn.onclick = () => {
              activeAttachment = null;
              previewBox.innerHTML = '';
              previewBox.style.display = 'none';
              fileInput.value = '';
            };
          }
        } else {
          showToast('Ошибка при загрузке: ' + (data.error || 'неизвестно'), 'error');
          previewBox.innerHTML = '';
          previewBox.style.display = 'none';
        }
      } catch (err) {
        showToast('Сетевая ошибка анализа зрения: ' + err.message, 'error');
        previewBox.innerHTML = '';
        previewBox.style.display = 'none';
      }
    };
  }

    // Setup Vision / Image Attachment
    setupFileAttachment();

    // Modal Close buttons
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.onclick = () => {
        const modalId = btn.getAttribute('data-modal');
        if (modalId) closeModal(modalId);
      };
    });

    // Modal Tabs
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      const tabBtns = modal.querySelectorAll('.modal-tab-btn');
      tabBtns.forEach(btn => {
        btn.onclick = () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const targetId = btn.getAttribute('data-tab');
          modal.querySelectorAll('.tab-pane').forEach(pane => {
            pane.style.display = (pane.id === targetId) ? 'block' : 'none';
          });
        };
      });
    });

    // Models Modal Actions
    if (dom.btnRefreshModels) dom.btnRefreshModels.onclick = loadInstalledModels;
    if (dom.btnOpenFolder) {
      dom.btnOpenFolder.onclick = async () => {
        try {
          await fetch('/api/models/open_folder', { method: 'POST' });
        } catch (e) {
          showToast('Не удалось открыть папку: ' + e.message, 'error');
        }
      };
    }
    if (dom.btnHfSearch) dom.btnHfSearch.onclick = searchHuggingFace;
    if (dom.hfSearchInput) {
      dom.hfSearchInput.onkeydown = (e) => {
        if (e.key === 'Enter') searchHuggingFace();
      };
    }
    if (dom.btnCancelDl) dom.btnCancelDl.onclick = cancelDownload;
    if (dom.headerDlPill) {
      dom.headerDlPill.onclick = () => {
        openModal('modal-models');
        switchTab('modal-models', 'tab-bonsai');
      };
    }

    // Settings Modal Actions
    if (dom.inputGpuLayers && dom.valGpuLayers) {
      dom.inputGpuLayers.oninput = () => {
        dom.valGpuLayers.textContent = `${dom.inputGpuLayers.value} слоев`;
      };
    }
    if (dom.inputThreads && dom.valThreads) {
      dom.inputThreads.oninput = () => {
        dom.valThreads.textContent = `${dom.inputThreads.value} потоков`;
      };
    }
    if (dom.btnOptimizeSettings) dom.btnOptimizeSettings.onclick = applyOptimizationPreset;
    if (dom.btnSaveSettings) dom.btnSaveSettings.onclick = saveSettingsFromUI;

    // Provider Controls Event Listeners
    if (dom.btnGotoApiSettings) {
      dom.btnGotoApiSettings.onclick = () => {
        closeModal('modal-models');
        openModal('modal-settings');
        // Switch to tab-set-providers
        document.querySelectorAll('#modal-settings .modal-tab-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === 'tab-set-providers');
        });
        document.querySelectorAll('#modal-settings .tab-pane').forEach(p => {
          p.style.display = (p.id === 'tab-set-providers') ? 'block' : 'none';
        });
      };
    }

    // Toggle password visibility
    const setupEyeToggle = (btn, input) => {
      if (!btn || !input) return;
      btn.onclick = () => {
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        btn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
      };
    };
    setupEyeToggle(dom.btnToggleShowOpenrouterKey, dom.inputOpenrouterKey);
    setupEyeToggle(dom.btnToggleShowGigachatSecret, dom.inputGigachatSecret);
    setupEyeToggle(dom.btnToggleShowGigachatKey, dom.inputGigachatKey);
    setupEyeToggle(dom.btnToggleShowCustomKey, dom.inputCustomKey);

    if (dom.inputGigachatClientId) dom.inputGigachatClientId.onblur = saveProviderConfig;
    if (dom.inputGigachatSecret) dom.inputGigachatSecret.onblur = saveProviderConfig;

    // Test buttons
    if (dom.btnTestOpenrouter) dom.btnTestOpenrouter.onclick = () => testProvider('openrouter');
    if (dom.btnTestGigachat) dom.btnTestGigachat.onclick = () => testProvider('gigachat');
    if (dom.btnTestCustom) dom.btnTestCustom.onclick = () => testProvider('custom');

    // Auto-save provider changes when checkboxes change
    if (dom.checkProviderOpenrouter) dom.checkProviderOpenrouter.onchange = saveProviderConfig;
    if (dom.checkProviderGigachat) dom.checkProviderGigachat.onchange = saveProviderConfig;
    if (dom.checkProviderCustom) dom.checkProviderCustom.onchange = saveProviderConfig;
    if (dom.selectOpenrouterModel) dom.selectOpenrouterModel.onchange = saveProviderConfig;
    if (dom.selectGigachatModel) dom.selectGigachatModel.onchange = saveProviderConfig;
    if (dom.selectGigachatScope) dom.selectGigachatScope.onchange = saveProviderConfig;
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'info') {
    let toast = document.getElementById('sreda-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'sreda-toast';
      toast.style.position = 'fixed';
      toast.style.bottom = '110px';
      toast.style.right = '28px';
      toast.style.top = 'auto';
      toast.style.left = 'auto';
      toast.style.zIndex = '99999';
      toast.style.padding = '12px 18px';
      toast.style.borderRadius = '8px';
      toast.style.fontSize = '13px';
      toast.style.fontWeight = '500';
      toast.style.display = 'flex';
      toast.style.alignItems = 'center';
      toast.style.gap = '10px';
      toast.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.5)';
      toast.style.pointerEvents = 'none';
      toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      document.body.appendChild(toast);
    }

    if (type === 'success') {
      toast.style.backgroundColor = 'var(--bg-elevated)';
      toast.style.border = '1px solid var(--accent-green)';
      toast.style.color = '#fff';
      toast.innerHTML = `<i class="fa-solid fa-check-circle" style="color: var(--accent-green)"></i> ${escapeHtml(message)}`;
    } else if (type === 'warning' || type === 'error') {
      toast.style.backgroundColor = 'var(--bg-elevated)';
      toast.style.border = '1px solid var(--accent-red)';
      toast.style.color = '#fff';
      toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-red)"></i> ${escapeHtml(message)}`;
    } else {
      toast.style.backgroundColor = 'var(--bg-elevated)';
      toast.style.border = '1px solid var(--border-light)';
      toast.style.color = '#fff';
      toast.innerHTML = `<i class="fa-solid fa-circle-info" style="color: var(--accent-red)"></i> ${escapeHtml(message)}`;
    }

    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
