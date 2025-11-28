const DATA_URL = "all_regions.csv";
const NOTES_API_URL = "/notes";
const AI_API_URL = "/ai/describe";

const regionFilter = document.getElementById("regionFilter");
const cadastralSearch = document.getElementById("cadastralSearch");
const resetButton = document.getElementById("resetButton");
const resultsBody = document.getElementById("resultsBody");
const resultsCount = document.getElementById("resultsCount");
const loadMoreButton = document.getElementById("loadMoreButton");

const detailsPanel = document.getElementById("detailsPanel");
const detailsPlaceholder = document.getElementById("detailsPlaceholder");
const detailsCard = document.getElementById("detailsCard");
const descriptionDraft = document.getElementById("descriptionDraft");
const generateButton = document.getElementById("generateButton");
const copyButton = document.getElementById("copyButton");
const avitoLinkInput = document.getElementById("avitoLink");
const copyLinkButton = document.getElementById("copyLinkButton");
const openLinkButton = document.getElementById("openLinkButton");
const saveDescriptionButton = document.getElementById("saveDescriptionButton");
const saveLinkButton = document.getElementById("saveLinkButton");
const exportRtfButton = document.getElementById("exportRtfButton");
const exportPdfButton = document.getElementById("exportPdfButton");
const generateGptButton = document.getElementById("generateGptButton");
const articleSearch = document.getElementById("articleSearch");
const areaMinInput = document.getElementById("areaMin");
const areaMaxInput = document.getElementById("areaMax");
const priceMinInput = document.getElementById("priceMin");
const priceMaxInput = document.getElementById("priceMax");

const detailFields = {
  detailsTitle: "cadastral_number",
  detailsRegion: "region",
  detailsArticle: "article",
  detailsArea: "area_ha",
  detailsPriceSotka: "price_per_sotka_rub",
  detailsPricePlot: "price_per_plot_rub",
  detailsDiscount: "discount_limit_percent",
  detailsWholesale: "wholesale_only",
  detailsLandUse: "land_use",
  detailsUsage: "recommended_usage",
  detailsOwner: "owner",
  detailsPartner: "partner",
  detailsRightDate: "right_date",
  detailsBalance: "balance_value",
  detailsNotes: "service_notes",
  detailsContext: "context",
  detailsRecommendations: "recommendations",
  detailsLocation: "location_description",
  detailsBestUse: "best_use",
};

const PHOTO_LINKS = [
  {
    matcher: (record) => {
      const context = normalizeString(record.context).toLowerCase();
      const article = normalizeString(record.article).toLowerCase();
      const region = normalizeString(record.region).toLowerCase();
      return context.includes("аватар") || article.includes("аватар") || region.includes("аватар");
    },
    label: 'Фото "Аватар"',
    url: "https://disk.yandex.ru/d/9rIQf-kuOEHjEA",
  },
];

const usageDescriptions = {
  "1": {
    title: "Плюс 1 · Жилой и рекреационный сценарий",
    text: "Участок органично подходит для индивидуальных домов, камерных резиденций и мягкой рекреации; переход к ИЖС проходит без конфликта с природой.",
  },
  "2": {
    title: "Плюс 2 · Глемпинг и фермерский туризм",
    text: "Рельеф и подъезд позволяют разместить глемпинг, эко-дома или фермерский туризм, создавая авторский маршрут для гостей Республики Алтай.",
  },
  "3": {
    title: "Плюс 3 · Потенциал роста стоимости",
    text: "Земля работает как инвестиционный лот: регион развивается, интерес к локации растёт, окупаемость может достигать 50% годовых при верной концепции.",
  },
  "4": {
    title: "Плюс 4 · Близость к воде",
    text: "Река или водоём рядом усиливают привлекательность: появляются видовые точки, частный выход к воде и аргумент для туристического продукта.",
  },
  "5": {
    title: "Плюс 5 · Лесной ресурс",
    text: "Лесной массив создаёт приватность, тень и готовую природную декорацию — база для клубных домов, эко-гостиниц и маршрутов выходного дня.",
  },
  "6": {
    title: "Плюс 6 · Придорожный трафик",
    text: "Близость к трассе даёт устойчивый поток гостей и делает площадку удобной для придорожного сервиса, мест притяжения и торговых точек.",
  },
  "7": {
    title: "Плюс 7 · Детские программы",
    text: "Масштаб и окружение позволяют запустить детский лагерь, образовательный кампус или сезонные программы на природе без потери логистики.",
  },
  "8": {
    title: "Плюс 8 · Посёлок или бутик-отель",
    text: "Конфигурация участка подходит для посёлка, кластера шале или бутик-отеля — можно развивать проект кварталами с общей концепцией.",
  },
  "9": {
    title: "Плюс 9 · Пространство для усадьбы",
    text: "Локация рассчитана на личную усадьбу, дачу или семейный дом с панорамами и запасом площади под сад, мастерские и гостевые домики.",
  },
};

