/**
 * Шаблон "Школьная" - School Stationery Theme
 * -------------------------------------------
 * Приглушённые тона, канцелярский стиль с элементами:
 * - Рваная бумага, тетради, блокноты
 * - Скрепки, скотч, кольца
 * - Золотые рамки
 * 
 * Использование:
 * ```typescript
 * import { createSchoolPresentation, SCHOOL_COLORS } from './school-template';
 * 
 * const slides = [
 *   { type: 'title', title: 'Математика\n3 класс' },
 *   { type: 'content', title: 'Тема урока', text: 'Основной материал...' },
 *   { type: 'task', title: 'Задание', text: 'Решите примеры' }
 * ];
 * 
 * await createSchoolPresentation(slides, 'output.pptx');
 * ```
 */

import pptxgen from 'pptxgenjs';

// ============================================
// COLOR PALETTE
// ============================================

export const SCHOOL_COLORS = {
  // Backgrounds
  cream: "F5F0EB",
  dustyBlue: "8E9EAB",
  sageGreen: "9AACAB",
  warmGray: "D5CEC5",
  
  // Paper elements
  paper: "FAF8F5",
  linedPaper: "FDF9F3",
  tornPaper: "F8F4EF",
  notebook: "E8E2DA",
  
  // Accents
  gold: "C9A86C",
  rust: "A67B5B",
  dustyPink: "D4B8B8",
  slate: "5D6D7E",
  brown: "8B7355",
  
  // Text
  darkText: "3D3D3D",
  lightText: "FFFFFF",
  mutedText: "6B6B6B",
} as const;

// Background themes
const SCHOOL_THEMES = [
  { bg: SCHOOL_COLORS.cream, accent1: SCHOOL_COLORS.dustyPink, accent2: SCHOOL_COLORS.slate },
  { bg: SCHOOL_COLORS.dustyBlue, accent1: SCHOOL_COLORS.sageGreen, accent2: SCHOOL_COLORS.dustyPink },
  { bg: SCHOOL_COLORS.sageGreen, accent1: SCHOOL_COLORS.slate, accent2: SCHOOL_COLORS.dustyPink },
  { bg: SCHOOL_COLORS.warmGray, accent1: SCHOOL_COLORS.dustyBlue, accent2: SCHOOL_COLORS.dustyPink },
];

// ============================================
// TYPES
// ============================================

export type SchoolSlideType = 'title' | 'content' | 'task';

export interface SchoolTitleSlide {
  type: 'title';
  title: string;
}

export interface SchoolContentSlide {
  type: 'content';
  title: string;
  text: string;
}

export interface SchoolTaskSlide {
  type: 'task';
  title: string;
  text: string;
}

export type SchoolSlideConfig = SchoolTitleSlide | SchoolContentSlide | SchoolTaskSlide;

export interface SchoolPresentationOptions {
  author?: string;
  theme?: number;
}

// ============================================
// DECORATIVE HELPERS
// ============================================

function addDecorativeDot(
  slide: pptxgen.Slide,
  x: number,
  y: number,
  size: number = 0.12,
  color: string = SCHOOL_COLORS.gold
) {
  slide.addShape('ellipse', {
    x, y, w: size, h: size,
    fill: { color },
    line: { width: 0 }
  });
}

function addRing(
  slide: pptxgen.Slide,
  x: number,
  y: number,
  size: number = 0.3,
  color: string = SCHOOL_COLORS.gold
) {
  slide.addShape('ellipse', {
    x, y, w: size, h: size,
    fill: { color: "FFFFFF", transparency: 100 },
    line: { color, width: 2 }
  });
}

function addTape(
  slide: pptxgen.Slide,
  x: number,
  y: number,
  w: number,
  rotation: number = 0,
  color: string = SCHOOL_COLORS.gold
) {
  slide.addShape('rect', {
    x, y, w, h: 0.25,
    fill: { color, transparency: 20 },
    line: { width: 0 },
    rotate: rotation
  });
}

