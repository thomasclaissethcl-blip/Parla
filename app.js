const STORAGE_KEY = "parla-state-v2";
const XP_PER_LESSON = 20;
const XP_PER_QUIZ = 10;
const XP_PER_REVIEW = 5;
const LEVEL_XP = 100;

const STAGE_ORDER = {
  decouverte: 1,
  apprentissage: 2,
  approfondissement: 3,
  maitrise: 4,
  superlocuteur: 5
};

const STAGE_LABELS = {
  decouverte: "Découverte",
  apprentissage: "Apprentissage",
  approfondissement: "Approfondissement",
  maitrise: "Maîtrise",
  superlocuteur: "Superlocuteur"
};

const STAGE_DESCRIPTIONS = {
  decouverte: "Vous découvrez les mots, structures et situations de base.",
  apprentissage: "Vous commencez à reconnaître et réutiliser les éléments vus.",
  approfondissement: "Vous réinvestissez ces contenus dans des contextes plus variés.",
  maitrise: "Vous utilisez ces ressources avec plus de stabilité et d’aisance.",
  superlocuteur: "Vous mobilisez ces contenus dans des échanges plus naturels et plus fins."
};

let deferredPrompt = null;
let lessons = [];
let pathways = [];
let currentLesson = null;
let currentQuizPool = [];
let availableVoices = [];

const defaultState = {
  profile: {
    xp: 0,
    level: 1,
    streak: 0,
    lastStudyDate: null,
    completedLessons: [],
    history: []
  },
  review: {},
    settings: {
    soundEnabled: true,
    selectedVoiceURI: null
  },
  dailyProgress: {
    date: todayISO(),
    lessonsCompletedToday: 0,
    reviewDoneToday: 0,
    quizDoneToday: 0
  },
  learningMode: "free",
  selectedPathway: null,
  pathwayProgress: {}
};

let state = loadState();

