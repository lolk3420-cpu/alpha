/**
 * app.js — Telegram MiniApp Integration Layer
 *
 * WHY: This file bridges the landing page with Telegram's WebApp SDK.
 * It provides theme synchronisation, native navigation (BackButton),
 * a persistent call-to-action (MainButton), haptic feedback on
 * interactive elements, and safe-area padding via CSS custom properties.
 *
 * GRACEFUL FALLBACK: Every Telegram-specific call is guarded behind
 * a `tg` check so the page works identically in a regular browser.
 */

(function () {
    "use strict";

    /* ------------------------------------------------------------------ */
    /*  Telegram WebApp reference (may be undefined outside Telegram)      */
    /* ------------------------------------------------------------------ */

    /** @type {object | undefined} */
    var tg = window.Telegram && window.Telegram.WebApp;

    /* ------------------------------------------------------------------ */
    /*  1. Initialization                                                  */
    /* ------------------------------------------------------------------ */

    if (tg) {
        tg.ready();
        tg.expand();

        // Prevent accidental close on vertical swipe (Bot API ≥ 7.7)
        if (typeof tg.disableVerticalSwipes === "function") {
            tg.disableVerticalSwipes();
        }
    }

    /* ------------------------------------------------------------------ */
    /*  2. Theme                                                           */
    /* ------------------------------------------------------------------ */

    var root = document.documentElement;
    var toggle = document.querySelector(".theme-toggle");

    /**
     * Apply theme to the page and synchronise the toggle's aria state.
     * @param {"light" | "dark"} theme
     */
    function applyTheme(theme) {
        root.setAttribute("data-theme", theme);

        if (toggle) {
            toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
        }

        var themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) {
            themeMeta.setAttribute("content", theme === "dark" ? "#1a1a1a" : "#f5f5f3");
        }

        // Mirror theme into Telegram header / background when possible
        if (tg) {
            var headerColor = theme === "dark" ? "#1a1a1a" : "#f5f5f3";
            var bgColor = theme === "dark" ? "#1a1a1a" : "#f5f5f3";

            if (typeof tg.setHeaderColor === "function") {
                tg.setHeaderColor(headerColor);
            }
            if (typeof tg.setBackgroundColor === "function") {
                tg.setBackgroundColor(bgColor);
            }
        }
    }

    // Determine initial theme: prefer Telegram's scheme, fall back to light
    var initialTheme = (tg && tg.colorScheme) ? tg.colorScheme : "light";
    applyTheme(initialTheme);

    // Listen for Telegram-side theme changes
    if (tg) {
        tg.onEvent("themeChanged", function () {
            applyTheme(tg.colorScheme);
        });
    }

    // Manual toggle still works — overrides Telegram theme until next themeChanged
    if (toggle) {
        toggle.addEventListener("click", function () {
            var current = root.getAttribute("data-theme") || "light";
            var next = current === "light" ? "dark" : "light";
            applyTheme(next);

            if (tg && tg.HapticFeedback) {
                tg.HapticFeedback.selectionChanged();
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /*  3. BackButton (scroll-to-top & modal navigation)                   */
    /* ------------------------------------------------------------------ */

    var updateBackButton = function () { };

    if (tg && tg.BackButton) {
        var SCROLL_THRESHOLD = 200; // px before BackButton appears
        var backVisible = false;
        var pastThreshold = false;

        updateBackButton = function () {
            var shouldShow = isModalOpen() || pastThreshold;
            if (shouldShow && !backVisible) {
                tg.BackButton.show();
                backVisible = true;
            } else if (!shouldShow && backVisible) {
                tg.BackButton.hide();
                backVisible = false;
            }
        };

        // A 1px sentinel at SCROLL_THRESHOLD: once it leaves the top of the viewport, show BackButton
        var sentinel = document.createElement("div");
        sentinel.setAttribute("aria-hidden", "true");
        sentinel.style.cssText = "position:absolute;left:0;top:" + SCROLL_THRESHOLD + "px;width:1px;height:1px;pointer-events:none;";
        document.body.style.position = document.body.style.position || "relative";
        document.body.appendChild(sentinel);

        if ("IntersectionObserver" in window) {
            new IntersectionObserver(function (entries) {
                var entry = entries[0];
                pastThreshold = !entry.isIntersecting && entry.boundingClientRect.top < 0;
                updateBackButton();
            }).observe(sentinel);
        }

        tg.onEvent("backButtonClicked", function () {
            if (isModalOpen()) {
                closeProjectModal();
                return;
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    /* ------------------------------------------------------------------ */
    /*  4. MainButton (отключена)                                          */
    /* ------------------------------------------------------------------ */

    if (tg && tg.MainButton) {
        tg.MainButton.hide();
    }

    /* ------------------------------------------------------------------ */
    /*  5. HapticFeedback                                                  */
    /* ------------------------------------------------------------------ */

    var haptic = tg && tg.HapticFeedback;

    // FAQ accordion — light tap on toggle (delegated for all existing and new items)
    document.addEventListener("click", function (e) {
        var summary = e.target.closest(".FAQ-item summary");
        if (summary && haptic) {
            haptic.impactOccurred("light");
        }
    });

    // Contact buttons (hero + footer) — medium tap & seamless Telegram profile open
    document.querySelectorAll(".contact-button, .hero-cta").forEach(function (contactBtn) {
        contactBtn.addEventListener("click", function (e) {
            if (haptic) {
                haptic.impactOccurred("medium");
            }
            if (tg && typeof tg.openTelegramLink === "function") {
                e.preventDefault();
                tg.openTelegramLink("https://t.me/shizukesa26");
            }
        });
    });

    /* ------------------------------------------------------------------ */
    /*  6. Safe Areas → CSS custom properties                              */
    /* ------------------------------------------------------------------ */

    function applySafeAreas() {
        if (!tg) return;

        var sa = tg.safeAreaInset || {};
        var csa = tg.contentSafeAreaInset || {};

        // Device safe area (notch, home indicator)
        root.style.setProperty("--tg-safe-top", (sa.top || 0) + "px");
        root.style.setProperty("--tg-safe-bottom", (sa.bottom || 0) + "px");
        root.style.setProperty("--tg-safe-left", (sa.left || 0) + "px");
        root.style.setProperty("--tg-safe-right", (sa.right || 0) + "px");

        // Content safe area (Telegram's own UI chrome)
        root.style.setProperty("--tg-content-safe-top", (csa.top || 0) + "px");
        root.style.setProperty("--tg-content-safe-bottom", (csa.bottom || 0) + "px");
        root.style.setProperty("--tg-content-safe-left", (csa.left || 0) + "px");
        root.style.setProperty("--tg-content-safe-right", (csa.right || 0) + "px");
    }

    applySafeAreas();

    if (tg) {
        tg.onEvent("safeAreaChanged", applySafeAreas);
        tg.onEvent("contentSafeAreaChanged", applySafeAreas);
    }

    /* ================================================================== */
    /*  7. РЕДАКТИРУЙТЕ ОПИСАНИЯ ПРОЕКТОВ ЗДЕСЬ (PROJECTS_DATA)           */
    /*                                                                    */
    /*  Карточки нумеруются слева направо (1, 2, 3, 4...).                */
    /*  Параметры кнопки:                                                 */
    /*    - buttonText: надпись на кнопке                                 */
    /*    - buttonUrl: ссылка на бота/проект                              */
    /*    - disabled: true / false (сделать кнопку неактивной и серой)    */
    /*    - disabledReason: причина после эмодзи ⚠️ в стиле Apple         */
    /* ================================================================== */

    var PROJECTS_DATA = {
        // Карточка №1 (ModerGod — первый бот)
        1: {
            title: "ModerGod",
            category: "Модерация · Telegram",
            logo: "M",
            description: "<p>Система автоматической модерации для Telegram-групп и каналов: <a href=\"https://t.me/moderg0d_bot\" target=\"_blank\" rel=\"noopener\" class=\"project-inline-link\">@moderg0d_bot</a>. Работает в режиме 24/7 без участия администратора — фильтрует контент, блокирует нежелательных участников и поддерживает порядок в чате.</p><ul class=\"modal-features-list\"><li><strong>Антиспам и фильтрация контента:</strong> гибкий список запрещённых слов и ссылок, который администратор настраивает под себя.</li><li><strong>Верификация новых участников:</strong> автоматическая проверка при вступлении в группу или канал — боты и нежелательные аккаунты блокируются.</li><li><strong>Контроль типов медиа:</strong> раздельные ограничения на голосовые сообщения, стикеры, GIF и частоту сообщений.</li><li><strong>Система предупреждений:</strong> автоматический мут, кик или бан при накоплении нарушений — порог настраивается.</li><li><strong>Белый список участников:</strong> доверенные пользователи с иммунитетом к автоматическим санкциям.</li><li><strong>Inline-управление:</strong> все настройки меняются прямо в диалоге с ботом без сторонних сервисов.</li></ul>",
            tags: ["Python", "SQLite", "FSM", "Asyncio"],
            buttonText: "Недоступен",
            buttonUrl: "https://t.me/moderg0d_bot",
            disabled: true,
            disabledReason: "Проект закрыт из-за невозможности оплачивать сервер"
        },

        // Карточка №2 (Marinera — парсинг и скоринг YouTube)
        2: {
            title: "Marinera",
            category: "Парсинг · Lead Generation",
            logoImg: "marinera.jpg",
            logo: "M",
            description: "<p>B2B‑инструмент для автоматизированного поиска и скоринга YouTube-блогеров: <a href=\"https://t.me/yt_marinerabot\" target=\"_blank\" rel=\"noopener\" class=\"project-inline-link\">@yt_marinerabot</a>. Система в фоновом режиме собирает базу каналов по заданным критериям, извлекает контакты из описаний и выставляет каждому лиду оценку качества от 0 до 100.</p><ul class=\"modal-features-list\"><li><strong>Автоматический сбор каналов:</strong> фоновый поиск по ключевым словам через YouTube API — без ручного мониторинга.</li><li><strong>Извлечение контактов:</strong> автоматически вытаскивает Telegram, Instagram, Email и сайты из описаний каналов.</li><li><strong>Скоринг лидов:</strong> каждый канал получает оценку качества на основе активности, аудитории и заданных фильтров.</li><li><strong>Гибкая фильтрация:</strong> чёрные списки каналов, минус-слова и фильтрация по дате последней активности.</li><li><strong>Экспорт в Excel:</strong> готовая таблица с контактами и статистикой по базе одним нажатием.</li><li><strong>Приватный доступ:</strong> закрытая система с ограничением по белому списку пользователей.</li></ul>",
            tags: ["Python", "YouTube API", "SQLite", "Excel"],
            buttonText: "Приватный доступ",
            buttonUrl: "https://t.me/yt_marinerabot",
            disabled: true,
            disabledReason: "Недоступно: частный проект"
        },

        // Карточка №3 (Tap2Sell — платформа автоматизированных продаж в Telegram)
        3: {
            title: "Tap2Sell",
            category: "E-commerce · Конструктор ботов",
            logoImg: "tap2sell.jpg",
            logo: "T",
            description: "<p>SaaS‑платформа для создания автоматизированных магазинов внутри Telegram: <a href=\"https://t.me/tap2sell_bot\" target=\"_blank\" rel=\"noopener\" class=\"project-inline-link\">@tap2sell_bot</a>. Архитектура Master‑Vassal позволяет запустить собственного бота-магазина без навыков программирования — достаточно подключить токен.</p><ul class=\"modal-features-list\"><li><strong>No-code запуск:</strong> создание бота-магазина без разработки — вся настройка через интерфейс самого бота.</li><li><strong>Три формата продуктов:</strong> цифровые файлы с автовыдачей, платный доступ в закрытые каналы и группы, марафоны с отправкой контента по расписанию.</li><li><strong>Встроенная админ-панель:</strong> управление витриной, товарами и ценами прямо в Telegram без сторонних сайтов.</li><li><strong>Мульти-эквайринг:</strong> приём платежей картами, Apple Pay и криптовалютой — несколько платёжных систем одновременно.</li><li><strong>Автоматическая выдача:</strong> после оплаты бот сам отдаёт товар, открывает доступ или начинает цикл марафона.</li><li><strong>Безопасное хранение данных:</strong> токены ботов и платёжные ключи хранятся в зашифрованном виде.</li></ul>",
            tags: ["Python", "SQLAlchemy", "APScheduler", "CryptoBot", "LavaTop"],
            buttonText: "Открыть демо-бота",
            buttonUrl: "https://t.me/tap2sell_demo_bot?start=miniapp",
            disabled: false
        },

        // Карточка №4 (PosterBoy — мульти-бот система отложенного постинга в Forum Topics)
        4: {
            title: "PosterBoy",
            category: "Постинг · Forum Topics",
            logoImg: "posterboy.jpg",
            logo: "P",
            description: "<p>Мульти-бот система для таргетированной публикации постов в топики Telegram-форумов. Поддерживает одновременную работу нескольких ботов-секретарей с централизованным управлением из одной точки.</p><ul class=\"modal-features-list\"><li><strong>Постинг в Forum Topics:</strong> публикация в конкретный топик форума с предпросмотром перед отправкой.</li><li><strong>Managed Bots:</strong> автоматическое создание персональных ботов-секретарей для каждого пользователя.</li><li><strong>Интерактивное оформление:</strong> добавление inline-кнопок и форматирование публикаций перед отправкой.</li><li><strong>Обязательная подписка:</strong> gate-механизм — доступ только после подписки на указанный канал.</li><li><strong>Изолированная маршрутизация:</strong> безопасная обработка обновлений каждого бота независимо от остальных.</li><li><strong>Высокая производительность:</strong> асинхронная архитектура с кешированием для стабильной работы под нагрузкой.</li></ul>",
            tags: ["Python", "Redis", "SQLAlchemy", "Webhooks"],
            buttonText: "Недоступен",
            buttonUrl: "https://t.me/posterboy_bot",
            disabled: true,
            disabledReason: "Сервер временно выключен"
        },

        // Карточка №5 (IG Parser — поиск и скоринг лидов в Instagram)
        5: {
            title: "IG Parser",
            category: "Парсинг · Instagram",
            logoImg: "igparser.jpg",
            logo: "I",
            description: "<p>Telegram-бот для поиска лидов в Instagram. Находит авторов по ключевым словам, хэштегам и Reels, проверяет каждый профиль и выставляет лиду оценку качества от 0 до 100.</p><ul class=\"modal-features-list\"><li><strong>Три режима поиска:</strong> ключевые слова через Reels, хэштеги и аккаунты. Кандидатами становятся авторы роликов по теме.</li><li><strong>Пул аккаунтов:</strong> бот сам входит в аккаунты, проходит challenge и пережидает кулдауны. Каждый аккаунт работает через свой прокси.</li><li><strong>Многопоточный парсинг:</strong> до 10 аккаунтов параллельно, уже пройденные ключи не повторяются.</li><li><strong>Извлечение контактов:</strong> Telegram, email и ссылки из bio и taplink.</li><li><strong>Гибкий скоринг:</strong> фильтры по подписчикам и свежести, проходной балл и веса критериев настраиваются прямо в боте.</li><li><strong>Экспорт в Excel:</strong> выгрузка лидов за любой период, от последней сессии до своего диапазона дат.</li></ul>",

            tags: ["Python", "aiogram", "instagrapi", "SQLite", "Excel"],
            buttonText: "Приватный доступ",
            buttonUrl: "",
            disabled: true,
            disabledReason: "Приватный проект"
        }
    };

    /* ------------------------------------------------------------------ */
    /*  8. Project Modal Controller                                       */
    /* ------------------------------------------------------------------ */

    var modal = document.getElementById("project-modal");
    var modalLogo = document.getElementById("modal-logo");
    var modalTitle = document.getElementById("modal-title");
    var modalCategory = document.getElementById("modal-category");
    var modalDescription = document.getElementById("modal-description");
    var modalTags = document.getElementById("modal-tags");
    var modalTagsHeading = document.getElementById("modal-tags-heading");
    var modalActionBtn = document.getElementById("modal-action-btn");
    var modalBtnText = document.getElementById("modal-btn-text");
    var modalDisabledNotice = document.getElementById("modal-disabled-notice");
    var modalNoticeText = document.getElementById("modal-notice-text");

    function isModalOpen() {
        return modal && modal.classList.contains("is-active");
    }

    // Project button — t.me links open natively inside Telegram (like the contact button)
    if (modalActionBtn) {
        modalActionBtn.addEventListener("click", function (e) {
            var href = modalActionBtn.getAttribute("href") || "";
            if (modalActionBtn.classList.contains("is-disabled") || !href) {
                e.preventDefault();
                return;
            }
            if (haptic) {
                haptic.impactOccurred("medium");
            }
            if (tg && typeof tg.openTelegramLink === "function" && href.indexOf("https://t.me/") === 0) {
                e.preventDefault();
                tg.openTelegramLink(href);
            }
        });
    }

    /**
     * Открытие модального окна проекта по его порядковому номеру (1, 2, 3...)
     * @param {number | string} projectNum
     * @param {HTMLElement} [cardElement]
     */
    function openProjectModal(projectNum, cardElement) {
        if (!modal) return;

        var num = parseInt(projectNum, 10) || 1;
        var data = PROJECTS_DATA[num];

        // Резервное считывание данных из DOM карточки, если какого-то поля нет в объекте
        var title = (data && data.title) || (cardElement && cardElement.querySelector(".title-2") ? cardElement.querySelector(".title-2").textContent.trim() : "Проект " + num);
        var category = (data && data.category) || (cardElement && cardElement.querySelector(".category-2") ? cardElement.querySelector(".category-2").textContent.trim() : "");
        var logo = (data && data.logo) || (cardElement && cardElement.querySelector(".logo-mark-2") ? cardElement.querySelector(".logo-mark-2").textContent.trim() : String(num));
        var description = (data && data.description) || "Описание данного проекта находится в разработке.";
        var tags = (data && Array.isArray(data.tags)) ? data.tags : [];
        var buttonText = (data && data.buttonText) || "Открыть проект";
        var buttonUrl = (data && data.buttonUrl) ? data.buttonUrl : "";

        // Заполнение полей модального окна
        if (modalLogo) {
            if (data && data.logoImg) {
                modalLogo.innerHTML = '<img class="modal-logo-img" src="' + data.logoImg + '" alt="' + title + '">';
            } else {
                modalLogo.textContent = logo;
            }
        }
        if (modalTitle) modalTitle.textContent = title;
        if (modalCategory) modalCategory.textContent = category;
        if (modalDescription) modalDescription.innerHTML = description;

        // Генерация тегов технологий
        if (modalTags) {
            modalTags.innerHTML = "";
            if (tags.length > 0) {
                if (modalTagsHeading) modalTagsHeading.style.display = "";
                tags.forEach(function (tagText) {
                    var tagEl = document.createElement("span");
                    tagEl.className = "modal-tag";
                    tagEl.textContent = tagText;
                    modalTags.appendChild(tagEl);
                });
            } else {
                if (modalTagsHeading) modalTagsHeading.style.display = "none";
            }
        }

        // Обработка неактивного состояния кнопки (disabled) и плашки Apple Warning
        var isDisabled = Boolean(data && data.disabled);
        var disabledReason = (data && data.disabledReason) || "Проект временно недоступен";

        if (modalDisabledNotice) {
            if (isDisabled) {
                modalDisabledNotice.style.display = "flex";
                if (modalNoticeText) modalNoticeText.textContent = disabledReason;
            } else {
                modalDisabledNotice.style.display = "none";
            }
        }

        // Кнопка перехода к проекту
        if (modalActionBtn) {
            if (isDisabled) {
                modalActionBtn.classList.add("is-disabled");
                modalActionBtn.setAttribute("aria-disabled", "true");
                modalActionBtn.setAttribute("tabindex", "-1");
                modalActionBtn.removeAttribute("href");
                modalActionBtn.style.display = "flex";
                if (modalBtnText) modalBtnText.textContent = buttonText;
            } else {
                modalActionBtn.classList.remove("is-disabled");
                modalActionBtn.removeAttribute("aria-disabled");
                modalActionBtn.removeAttribute("tabindex");

                if (buttonUrl && buttonUrl !== "#") {
                    modalActionBtn.href = buttonUrl;
                    modalActionBtn.style.display = "flex";
                    if (modalBtnText) modalBtnText.textContent = buttonText;
                } else {
                    modalActionBtn.style.display = "none";
                }
            }
        }

        // Отображение модального окна
        modal.classList.add("is-active");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");

        // Интеграция с Telegram BackButton & HapticFeedback
        updateBackButton();

        if (haptic) {
            haptic.impactOccurred("medium");
        }
    }

    /**
     * Закрытие модального окна проекта
     */
    function closeProjectModal() {
        if (!modal || !isModalOpen()) return;

        modal.classList.remove("is-active");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");

        if (tg && tg.BackButton) {
            updateBackButton();
        }

        if (haptic) {
            haptic.selectionChanged();
        }
    }

    // Привязка кликов к карточкам проектов (нумерация 1, 2, 3, 4...)
    document.querySelectorAll(".project-card-2").forEach(function (card, index) {
        var projectNum = card.getAttribute("data-project") || (index + 1);
        card.addEventListener("click", function (e) {
            e.preventDefault();
            openProjectModal(projectNum, card);
        });
    });

    // Обработчики закрытия по кнопке «✕» и по клику на фон (бэкдроп)
    document.querySelectorAll("[data-close-modal]").forEach(function (el) {
        el.addEventListener("click", function (e) {
            e.preventDefault();
            closeProjectModal();
        });
    });

    // Закрытие по клавише Escape на клавиатуре
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && isModalOpen()) {
            closeProjectModal();
        }
    });

    /* ------------------------------------------------------------------ */
    /*  9. Workflow Interactive Simulator («Прикол»)                       */
    /* ------------------------------------------------------------------ */

    var eggBtn = document.getElementById("workflow-interactive-btn");
    var eggConsole = document.getElementById("workflow-console");
    var eggBtnLabel = document.getElementById("workflow-btn-label");

    if (eggBtn && eggConsole) {
        var isPipelineRunning = false;

        eggBtn.addEventListener("click", function () {
            if (isPipelineRunning) return;
            isPipelineRunning = true;
            eggBtn.disabled = true;

            if (haptic) {
                haptic.impactOccurred("medium");
            }

            if (eggBtnLabel) {
                eggBtnLabel.textContent = "Обработка запроса...";
            }

            var steps = [
                { text: "[02:30:01]  Правка получена", delay: 0, cls: "wf-console-active" },
                { text: "[02:45:22]  Планировка архитектуры", delay: 650, cls: "wf-console-active" },
                { text: "[03:16:14]  Сборка: 30min52s · Автотесты: 100% Passed · Багов: 0", delay: 1350, cls: "wf-console-active" },
                { text: "[03:17:50]  Успешный деплой! Спите спокойно.", delay: 2100, cls: "wf-console-success" }
            ];

            steps.forEach(function (step, i) {
                setTimeout(function () {
                    var line = document.createElement("div");
                    line.className = "wf-console-line " + step.cls;
                    line.textContent = step.text;

                    if (i === 0) {
                        eggConsole.innerHTML = "";
                    }
                    eggConsole.appendChild(line);

                    if (haptic) {
                        haptic.selectionChanged();
                    }

                    if (i === steps.length - 1) {
                        if (haptic && typeof haptic.notificationOccurred === "function") {
                            haptic.notificationOccurred("success");
                        }
                        if (eggBtnLabel) {
                            eggBtnLabel.textContent = "Повторить симуляцию";
                        }
                        eggBtn.disabled = false;
                        isPipelineRunning = false;
                    }
                }, step.delay);
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /*  10. Motion: заголовок, появление блоков, FAQ, подсветка карточек   */
    /*  Работает только если пользователь не просил уменьшить анимацию     */
    /* ------------------------------------------------------------------ */

    var motionOK = root.classList.contains("motion");

    // Pointer spotlight on project cards (cheap: two CSS variables)
    document.querySelectorAll(".project-card-2").forEach(function (card) {
        card.addEventListener("pointermove", function (e) {
            var r = card.getBoundingClientRect();
            card.style.setProperty("--mx", (e.clientX - r.left) + "px");
            card.style.setProperty("--my", (e.clientY - r.top) + "px");
        });
    });

    if (!motionOK) return;

    // Headline: split into words that rise from a clip mask
    var headline = document.querySelector(".headline");
    if (headline && !headline.classList.contains("is-split")) {
        var words = headline.textContent.trim().split(/\s+/);
        headline.setAttribute("aria-label", words.join(" "));
        headline.innerHTML = words.map(function (word, i) {
            var safe = word.replace(/&/g, "&amp;").replace(/</g, "&lt;");
            return '<span class="w" aria-hidden="true"><span style="--i:' + i + '">' + safe + "</span></span>";
        }).join(" ");
        headline.classList.add("is-split");
    }

    function markReady() {
        requestAnimationFrame(function () {
            root.classList.add("is-ready");
        });
    }
    // Wait for the display font so the words do not reflow mid-animation
    if (document.fonts && document.fonts.ready) {
        Promise.race([
            document.fonts.ready,
            new Promise(function (resolve) { setTimeout(resolve, 700); })
        ]).then(markReady);
    } else {
        markReady();
    }

    // Scroll reveal
    var revealTargets = [];
    document.querySelectorAll(".project-card-2").forEach(function (el, i) {
        el.style.setProperty("--d", (i * 70) + "ms");
        revealTargets.push(el);
    });
    document.querySelectorAll(".workflow-card, .workflow-easter-egg, .FAQ, .contact-callout").forEach(function (el) {
        revealTargets.push(el);
    });
    revealTargets.forEach(function (el) {
        el.classList.add("reveal");
    });

    // Workflow mockups assemble themselves once the card is on screen
    document.querySelectorAll(".workflow-card").forEach(function (card) {
        card.querySelectorAll(".wf-msg, .wf-contract-item, .wf-feed-item, .wf-deploy-item").forEach(function (el, i) {
            el.classList.add("wf-anim");
            el.style.setProperty("--d", (i * 110) + "ms");
        });
    });

    function settle(el) {
        var delay = parseInt(el.style.getPropertyValue("--d"), 10) || 0;
        setTimeout(function () {
            el.classList.add("is-settled");
        }, delay + 1000);
    }

    if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-inview");
                settle(entry.target);
                io.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

        revealTargets.forEach(function (el) {
            io.observe(el);
        });
    } else {
        revealTargets.forEach(function (el) {
            el.classList.add("is-inview", "is-settled");
        });
    }

    // FAQ: animated height instead of an instant jump
    document.querySelectorAll(".FAQ-item").forEach(function (item) {
        var summary = item.querySelector("summary");
        var answer = item.querySelector(".answer");
        if (!summary || !answer || typeof answer.animate !== "function") return;

        var running = null;
        var easing = "cubic-bezier(0.16, 1, 0.3, 1)";

        summary.addEventListener("click", function (e) {
            e.preventDefault();
            var wantClose = item.open && !item.classList.contains("is-closing");
            if (running) running.cancel();

            if (wantClose) {
                var from = answer.offsetHeight;
                item.classList.add("is-closing");
                running = answer.animate(
                    [{ height: from + "px", opacity: 1 }, { height: "0px", opacity: 0 }],
                    { duration: 340, easing: easing }
                );
                running.onfinish = function () {
                    item.open = false;
                    item.classList.remove("is-closing");
                    running = null;
                };
                running.oncancel = function () {
                    item.classList.remove("is-closing");
                };
            } else {
                item.open = true;
                var to = answer.offsetHeight;
                running = answer.animate(
                    [{ height: "0px", opacity: 0 }, { height: to + "px", opacity: 1 }],
                    { duration: 460, easing: easing }
                );
                running.onfinish = function () {
                    running = null;
                };
            }
        });
    });
})();

