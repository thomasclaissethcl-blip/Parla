const STORAGE_KEY = 'parla-progress-v1';
const XP_PER_LEVEL = 120;

const DEFAULT_STATE = {
  profile: {
    xp: 0,
    level: 1,
    streak: 0,
    lastStudyDate: null,
    completedLessons: [],
    masteredCards: [],
    history: []
  },
  review: {},
  settings: {
    soundEnabled: true
  },
  dailyProgress: {
    date: null,
    lessonsCompletedToday: 0,
    reviewDoneToday: 0,
    quizDoneToday: 0
  }
};

const achievementsCatalog = [
  { id: 'first-lesson', label: 'Premier pas', description: 'Terminer une première leçon', check: s => s.profile.completedLessons.length >= 1 },
  { id: 'three-lessons', label: 'Rythme lancé', description: 'Terminer trois leçons', check: s => s.profile.completedLessons.length >= 3 },
  { id: 'reviewer', label: 'Mémoire active', description: 'Réviser cinq cartes', check: s => Object.keys(s.review).length >= 5 },
  { id: 'streak-3', label: 'Habitude installée', description: 'Atteindre une série de 3 jours', check: s => s.profile.streak >= 3 },
  { id: 'quiz-master', label: 'Esprit de défi', description: 'Réussir un quiz avec 4 bonnes réponses', check: s => s.profile.history.some(entry => entry.type === 'quiz' && entry.score >= 4) }
];

const app = {
  lessons: [],
  state: loadState(),
  currentLessonIndex: 0,
  currentReviewCard: null,
  quiz: {
    timer: null,
    timeLeft: 60,
    score: 0,
    currentQuestion: null,
    asked: []
  },
  installPrompt: null
};

const els = {
  tabs: [...document.querySelectorAll('.tab')],
  panels: [...document.querySelectorAll('.tab-panel')],
  levelValue: document.getElementById('levelValue'),
  xpValue: document.getElementById('xpValue'),
  streakValue: document.getElementById('streakValue'),
  masteredValue: document.getElementById('masteredValue'),
  levelProgressLabel: document.getElementById('levelProgressLabel'),
  levelProgressBar: document.getElementById('levelProgressBar'),
  dailyGoals: document.getElementById('dailyGoals'),
  nextLessonTitle: document.getElementById('nextLessonTitle'),
  nextLessonDescription: document.getElementById('nextLessonDescription'),
  continueLessonBtn: document.getElementById('continueLessonBtn'),
  startReviewBtn: document.getElementById('startReviewBtn'),
  lessonRoadmap: document.getElementById('lessonRoadmap'),
  achievements: document.getElementById('achievements'),
  wordOfTheDay: document.getElementById('wordOfTheDay'),
  lessonSelect: document.getElementById('lessonSelect'),
  lessonMeta: document.getElementById('lessonMeta'),
  lessonTitle: document.getElementById('lessonTitle'),
  lessonDescription: document.getElementById('lessonDescription'),
  lessonContent: document.getElementById('lessonContent'),
  practiceForm: document.getElementById('practiceForm'),
  practiceFeedback: document.getElementById('practiceFeedback'),
  checkPracticeBtn: document.getElementById('checkPracticeBtn'),
  completeLessonBtn: document.getElementById('completeLessonBtn'),
  listenLessonBtn: document.getElementById('listenLessonBtn'),
  reviewCountBadge: document.getElementById('reviewCountBadge'),
  flashcard: document.getElementById('flashcard'),
  showAnswerBtn: document.getElementById('showAnswerBtn'),
  againBtn: document.getElementById('againBtn'),
  goodBtn: document.getElementById('goodBtn'),
  easyBtn: document.getElementById('easyBtn'),
  reviewTips: document.getElementById('reviewTips'),
  quizTimer: document.getElementById('quizTimer'),
  quizScore: document.getElementById('quizScore'),
  quizQuestionArea: document.getElementById('quizQuestionArea'),
  startQuizBtn: document.getElementById('startQuizBtn'),
  nextQuizQuestionBtn: document.getElementById('nextQuizQuestionBtn'),
  quizFeedback: document.getElementById('quizFeedback'),
  profileSummary: document.getElementById('profileSummary'),
  historyLog: document.getElementById('historyLog'),
  exportSaveBtn: document.getElementById('exportSaveBtn'),
  importSaveInput: document.getElementById('importSaveInput'),
  resetProgressBtn: document.getElementById('resetProgressBtn'),
  installBtn: document.getElementById('installBtn'),
  speakChallengeBtn: document.getElementById('speakChallengeBtn'),
  toast: document.getElementById('toast')
};