function addGoldenFrame(
  slide: pptxgen.Slide,
  x: number,
  y: number,
  w: number,
  h: number
) {
  slide.addShape('rect', {
    x, y, w, h,
    fill: { color: "FFFFFF", transparency: 100 },
    line: { color: SCHOOL_COLORS.gold, width: 1.5 }
  });
}

function addNotebookHoles(
  slide: pptxgen.Slide,
  x: number,
  startY: number,
  count: number = 5,
  spacing: number = 0.4
) {
  for (let i = 0; i < count; i++) {
    slide.addShape('ellipse', {
      x, y: startY + i * spacing,
      w: 0.15, h: 0.15,
      fill: { color: SCHOOL_COLORS.dustyBlue },
      line: { width: 0 }
    });
  }
}

function addPaperStack(
  slide: pptxgen.Slide,
  x: number,
  y: number,
  colors: string[],
  rotations: number[]
) {
  colors.forEach((color, i) => {
    slide.addShape('rect', {
      x: x + i * 0.2,
      y: y + i * 0.2,
      w: 2.5 - i * 0.2,
      h: 2 - i * 0.1,
      fill: { color },
      line: { width: 0 },
      rotate: rotations[i] || 0
    });
  });
}

// ============================================
// SLIDE BUILDERS
// ============================================

function buildTitleSlide(
  pres: pptxgen,
  config: SchoolTitleSlide,
  theme: typeof SCHOOL_THEMES[0]
) {
  const slide = pres.addSlide();
  slide.background = { color: SCHOOL_COLORS.cream };

  // Top-left paper stack
  addPaperStack(slide, -0.5, -0.3, 
    [SCHOOL_COLORS.brown, SCHOOL_COLORS.warmGray, theme.accent1],
    [-15, -10, -5]
  );
  
  // Top-right torn paper
  slide.addShape('rect', {
    x: 8, y: -0.5, w: 2.5, h: 2.5,
    fill: { color: theme.accent2 },
    line: { width: 0 },
    rotate: 10
  });
  slide.addShape('rect', {
    x: 8.5, y: 0, w: 2, h: 2,
    fill: { color: SCHOOL_COLORS.tornPaper },
    line: { width: 0 },
    rotate: 5
  });
  addTape(slide, 8.3, 0.8, 1.5, -20, SCHOOL_COLORS.gold);
  
  // Bottom notebooks
  slide.addShape('rect', {
    x: 3.5, y: 4.5, w: 1.8, h: 2,
    fill: { color: theme.accent1 },
    line: { width: 0 },
    rotate: -10
  });
  slide.addShape('rect', {
    x: 5, y: 4.2, w: 2, h: 2.5,
    fill: { color: SCHOOL_COLORS.slate },
    line: { width: 0 },
    rotate: 15
  });
  addNotebookHoles(slide, 5.1, 4.4, 4, 0.5);
  
  slide.addShape('rect', {
    x: 7, y: 4.8, w: 1.5, h: 1.8,
    fill: { color: SCHOOL_COLORS.linedPaper },
    line: { color: SCHOOL_COLORS.warmGray, width: 0.5 },
    rotate: 20
  });
  
  // Golden frame
  addGoldenFrame(slide, 1.5, 1, 7, 3.5);
  
  // Inner white paper
  slide.addShape('rect', {
    x: 1.7, y: 1.2, w: 6.6, h: 3.1,
    fill: { color: SCHOOL_COLORS.paper },
    line: { width: 0 }
  });
  
  // Title text
  slide.addText(config.title, {
    x: 1.7, y: 1.5, w: 6.6, h: 2.5,
    fontSize: 42,
    fontFace: "Georgia",
    color: SCHOOL_COLORS.darkText,
    align: "center",
    valign: "middle",
    lineSpacing: 50
  });
  
  // Decorations
  addRing(slide, 4.7, 0.6, 0.35, SCHOOL_COLORS.gold);
  addDecorativeDot(slide, 8.5, 3.5, 0.15, SCHOOL_COLORS.gold);
  addDecorativeDot(slide, 1, 4.2, 0.12, theme.accent1);
  
  // Paper clip
  slide.addShape('roundRect', {
    x: 7.8, y: 2.8, w: 0.12, h: 0.45,
    fill: { color: "FFFFFF", transparency: 100 },
    line: { color: SCHOOL_COLORS.gold, width: 1.5 },
    rectRadius: 0.06,
    rotate: 15
  });
  
  addTape(slide, -0.3, 2.5, 1.2, -45, SCHOOL_COLORS.gold);
}