const els = {
  xpValue: document.getElementById("xpValue"),
  levelValue: document.getElementById("levelValue"),
  streakValue: document.getElementById("streakValue"),
  levelProgressText: document.getElementById("levelProgressText"),
  levelProgressBar: document.getElementById("levelProgressBar"),
  freeModeBtn: document.getElementById("freeModeBtn"),
  pathModeBtn: document.getElementById("pathModeBtn"),
  pathwayList: document.getElementById("pathwayList"),
  currentStageLabel: document.getElementById("currentStageLabel"),
  currentStageDescription: document.getElementById("currentStageDescription"),
  lessonList: document.getElementById("lessonList"),
  lessonPlayer: document.getElementById("lessonPlayer"),
  lessonMeta: document.getElementById("lessonMeta"),
  lessonTitle: document.getElementById("lessonTitle"),
  lessonContent: document.getElementById("lessonContent"),
  closeLessonBtn: document.getElementById("closeLessonBtn"),
  completeLessonBtn: document.getElementById("completeLessonBtn"),
  listenLessonBtn: document.getElementById("listenLessonBtn"),
  searchInput: document.getElementById("searchInput"),
  reviewArea: document.getElementById("reviewArea"),
  quizArea: document.getElementById("quizArea"),
  startReviewBtn: document.getElementById("startReviewBtn"),
  startQuizBtn: document.getElementById("startQuizBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  resetBtn: document.getElementById("resetBtn"),
  lessonsTodayValue: document.getElementById("lessonsTodayValue"),
  reviewsTodayValue: document.getElementById("reviewsTodayValue"),
  quizTodayValue: document.getElementById("quizTodayValue"),
  modeBadge: document.getElementById("modeBadge"),
  pathBadge: document.getElementById("pathBadge"),
  heroTitle: document.getElementById("heroTitle"),
  heroText: document.getElementById("heroText"),
  installBtn: document.getElementById("installBtn"),
  speakBtn: document.getElementById("speakBtn"),
    voiceSelect: document.getElementById("voiceSelect"),
  voiceStatus: document.getElementById("voiceStatus"),
  testSelectedVoiceBtn: document.getElementById("testSelectedVoiceBtn"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadData();
  hydrateMissingPathwayProgress();
  bindEvents();
  initVoices();
  registerSW();
  refreshAll();
}

async function loadData() {
  const [lessonsRes, pathwaysRes] = await Promise.all([
    fetch("data/lessons.json"),
    fetch("data/pathways.json")
  ]);

  const lessonsJson = await lessonsRes.json();
  const pathwaysJson = await pathwaysRes.json();

  lessons = lessonsJson.lessons || [];
  pathways = pathwaysJson.pathways || [];

  if (!state.selectedPathway && pathways.length) {
    state.selectedPathway = pathways[0].id;
  }

  saveState();
}

function bindEvents() {
  els.freeModeBtn.addEventListener("click", () => {
    state.learningMode = "free";
    saveState();
    refreshAll();
  });

  els.pathModeBtn.addEventListener("click", () => {
    state.learningMode = "pathway";
    if (!state.selectedPathway && pathways.length) {
      state.selectedPathway = pathways[0].id;
    }
    saveState();
    refreshAll();
  });

  els.searchInput.addEventListener("input", renderLessonList);

  els.closeLessonBtn.addEventListener("click", () => {
    currentLesson = null;
    els.lessonPlayer.classList.add("hidden");
  });

  els.completeLessonBtn.addEventListener("click", completeCurrentLesson);
  els.listenLessonBtn.addEventListener("click", listenCurrentLesson);

  els.startReviewBtn.addEventListener("click", startReviewSession);
  els.startQuizBtn.addEventListener("click", startQuickQuiz);

  els.exportBtn.addEventListener("click", exportStateToFile);
  els.importInput.addEventListener("change", importStateFromFile);
  els.resetBtn.addEventListener("click", resetState);

  els.speakBtn.addEventListener("click", () => {
    speakItalian("Ciao, benvenuto su Parla");
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    els.installBtn.classList.remove("hidden");
  });

  els.installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installBtn.classList.add("hidden");
  });
  
    els.voiceSelect.addEventListener("change", () => {
    state.settings.selectedVoiceURI = els.voiceSelect.value || null;
    saveState();
    updateVoiceStatus();
  });

  els.testSelectedVoiceBtn.addEventListener("click", () => {
    speakItalian("Ciao, mi chiamo Parla. Benvenuto nel corso di italiano.");
  });
}

function refreshAll() {
  normalizeDailyProgress();
  updateProfileUI();
  renderPathways();
  updateHero();
  updateStageCard();
  renderLessonList();
  renderDailyStats();
  saveState();
}

function renderPathways() {
  els.pathwayList.innerHTML = "";

  pathways.forEach((pathway) => {
    const div = document.createElement("div");
    div.className = "pathway-card" + (state.selectedPathway === pathway.id ? " active" : "");
    div.innerHTML = `
      <h3>${escapeHtml(pathway.title)}</h3>
      <p>${escapeHtml(pathway.description)}</p>
    `;
    div.addEventListener("click", () => {
      state.selectedPathway = pathway.id;
      state.learningMode = "pathway";
      saveState();
      refreshAll();
    });
    els.pathwayList.appendChild(div);
  });
}

function updateHero() {
  const currentPathway = pathways.find((p) => p.id === state.selectedPathway);

  if (state.learningMode === "free") {
    els.modeBadge.textContent = "Mode libre";
    els.pathBadge.textContent = "Aucun parcours";
    els.heroTitle.textContent = "Votre tableau de bord";
    els.heroText.textContent = "Explorez les leçons à la carte selon vos besoins.";
    return;
  }

  els.modeBadge.textContent = "Mode parcours";
  els.pathBadge.textContent = currentPathway ? currentPathway.title : "Parcours";
  els.heroTitle.textContent = currentPathway ? currentPathway.title : "Parcours";
  els.heroText.textContent = currentPathway
    ? currentPathway.description
    : "Suivez une progression thématique.";
}

