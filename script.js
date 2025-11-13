const lessons = [
  { question: "What is your name?", answer: "My name is André." },
  { question: "Where do you work?", answer: "I work at a bank." },
  { question: "What do you do?", answer: "I am a software developer." },
  { question: "Do you like technology?", answer: "Yes, I like technology." },
  { question: "How often do you study English?", answer: "I study English every day." },
  { question: "Are you ready to speak faster?", answer: "Yes, I am ready to speak faster." }
];

const questionText = document.getElementById("questionText");
const timerDisplay = document.getElementById("timerDisplay");
const transcriptDisplay = document.getElementById("transcript");
const feedbackDisplay = document.getElementById("feedback");
const pronunciationScoreDisplay = document.getElementById("pronunciationScore");
const startButton = document.getElementById("startButton");

const encouragementTemplate = document.getElementById("encouragementTemplate");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const state = {
  currentIndex: 0,
  recognition: null,
  timer: null,
  timerLimit: 5,
  evaluationPending: false,
  responseStartTime: null,
  awaitingRestart: false
};

if (!SpeechRecognition) {
  startButton.disabled = true;
  feedbackDisplay.innerHTML =
    '<span class="feedback feedback-error">Speech Recognition is not supported in this browser.</span>';
}

startButton.addEventListener("click", () => {
  startButton.disabled = true;
  startLesson();
});

function startLesson() {
  resetState();
  askQuestion();
}

function resetState() {
  state.currentIndex = 0;
  state.awaitingRestart = false;
}

function askQuestion() {
  if (state.currentIndex >= lessons.length) {
    finishLesson();
    return;
  }

  const { question } = lessons[state.currentIndex];
  feedbackDisplay.innerHTML = "&nbsp;";
  pronunciationScoreDisplay.textContent = "--";
  transcriptDisplay.textContent = "Listening...";
  questionText.textContent = question;

  speakQuestion(question, () => {
    beginListening();
    startCountdown();
  });
}

function speakQuestion(text, onEnd) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1.05;
  utterance.pitch = 1.1;
  utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

function beginListening() {
  if (state.recognition) {
    state.recognition.onresult = null;
    state.recognition.onend = null;
    state.recognition.stop();
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  state.recognition = recognition;
  state.evaluationPending = true;
  state.responseStartTime = Date.now();

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join(" ");

    transcriptDisplay.textContent = transcript.trim();

    const isFinal = event.results[event.results.length - 1].isFinal;
    if (isFinal && state.evaluationPending) {
      state.evaluationPending = false;
      evaluateResponse(transcript.trim());
    }
  };

  recognition.onerror = () => {
    if (state.evaluationPending) {
      state.evaluationPending = false;
      evaluateResponse("");
    }
  };

  recognition.onend = () => {
    if (state.evaluationPending) {
      state.evaluationPending = false;
      evaluateResponse(transcriptDisplay.textContent.trim());
    }
  };

  recognition.start();
}

function startCountdown() {
  clearInterval(state.timer);
  let timeLeft = state.timerLimit;
  timerDisplay.textContent = timeLeft.toString();

  state.timer = setInterval(() => {
    timeLeft -= 1;
    timerDisplay.textContent = timeLeft.toString();

    if (timeLeft <= 0) {
      clearInterval(state.timer);
      timerDisplay.textContent = "0";
      handleTimeout();
    }
  }, 1000);
}

function handleTimeout() {
  if (state.recognition) {
    state.recognition.stop();
  }
  state.evaluationPending = false;
  const encouragement = encouragementTemplate.content.cloneNode(true);
  feedbackDisplay.innerHTML = "";
  feedbackDisplay.appendChild(encouragement);
  transcriptDisplay.textContent = "No response detected.";
  repeatQuestion();
}