bootstrap();

async function bootstrap() {
  await loadLessons();
  ensureDailyProgress();
  bindEvents();
  renderAll();
  registerServiceWorker();
}

async function loadLessons() {
  const response = await fetch('./data/lessons.json');
  app.lessons = await response.json();
}

function bindEvents() {
  els.tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
  els.lessonSelect.addEventListener('change', (e) => {
    app.currentLessonIndex = Number(e.target.value);
    renderLesson();
  });
  els.checkPracticeBtn.addEventListener('click', handlePracticeCheck);
  els.completeLessonBtn.addEventListener('click', completeCurrentLesson);
  els.listenLessonBtn.addEventListener('click', speakCurrentLesson);
  els.showAnswerBtn.addEventListener('click', revealFlashcard);
  els.againBtn.addEventListener('click', () => scoreReview('again'));
  els.goodBtn.addEventListener('click', () => scoreReview('good'));
  els.easyBtn.addEventListener('click', () => scoreReview('easy'));
  els.startQuizBtn.addEventListener('click', startQuiz);
  els.nextQuizQuestionBtn.addEventListener('click', nextQuizQuestion);
  els.exportSaveBtn.addEventListener('click', exportSave);
  els.importSaveInput.addEventListener('change', importSave);
  els.resetProgressBtn.addEventListener('click', resetProgress);
  els.continueLessonBtn.addEventListener('click', () => {
    switchTab('learn');
    app.currentLessonIndex = findNextLessonIndex();
    els.lessonSelect.value = String(app.currentLessonIndex);
    renderLesson();
  });
  els.startReviewBtn.addEventListener('click', () => switchTab('review'));
  els.speakChallengeBtn.addEventListener('click', runSpeakChallenge);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    app.installPrompt = event;
    els.installBtn.classList.remove('hidden');
  });

  els.installBtn.addEventListener('click', async () => {
    if (!app.installPrompt) return;
    app.installPrompt.prompt();
    await app.installPrompt.userChoice;
    app.installPrompt = null;
    els.installBtn.classList.add('hidden');
  });
}

function switchTab(tabId) {
  els.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));
  els.panels.forEach(panel => panel.classList.toggle('active', panel.id === tabId));
  if (tabId === 'review') renderReview();
  if (tabId === 'quiz') renderQuizIdle();
}

function renderAll() {
  renderStats();
  renderDailyGoals();
  renderDashboard();
  renderLessonSelect();
  renderLesson();
  renderReview();
  renderQuizIdle();
  renderProfile();
}

function renderStats() {
  const { xp, level, streak, masteredCards } = app.state.profile;
  els.levelValue.textContent = level;
  els.xpValue.textContent = xp;
  els.streakValue.textContent = `${streak} jour${streak > 1 ? 's' : ''}`;
  els.masteredValue.textContent = masteredCards.length;

  const currentLevelXp = xp - ((level - 1) * XP_PER_LEVEL);
  const pct = Math.min(100, (currentLevelXp / XP_PER_LEVEL) * 100);
  els.levelProgressLabel.textContent = `${currentLevelXp} / ${XP_PER_LEVEL} XP`;
  els.levelProgressBar.style.width = `${pct}%`;
}

function renderDailyGoals() {
  const goals = [
    { label: 'Terminer 1 leçon', done: app.state.dailyProgress.lessonsCompletedToday >= 1 },
    { label: 'Réviser 3 cartes', done: app.state.dailyProgress.reviewDoneToday >= 3 },
    { label: 'Faire 1 quiz', done: app.state.dailyProgress.quizDoneToday >= 1 }
  ];

  els.dailyGoals.innerHTML = goals.map(goal => `
    <li class="${goal.done ? 'done' : ''}">${goal.done ? 'Fait — ' : ''}${goal.label}</li>
  `).join('');
}