function buildContentSlide(
  pres: pptxgen,
  config: SchoolContentSlide,
  theme: typeof SCHOOL_THEMES[0]
) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Bottom-right notepad decoration
  slide.addShape('ellipse', {
    x: 7.5, y: 3.5, w: 2.5, h: 2.5,
    fill: { color: theme.accent1 },
    line: { width: 0 }
  });
  
  // Lined paper
  slide.addShape('rect', {
    x: 7.2, y: 3.8, w: 1.8, h: 2.2,
    fill: { color: SCHOOL_COLORS.linedPaper },
    line: { width: 0 },
    rotate: -5
  });
  for (let i = 0; i < 6; i++) {
    slide.addShape('rect', {
      x: 7.3, y: 4.1 + i * 0.3, w: 1.5, h: 0.02,
      fill: { color: SCHOOL_COLORS.warmGray },
      line: { width: 0 }
    });
  }
  
  addTape(slide, 7.5, 3.6, 1.2, 10, theme.accent2);
  
  // Paper clips
  slide.addShape('roundRect', {
    x: 7.8, y: 4.5, w: 0.1, h: 0.4,
    fill: { color: "FFFFFF", transparency: 100 },
    line: { color: SCHOOL_COLORS.slate, width: 1.5 },
    rectRadius: 0.05,
    rotate: -10
  });
  slide.addShape('roundRect', {
    x: 8.8, y: 4.0, w: 0.1, h: 0.35,
    fill: { color: "FFFFFF", transparency: 100 },
    line: { color: SCHOOL_COLORS.slate, width: 1.5 },
    rectRadius: 0.05,
    rotate: 20
  });
  
  // Content card
  slide.addShape('roundRect', {
    x: 0.8, y: 1.5, w: 5.5, h: 2.5,
    fill: { color: SCHOOL_COLORS.paper },
    line: { width: 0 },
    rectRadius: 0.1,
    shadow: { type: "outer", color: "000000", blur: 8, offset: 2, angle: 135, opacity: 0.1 }
  });
  
  slide.addText(config.title, {
    x: 1, y: 1.8, w: 5.1, h: 0.8,
    fontSize: 32,
    fontFace: "Georgia",
    color: SCHOOL_COLORS.darkText,
    align: "left",
    bold: true
  });
  
  slide.addText(config.text, {
    x: 1, y: 2.7, w: 5.1, h: 1.1,
    fontSize: 18,
    fontFace: "Arial",
    color: SCHOOL_COLORS.mutedText,
    align: "left",
    lineSpacing: 26
  });
}