const PAGE_SIZE = 15;

let records = [];
let filteredRecords = [];
let selectedRecord = null;
let notesIndex = {};
let currentNoteEntry = null;
let visibleCount = 0;

function formatNumber(value) {
  if (value === null || value === undefined || value === "" || isNaN(value)) {
    return "";
  }
  return Number(value).toLocaleString("ru-RU");
}

function normalizeString(value) {
  return value ? String(value).trim() : "";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function coerceNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const normalized = String(value).replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInputNumber(inputElement) {
  if (!inputElement) return null;
  const raw = inputElement.value.trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function getPrimaryCadastral(record) {
  if (!record) return "";
  const raw = normalizeString(record.cadastral_number);
  if (!raw) return "";
  return raw.split(/[;,]/)[0].trim();
}

function refreshSelectedRow() {
  if (!selectedRecord) return;
  const target = selectedRecord.cadastral_number ?? "";
  const rowElement = [...resultsBody.querySelectorAll("tr")].find(
    (row) => row.dataset.cadastral === target
  );
  if (rowElement) {
    selectRecord(selectedRecord, rowElement);
  }
}

function buildIndex(data) {
  const regions = new Set();
  data.forEach((row) => {
    const regionValue = normalizeString(row.region);
    if (regionValue) {
      regions.add(regionValue);
    }
  });

  const sortedRegions = Array.from(regions).sort((a, b) => a.localeCompare(b, "ru"));
  sortedRegions.forEach((region) => {
    const option = document.createElement("option");
    option.value = region;
    option.textContent = region;
    regionFilter.appendChild(option);
  });
}

function updateLoadMoreButton() {
  if (!loadMoreButton) return;
  const total = filteredRecords.length;
  const hasMore = visibleCount < total;
  loadMoreButton.hidden = !hasMore;
  loadMoreButton.disabled = !hasMore;
}

function renderTable(data, options = {}) {
  const { append = false } = options;

  if (!append) {
    visibleCount = Math.min(PAGE_SIZE, data.length);
  } else {
    visibleCount = Math.min(visibleCount + PAGE_SIZE, data.length);
  }

  resultsBody.innerHTML = "";
  const rowsToRender = data.slice(0, visibleCount);
  const fragment = document.createDocumentFragment();

  rowsToRender.forEach((row) => {
    const tr = document.createElement("tr");
    tr.dataset.cadastral = row.cadastral_number || "";
    tr.innerHTML = `
      <td>${row.cadastral_number ?? ""}</td>
      <td>${row.article ?? ""}</td>
      <td>${row.area_ha ?? ""}</td>
      <td>${formatNumber(row.price_per_sotka_rub)}</td>
      <td>${formatNumber(row.price_per_plot_rub)}</td>
    `;
    tr.addEventListener("click", () => selectRecord(row, tr));
    fragment.appendChild(tr);
  });
  resultsBody.appendChild(fragment);

  resultsCount.textContent = data.length;
  updateLoadMoreButton();
  refreshSelectedRow();
}

function clearSelection() {
  selectedRecord = null;
  currentNoteEntry = null;
  descriptionDraft.value = "";
  detailsCard.hidden = true;
  detailsPlaceholder.hidden = false;
  resultsBody.querySelectorAll("tr").forEach((row) => row.classList.remove("active"));
  if (exportRtfButton) {
    exportRtfButton.disabled = true;
  }
  if (exportPdfButton) {
    exportPdfButton.disabled = true;
  }
  if (generateGptButton) {
    generateGptButton.disabled = true;
  }
}

function selectRecord(record, rowElement) {
  selectedRecord = record;
  resultsBody.querySelectorAll("tr").forEach((row) => row.classList.remove("active"));
  rowElement.classList.add("active");

  Object.entries(detailFields).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;

    let value = record[key];
    if (["price_per_sotka_rub", "price_per_plot_rub", "balance_value", "valuation_per_sotka", "valuation_per_plot"].includes(key)) {
      value = formatNumber(value);
    } else {
      value = normalizeString(value);
    }

    if (key === "context" || key === "recommendations" || key === "location_description" || key === "service_notes" || key === "best_use") {
      value = value.replace(/\n+/g, "\n");
      value = escapeHtml(value).replace(/\n/g, "<br/>");
      el.innerHTML = value || "<span class=\"placeholder-text\">—</span>";
    } else {
      el.textContent = value || "—";
    }
  });

  const matchIndexEl = document.getElementById("detailsMatchIndex");
  if (matchIndexEl) {
    const rawValue = normalizeString(record.cadastral_number_raw);
    const totalMatches = rawValue
      ? records.filter((item) => normalizeString(item.cadastral_number_raw) === rawValue).length
      : 0;
    const index = Number(record.match_index);
    if (!Number.isNaN(index)) {
      if (totalMatches > 1) {
        matchIndexEl.textContent = `${index + 1} из ${totalMatches}`;
      } else {
        matchIndexEl.textContent = index + 1;
      }
    } else {
        matchIndexEl.textContent = "—";
    }
  }

  const rawCadastralEl = document.getElementById("detailsCadastralRaw");
  if (rawCadastralEl) {
    const rawValue = normalizeString(record.cadastral_number_raw);
    if (rawValue) {
      rawCadastralEl.innerHTML = escapeHtml(rawValue).replace(/\n/g, "<br/>");
    } else {
      rawCadastralEl.innerHTML = '<span class="placeholder-text">—</span>';
    }
  }

  // Дополнительная расшифровка назначений
  const usageRaw = normalizeString(record.recommended_usage);
  const usageDecodedEl = document.getElementById("detailsUsageDecoded");
  if (usageDecodedEl) {
    const codes = [...new Set((usageRaw.match(/\d+/g) || []))];
    const blocks = codes
      .map((code) => {
        const info = usageDescriptions[code];
        if (!info) return "";
        const title = escapeHtml(info.title);
        const text = escapeHtml(info.text);
        return `<li class="usage-item"><h4 class="usage-title">${title}</h4><p class="usage-text">${text}</p></li>`;
      })
      .filter(Boolean);

    usageDecodedEl.innerHTML = blocks.length
      ? `<ul class="usage-list">${blocks.join("")}</ul>`
      : '<span class="placeholder-text">—</span>';
  }

  // Ссылка на карту
  const detailsMap = document.getElementById("detailsMap");
  if (detailsMap) {
    const rawNumber = normalizeString(record.cadastral_number);
    if (rawNumber) {
      const firstNumber = rawNumber.split(/[;,]/)[0].trim();
      if (!detailsMap.querySelector(".map-frame")) {
        detailsMap.innerHTML = `
          <div class="map-embed">
            <iframe
              class="map-frame"
              title="Карта участка"
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
          <div class="map-links">
            <a class="map-link secondary" target="_blank" rel="noopener">
              Открыть в Публичной кадастровой карте
            </a>
          </div>
        `;
      }

      const frame = detailsMap.querySelector(".map-frame");
      if (frame) {
        frame.src = `map.html?cad=${encodeURIComponent(firstNumber)}`;
      }

      const publicMapLink = detailsMap.querySelector(".map-links a");
      if (publicMapLink) {
        publicMapLink.href = `https://pkk.rosreestr.ru/#/search/${firstNumber}`;
        publicMapLink.textContent = `Публичная кадастровая карта: ${firstNumber}`;
      }
    } else {
      detailsMap.innerHTML = '<span class="placeholder-text">—</span>';
    }
  }

  // Фото
  const detailsPhotos = document.getElementById("detailsPhotos");
  if (detailsPhotos) {
    const matched = PHOTO_LINKS.find((entry) => entry.matcher(record));
    if (matched) {
      detailsPhotos.innerHTML = `<a href="${matched.url}" target="_blank" rel="noopener" class="map-link">${escapeHtml(matched.label)}</a>`;
    } else {
      detailsPhotos.innerHTML = '<span class="placeholder-text">—</span>';
    }
  }

  const primaryCadastral = getPrimaryCadastral(record);
  const noteEntry = notesIndex[primaryCadastral] || {};
  descriptionDraft.value = noteEntry.description ?? "";
  avitoLinkInput.value = noteEntry.avito_link ?? "";
  currentNoteEntry = noteEntry;

  detailsPlaceholder.hidden = true;
  detailsCard.hidden = false;
  if (exportRtfButton) {
    exportRtfButton.disabled = false;
  }
  if (exportPdfButton) {
    exportPdfButton.disabled = false;
  }
  if (generateGptButton) {
    generateGptButton.disabled = false;
  }
}