function evaluateResponse(response) {
  clearInterval(state.timer);
  const { answer } = lessons[state.currentIndex];

  const normalizedExpected = normalizeText(answer);
  const normalizedResponse = normalizeText(response);

  if (!response) {
    feedbackDisplay.innerHTML =
      '<span class="feedback feedback-warning">Speak up! Answer quickly like in class.</span>';
    transcriptDisplay.textContent = response || "No response detected.";
    return repeatQuestion();
  }

  const responseTime = state.responseStartTime
    ? (Date.now() - state.responseStartTime) / 1000
    : state.timerLimit + 1;
  const isCorrect = normalizedResponse === normalizedExpected;
  const pronunciationScore = calculatePronunciationScore(answer, response, responseTime, state.timerLimit);
  const rhythmFeedback = responseTime <= state.timerLimit ? "Good pace." : "Too slow.";

  pronunciationScoreDisplay.textContent = `${Math.round(pronunciationScore)} / 100`;

  if (isCorrect) {
    feedbackDisplay.innerHTML =
      `<span class="feedback feedback-success">Correct! ${rhythmFeedback}</span>`;
    proceedToNextQuestion();
  } else {
    feedbackDisplay.innerHTML =
      `<span class="feedback feedback-error">Not quite. Say: "${answer}"</span>`;
    repeatQuestion();
  }
}

function proceedToNextQuestion() {
  state.currentIndex += 1;
  setTimeout(() => {
    transcriptDisplay.textContent = "Listening...";
    askQuestion();
  }, 1400);
}

function repeatQuestion() {
  state.awaitingRestart = true;
  setTimeout(() => {
    state.awaitingRestart = false;
    askQuestion();
  }, 2000);
}

function finishLesson() {
  questionText.textContent = "Lesson complete!";
  timerDisplay.textContent = "--";
  transcriptDisplay.textContent = "Great job keeping the pace!";
  feedbackDisplay.innerHTML =
    '<span class="feedback feedback-success">Fantastic work. Restart for more practice.</span>';
  pronunciationScoreDisplay.textContent = "--";
  startButton.disabled = false;
  startButton.textContent = "Restart Lesson";
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calculatePronunciationScore(expected, actual, responseTime, limit) {
  const expectedWords = expected.split(/\s+/);
  const actualWords = actual.split(/\s+/);

  const expectedCodes = expectedWords.map(soundex);
  const actualCodes = actualWords.map(soundex);

  const maxLength = Math.max(expectedCodes.length, actualCodes.length);
  if (!maxLength) return 0;

  let matches = 0;
  expectedCodes.forEach((code, index) => {
    if (code && code === actualCodes[index]) {
      matches += 1;
    }
  });

  const phoneticSimilarity = (matches / maxLength) * 70;
  const textSimilarity = computeTextSimilarity(expected, actual) * 20;
  const pacingBonus = Math.max(0, 10 - Math.abs(actualWords.length - expectedWords.length) * 2);
  const timingScore = Math.max(0, (limit - Math.max(responseTime - limit, 0)) / limit) * 10;

  return Math.min(100, phoneticSimilarity + textSimilarity + pacingBonus + timingScore);
}

function soundex(phrase) {
  const word = phrase.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (!word) return "";

  const firstLetter = word[0];
  const mappings = {
    B: 1, F: 1, P: 1, V: 1,
    C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2,
    D: 3, T: 3,
    L: 4,
    M: 5, N: 5,
    R: 6
  };

  let result = firstLetter;
  let previousDigit = mappings[firstLetter] || "";

  for (let i = 1; i < word.length; i += 1) {
    const char = word[i];
    const digit = mappings[char] || 0;

    if (digit !== 0 && digit !== previousDigit) {
      result += digit;
    }

    previousDigit = digit;
  }

  return (result + "000").slice(0, 4);
}

function computeTextSimilarity(expected, actual) {
  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);

  const expectedWords = normalizedExpected.split(" ");
  const actualWords = normalizedActual.split(" ");

  const setExpected = new Set(expectedWords);
  let overlap = 0;
  actualWords.forEach((word) => {
    if (setExpected.has(word)) {
      overlap += 1;
    }
  });

  return overlap / Math.max(expectedWords.length, 1);
}
