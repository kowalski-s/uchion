const pptxgen = require("pptxgenjs");

// ============================================================
// КОНФИГУРАЦИЯ ЦВЕТОВ
// ============================================================
const THEMES = {
  // Минималистичная тёплая тема (по умолчанию)
  warm: {
    primary: "1A1A1A",      // основной тёмный
    secondary: "F5F3F0",    // фон светлый
    accent: "8B7355",       // акцент
    text: "2D2D2D",         // текст
    lightGray: "E8E4DF",    // светло-серый
    white: "FFFFFF",
    muted: "6B6B6B"         // приглушённый
  },
  // Холодная синяя тема
  cool: {
    primary: "1E2761",
    secondary: "F8FAFC",
    accent: "3B82F6",
    text: "1E293B",
    lightGray: "E2E8F0",
    white: "FFFFFF",
    muted: "64748B"
  },
  // Тёмная тема
  dark: {
    primary: "0F0F0F",
    secondary: "1A1A1A",
    accent: "10B981",
    text: "F1F1F1",
    lightGray: "2D2D2D",
    white: "FFFFFF",
    muted: "9CA3AF"
  }
};

// ============================================================
// СТРУКТУРА ДАННЫХ ПРЕЗЕНТАЦИИ
// ============================================================
const TEMPLATE_DATA = {
  // Метаданные
  meta: {
    title: "",           // Название презентации
    author: "",          // Автор
    subject: "",         // Предмет
    class: "",           // Класс
    year: ""             // Учебный год
  },

  // Слайд 1: Титульный
  titleSlide: {
    category: "",        // Категория/предмет (маленький текст сверху)
    title: "",           // Основной заголовок
    subtitle: "",        // Подзаголовок
    footer: ""           // Нижняя строка (класс, год)
  },

  // Слайд 2: Содержание
  contentsSlide: {
    title: "Содержание",
    items: [
      // { num: "01", title: "", description: "" }
    ]
  },

  // Слайд 3+: Слайды с контентом
  // Каждый слайд может быть одного из типов:
  contentSlides: [
    // Примеры типов слайдов:
    // 
    // ТИП: twoColumn — две колонки (тёмная слева, контент справа)
    // {
    //   type: "twoColumn",
    //   sectionNum: "01",
    //   sectionTitle: "",
    //   sectionSubtitle: "",
    //   contentTitle: "",
    //   contentText: "",
    //   cards: [{ title: "", text: "" }]
    // }
    //
    // ТИП: formula — слайд с крупной формулой/цитатой
    // {
    //   type: "formula",
    //   sectionNum: "02",
    //   title: "",
    //   formula: "",
    //   description: "",
    //   items: [{ symbol: "", label: "" }]
    // }
    //
    // ТИП: grid — сетка карточек 2x2
    // {
    //   type: "grid",
    //   sectionNum: "03",
    //   title: "",
    //   cards: [{ title: "", description: "", value: "", note: "" }]
    // }
    //
    // ТИП: stats — большие числа/статистика
    // {
    //   type: "stats",
    //   title: "",
    //   subtitle: "",
    //   stats: [{ value: "", label: "" }],
    //   footer: ""
    // }
    //
    // ТИП: practice — задача с решением
    // {
    //   type: "practice",
    //   sectionNum: "04",
    //   title: "",
    //   taskTitle: "",
    //   taskText: "",
    //   solutionTitle: "",
    //   solutionText: "",
    //   answer: "",
    //   answerNote: ""
    // }
  ],

  // Финальный слайд
  endSlide: {
    thankYou: "СПАСИБО ЗА ВНИМАНИЕ",
    title: "Вопросы?",
    contactInfo: ""      // Контактная информация (многострочный текст)
  }
};

// ============================================================
// ФУНКЦИИ ГЕНЕРАЦИИ СЛАЙДОВ
// ============================================================

/**
 * Создаёт титульный слайд
 */