function updateStageCard() {
  if (state.learningMode === "free") {
    els.currentStageLabel.textContent = "Libre";
    els.currentStageDescription.textContent = "Vous choisissez vos leçons librement.";
    return;
  }

  const lessonsForPath = getLessonsForCurrentPathway();
  const nextLesson = lessonsForPath.find((lesson) => !isLessonCompleted(lesson.id));
  const stage = nextLesson?.pathwayMeta?.stage || "superlocuteur";

  els.currentStageLabel.textContent = STAGE_LABELS[stage] || "Progression";
  els.currentStageDescription.textContent = STAGE_DESCRIPTIONS[stage] || "";
}

function renderLessonList() {
  const query = els.searchInput.value.trim().toLowerCase();
  const availableLessons = getVisibleLessons(query);

  els.lessonList.innerHTML = "";

  if (!availableLessons.length) {
    els.lessonList.innerHTML = `<p class="small-text">Aucune leçon ne correspond à votre recherche.</p>`;
    return;
  }

  availableLessons.forEach((lesson) => {
    const locked = state.learningMode === "pathway" ? !isLessonUnlockedInPathway(lesson) : false;

    const card = document.createElement("article");
    card.className = "lesson-card" + (locked ? " locked" : "");

    const completed = isLessonCompleted(lesson.id);
    const tags = buildLessonTags(lesson);

    card.innerHTML = `
      <div class="lesson-tags">${tags}</div>
      <h3>${escapeHtml(lesson.title)}</h3>
      <p>${escapeHtml(lesson.description || "")}</p>
      <p class="small-text">Difficulté ${lesson.difficulty || 1}${lesson.pathwayMeta ? ` · ${STAGE_LABELS[lesson.pathwayMeta.stage]}` : ""}</p>
      <button class="${locked ? "locked" : ""}">
        ${completed ? "Revoir la leçon" : "Ouvrir la leçon"}
      </button>
    `;

    const btn = card.querySelector("button");
    btn.disabled = locked;

    btn.addEventListener("click", () => {
      if (locked) return;
      openLesson(lesson.id);
    });

    els.lessonList.appendChild(card);
  });
}

function buildLessonTags(lesson) {
  const tags = [];

  if (lesson.type) {
    tags.push(`<span class="lesson-tag">${escapeHtml(labelForType(lesson.type))}</span>`);
  }

  if (lesson.pathwayMeta?.stage) {
    tags.push(`<span class="lesson-tag">${escapeHtml(STAGE_LABELS[lesson.pathwayMeta.stage])}</span>`);
  }

  if (isLessonCompleted(lesson.id)) {
    tags.push(`<span class="lesson-tag">Terminé</span>`);
  }

  return tags.join("");
}

function labelForType(type) {
  const labels = {
    vocabulary: "Vocabulaire",
    scenario: "Situation",
    conversation: "Conversation",
    culture: "Culture",
    politique: "Politique"
  };
  return labels[type] || type;
}