function applyFilters(options = {}) {
  const { autoSelect = false } = options;
  const regionValue = regionFilter.value.trim();
  const cadastralValue = cadastralSearch.value.trim().toLowerCase();
  const articleValue = articleSearch ? articleSearch.value.trim().toLowerCase() : "";
  const areaMin = parseInputNumber(areaMinInput);
  const areaMax = parseInputNumber(areaMaxInput);
  const priceMin = parseInputNumber(priceMinInput);
  const priceMax = parseInputNumber(priceMaxInput);

  filteredRecords = records.filter((row) => {
    const regionMatch = !regionValue || normalizeString(row.region) === regionValue;
    const cadastralSource = String(row.cadastral_number ?? "").toLowerCase();
    const cadastralMatch = !cadastralValue || cadastralSource.includes(cadastralValue);
    const articleSource = normalizeString(row.article).toLowerCase();
    const articleMatch = !articleValue || articleSource.includes(articleValue);

    const areaValue = coerceNumber(row.area_ha);
    const areaMatch =
      (areaMin === null || (areaValue !== null && areaValue >= areaMin)) &&
      (areaMax === null || (areaValue !== null && areaValue <= areaMax));

    const priceValue = coerceNumber(row.price_per_plot_rub);
    const priceMatch =
      (priceMin === null || (priceValue !== null && priceValue >= priceMin)) &&
      (priceMax === null || (priceValue !== null && priceValue <= priceMax));

    return regionMatch && cadastralMatch && articleMatch && areaMatch && priceMatch;
  });

  filteredRecords.sort((a, b) => {
    const regionCompare = normalizeString(a.region).localeCompare(normalizeString(b.region), "ru");
    if (!regionValue && regionCompare !== 0) {
      return regionCompare;
    }
    const numA = Number(a.number);
    const numB = Number(b.number);
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      return numA - numB;
    }
    return (a.source_row ?? 0) - (b.source_row ?? 0);
  });

  renderTable(filteredRecords);
  const recordStillVisible = selectedRecord && filteredRecords.includes(selectedRecord);
  if (!recordStillVisible) {
    clearSelection();
  }

  if (autoSelect && filteredRecords.length > 0) {
    const firstRow = resultsBody.querySelector("tr");
    if (firstRow) {
      selectRecord(filteredRecords[0], firstRow);
    }
  }
}