function renderDashboard() {
  const nextLesson = app.lessons[findNextLessonIndex()];
  els.nextLessonTitle.textContent = nextLesson?.title || 'Toutes les leçons ont été terminées';
  els.nextLessonDescription.textContent = nextLesson?.description || 'Passez en mode révision et challenge pour consolider vos acquis.';

  const allExpressions = app.lessons.flatMap(lesson => lesson.expressions);
  const todayKey = new Date().toISOString().slice(0, 10);
  const dayIndex = [...todayKey].reduce((acc, char) => acc + char.charCodeAt(0), 0) % allExpressions.length;
  const word = allExpressions[dayIndex];
  els.wordOfTheDay.innerHTML = `
    <div class="it">${word.it}</div>
    <div>${word.fr}</div>
    <div class="phonetic">${word.phonetic}</div>
    <button class="secondary-btn" id="playWordBtn">Écouter</button>
  `;
  document.getElementById('playWordBtn').addEventListener('click', () => speakText(word.it));

  els.lessonRoadmap.innerHTML = app.lessons.map((lesson, index) => {
    const done = app.state.profile.completedLessons.includes(lesson.id);
    const current = index === findNextLessonIndex();
    return `
      <div class="roadmap-item ${done ? 'done' : ''} ${current ? 'current' : ''}">
        <strong>${lesson.title}</strong>
        <p class="muted">${lesson.description}</p>
        <span class="badge">${lesson.difficulty}</span>
      </div>
    `;
  }).join('');

  els.achievements.innerHTML = achievementsCatalog.map(item => {
    const unlocked = item.check(app.state);
    return `
      <div class="achievement ${unlocked ? '' : 'locked'}">
        <strong>${item.label}</strong>
        <p class="muted">${item.description}</p>
      </div>
    `;
  }).join('');
}

function renderLessonSelect() {
  els.lessonSelect.innerHTML = app.lessons.map((lesson, index) => `
    <option value="${index}">${index + 1}. ${lesson.title}</option>
  `).join('');
  app.currentLessonIndex = Math.min(app.currentLessonIndex, app.lessons.length - 1);
  els.lessonSelect.value = String(app.currentLessonIndex);
}

function renderLesson() {
  const lesson = app.lessons[app.currentLessonIndex];
  if (!lesson) return;
  const isDone = app.state.profile.completedLessons.includes(lesson.id);

  els.lessonMeta.innerHTML = `
    <span class="badge">${lesson.difficulty}</span>
    <span class="badge">${lesson.xp} XP</span>
    <span class="badge">${isDone ? 'Terminée' : 'À faire'}</span>
  `;
  els.lessonTitle.textContent = lesson.title;
  els.lessonDescription.textContent = lesson.description;
  els.lessonContent.innerHTML = lesson.expressions.map(item => `
    <div class="expression-card">
      <h4>${item.it}</h4>
      <p><strong>Français :</strong> ${item.fr}</p>
      <p><strong>Prononciation :</strong> ${item.phonetic}</p>
      <p class="muted"><strong>Exemple :</strong> ${item.example}</p>
    </div>
  `).join('');

  els.practiceForm.innerHTML = lesson.practice.map((item, idx) => `
    <label>
      ${item.prompt}
      <input type="text" data-index="${idx}" placeholder="Votre réponse" autocomplete="off" />
    </label>
  `).join('');

  els.practiceFeedback.textContent = '';
  els.practiceFeedback.className = 'feedback';
}