function createTitleSlide(pres, data, colors) {
  const slide = pres.addSlide();
  slide.background = { color: colors.primary };

  // Вертикальная линия-акцент слева
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 0.8, w: 0.04, h: 4,
    fill: { color: colors.accent }
  });

  // Категория (маленький текст)
  if (data.category) {
    slide.addText(data.category.toUpperCase(), {
      x: 1.1, y: 0.8, w: 7, h: 0.4,
      fontSize: 12, fontFace: "Arial", color: colors.accent,
      bold: true, charSpacing: 6
    });
  }

  // Заголовок
  slide.addText(data.title || "Заголовок", {
    x: 1.1, y: 1.4, w: 5.2, h: 2,
    fontSize: 42, fontFace: "Georgia", color: colors.white,
    bold: true, lineSpacing: 48
  });

  // Подзаголовок
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 1.1, y: 3.5, w: 5, h: 0.5,
      fontSize: 18, fontFace: "Arial", color: colors.muted
    });
  }

  // Нижняя строка
  if (data.footer) {
    slide.addText(data.footer, {
      x: 1.1, y: 4.8, w: 5, h: 0.4,
      fontSize: 11, fontFace: "Arial", color: colors.muted
    });
  }

  // Декоративные блоки справа
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 6.5, y: 0.8, w: 3, h: 4,
    fill: { color: colors.lightGray }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 7, y: 1.3, w: 2, h: 2.5,
    fill: { color: colors.white }
  });

  return slide;
}

/**
 * Создаёт слайд с содержанием
 */
function createContentsSlide(pres, data, colors) {
  const slide = pres.addSlide();
  slide.background = { color: colors.secondary };

  // Заголовок
  slide.addText(data.title || "Содержание", {
    x: 0.7, y: 0.5, w: 4, h: 0.8,
    fontSize: 36, fontFace: "Georgia", color: colors.primary,
    bold: true, margin: 0
  });

  // Пункты содержания
  let yPos = 1.5;
  for (const item of (data.items || [])) {
    slide.addText(item.num || "", {
      x: 0.7, y: yPos, w: 0.7, h: 0.5,
      fontSize: 24, fontFace: "Georgia", color: colors.accent,
      bold: true, margin: 0
    });
    slide.addText(item.title || "", {
      x: 1.5, y: yPos, w: 3, h: 0.4,
      fontSize: 18, fontFace: "Arial", color: colors.primary,
      bold: true, margin: 0
    });
    if (item.description) {
      slide.addText(item.description, {
        x: 1.5, y: yPos + 0.35, w: 4, h: 0.4,
        fontSize: 11, fontFace: "Arial", color: colors.muted,
        margin: 0
      });
    }
    yPos += 0.95;
  }

  // Блок справа с количеством разделов
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 6.3, y: 0.5, w: 3.2, h: 4.6,
    fill: { color: colors.primary }
  });
  slide.addText(String(data.items?.length || 0), {
    x: 6.5, y: 1.2, w: 2.8, h: 1.5,
    fontSize: 72, fontFace: "Georgia", color: colors.white,
    bold: true, align: "center"
  });
  slide.addText(data.items?.length === 1 ? "раздел" : "раздела", {
    x: 6.5, y: 2.7, w: 2.8, h: 0.5,
    fontSize: 14, fontFace: "Arial", color: colors.muted,
    align: "center"
  });

  return slide;
}

/**
 * Создаёт слайд с двумя колонками
 */
function createTwoColumnSlide(pres, data, colors) {
  const slide = pres.addSlide();
  slide.background = { color: colors.secondary };

  // Левая колонка — тёмная
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 4.5, h: 5.625,
    fill: { color: colors.primary }
  });

  // Номер раздела
  if (data.sectionNum) {
    slide.addText(data.sectionNum, {
      x: 0.5, y: 0.5, w: 1, h: 0.6,
      fontSize: 14, fontFace: "Arial", color: colors.accent,
      bold: true
    });
  }

  // Заголовок раздела
  slide.addText(data.sectionTitle || "Заголовок", {
    x: 0.5, y: 1.2, w: 3.8, h: 2.2,
    fontSize: 28, fontFace: "Georgia", color: colors.white,
    bold: true, lineSpacing: 34
  });

  // Подпись раздела
  if (data.sectionSubtitle) {
    slide.addText(data.sectionSubtitle, {
      x: 0.5, y: 4.8, w: 3.5, h: 0.4,
      fontSize: 10, fontFace: "Arial", color: colors.muted
    });
  }

  // Правая колонка — контент
  if (data.contentTitle) {
    slide.addText(data.contentTitle, {
      x: 5, y: 0.6, w: 4.5, h: 0.5,
      fontSize: 18, fontFace: "Arial", color: colors.primary,
      bold: true, margin: 0
    });
  }

  if (data.contentText) {
    slide.addText(data.contentText, {
      x: 5, y: 1.2, w: 4.5, h: 1,
      fontSize: 12, fontFace: "Arial", color: colors.text,
      margin: 0
    });
  }

  // Карточки
  let cardY = 2.4;
  for (const card of (data.cards || [])) {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 5, y: cardY, w: 4.5, h: 0.9,
      fill: { color: colors.white }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 5, y: cardY, w: 0.05, h: 0.9,
      fill: { color: colors.accent }
    });
    slide.addText(card.title || "", {
      x: 5.2, y: cardY + 0.15, w: 4, h: 0.35,
      fontSize: 13, fontFace: "Arial", color: colors.primary,
      bold: true, margin: 0
    });
    slide.addText(card.text || "", {
      x: 5.2, y: cardY + 0.5, w: 4, h: 0.3,
      fontSize: 10, fontFace: "Arial", color: colors.muted,
      margin: 0
    });
    cardY += 1;
  }

  return slide;
}