function handleGenerate() {
  if (!selectedRecord) return;

  const fragments = [];
  fragments.push(`Участок ${selectedRecord.cadastral_number || "—"} (${selectedRecord.area_ha || "—"} га) расположен в районе ${selectedRecord.region || "—"}.`);

  if (selectedRecord.location_description) {
    fragments.push(selectedRecord.location_description);
  }

  if (selectedRecord.context) {
    fragments.push(selectedRecord.context);
  }

  if (selectedRecord.recommended_usage) {
    const usageRaw = normalizeString(selectedRecord.recommended_usage);
    fragments.push(`Рекомендуемое назначение: ${usageRaw || "—"}.`);

    const usageCodes = [...new Set((usageRaw.match(/\d+/g) || []))];
    const usageBlocks = usageCodes
      .map((code) => {
        const info = usageDescriptions[code];
        if (!info) return "";
        return `${info.title}\n${info.text}`;
      })
      .filter((block) => Boolean(block));

    if (usageBlocks.length) {
      fragments.push(usageBlocks.join("\n\n"));
    }
  }

  if (selectedRecord.price_per_plot_rub || selectedRecord.price_per_sotka_rub) {
    const parts = [];
    if (selectedRecord.price_per_plot_rub) {
      parts.push(`цена за участок ${formatNumber(selectedRecord.price_per_plot_rub)} руб.`);
    }
    if (selectedRecord.price_per_sotka_rub) {
      parts.push(`стоимость сотки ${formatNumber(selectedRecord.price_per_sotka_rub)} руб.`);
    }
    fragments.push(`Предложение: ${parts.join(", ")}.`);
  }

  if (selectedRecord.service_notes) {
    fragments.push(`Служебные отметки: ${selectedRecord.service_notes}.`);
  }

  descriptionDraft.value = fragments.join("\n\n");
}