function getVisibleLessons(query = "") {
  let pool = state.learningMode === "pathway" ? getLessonsForCurrentPathway() : lessons.map((l) => ({ ...l }));

  if (!query) return pool;

  return pool.filter((lesson) => {
    const haystack = [
      lesson.title,
      lesson.description,
      ...(lesson.content || []).flatMap((item) => [item.it, item.fr])
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function getLessonsForCurrentPathway() {
  if (!state.selectedPathway) return [];

  return lessons
    .filter((lesson) => Array.isArray(lesson.pathways) && lesson.pathways.some((p) => p.id === state.selectedPathway))
    .map((lesson) => {
      const match = lesson.pathways.find((p) => p.id === state.selectedPathway);
      return {
        ...lesson,
        pathwayMeta: match
      };
    })
    .sort((a, b) => {
      const stageDiff = (STAGE_ORDER[a.pathwayMeta.stage] || 99) - (STAGE_ORDER[b.pathwayMeta.stage] || 99);
      if (stageDiff !== 0) return stageDiff;
      return (a.pathwayMeta.order || 0) - (b.pathwayMeta.order || 0);
    });
}

function isLessonUnlockedInPathway(lesson) {
  const pathLessons = getLessonsForCurrentPathway();
  const index = pathLessons.findIndex((l) => l.id === lesson.id);
  if (index <= 0) return true;

  const previous = pathLessons[index - 1];
  return isLessonCompleted(previous.id);
}

function openLesson(lessonId) {
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) return;

  currentLesson = lesson;

  const meta = state.learningMode === "pathway"
    ? getLessonsForCurrentPathway().find((l) => l.id === lessonId)?.pathwayMeta
    : null;

  els.lessonMeta.textContent = meta
    ? `${labelForType(lesson.type)} · ${STAGE_LABELS[meta.stage]}`
    : `${labelForType(lesson.type)} · Difficulté ${lesson.difficulty || 1}`;

  els.lessonTitle.textContent = lesson.title;
  els.lessonContent.innerHTML = buildLessonContentHTML(lesson);
  attachQuizButtons(lesson);

  els.lessonPlayer.classList.remove("hidden");
  els.lessonPlayer.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildLessonContentHTML(lesson) {
  const vocabHtml = `
    <div>
      <h3>Vocabulaire et expressions</h3>
      <div class="vocab-list">
        ${lesson.content.map((item) => `
          <div class="vocab-item">
            <div class="vocab-it">${escapeHtml(item.it)}</div>
            <div class="vocab-fr">${escapeHtml(item.fr)}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  const quizHtml = lesson.quiz?.length
    ? lesson.quiz.map((q, index) => `
      <div class="quiz-card">
        <strong>Question ${index + 1}</strong>
        <p>${escapeHtml(q.q)}</p>
        <div class="quiz-options">
          ${q.options.map((option) => `
            <button class="option-btn" data-question-index="${index}" data-answer="${escapeHtml(option)}">
              ${escapeHtml(option)}
            </button>
          `).join("")}
        </div>
        <div id="quiz-feedback-${index}" class="feedback"></div>
      </div>
    `).join("")
    : `<p class="small-text">Aucun quiz disponible pour cette leçon.</p>`;

  return `${vocabHtml}<div><h3>Mini-quiz</h3>${quizHtml}</div>`;
}

function attachQuizButtons(lesson) {
  const buttons = els.lessonContent.querySelectorAll(".option-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const questionIndex = Number(btn.dataset.questionIndex);
      const selected = btn.dataset.answer;
      const q = lesson.quiz[questionIndex];
      const feedback = document.getElementById(`quiz-feedback-${questionIndex}`);

      if (!feedback || !q) return;

      if (selected === q.answer) {
        feedback.textContent = "Bonne réponse.";
        feedback.classList.remove("error");
        addXp(XP_PER_QUIZ);
      } else {
        feedback.textContent = `Réponse incorrecte. Bonne réponse : ${q.answer}`;
        feedback.classList.add("error");
      }
      saveState();
      updateProfileUI();
    });
  });
}

function completeCurrentLesson() {
  if (!currentLesson) return;

  if (!state.profile.completedLessons.includes(currentLesson.id)) {
    state.profile.completedLessons.push(currentLesson.id);
    addXp(XP_PER_LESSON);
    incrementDaily("lessonsCompletedToday");
    updateStreak();
    registerLessonReviewItems(currentLesson);
    state.profile.history.push({
      lessonId: currentLesson.id,
      completedAt: new Date().toISOString(),
      mode: state.learningMode,
      pathway: state.learningMode === "pathway" ? state.selectedPathway : null
    });
  }

  if (state.learningMode === "pathway" && state.selectedPathway) {
    ensurePathwayProgress(state.selectedPathway);
    const pathProgress = state.pathwayProgress[state.selectedPathway];
    if (!pathProgress.completedLessons.includes(currentLesson.id)) {
      pathProgress.completedLessons.push(currentLesson.id);
    }
    pathProgress.currentLesson = getNextLessonIdInPathway();
  }

  saveState();
  refreshAll();
}

function getNextLessonIdInPathway() {
  const pathLessons = getLessonsForCurrentPathway();
  const next = pathLessons.find((lesson) => !isLessonCompleted(lesson.id));
  return next ? next.id : null;
}

function registerLessonReviewItems(lesson) {
  lesson.content.forEach((item, index) => {
    const cardId = `${lesson.id}::${index}`;
    if (!state.review[cardId]) {
      state.review[cardId] = {
        lessonId: lesson.id,
        it: item.it,
        fr: item.fr,
        interval: 1,
        dueDate: todayISO()
      };
    }
  });
}

function startReviewSession() {
  const dueCards = Object.entries(state.review)
    .filter(([, card]) => card.dueDate <= todayISO())
    .slice(0, 1);

  if (!dueCards.length) {
    els.reviewArea.innerHTML = `<p>Aucune carte à réviser aujourd’hui.</p>`;
    return;
  }

  const [cardId, card] = dueCards[0];

  els.reviewArea.innerHTML = `
    <div class="review-card">
      <p><strong>Italien :</strong> ${escapeHtml(card.it)}</p>
      <button id="showReviewAnswerBtn" class="secondary">Afficher la traduction</button>
      <div id="reviewAnswerWrap" class="hidden">
        <p><strong>Français :</strong> ${escapeHtml(card.fr)}</p>
        <div class="quiz-options">
          <button id="reviewHardBtn" class="option-btn">Difficile</button>
          <button id="reviewEasyBtn" class="option-btn">Facile</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("showReviewAnswerBtn").addEventListener("click", () => {
    document.getElementById("reviewAnswerWrap").classList.remove("hidden");
  });

  document.getElementById("reviewHardBtn").addEventListener("click", () => {
    state.review[cardId].interval = 1;
    state.review[cardId].dueDate = addDaysISO(1);
    addXp(XP_PER_REVIEW);
    incrementDaily("reviewDoneToday");
    saveState();
    updateProfileUI();
    renderDailyStats();
    els.reviewArea.innerHTML = `<p>Révision enregistrée. Cette carte reviendra demain.</p>`;
  });

  document.getElementById("reviewEasyBtn").addEventListener("click", () => {
    const nextInterval = Math.max(2, (state.review[cardId].interval || 1) * 2);
    state.review[cardId].interval = nextInterval;
    state.review[cardId].dueDate = addDaysISO(nextInterval);
    addXp(XP_PER_REVIEW);
    incrementDaily("reviewDoneToday");
    saveState();
    updateProfileUI();
    renderDailyStats();
    els.reviewArea.innerHTML = `<p>Révision enregistrée. Cette carte reviendra dans ${nextInterval} jours.</p>`;
  });
}

function startQuickQuiz() {
  currentQuizPool = buildQuizPool();
  if (!currentQuizPool.length) {
    els.quizArea.innerHTML = `<p>Aucune question disponible.</p>`;
    return;
  }

  const q = currentQuizPool[Math.floor(Math.random() * currentQuizPool.length)];

  els.quizArea.innerHTML = `
    <div class="quiz-card">
      <p>${escapeHtml(q.q)}</p>
      <div class="quiz-options">
        ${q.options.map((option) => `
          <button class="option-btn" data-quiz-option="${escapeHtml(option)}">${escapeHtml(option)}</button>
        `).join("")}
      </div>
      <div id="quickQuizFeedback" class="feedback"></div>
    </div>
  `;

  els.quizArea.querySelectorAll("[data-quiz-option]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selected = btn.dataset.quizOption;
      const feedback = document.getElementById("quickQuizFeedback");
      if (selected === q.answer) {
        feedback.textContent = "Bonne réponse.";
        feedback.classList.remove("error");
        addXp(XP_PER_QUIZ);
      } else {
        feedback.textContent = `Réponse incorrecte. Bonne réponse : ${q.answer}`;
        feedback.classList.add("error");
      }
      incrementDaily("quizDoneToday");
      saveState();
      updateProfileUI();
      renderDailyStats();
    });
  });
}

function buildQuizPool() {
  const pool = state.learningMode === "pathway" ? getLessonsForCurrentPathway() : lessons;
  return pool.flatMap((lesson) => lesson.quiz || []);
}

function renderDailyStats() {
  els.lessonsTodayValue.textContent = state.dailyProgress.lessonsCompletedToday;
  els.reviewsTodayValue.textContent = state.dailyProgress.reviewDoneToday;
  els.quizTodayValue.textContent = state.dailyProgress.quizDoneToday;
}

function updateProfileUI() {
  const xp = state.profile.xp;
  const level = Math.max(1, Math.floor(xp / LEVEL_XP) + 1);
  state.profile.level = level;

  const xpIntoLevel = xp % LEVEL_XP;
  const percentage = (xpIntoLevel / LEVEL_XP) * 100;

  els.xpValue.textContent = xp;
  els.levelValue.textContent = level;
  els.streakValue.textContent = state.profile.streak;
  els.levelProgressText.textContent = `${xpIntoLevel} / ${LEVEL_XP}`;
  els.levelProgressBar.style.width = `${percentage}%`;

  els.freeModeBtn.classList.toggle("active", state.learningMode === "free");
  els.pathModeBtn.classList.toggle("active", state.learningMode === "pathway");
}

function addXp(value) {
  state.profile.xp += value;
}

function updateStreak() {
  const today = todayISO();
  const last = state.profile.lastStudyDate;

  if (!last) {
    state.profile.streak = 1;
  } else {
    const yesterday = addDaysISO(-1);
    if (last === today) {
      return;
    } else if (last === yesterday) {
      state.profile.streak += 1;
    } else {
      state.profile.streak = 1;
    }
  }

  state.profile.lastStudyDate = today;
}

function isLessonCompleted(lessonId) {
  return state.profile.completedLessons.includes(lessonId);
}

function ensurePathwayProgress(pathwayId) {
  if (!state.pathwayProgress[pathwayId]) {
    state.pathwayProgress[pathwayId] = {
      completedLessons: [],
      currentLesson: null
    };
  }
}

function hydrateMissingPathwayProgress() {
  pathways.forEach((pathway) => ensurePathwayProgress(pathway.id));
}

function normalizeDailyProgress() {
  const today = todayISO();
  if (state.dailyProgress.date !== today) {
    state.dailyProgress = {
      date: today,
      lessonsCompletedToday: 0,
      reviewDoneToday: 0,
      quizDoneToday: 0
    };
  }
}

function incrementDaily(key) {
  normalizeDailyProgress();
  state.dailyProgress[key] += 1;
}

function listenCurrentLesson() {
  if (!currentLesson || !state.settings.soundEnabled) return;
  const text = currentLesson.content.map((item) => item.it).join(". ");
  speakItalian(text);
}

function getItalianVoice() {
  const voices = window.speechSynthesis.getVoices();

  let voice =
    voices.find(v => v.lang === "it-IT") ||
    voices.find(v => v.lang && v.lang.toLowerCase().startsWith("it"));

  return voice || null;
}

function initVoices() {
  if (!("speechSynthesis" in window)) {
    updateVoiceStatus("Synthèse vocale non disponible sur ce navigateur.", "warning");
    return;
  }

  loadVoicesIntoUI();

  window.speechSynthesis.getVoices();

  window.speechSynthesis.addEventListener("voiceschanged", () => {
    loadVoicesIntoUI();
  });
}

function loadVoicesIntoUI() {
  availableVoices = window.speechSynthesis.getVoices() || [];

  const italianVoices = availableVoices
    .filter((voice) => voice.lang && voice.lang.toLowerCase().startsWith("it"))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  els.voiceSelect.innerHTML = "";

  if (!italianVoices.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Aucune voix italienne détectée";
    els.voiceSelect.appendChild(option);
    updateVoiceStatus("Aucune voix italienne n’a été détectée sur cet appareil. La prononciation peut être approximative.", "warning");
    return;
  }

  italianVoices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} (${voice.lang})${voice.default ? " — par défaut" : ""}`;
    els.voiceSelect.appendChild(option);
  });

  const savedVoiceExists = italianVoices.some(
    (voice) => voice.voiceURI === state.settings.selectedVoiceURI
  );

  if (savedVoiceExists) {
    els.voiceSelect.value = state.settings.selectedVoiceURI;
  } else {
    const preferred =
      italianVoices.find((voice) => voice.lang === "it-IT") ||
      italianVoices[0];

    state.settings.selectedVoiceURI = preferred.voiceURI;
    els.voiceSelect.value = preferred.voiceURI;
    saveState();
  }

  updateVoiceStatus();
}

