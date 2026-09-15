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

        updateBackButton = function () {
            if (isModalOpen()) {
                tg.BackButton.show();
                backVisible = true;
                return;
            }

            var scrolled = window.scrollY || window.pageYOffset;

            if (scrolled > SCROLL_THRESHOLD && !backVisible) {
                tg.BackButton.show();
                backVisible = true;
            } else if (scrolled <= SCROLL_THRESHOLD && backVisible) {
                tg.BackButton.hide();
                backVisible = false;
            }
        };

        window.addEventListener("scroll", updateBackButton, { passive: true });

        tg.onEvent("backButtonClicked", function () {
            if (isModalOpen()) {
                closeProjectModal();
                return;
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
            tg.BackButton.hide();
            backVisible = false;
        });
    }

    /* ------------------------------------------------------------------ */
    /*  4. MainButton ("Связаться")                                        */
    /* ------------------------------------------------------------------ */

    if (tg && tg.MainButton) {
        tg.MainButton.setText("Связаться");
        tg.MainButton.show();

        tg.onEvent("mainButtonClicked", function () {
            // Honour the same action as the in-page contact button (mailto:)
            window.location.href = "mailto:hello@example.com";
        });
    }

    /* ------------------------------------------------------------------ */
    /*  5. HapticFeedback                                                  */
    /* ------------------------------------------------------------------ */

    var haptic = tg && tg.HapticFeedback;

    // FAQ accordion — light tap on toggle
    document.querySelectorAll(".FAQ-item").forEach(function (details) {
        var summary = details.querySelector("summary");
        if (summary) {
            summary.addEventListener("click", function () {
                if (haptic) {
                    haptic.impactOccurred("light");
                }
            });
        }
    });

    // Contact button — medium tap
    var contactBtn = document.querySelector(".contact-button");
    if (contactBtn) {
        contactBtn.addEventListener("click", function () {
            if (haptic) {
                haptic.impactOccurred("medium");
            }
        });
    }

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
            description: "<p>Бот-охранник для Telegram-групп и каналов: <a href=\"https://t.me/moderg0d_bot\" target=\"_blank\" rel=\"noopener\" class=\"project-inline-link\">@moderg0d_bot</a>. Работает сам, пока вы занимаетесь другим — без участия администратора убирает спам, блокирует ботов и следит за порядком в чате.</p><ul class=\"modal-features-list\"><li><strong>Блокирует спам и мат:</strong> фильтрует запрещённые слова и ссылки, которые вы сами определяете.</li><li><strong>Проверяет новичков:</strong> каждый новый участник проходит проверку — боты и нежелательные аккаунты не проходят.</li><li><strong>Контролирует поведение:</strong> ограничивает частоту сообщений, блокирует голосовые, стикеры, GIF по вашему выбору.</li><li><strong>Система предупреждений:</strong> нарушителю начисляются предупреждения — после нужного числа бот автоматически его мьютит, кикает или банит.</li><li><strong>Доверенные участники:</strong> можно добавить в список тех, кого бот никогда не тронет.</li><li><strong>Управление в пару кликов:</strong> все настройки меняются прямо в диалоге с ботом, без сторонних сервисов.</li></ul>",
            tags: ["Python", "aiogram 3", "SQLite", "FSM", "RegEx", "Asyncio"],
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
            description: "<p>Инструмент для поиска блогеров на YouTube и сбора их контактов: <a href=\"https://t.me/yt_marinerabot\" target=\"_blank\" rel=\"noopener\" class=\"project-inline-link\">@yt_marinerabot</a>. Вы задаёте тему — бот сам находит подходящие каналы, вытаскивает Telegram, Instagram, email и сортирует результаты по качеству.</p><ul class=\"modal-features-list\"><li><strong>Автоматический поиск:</strong> бот ищет каналы по нужным ключевым словам в фоне, пока вы не отвлекаетесь.</li><li><strong>Контакты из описаний:</strong> автоматически вытаскивает Telegram, Instagram, Email и сайты из профилей каналов.</li><li><strong>Оценка качества:</strong> каждый канал получает оценку от 0 до 100 — сразу видно, с кем стоит работать.</li><li><strong>Гибкая фильтрация:</strong> можно исключить ненужные каналы, добавить стоп-слова и ограничить поиск по дате активности.</li><li><strong>Готовая таблица:</strong> результаты выгружаются в Excel-файл — открыл и работаешь.</li><li><strong>Приватный доступ:</strong> бот работает только для разрешённых пользователей.</li></ul>",
            tags: ["Python", "aiogram 3", "YouTube API", "aiosqlite", "Excel", "Cryptography"],
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
            description: "<p>Платформа для запуска интернет-магазина прямо в Telegram: <a href=\"https://t.me/tap2sell_bot\" target=\"_blank\" rel=\"noopener\" class=\"project-inline-link\">@tap2sell_bot</a>. Вы подключаете своего бота, добавляете товары — и он начинает принимать заказы и деньги сам, без вашего участия.</p><ul class=\"modal-features-list\"><li><strong>Запуск без программиста:</strong> создать бота-магазин можно за несколько минут — достаточно вставить токен от BotFather.</li><li><strong>Три типа товаров:</strong> файлы (курсы, PDF, видео), доступ в закрытый канал или группу, а также марафоны — когда уроки приходят покупателю по расписанию.</li><li><strong>Управление через самого бота:</strong> добавлять товары, менять цены и описания можно прямо в Telegram, без сторонних сайтов.</li><li><strong>Приём оплаты:</strong> банковские карты, Apple Pay и криптовалюта — всё настраивается за пять минут.</li><li><strong>Работает само:</strong> после оплаты бот сам выдаёт товар, открывает доступ или начинает отправлять уроки.</li><li><strong>Надёжное хранение данных:</strong> все токены и ключи оплаты хранятся в зашифрованном виде.</li></ul>",
            tags: ["Python", "aiogram 3", "FastAPI", "SQLAlchemy", "Alembic", "APScheduler", "CryptoBot", "LavaTop", "Cryptography"],
            buttonText: "Недоступен",
            buttonUrl: "https://t.me/tap2sell_bot",
            disabled: true,
            disabledReason: "Сервер временно выключен"
        },

        // Карточка №4 (PosterBoy — мульти-бот система отложенного постинга в Forum Topics)
        4: {
            title: "PosterBoy",
            category: "Постинг · Forum Topics",
            logoImg: "posterboy.jpg",
            logo: "P",
            description: "<p>Инструмент для публикации постов в нужные темы Telegram-форумов: <a href=\"https://t.me/posterboy_bot\" target=\"_blank\" rel=\"noopener\" class=\"project-inline-link\">@posterboy_bot</a>. Вы пишете пост, выбираете раздел форума — бот публикует туда. Можно создать отдельных ботов для разных форумов и управлять всем из одного места.</p><ul class=\"modal-features-list\"><li><strong>Постинг в нужный раздел:</strong> бот публикует сообщение именно в ту тему форума, которую вы выбрали.</li><li><strong>Несколько ботов сразу:</strong> к одному аккаунту можно привязать неограниченное количество ботов для разных форумов.</li><li><strong>Удобное оформление:</strong> перед публикацией можно добавить кнопки со ссылками и посмотреть предпросмотр поста.</li><li><strong>Обязательная подписка:</strong> пользователь получит доступ к боту только после подписки на ваш канал.</li><li><strong>Мгновенная реакция:</strong> бот обрабатывает входящие запросы без задержек даже при большой нагрузке.</li></ul>",
            tags: ["Python", "FastAPI", "Raw HTTP", "Redis", "SQLAlchemy 2.0", "SQLite WAL", "Httpx", "Uvicorn"],
            buttonText: "Недоступен",
            buttonUrl: "https://t.me/posterboy_bot",
            disabled: true,
            disabledReason: "Сервер временно выключен"
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
        if (tg && tg.BackButton) {
            tg.BackButton.show();
        }

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
})();