function normalizeAnswer(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[?.!,;:']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function handlePracticeCheck() {
  const lesson = app.lessons[app.currentLessonIndex];
  const inputs = [...els.practiceForm.querySelectorAll('input')];
  let score = 0;

  inputs.forEach((input, idx) => {
    const expected = lesson.practice[idx];
    const value = normalizeAnswer(input.value);
    const correctAnswers = [expected.answer, ...(expected.altAnswers || [])].map(normalizeAnswer);
    if (correctAnswers.includes(value)) score += 1;
  });

  if (score === lesson.practice.length) {
    els.practiceFeedback.textContent = 'Très bien. Toutes les réponses sont correctes.';
    els.practiceFeedback.className = 'feedback good';
  } else {
    els.practiceFeedback.textContent = `Vous avez ${score} bonne${score > 1 ? 's' : ''} réponse${score > 1 ? 's' : ''} sur ${lesson.practice.length}. Reprenez les expressions avant de valider la leçon.`;
    els.practiceFeedback.className = 'feedback bad';
  }
}

function completeCurrentLesson() {
  const lesson = app.lessons[app.currentLessonIndex];
  if (app.state.profile.completedLessons.includes(lesson.id)) {
    toast('Cette leçon est déjà validée.');
    return;
  }

  app.state.profile.completedLessons.push(lesson.id);
  addXp(lesson.xp);
  registerStudyDay();
  app.state.dailyProgress.lessonsCompletedToday += 1;

  lesson.expressions.forEach((item, idx) => {
    const cardId = `${lesson.id}-${idx}`;
    if (!app.state.review[cardId]) {
      app.state.review[cardId] = {
        id: cardId,
        front: item.it,
        back: item.fr,
        example: item.example,
        ease: 2.3,
        interval: 1,
        dueDate: todayIso(),
        lessonId: lesson.id,
        mastery: 0
      };
    }
  });

  pushHistory({ type: 'lesson', title: lesson.title, xp: lesson.xp, date: new Date().toISOString() });
  saveState();
  renderAll();
  toast(`Leçon validée. +${lesson.xp} XP`);
}

function renderReview() {
  const dueCards = getDueCards();
  els.reviewCountBadge.textContent = `${dueCards.length} carte${dueCards.length > 1 ? 's' : ''}`;
  els.reviewTips.innerHTML = [
    'Répondez rapidement et sans traduire mentalement mot à mot.',
    'Dites la réponse à voix haute avant de retourner la carte.',
    'Préférez des sessions courtes mais fréquentes.'
  ].map(text => `<div class="achievement">${text}</div>`).join('');

  if (!dueCards.length) {
    app.currentReviewCard = null;
    els.flashcard.className = 'flashcard empty';
    els.flashcard.innerHTML = '<p>Aucune carte urgente. Revenez plus tard ou terminez une nouvelle leçon.</p>';
    return;
  }

  if (!app.currentReviewCard || !app.state.review[app.currentReviewCard.id] || !dueCards.some(card => card.id === app.currentReviewCard.id)) {
    app.currentReviewCard = dueCards[0];
  }

  renderCurrentFlashcard(false);
}

function renderCurrentFlashcard(revealed = false) {
  if (!app.currentReviewCard) return;
  els.flashcard.className = `flashcard ${revealed ? 'revealed' : ''}`;
  els.flashcard.innerHTML = `
    <div>
      <p class="eyebrow">Italien</p>
      <h3>${app.currentReviewCard.front}</h3>
      <p class="answer"><strong>Français :</strong> ${app.currentReviewCard.back}</p>
      <p class="answer muted">${app.currentReviewCard.example}</p>
    </div>
  `;
}

function revealFlashcard() {
  if (!app.currentReviewCard) return;
  renderCurrentFlashcard(true);
}

function scoreReview(grade) {
  if (!app.currentReviewCard) return;
  const card = app.state.review[app.currentReviewCard.id];
  const today = new Date();

  if (grade === 'again') {
    card.interval = 1;
    card.ease = Math.max(1.5, card.ease - 0.2);
    card.mastery = Math.max(0, card.mastery - 1);
    addXp(5);
  } else if (grade === 'good') {
    card.interval = Math.max(1, Math.round(card.interval * card.ease));
    card.ease = Math.min(3.0, card.ease + 0.05);
    card.mastery += 1;
    addXp(12);
  } else {
    card.interval = Math.max(2, Math.round(card.interval * (card.ease + 0.4)));
    card.ease = Math.min(3.1, card.ease + 0.1);
    card.mastery += 2;
    addXp(18);
  }

  today.setDate(today.getDate() + card.interval);
  card.dueDate = today.toISOString().slice(0, 10);

  if (card.mastery >= 5 && !app.state.profile.masteredCards.includes(card.id)) {
    app.state.profile.masteredCards.push(card.id);
  }

  app.state.dailyProgress.reviewDoneToday += 1;
  registerStudyDay();
  pushHistory({ type: 'review', title: card.front, grade, date: new Date().toISOString() });
  saveState();
  renderAll();
}

function getDueCards() {
  const now = todayIso();
  return Object.values(app.state.review).filter(card => card.dueDate <= now).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function renderQuizIdle() {
  clearInterval(app.quiz.timer);
  app.quiz.timer = null;
  app.quiz.timeLeft = 60;
  app.quiz.score = 0;
  app.quiz.currentQuestion = null;
  app.quiz.asked = [];
  els.quizTimer.textContent = '60 s';
  els.quizScore.textContent = '0 point';
  els.quizFeedback.textContent = '';
  els.quizFeedback.className = 'feedback';
  els.quizQuestionArea.innerHTML = '<p class="muted">Le quiz mélange les expressions déjà vues. Plus vous répondez vite, plus la session est motivante.</p>';
  els.startQuizBtn.classList.remove('hidden');
  els.nextQuizQuestionBtn.classList.add('hidden');
}

function buildQuizPool() {
  const completed = new Set(app.state.profile.completedLessons);
  return app.lessons
    .filter(lesson => completed.has(lesson.id))
    .flatMap(lesson => lesson.expressions.map(item => ({ ...item, lessonId: lesson.id })));
}

function startQuiz() {
  const pool = buildQuizPool();
  if (pool.length < 4) {
    els.quizFeedback.textContent = 'Terminez au moins une leçon pour lancer un quiz varié.';
    els.quizFeedback.className = 'feedback bad';
    return;
  }

  els.startQuizBtn.classList.add('hidden');
  els.nextQuizQuestionBtn.classList.remove('hidden');
  app.quiz.timeLeft = 60;
  app.quiz.score = 0;
  app.quiz.asked = [];
  updateQuizMeta();

  app.quiz.timer = setInterval(() => {
    app.quiz.timeLeft -= 1;
    updateQuizMeta();
    if (app.quiz.timeLeft <= 0) finishQuiz();
  }, 1000);

  nextQuizQuestion();
}

function nextQuizQuestion() {
  const pool = buildQuizPool();
  const available = pool.filter(item => !app.quiz.asked.includes(item.it));
  if (!available.length) {
    finishQuiz();
    return;
  }

  const correct = pickOne(available);
  app.quiz.currentQuestion = correct;
  app.quiz.asked.push(correct.it);

  const wrongOptions = shuffle(pool.filter(item => item.it !== correct.it)).slice(0, 3).map(item => item.fr);
  const options = shuffle([correct.fr, ...wrongOptions]);

  els.quizQuestionArea.innerHTML = `
    <div>
      <p class="eyebrow">Quel est le bon sens ?</p>
      <h3>${correct.it}</h3>
      ${options.map(option => `<button class="quiz-option" data-answer="${escapeHtml(option)}">${option}</button>`).join('')}
    </div>
  `;

  [...els.quizQuestionArea.querySelectorAll('.quiz-option')].forEach(btn => {
    btn.addEventListener('click', () => answerQuiz(btn, correct.fr));
  });

  els.quizFeedback.textContent = '';
  els.quizFeedback.className = 'feedback';
}

function answerQuiz(button, correctAnswer) {
  const buttons = [...els.quizQuestionArea.querySelectorAll('.quiz-option')];
  buttons.forEach(btn => btn.disabled = true);

  if (button.textContent === correctAnswer) {
    button.classList.add('correct');
    app.quiz.score += 1;
    addXp(10);
    els.quizFeedback.textContent = 'Bonne réponse.';
    els.quizFeedback.className = 'feedback good';
  } else {
    button.classList.add('wrong');
    buttons.find(btn => btn.textContent === correctAnswer)?.classList.add('correct');
    els.quizFeedback.textContent = `Réponse attendue : ${correctAnswer}`;
    els.quizFeedback.className = 'feedback bad';
  }

  updateQuizMeta();
}

function finishQuiz() {
  clearInterval(app.quiz.timer);
  app.quiz.timer = null;
  app.state.dailyProgress.quizDoneToday += 1;
  registerStudyDay();
  pushHistory({ type: 'quiz', score: app.quiz.score, date: new Date().toISOString() });
  saveState();
  els.quizFeedback.textContent = `Quiz terminé. Score final : ${app.quiz.score}`;
  els.quizFeedback.className = 'feedback good';
  els.nextQuizQuestionBtn.classList.add('hidden');
  els.startQuizBtn.classList.remove('hidden');
  renderStats();
  renderDailyGoals();
  renderProfile();
}

function updateQuizMeta() {
  els.quizTimer.textContent = `${app.quiz.timeLeft} s`;
  els.quizScore.textContent = `${app.quiz.score} point${app.quiz.score > 1 ? 's' : ''}`;
}

function renderProfile() {
  const completedLessonsCount = app.state.profile.completedLessons.length;
  const dueCount = getDueCards().length;
  const masteryRate = Object.keys(app.state.review).length
    ? Math.round((app.state.profile.masteredCards.length / Object.keys(app.state.review).length) * 100)
    : 0;

  els.profileSummary.innerHTML = [
    `Leçons terminées : ${completedLessonsCount} / ${app.lessons.length}`,
    `Cartes maîtrisées : ${app.state.profile.masteredCards.length}`,
    `Cartes à revoir aujourd'hui : ${dueCount}`,
    `Taux de maîtrise : ${masteryRate} %`
  ].map(item => `<div class="achievement">${item}</div>`).join('');

  const history = [...app.state.profile.history].reverse().slice(0, 8);
  els.historyLog.innerHTML = history.length
    ? history.map(item => `<div class="achievement">${formatHistory(item)}</div>`).join('')
    : '<div class="achievement muted">Aucune activité enregistrée pour le moment.</div>';
}

function formatHistory(item) {
  const date = new Date(item.date).toLocaleString('fr-FR');
  if (item.type === 'lesson') return `${date} — Leçon terminée : ${item.title} (+${item.xp} XP)`;
  if (item.type === 'review') return `${date} — Révision : ${item.title} (${item.grade})`;
  if (item.type === 'quiz') return `${date} — Quiz : ${item.score} bonne${item.score > 1 ? 's' : ''} réponse${item.score > 1 ? 's' : ''}`;
  return `${date} — Activité`;
}

function addXp(amount) {
  app.state.profile.xp += amount;
  app.state.profile.level = Math.floor(app.state.profile.xp / XP_PER_LEVEL) + 1;
}

function registerStudyDay() {
  const today = todayIso();
  if (app.state.profile.lastStudyDate === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);

  if (app.state.profile.lastStudyDate === yesterdayIso) {
    app.state.profile.streak += 1;
  } else {
    app.state.profile.streak = 1;
  }

  app.state.profile.lastStudyDate = today;
}

function ensureDailyProgress() {
  const today = todayIso();
  if (app.state.dailyProgress.date !== today) {
    app.state.dailyProgress = {
      date: today,
      lessonsCompletedToday: 0,
      reviewDoneToday: 0,
      quizDoneToday: 0
    };
    saveState();
  }
}

function pushHistory(entry) {
  app.state.profile.history.push(entry);
  if (app.state.profile.history.length > 100) {
    app.state.profile.history = app.state.profile.history.slice(-100);
  }
}

function speakCurrentLesson() {
  const lesson = app.lessons[app.currentLessonIndex];
  const text = lesson.expressions.map(item => item.it).join('. ');
  speakText(text);
}

function runSpeakChallenge() {
  const pool = app.lessons.flatMap(lesson => lesson.expressions);
  const item = pickOne(pool);
  speakText(`Dites à voix haute : ${item.it}`);
  toast(`Défi oral : ${item.it}`);
}

function speakText(text) {
  if (!('speechSynthesis' in window)) {
    toast('La synthèse vocale n’est pas disponible sur ce navigateur.');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const italianVoice = voices.find(voice => voice.lang.toLowerCase().startsWith('it'));
  if (italianVoice) utterance.voice = italianVoice;
  utterance.lang = 'it-IT';
  utterance.rate = 0.92;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function exportSave() {
  const payload = {
    app: 'Parla',
    version: 1,
    exportedAt: new Date().toISOString(),
    state: app.state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `parla-save-${todayIso()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  toast('Sauvegarde JSON exportée.');
}

function importSave(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.state || !parsed.app) throw new Error('Format invalide');
      app.state = mergeWithDefaultState(parsed.state);
      saveState();
      ensureDailyProgress();
      renderAll();
      toast('Sauvegarde importée avec succès.');
    } catch {
      toast('Import impossible. Le fichier JSON ne correspond pas au format attendu.');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file, 'utf-8');
}

function resetProgress() {
  const confirmed = window.confirm('Supprimer toute la progression enregistrée dans ce navigateur ?');
  if (!confirmed) return;
  app.state = structuredClone(DEFAULT_STATE);
  saveState();
  renderAll();
  toast('Progression réinitialisée.');
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(app.state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return mergeWithDefaultState(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function mergeWithDefaultState(partial) {
  return {
    profile: { ...structuredClone(DEFAULT_STATE.profile), ...(partial.profile || {}) },
    review: partial.review || {},
    settings: { ...structuredClone(DEFAULT_STATE.settings), ...(partial.settings || {}) },
    dailyProgress: { ...structuredClone(DEFAULT_STATE.dailyProgress), ...(partial.dailyProgress || {}) }
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function findNextLessonIndex() {
  const idx = app.lessons.findIndex(lesson => !app.state.profile.completedLessons.includes(lesson.id));
  return idx === -1 ? 0 : idx;
}

function pickOne(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function escapeHtml(value) {
  return value.replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => els.toast.classList.remove('visible'), 2200);
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch {
      console.warn('Service worker non enregistré.');
    }
  }
}
