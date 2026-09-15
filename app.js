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
            description: "<p>Мой первый Telegram‑бот, разработанный с нуля на Python и aiogram 3: <a href=\"https://t.me/moderg0d_bot\" target=\"_blank\" rel=\"noopener\" class=\"project-inline-link\">@moderg0d_bot</a>. Представляет собой полноценную систему модерации и защиты групп и каналов от спама, флуда и нежелательного контента с удобным управлением через Inline‑меню.</p><ul class=\"modal-features-list\"><li><strong>Защита от спама:</strong> автофильтр нецензурных выражений, кастомный Blacklist стоп-слов и проверка ссылок (Whitelist).</li><li><strong>Анти-бот капча:</strong> проверка новых участников при входе в группу и верификация заявок на вступление в канал.</li><li><strong>Контроль флуда и медиа:</strong> ограничение частоты сообщений, анти-капс и раздельная блокировка голосовых, видеокружочков, стикеров и GIF.</li><li><strong>Система варнов:</strong> настраиваемые автоматические наказания (мут, кик, бан) при накоплении предупреждений.</li><li><strong>Логирование и VIP:</strong> аудит событий модерации в отдельный чат и белый список доверенных пользователей с иммунитетом.</li><li><strong>Интерактивное меню:</strong> персональное управление настройками чатов прямо в ЛС с ботом в 1 клик.</li></ul>",
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
            description: "<p>B2B‑система для автоматизированного поиска, скоринга и сбора базы контактов YouTube‑блогеров на Python и aiogram 3: <a href=\"https://t.me/yt_marinerabot\" target=\"_blank\" rel=\"noopener\" class=\"project-inline-link\">@yt_marinerabot</a>. Бот осуществляет фоновый парсинг каналов через YouTube Data API v3, извлекает прямые контакты и оценивает релевантность лидов от 0 до 100 баллов.</p><ul class=\"modal-features-list\"><li><strong>Сбор и парсинг каналов:</strong> фоновый поиск по ключевым словам через YouTube Data API v3 с авто-ротацией пула API-ключей.</li><li><strong>Извлечение контактов:</strong> интеллектуальный RegEx-парсинг описаний каналов и видео (Telegram, Instagram, Email, веб-сайты).</li><li><strong>Система скоринга лидов:</strong> динамический расчет качества лида (0–100) на основе активности, аудитории, стоп-слов и магнитных фраз.</li><li><strong>Гибкая фильтрация:</strong> поддержка черных списков (Blacklist каналов), минус-слов и фильтрации по дате загрузки видео.</li><li><strong>Экспорт в Excel:</strong> генерация структурированных таблиц .xlsx с авто-очисткой временных файлов и статистикой по базе.</li><li><strong>Приватный доступ и безопасность:</strong> шифрование токенов (Fernet), ограничение доступа по белому списку пользователей.</li></ul>",
            tags: ["Python", "aiogram 3", "YouTube API", "aiosqlite", "Excel", "Cryptography"],
            buttonText: "Приватный доступ",
            buttonUrl: "https://t.me/yt_marinerabot",
            disabled: true,
            disabledReason: "Недоступно: частный проект"
        },

        // Карточка №3 (Paywall)
        3: {
            title: "Paywall",
            category: "Подписки",
            logo: "P",
            description: "Платформа монетизации закрытых каналов и чатов по модели подписки. Автоматический приём платежей (Telegram Stars, банковские карты, криптовалюта), регулярные списания, напоминания об окончании доступа и автокик.",
            tags: ["Платежи", "Telegram Stars", "Webhooks", "Автоподписка"],
            buttonText: "Подробнее",
            buttonUrl: "https://t.me/example_paywall_bot",
            disabled: false,
            disabledReason: ""
        },

        // Карточка №4 (Pulse AI)
        4: {
            title: "Pulse AI",
            category: "Ассистент поддержки",
            logo: "◉",
            description: "Интеллектуальный AI-ассистент первой линии поддержки клиентов. Обучен по документации и базе знаний бизнеса, мгновенно отвечает на типовые запросы 24/7 и бесшовно подключает живого оператора при сложных случаях.",
            tags: ["LLM", "RAG", "Python", "AI Support", "OpenAI"],
            buttonText: "Протестировать",
            buttonUrl: "https://t.me/example_pulse_bot",
            disabled: false,
            disabledReason: ""
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