/**
 * Создаёт слайд с формулой/цитатой
 */
function createFormulaSlide(pres, data, colors) {
  const slide = pres.addSlide();
  slide.background = { color: colors.white };

  // Номер раздела
  if (data.sectionNum) {
    slide.addText(data.sectionNum, {
      x: 0.7, y: 0.5, w: 1, h: 0.5,
      fontSize: 12, fontFace: "Arial", color: colors.accent,
      bold: true
    });
  }

  // Заголовок
  slide.addText(data.title || "Заголовок", {
    x: 0.7, y: 1, w: 5, h: 0.7,
    fontSize: 32, fontFace: "Georgia", color: colors.primary,
    bold: true, margin: 0
  });

  // Блок с формулой
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.9, w: 8.6, h: 2.2,
    fill: { color: colors.lightGray }
  });

  slide.addText(data.formula || "", {
    x: 0.7, y: 2.2, w: 8.6, h: 1,
    fontSize: 48, fontFace: "Georgia", color: colors.primary,
    bold: true, align: "center", margin: 0
  });

  if (data.description) {
    slide.addText(data.description, {
      x: 0.7, y: 3.3, w: 8.6, h: 0.5,
      fontSize: 12, fontFace: "Arial", color: colors.muted,
      align: "center", margin: 0
    });
  }

  // Нижние блоки с пояснениями
  const items = data.items || [];
  const itemWidth = 8.6 / Math.max(items.length, 1);
  let fx = 0.7;

  for (const item of items) {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: fx, y: 4.3, w: itemWidth - 0.2, h: 1,
      fill: { color: colors.primary }
    });
    slide.addText(item.symbol || "", {
      x: fx + 0.2, y: 4.4, w: 1.2, h: 0.5,
      fontSize: 20, fontFace: "Georgia", color: colors.accent,
      bold: true, margin: 0
    });
    slide.addText(item.label || "", {
      x: fx + 1.4, y: 4.45, w: itemWidth - 1.8, h: 0.8,
      fontSize: 9, fontFace: "Arial", color: colors.white,
      margin: 0
    });
    fx += itemWidth;
  }

  return slide;
}

/**
 * Создаёт слайд с сеткой карточек
 */
function createGridSlide(pres, data, colors) {
  const slide = pres.addSlide();
  slide.background = { color: colors.secondary };

  // Номер раздела
  if (data.sectionNum) {
    slide.addText(data.sectionNum, {
      x: 0.7, y: 0.4, w: 1, h: 0.4,
      fontSize: 12, fontFace: "Arial", color: colors.accent,
      bold: true
    });
  }

  // Заголовок
  slide.addText(data.title || "Заголовок", {
    x: 0.7, y: 0.8, w: 5, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: colors.primary,
    bold: true, margin: 0
  });

  // Сетка 2x2
  const positions = [
    { x: 0.7, y: 1.6 }, { x: 5.1, y: 1.6 },
    { x: 0.7, y: 3.5 }, { x: 5.1, y: 3.5 }
  ];

  const cards = data.cards || [];
  for (let i = 0; i < Math.min(cards.length, 4); i++) {
    const card = cards[i];
    const pos = positions[i];

    slide.addShape(pres.shapes.RECTANGLE, {
      x: pos.x, y: pos.y, w: 4.2, h: 1.7,
      fill: { color: colors.white }
    });

    slide.addText(card.title || "", {
      x: pos.x + 0.3, y: pos.y + 0.2, w: 2.5, h: 0.4,
      fontSize: 16, fontFace: "Arial", color: colors.primary,
      bold: true, margin: 0
    });

    slide.addText(card.description || "", {
      x: pos.x + 0.3, y: pos.y + 0.6, w: 2.5, h: 0.4,
      fontSize: 10, fontFace: "Arial", color: colors.muted,
      margin: 0
    });

    if (card.value) {
      slide.addText(card.value, {
        x: pos.x + 2.6, y: pos.y + 0.35, w: 1.4, h: 1,
        fontSize: 28, fontFace: "Georgia", color: colors.primary,
        bold: true, align: "center", margin: 0
      });
    }

    slide.addShape(pres.shapes.RECTANGLE, {
      x: pos.x + 0.3, y: pos.y + 1.1, w: 3.6, h: 0.02,
      fill: { color: colors.lightGray }
    });

    if (card.note) {
      slide.addText(card.note, {
        x: pos.x + 0.3, y: pos.y + 1.25, w: 2, h: 0.3,
        fontSize: 10, fontFace: "Arial", color: colors.accent,
        margin: 0
      });
    }
  }

  return slide;
}