async function handleGenerateGpt() {
  if (!selectedRecord || !generateGptButton) return;

  const originalLabel = generateGptButton.textContent;
  generateGptButton.disabled = true;
  generateGptButton.textContent = "Генерирую...";
  let forceDisable = false;

  const primary = getPrimaryCadastral(selectedRecord);
  const existingNote = (currentNoteEntry && typeof currentNoteEntry.description === "string" && currentNoteEntry.description.trim())
    ? currentNoteEntry.description.trim()
    : descriptionDraft.value.trim();

  try {
    const response = await fetch(AI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record: selectedRecord,
        existing_note: existingNote,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data && typeof data.text === "string" && data.text.trim()) {
      descriptionDraft.value = data.text.trim();
      if (primary) {
        const entry = notesIndex[primary] || {};
        entry.description = descriptionDraft.value;
        notesIndex[primary] = entry;
      }
      generateGptButton.textContent = "Готово";
    } else {
      generateGptButton.textContent = "Пустой ответ";
    }
  } catch (error) {
    console.error("YandexGPT error", error);
    const message = typeof error?.message === "string" ? error.message : "";
    alert("Не удалось получить ответ от YandexGPT. Проверьте ключ и интернет.");
    if (/YandexGPT is not configured/i.test(message) || /503/.test(message)) {
      forceDisable = true;
    }
    generateGptButton.textContent = "Ошибка";
  } finally {
    if (forceDisable) {
      generateGptButton.textContent = "Недоступно";
      generateGptButton.disabled = true;
      return;
    }
    setTimeout(() => {
      generateGptButton.textContent = originalLabel;
      generateGptButton.disabled = false;
    }, 1500);
  }
}

function handleCopy() {
  if (!descriptionDraft.value) return;
  navigator.clipboard
    .writeText(descriptionDraft.value)
    .then(() => {
      copyButton.textContent = "Скопировано!";
      setTimeout(() => {
        copyButton.textContent = "Скопировать";
      }, 1500);
    })
    .catch(() => {
      copyButton.textContent = "Ошибка копирования";
      setTimeout(() => {
        copyButton.textContent = "Скопировать";
      }, 1500);
    });
}

function handleSaveDescription() {
  saveNote({ description: descriptionDraft.value }, saveDescriptionButton, "Сохранено!");
}

function handleCopyLink() {
  const link = avitoLinkInput.value.trim();
  if (!link) return;
  navigator.clipboard
    .writeText(link)
    .then(() => {
      copyLinkButton.textContent = "Скопировано!";
      setTimeout(() => (copyLinkButton.textContent = "Скопировать ссылку"), 1500);
    })
    .catch(() => {
      copyLinkButton.textContent = "Ошибка";
      setTimeout(() => (copyLinkButton.textContent = "Скопировать ссылку"), 1500);
    });
}

function handleSaveLink() {
  saveNote({ avito_link: avitoLinkInput.value.trim() }, saveLinkButton, "Сохранено!");
}

function handleOpenLink() {
  const link = avitoLinkInput.value.trim();
  if (!link) return;
  const prefixed = /^https?:\/\//i.test(link) ? link : `https://${link}`;
  window.open(prefixed, "_blank", "noopener");
}