function buildTaskSlide(
  pres: pptxgen,
  config: SchoolTaskSlide,
  theme: typeof SCHOOL_THEMES[0]
) {
  const slide = pres.addSlide();
  slide.background = { color: SCHOOL_COLORS.warmGray };

  // Background papers
  addPaperStack(slide, -1, -0.5,
    [SCHOOL_COLORS.slate, theme.accent1],
    [-25, -15]
  );
  
  slide.addShape('rect', {
    x: 8.5, y: -0.5, w: 2.5, h: 2,
    fill: { color: theme.accent2 },
    line: { width: 0 },
    rotate: 20
  });
  
  // Bottom decorations
  slide.addShape('rect', {
    x: 7.5, y: 4.5, w: 2.5, h: 2,
    fill: { color: SCHOOL_COLORS.brown },
    line: { width: 0 },
    rotate: -15
  });
  slide.addShape('rect', {
    x: 8, y: 4.2, w: 1.8, h: 2.3,
    fill: { color: theme.accent1 },
    line: { width: 0 },
    rotate: 10
  });
  addNotebookHoles(slide, 9.2, 4.5, 3, 0.4);
  
  // Golden frame
  addGoldenFrame(slide, 1.5, 1, 7, 3.5);
  
  // Inner area
  slide.addShape('rect', {
    x: 1.7, y: 1.2, w: 6.6, h: 3.1,
    fill: { color: SCHOOL_COLORS.paper },
    line: { width: 0 }
  });
  
  slide.addText(config.title, {
    x: 1.7, y: 1.5, w: 6.6, h: 1,
    fontSize: 36,
    fontFace: "Georgia",
    color: SCHOOL_COLORS.darkText,
    align: "center",
    bold: true
  });
  
  slide.addText(config.text, {
    x: 2, y: 2.6, w: 6, h: 1.4,
    fontSize: 18,
    fontFace: "Arial",
    color: SCHOOL_COLORS.mutedText,
    align: "center",
    lineSpacing: 26
  });
  
  // Decorations
  addDecorativeDot(slide, 2.5, 5, 0.15, SCHOOL_COLORS.gold);
  addDecorativeDot(slide, 7, 0.5, 0.12, theme.accent1);
  addRing(slide, 0.8, 3.5, 0.3, SCHOOL_COLORS.gold);
  
  addTape(slide, 1.2, 0.7, 1, 45, SCHOOL_COLORS.gold);
  addTape(slide, 7.8, 4.2, 0.8, -30, theme.accent1);
}

// ============================================
// MAIN EXPORT
// ============================================

/**
 * Creates a school-themed presentation with stationery aesthetic
 */
export async function createSchoolPresentation(
  slides: SchoolSlideConfig[],
  outputPath: string,
  options: SchoolPresentationOptions = {}
): Promise<void> {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = options.author || "Uchion";
  pres.title = slides[0]?.title || "Школьная";
  
  slides.forEach((slideConfig, index) => {
    const themeIndex = options.theme !== undefined 
      ? options.theme % SCHOOL_THEMES.length
      : index % SCHOOL_THEMES.length;
    const theme = SCHOOL_THEMES[themeIndex];
    
    switch (slideConfig.type) {
      case 'title':
        buildTitleSlide(pres, slideConfig, theme);
        break;
      case 'content':
        buildContentSlide(pres, slideConfig, theme);
        break;
      case 'task':
        buildTaskSlide(pres, slideConfig, theme);
        break;
    }
  });
  
  await pres.writeFile({ fileName: outputPath });
}

/**
 * Creates presentation and returns as base64
 */
export async function createSchoolPresentationBase64(
  slides: SchoolSlideConfig[],
  options: SchoolPresentationOptions = {}
): Promise<string> {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = options.author || "Uchion";
  pres.title = slides[0]?.title || "Школьная";
  
  slides.forEach((slideConfig, index) => {
    const themeIndex = options.theme !== undefined 
      ? options.theme % SCHOOL_THEMES.length
      : index % SCHOOL_THEMES.length;
    const theme = SCHOOL_THEMES[themeIndex];
    
    switch (slideConfig.type) {
      case 'title':
        buildTitleSlide(pres, slideConfig, theme);
        break;
      case 'content':
        buildContentSlide(pres, slideConfig, theme);
        break;
      case 'task':
        buildTaskSlide(pres, slideConfig, theme);
        break;
    }
  });
  
  const output = await pres.write({ outputType: 'base64' });
  return output as string;
}