/**
 * Создаёт слайд со статистикой
 */
function createStatsSlide(pres, data, colors) {
  const slide = pres.addSlide();
  slide.background = { color: colors.primary };

  // Заголовок
  slide.addText(data.title || "Статистика", {
    x: 0.7, y: 0.5, w: 5, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: colors.white,
    bold: true, margin: 0
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.7, y: 1.1, w: 5, h: 0.4,
      fontSize: 12, fontFace: "Arial", color: colors.muted,
      margin: 0
    });
  }

  // Блоки статистики
  const stats = data.stats || [];
  const statWidth = 8.6 / Math.max(stats.length, 1);
  let sx = 0.7;

  for (const stat of stats) {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: sx, y: 1.8, w: statWidth - 0.2, h: 2.5,
      fill: { color: "2A2A2A" }
    });

    slide.addText(stat.value || "", {
      x: sx, y: 2, w: statWidth - 0.2, h: 1.2,
      fontSize: 56, fontFace: "Georgia", color: colors.white,
      bold: true, align: "center", margin: 0
    });

    slide.addText(stat.label || "", {
      x: sx, y: 3.3, w: statWidth - 0.2, h: 0.8,
      fontSize: 11, fontFace: "Arial", color: colors.muted,
      align: "center", margin: 0
    });

    sx += statWidth;
  }

  // Нижний блок
  if (data.footer) {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 4.5, w: 8.6, h: 0.8,
      fill: { color: colors.accent }
    });
    slide.addText(data.footer, {
      x: 0.7, y: 4.6, w: 8.6, h: 0.6,
      fontSize: 14, fontFace: "Arial", color: colors.white,
      align: "center", valign: "middle"
    });
  }

  return slide;
}

/**
 * Создаёт слайд с практическим заданием
 */
function createPracticeSlide(pres, data, colors) {
  const slide = pres.addSlide();
  slide.background = { color: colors.secondary };

  // Номер раздела
  if (data.sectionNum) {
    slide.addText(data.sectionNum, {
      x: 0.7, y: 0.4, w: 1, h: 0.4,
      fontSize: 12, fontFace: "Arial", color: colors.accent,
      bold: true
    });
  }

  // Заголовок
  slide.addText(data.title || "Практика", {
    x: 0.7, y: 0.8, w: 5, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: colors.primary,
    bold: true, margin: 0
  });

  // Карточка с заданием
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.6, w: 5.5, h: 3.5,
    fill: { color: colors.white }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.6, w: 5.5, h: 0.08,
    fill: { color: colors.accent }
  });

  slide.addText(data.taskTitle || "Задача", {
    x: 1, y: 1.9, w: 5, h: 0.4,
    fontSize: 16, fontFace: "Arial", color: colors.primary,
    bold: true, margin: 0
  });

  slide.addText(data.taskText || "", {
    x: 1, y: 2.4, w: 4.9, h: 1.2,
    fontSize: 13, fontFace: "Arial", color: colors.text,
    margin: 0
  });

  if (data.solutionTitle) {
    slide.addText(data.solutionTitle, {
      x: 1, y: 3.5, w: 5, h: 0.35,
      fontSize: 12, fontFace: "Arial", color: colors.accent,
      bold: true, margin: 0
    });
  }

  if (data.solutionText) {
    slide.addText(data.solutionText, {
      x: 1, y: 3.85, w: 4.9, h: 1,
      fontSize: 12, fontFace: "Arial", color: colors.muted,
      margin: 0
    });
  }

  // Панель с ответом
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 6.5, y: 1.6, w: 2.8, h: 3.5,
    fill: { color: colors.primary }
  });

  slide.addText("Ответ", {
    x: 6.5, y: 2, w: 2.8, h: 0.4,
    fontSize: 12, fontFace: "Arial", color: colors.muted,
    align: "center"
  });

  slide.addText(data.answer || "", {
    x: 6.5, y: 2.5, w: 2.8, h: 1.5,
    fontSize: 48, fontFace: "Georgia", color: colors.white,
    bold: true, align: "center", margin: 0
  });

  if (data.answerNote) {
    slide.addText(data.answerNote, {
      x: 6.5, y: 4, w: 2.8, h: 0.4,
      fontSize: 14, fontFace: "Arial", color: colors.accent,
      align: "center"
    });
  }

  return slide;
}