function handleReset() {
  regionFilter.value = "";
  cadastralSearch.value = "";
  if (articleSearch) {
    articleSearch.value = "";
  }
  if (areaMinInput) {
    areaMinInput.value = "";
  }
  if (areaMaxInput) {
    areaMaxInput.value = "";
  }
  if (priceMinInput) {
    priceMinInput.value = "";
  }
  if (priceMaxInput) {
    priceMaxInput.value = "";
  }
  clearSelection();
  applyFilters({ autoSelect: true });
}

function hasValue(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "number") {
    return !Number.isNaN(value);
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  return true;
}

function buildUsageDecodedText(record) {
  const usageRaw = normalizeString(record.recommended_usage);
  if (!usageRaw) return "";
  const codes = [...new Set((usageRaw.match(/\d/g) || []))];
  if (!codes.length) return usageRaw;
  return codes
    .map((code) => {
      const decoded = usageDescriptions[code] || "";
      return decoded ? `${code} — ${decoded}` : code;
    })
    .join("\n");
}

function collectExportSections(record, noteEntry, descriptionText) {
  const sections = [];
  const push = (label, value) => {
    if (value === null || value === undefined) return;
    const text = typeof value === "string" ? value.trim() : String(value).trim();
    if (!text) return;
    sections.push({ label, value: text });
  };

  push("Регион", record.region);
  push("Артикул", record.article);
  if (hasValue(record.area_ha)) {
    push("Площадь, га", formatNumber(record.area_ha));
  }
  if (hasValue(record.price_per_plot_rub)) {
    push("Цена за участок, руб", formatNumber(record.price_per_plot_rub));
  }
  if (hasValue(record.price_per_sotka_rub)) {
    push("Цена за сотку, руб", formatNumber(record.price_per_sotka_rub));
  }
  if (hasValue(record.discount_limit_percent)) {
    const discount = typeof record.discount_limit_percent === "number" && !Number.isNaN(record.discount_limit_percent)
      ? `${record.discount_limit_percent}%`
      : String(record.discount_limit_percent);
    push("Допустимая скидка", discount);
  }
  if (hasValue(record.wholesale_only)) {
    let wholesale = record.wholesale_only;
    if (typeof wholesale === "boolean") {
      wholesale = wholesale ? "Только опт" : "Розница возможна";
    } else {
      const normalized = normalizeString(String(wholesale));
      if (/^(1|да|yes|true)$/i.test(normalized)) {
        wholesale = "Только опт";
      } else if (/^(0|нет|no|false)$/i.test(normalized)) {
        wholesale = "Розница возможна";
      } else {
        wholesale = normalized;
      }
    }
    push("Продажа (опт)", wholesale);
  }
  push("ВРИ / Категория", record.land_use);
  push("Рекомендованное назначение", record.recommended_usage);
  const decodedUsage = buildUsageDecodedText(record);
  if (decodedUsage && decodedUsage !== record.recommended_usage) {
    push("Расшифровка назначений", decodedUsage);
  }
  push("Служебные отметки", record.service_notes);
  push("Контекст", record.context);
  push("Рекомендации", record.recommendations);
  push("Описание расположения", record.location_description);
  push("Наилучшее использование", record.best_use);
  push("Собственник", record.owner);
  push("Партнёр", record.partner);
  push("Дата права", record.right_date);
  if (hasValue(record.balance_value)) {
    push("Балансовая стоимость", formatNumber(record.balance_value));
  }

  if (noteEntry && hasValue(noteEntry.avito_link)) {
    push("Ссылка Авито", noteEntry.avito_link);
  }

  const rawNumber = normalizeString(record.cadastral_number);
  if (rawNumber) {
    const firstNumber = rawNumber.split(/[;,]/)[0].trim();
    const rosreestrUrl = `https://pkk.rosreestr.ru/#/search/${firstNumber}`;
    push("Публичная карта", rosreestrUrl);
  }

  if (descriptionText) {
    push("Черновик описания", descriptionText);
  }

  return sections;
}