function getSelectedItalianVoice() {
  if (!availableVoices.length) return null;

  const selectedURI = state.settings.selectedVoiceURI;

  if (selectedURI) {
    const exact = availableVoices.find((voice) => voice.voiceURI === selectedURI);
    if (exact) return exact;
  }

  return (
    availableVoices.find((voice) => voice.lang === "it-IT") ||
    availableVoices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith("it")) ||
    null
  );
}

function updateVoiceStatus(customMessage = null, type = null) {
  if (customMessage) {
    els.voiceStatus.textContent = customMessage;
    els.voiceStatus.className = `small-text ${type || ""}`.trim();
    return;
  }

  const selectedVoice = getSelectedItalianVoice();

  if (!selectedVoice) {
    els.voiceStatus.textContent = "Aucune voix italienne disponible. Le navigateur utilisera éventuellement une voix de repli.";
    els.voiceStatus.className = "small-text warning";
    return;
  }

  els.voiceStatus.textContent = `Voix sélectionnée : ${selectedVoice.name} (${selectedVoice.lang}).`;
  els.voiceStatus.className = "small-text success";
}

function speakItalian(text) {
  if (!("speechSynthesis" in window)) {
    alert("La synthèse vocale n’est pas disponible sur ce navigateur.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "it-IT";
  utterance.rate = 0.95;
  utterance.pitch = 1;

  const italianVoice = getSelectedItalianVoice();

  if (italianVoice) {
    utterance.voice = italianVoice;
    utterance.lang = italianVoice.lang || "it-IT";
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function initVoices() {
  // force le chargement des voix
  window.speechSynthesis.getVoices();

  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {
      console.log("Voix disponibles :", speechSynthesis.getVoices());
    };
  }
}

function exportStateToFile() {
  const payload = {
    app: "Parla",
    version: 2,
    exportedAt: new Date().toISOString(),
    state
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `parla-save-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importStateFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported?.state) {
        throw new Error("Format invalide");
      }
      state = {
        ...structuredClone(defaultState),
        ...imported.state,
        profile: {
          ...structuredClone(defaultState.profile),
          ...(imported.state.profile || {})
        },
        review: imported.state.review || {},
        settings: {
          ...structuredClone(defaultState.settings),
          ...(imported.state.settings || {})
        },
        dailyProgress: {
          ...structuredClone(defaultState.dailyProgress),
          ...(imported.state.dailyProgress || {})
        },
        pathwayProgress: imported.state.pathwayProgress || {}
      };
      hydrateMissingPathwayProgress();
      saveState();
      refreshAll();
      alert("Sauvegarde importée avec succès.");
    } catch (error) {
      alert("Impossible d’importer cette sauvegarde.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}
function resetState() {
  const ok = window.confirm("Voulez-vous vraiment réinitialiser toute votre progression ?");
  if (!ok) return;
  state = structuredClone(defaultState);
  if (pathways.length) {
    state.selectedPathway = pathways[0].id;
  }
  hydrateMissingPathwayProgress();
  saveState();
  currentLesson = null;
  els.lessonPlayer.classList.add("hidden");
  els.reviewArea.innerHTML = "<p>Les cartes à réviser apparaîtront ici.</p>";
  els.quizArea.innerHTML = "<p>Un quiz de consolidation apparaîtra ici.</p>";
  refreshAll();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);

    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      profile: {
        ...structuredClone(defaultState.profile),
        ...(parsed.profile || {})
      },
      review: parsed.review || {},
      settings: {
        ...structuredClone(defaultState.settings),
        ...(parsed.settings || {})
      },
      dailyProgress: {
        ...structuredClone(defaultState.dailyProgress),
        ...(parsed.dailyProgress || {})
      },
      pathwayProgress: parsed.pathwayProgress || {}
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