/**
 * Создаёт финальный слайд
 */
function createEndSlide(pres, data, colors) {
  const slide = pres.addSlide();
  slide.background = { color: colors.primary };

  // Вертикальная линия
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 1.5, w: 0.04, h: 2.5,
    fill: { color: colors.accent }
  });

  // Маленький текст
  slide.addText(data.thankYou || "СПАСИБО ЗА ВНИМАНИЕ", {
    x: 1.1, y: 1.5, w: 5, h: 0.4,
    fontSize: 11, fontFace: "Arial", color: colors.accent,
    bold: true, charSpacing: 4
  });

  // Большой заголовок
  slide.addText(data.title || "Вопросы?", {
    x: 1.1, y: 2, w: 5, h: 1,
    fontSize: 52, fontFace: "Georgia", color: colors.white,
    bold: true, margin: 0
  });

  // Контактная информация
  if (data.contactInfo) {
    slide.addText(data.contactInfo, {
      x: 1.1, y: 3.5, w: 4, h: 1,
      fontSize: 12, fontFace: "Arial", color: colors.muted,
      margin: 0
    });
  }

  // Декоративные квадраты
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 7, y: 1, w: 2.5, h: 2.5,
    fill: { color: colors.lightGray }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 7.5, y: 2.5, w: 2, h: 2,
    fill: { color: colors.accent }
  });

  return slide;
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ
// ============================================================

/**
 * Генерирует презентацию на основе данных
 * @param {Object} data - Данные презентации (структура TEMPLATE_DATA)
 * @param {Object} options - Опции
 * @param {string} options.theme - Название темы из THEMES
 * @param {string} options.outputPath - Путь для сохранения файла
 */
async function generatePresentation(data, options = {}) {
  const theme = options.theme || "warm";
  const colors = THEMES[theme] || THEMES.warm;
  const outputPath = options.outputPath || "presentation.pptx";

  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = data.meta?.title || "Презентация";
  pres.author = data.meta?.author || "";

  // 1. Титульный слайд
  if (data.titleSlide) {
    createTitleSlide(pres, data.titleSlide, colors);
  }

  // 2. Содержание
  if (data.contentsSlide && data.contentsSlide.items?.length > 0) {
    createContentsSlide(pres, data.contentsSlide, colors);
  }

  // 3. Слайды с контентом
  for (const slideData of (data.contentSlides || [])) {
    switch (slideData.type) {
      case "twoColumn":
        createTwoColumnSlide(pres, slideData, colors);
        break;
      case "formula":
        createFormulaSlide(pres, slideData, colors);
        break;
      case "grid":
        createGridSlide(pres, slideData, colors);
        break;
      case "stats":
        createStatsSlide(pres, slideData, colors);
        break;
      case "practice":
        createPracticeSlide(pres, slideData, colors);
        break;
      default:
        console.warn(`Неизвестный тип слайда: ${slideData.type}`);
    }
  }

  // 4. Финальный слайд
  if (data.endSlide) {
    createEndSlide(pres, data.endSlide, colors);
  }

  await pres.writeFile({ fileName: outputPath });
  return outputPath;
}

// ============================================================
// ЭКСПОРТ
// ============================================================

module.exports = {
  THEMES,
  TEMPLATE_DATA,
  generatePresentation,
  // Экспорт отдельных функций для кастомизации
  createTitleSlide,
  createContentsSlide,
  createTwoColumnSlide,
  createFormulaSlide,
  createGridSlide,
  createStatsSlide,
  createPracticeSlide,
  createEndSlide
};