function encodeRtfText(input) {
  const text = (input ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let result = "";
  for (const char of text) {
    if (char === "\n") {
      result += "\\line ";
      continue;
    }
    if (char === "\\") {
      result += "\\\\";
      continue;
    }
    if (char === "{") {
      result += "\\{";
      continue;
    }
    if (char === "}") {
      result += "\\}";
      continue;
    }
    const code = char.charCodeAt(0);
    if (code >= 32 && code <= 126) {
      result += char;
    } else {
      const signed = code <= 32767 ? code : code - 65536;
      result += `\\u${signed}?`;
    }
  }
  return result;
}

function buildRtfDocument({ title, subtitle, sections, generatedAt }) {
  const parts = [
    "{\\rtf1\\ansi\\deff0",
    "{\\fonttbl{\\f0 Arial;}}",
    "\\viewkind4\\uc1",
    `\\pard\\f0\\fs32\\b ${encodeRtfText(title)}\\b0\\par`,
  ];

  if (subtitle) {
    parts.push(`\\pard\\sa200\\fs24 ${encodeRtfText(subtitle)}\\par`);
  }

  sections.forEach(({ label, value }) => {
    parts.push(`\\pard\\sa200\\fs22\\b ${encodeRtfText(label)}:\\b0\\par`);
    parts.push(`\\pard\\sa100\\fs22 ${encodeRtfText(value)}\\par`);
  });

  if (generatedAt) {
    parts.push(`\\pard\\sa300\\fs18 ${encodeRtfText(`Дата выгрузки: ${generatedAt}`)}\\par`);
  }

  parts.push("}");
  return parts.join("\n");
}

function buildExportFilename(record, extension) {
  const primary = getPrimaryCadastral(record) || "parcel";
  const safe = primary.replace(/[^0-9a-zA-Z]+/g, "_").replace(/^_+|_+$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  const base = safe || "parcel";
  return `parcel_${base}_${date}.${extension}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function handleExportRtf() {
  if (!selectedRecord) return;
  const primary = getPrimaryCadastral(selectedRecord);
  const noteEntry = primary ? notesIndex[primary] || {} : {};
  const descriptionText = descriptionDraft.value.trim();
  const sections = collectExportSections(selectedRecord, noteEntry, descriptionText);
  const generatedAt = new Date().toLocaleString("ru-RU");
  const subtitleParts = [];
  if (normalizeString(selectedRecord.region)) {
    subtitleParts.push(selectedRecord.region);
  }
  if (hasValue(selectedRecord.area_ha)) {
    subtitleParts.push(`${formatNumber(selectedRecord.area_ha)} га`);
  }
  const subtitle = subtitleParts.join(" • ");
  const title = `Участок ${normalizeString(selectedRecord.cadastral_number) || "без кадастрового номера"}`;
  const rtfContent = buildRtfDocument({ title, subtitle, sections, generatedAt });
  const blob = new Blob([rtfContent], { type: "application/rtf" });
  downloadBlob(blob, buildExportFilename(selectedRecord, "rtf"));
}

function buildPrintHtml({ title, subtitle, sections, generatedAt }) {
  const sectionsHtml = sections
    .map(({ label, value }) => {
      const safeLabel = escapeHtml(label);
      const safeValue = escapeHtml(value).replace(/\n/g, "<br/>");
      return `
        <section class="entry">
          <h3>${safeLabel}</h3>
          <p>${safeValue}</p>
        </section>
      `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color: #111827;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.5;
      }
      body {
        margin: 2.5rem;
        color: inherit;
      }
      .report-header h1 {
        margin: 0 0 0.4rem;
        font-size: 1.9rem;
      }
      .report-header p {
        margin: 0.2rem 0;
        color: #4b5563;
      }
      .meta {
        margin-top: 0.6rem;
        font-size: 0.9rem;
        color: #6b7280;
      }
      .entry {
        margin-top: 1.4rem;
        page-break-inside: avoid;
      }
      .entry h3 {
        margin: 0 0 0.35rem;
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #1f2937;
      }
      .entry p {
        margin: 0;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <header class="report-header">
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
      <p class="meta">Дата выгрузки: ${escapeHtml(generatedAt)}</p>
    </header>
    ${sectionsHtml}
    <script>
      window.addEventListener('load', function () {
        window.focus();
        setTimeout(function () { window.print(); }, 120);
      });
      window.addEventListener('afterprint', function () {
        window.close();
      });
    </script>
  </body>
</html>`;
}

function handleExportPdf() {
  if (!selectedRecord) return;
  const primary = getPrimaryCadastral(selectedRecord);
  const noteEntry = primary ? notesIndex[primary] || {} : {};
  const descriptionText = descriptionDraft.value.trim();
  const sections = collectExportSections(selectedRecord, noteEntry, descriptionText);
  const generatedAt = new Date().toLocaleString("ru-RU");
  const subtitleParts = [];
  if (normalizeString(selectedRecord.region)) {
    subtitleParts.push(selectedRecord.region);
  }
  if (hasValue(selectedRecord.area_ha)) {
    subtitleParts.push(`${formatNumber(selectedRecord.area_ha)} га`);
  }
  const subtitle = subtitleParts.join(" • ");
  const title = `Участок ${normalizeString(selectedRecord.cadastral_number) || "без кадастрового номера"}`;
  const html = buildPrintHtml({ title, subtitle, sections, generatedAt });
  const printWindow = window.open("", "_blank", "noopener");
  if (!printWindow) {
    alert("Не удалось открыть окно печати. Разрешите всплывающие окна для этого сайта.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}

function initEvents() {
  regionFilter.addEventListener("change", () => applyFilters({ autoSelect: true }));
  cadastralSearch.addEventListener("input", () => applyFilters());
  resetButton.addEventListener("click", handleReset);
  generateButton.addEventListener("click", handleGenerate);
  if (generateGptButton) {
    generateGptButton.addEventListener("click", handleGenerateGpt);
  }
  copyButton.addEventListener("click", handleCopy);
  copyLinkButton.addEventListener("click", handleCopyLink);
  openLinkButton.addEventListener("click", handleOpenLink);
  if (articleSearch) {
    articleSearch.addEventListener("input", () => applyFilters());
  }
  [areaMinInput, areaMaxInput, priceMinInput, priceMaxInput].forEach((input) => {
    if (input) {
      input.addEventListener("input", () => applyFilters());
    }
  });
  if (saveDescriptionButton) {
    saveDescriptionButton.addEventListener("click", handleSaveDescription);
  }
  if (saveLinkButton) {
    saveLinkButton.addEventListener("click", handleSaveLink);
  }
  if (exportRtfButton) {
    exportRtfButton.addEventListener("click", handleExportRtf);
  }
  if (exportPdfButton) {
    exportPdfButton.addEventListener("click", handleExportPdf);
  }
}

function loadData() {
  Papa.parse(DATA_URL, {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (results) => {
      records = results.data;
      filteredRecords = records.slice();
      buildIndex(records);
      applyFilters({ autoSelect: true });
      loadNotes();
    },
    error: (error) => {
      console.error("Не удалось загрузить данные", error);
    },
  });
}

async function loadNotes() {
  try {
    const response = await fetch(NOTES_API_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data && typeof data === "object") {
      notesIndex = data;
    } else {
      notesIndex = {};
    }
    refreshSelectedRow();
  } catch (error) {
    console.warn("Не удалось загрузить заметки", error);
    notesIndex = {};
  }
}

async function saveNote(partialPayload, buttonElement, successLabel) {
  if (!selectedRecord) return;
  const cadastral = getPrimaryCadastral(selectedRecord);
  if (!cadastral) return;

  const body = {
    cadastral_number: cadastral,
    ...partialPayload,
  };

  const originalLabel = buttonElement.textContent;
  buttonElement.disabled = true;
  buttonElement.textContent = "Сохраняю...";

  try {
    const response = await fetch(NOTES_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const entry = notesIndex[cadastral] || {};
    Object.assign(entry, partialPayload);
    notesIndex[cadastral] = entry;

    buttonElement.textContent = successLabel;
    refreshSelectedRow();
  } catch (error) {
    console.error("Не удалось сохранить данные", error);
    buttonElement.textContent = "Ошибка";
  } finally {
    setTimeout(() => {
      buttonElement.textContent = originalLabel;
      buttonElement.disabled = false;
    }, 1200);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initEvents();
  if (loadMoreButton) {
    loadMoreButton.addEventListener("click", () => {
      renderTable(filteredRecords, { append: true });
    });
  }
  loadData();
});
