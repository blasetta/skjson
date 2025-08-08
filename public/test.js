//import { collection, getDocs } from 'firebase/firestore';

// The frontend no longer connects to Firebase directly.
// It fetches data from our new Cloud Run API.

// --- DATA SOURCE ---
let main_title = "Practice Quiz ";

// --- CONSTANTS ---
// This will be replaced with your actual Cloud Run URL after deployment.
const API_BASE_URL = 'https://quiz-api-848065846796.us-central1.run.app'; // IMPORTANT: Paste your actual Cloud Run URL here

// --- HELPERS ---

/**
 * Gets the quiz code from the URL query parameter.
 * @returns {string|null} The quiz code (e.g., "GCP-ML") or null if not present.
 */
function getQuizCodeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('quiz');
}

// Function to fetch questions from the new API
async function fetchQuestionsFromApi(quizCode) {
    if (!quizCode) {
        console.error("No quiz code provided to fetchQuestionsFromApi.");
        return null;
    }

    const apiUrl = `${API_BASE_URL}/quiz/${quizCode}`;
    console.log(`Fetching quiz from API: ${apiUrl}`);

    try {
        const response = await fetch(apiUrl);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `API request failed with status: ${response.status}` }));
            console.error(`API Error: ${errorData.error}`);
            return { error: errorData.error }; // Return error info to display on UI
        }

        const questionDoc = await response.json();

        // Update the main title with the title from the database
        main_title += questionDoc.title;

        // This is just for demonstration to see what you get
        console.log(`Fetched Quiz: ${questionDoc.title} (${questionDoc.platform})`);

        // Return the array of question objects
        return questionDoc.qa;

    } catch (error) {
        console.error("Failed to fetch from API:", error);
        return { error: "Could not connect to the quiz API. Is it running?" };
    }
}


let questions = [];

// --- STATE MANAGEMENT ---
let currentQuestionIndex = 0;
let score = 0;
let userSelections;
let answeredCorrectly;

// Timer state
let timerInterval;
let totalSeconds = 0;
let inactivityTimer;
let userHasInteracted = false;

// --- DOM ELEMENTS ---
const mainTitleEl = document.getElementById('main-title');
const scoreboardEl = document.getElementById('scoreboard');
const questionsWrapperEl = document.getElementById('questions-wrapper');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const questionJumpEl = document.getElementById('question-jump');
const resetQuizBtn = document.getElementById('reset-quiz-btn');
const timerEl = document.getElementById('timer');
const resetConfirmModal = document.getElementById('reset-confirm-modal');
const resetConfirmOverlay = document.getElementById('reset-confirm-overlay');
const cancelResetBtn = document.getElementById('cancel-reset-btn');
const confirmResetBtn = document.getElementById('confirm-reset-btn');

// --- COOKIE HELPERS ---
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (JSON.stringify(value) || "") + expires + "; path=/; SameSite=Lax";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) {
            try {
                return JSON.parse(c.substring(nameEQ.length, c.length));
            } catch (e) {
                return null;
            }
        }
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999; path=/; SameSite=Lax';
}

// --- STATE PERSISTENCE ---
function saveState() {
    const state = {
        currentQuestionIndex,
        score,
        userSelections,
        answeredCorrectly,
        totalSeconds
    };
    setCookie('quizState', state, 7);
}

function loadState() {
    const savedState = getCookie('quizState');
    if (savedState) {
        currentQuestionIndex = savedState.currentQuestionIndex || 0;
        score = savedState.score || 0;
        userSelections = savedState.userSelections || Array(questions.length).fill(null).map(() => []);
        answeredCorrectly = savedState.answeredCorrectly || Array(questions.length).fill(false);
        totalSeconds = savedState.totalSeconds || 0;
        userHasInteracted = true;
        return true;
    } 
    return false;
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const gdprModal = document.getElementById('gdpr-modal');
    const gdprOverlay = document.getElementById('gdpr-overlay');
    const acceptGdprBtn = document.getElementById('accept-gdpr-btn');

    if (!getCookie('gdprAccepted')) {
        gdprModal.classList.remove('hidden');
        gdprOverlay.classList.remove('hidden');
    }

    acceptGdprBtn.addEventListener('click', () => {
        gdprModal.classList.add('hidden');
        gdprOverlay.classList.add('hidden');
        setCookie('gdprAccepted', 'true', 365);
    });

    setupQuiz();
    addEventListeners();
});

async function setupQuiz() {
    const quizCode = getQuizCodeFromURL();

    if (!quizCode) {
        mainTitleEl.textContent = "No Quiz Selected";
        questionsWrapperEl.innerHTML = `<div class="text-center p-8 bg-white rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-red-600 mb-4">Quiz Not Found</h2>
            <p class="text-gray-700">Please specify a quiz code in the URL.</p>
            <p class="text-gray-500 mt-2">Example: <code>/test.html?quiz=GCP-ML</code></p>
        </div>`;
        document.getElementById('navigation-controls').classList.add('hidden');
        return;
    }

    const fetchedData = await fetchQuestionsFromApi(quizCode);

    // Handle cases where the API returns an error object
    if (fetchedData && fetchedData.error) {
        mainTitleEl.textContent = "Error Loading Quiz";
        questionsWrapperEl.innerHTML = `<div class="text-center p-8 bg-white rounded-lg shadow-md"><h2 class="text-2xl font-bold text-red-600 mb-4">Could not load quiz</h2><p class="text-gray-700">${fetchedData.error}</p></div>`;
        document.getElementById('navigation-controls').classList.add('hidden');
        return;
    }

    questions = fetchedData;

    document.title = main_title;
    mainTitleEl.textContent = main_title;
    questionsWrapperEl.innerHTML = '';
    questionJumpEl.innerHTML = '';

    if (!questions || questions.length === 0) {
        console.error(`No questions found for quiz code: ${quizCode}`);
        mainTitleEl.textContent = `Quiz Not Found: ${quizCode}`;
        questionsWrapperEl.innerHTML = `<div class="text-center p-8 bg-white rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-red-600 mb-4">Quiz Not Found</h2>
            <p class="text-gray-700">We couldn't find a quiz with the code <strong>${quizCode}</strong>.</p>
            <p class="text-gray-500 mt-2">Please check the code and try again.</p>
        </div>`;
        document.getElementById('navigation-controls').classList.add('hidden');
        return;
    }

    // Initialize state arrays now that we know the number of questions
    userSelections = Array(questions.length).fill(null).map(() => []);
    answeredCorrectly = Array(questions.length).fill(false);

    const stateLoaded = loadState();

    questions.forEach((q, index) => {
        renderQuestion(q, index);
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `Question ${index + 1}`;
        questionJumpEl.appendChild(option);
    });

    questions.forEach((q, index) => {
        const selections = userSelections[index];
        if (selections && selections.length > 0) {
            const qContainer = document.getElementById(`question-${index}`);
            selections.forEach(letter => {
                const btn = qContainer.querySelector(`.option-btn[data-letter="${letter}"]`);
                if (btn) {
                    btn.classList.add('selected', 'font-bold');
                }
            });
            if (!answeredCorrectly[index]) {
                 const confirmBtn = qContainer.querySelector('.confirm-btn');
                 confirmBtn.disabled = userSelections[index].length !== q.correctAnswers.length;
            }
        }
        if (answeredCorrectly[index]) {
            applyConfirmedState(index);
        }
    });
    
    updateScoreboard();
    timerEl.textContent = formatTime(totalSeconds);
    showQuestion(currentQuestionIndex, true);

    if (stateLoaded) {
        handleUserInteraction();
    }
}

function addEventListeners() {
    document.getElementById('quiz-container').addEventListener('click', (e) => {
        handleUserInteraction();
        dispatchInteraction(e);
    });
    document.getElementById('quiz-container').addEventListener('change', (e) => {
        handleUserInteraction();
        dispatchInteraction(e);
    });

    resetQuizBtn.addEventListener('click', showResetModal);

    cancelResetBtn.addEventListener('click', hideResetModal);
    confirmResetBtn.addEventListener('click', handleResetConfirmation);
}

// --- RENDERING ---
function renderQuestion(question, index) {
    const questionContainer = document.createElement('div');
    questionContainer.id = `question-${index}`;
    questionContainer.className = 'question-container bg-white p-6 rounded-lg shadow-md mb-4 hidden';

    const choiceText = `(Choose ${question.correctAnswers.length})`;
    
    let levelBadgeClass = '';
    let levelText = '';
    if (question.level) {
        levelText = `Level ${question.level}`;
        switch (question.level) {
            case 1:
                levelBadgeClass = 'bg-green-100 text-green-800';
                break;
            case 2:
                levelBadgeClass = 'bg-yellow-100 text-yellow-800';
                break;
            case 3:
                levelBadgeClass = 'bg-red-100 text-red-800';
                break;
            default:
                levelBadgeClass = 'bg-gray-100 text-gray-800';
        }
    }

    questionContainer.innerHTML = `
        <div class="flex justify-between items-center border-b pb-2 mb-4">
            <h2 class="text-xl font-bold text-gray-800">Question ${index + 1}</h2>
            ${question.level ? `<span class="text-sm font-semibold px-3 py-1 rounded-full ${levelBadgeClass}">${levelText}</span>` : ''}
        </div>
        <p class="text-gray-800 text-xl mb-4">${question.scenario}</p>
        <p class="text-lg font-medium mb-4">${question.questionText} <span class="text-sm font-normal text-gray-500">${question.isMultiChoice ? choiceText : '(Choose one)'}</span></p>
        <div class="options-grid grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            ${question.options.map(opt => `
                <button class="option-btn w-full text-left p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-100 transition-colors" data-question-index="${index}" data-letter="${opt.letter}">
                    <span class="font-bold mr-2">${opt.letter}.</span> ${opt.text}
                </button>
            `).join('')}
        </div>
        <div class="mt-4 flex justify-between items-center">
            <button class="explanation-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed" data-question-index="${index}" disabled>Explanation</button>
            <button class="confirm-btn bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed" data-question-index="${index}" disabled>Confirm</button>
        </div>
        <div class="explanation-box mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p class="explanation-text whitespace-pre-wrap text-base"></p>
            <p class="wrong-explanation-text whitespace-pre-wrap text-base mt-2"></p>
        </div>
    `;

    questionsWrapperEl.appendChild(questionContainer);
}

function applyConfirmedState(index) {
    const question = questions[index];
    const selections = userSelections[index];
    const qContainer = document.getElementById(`question-${index}`);
    const confirmBtn = qContainer.querySelector('.confirm-btn');
    const explanationBtn = qContainer.querySelector('.explanation-btn');
    const optionButtons = qContainer.querySelectorAll('.option-btn');

    confirmBtn.disabled = true;
    explanationBtn.disabled = false;
    optionButtons.forEach(btn => btn.disabled = true);

    optionButtons.forEach(btn => {
        const letter = btn.dataset.letter;
        if (question.correctAnswers.includes(letter)) {
            btn.classList.add('correct');
        } else if (selections.includes(letter)) {
            btn.classList.add('incorrect');
        }
    });

    const explanationBox = qContainer.querySelector('.explanation-box');
    explanationBox.querySelector('.explanation-text').textContent = question.explanation;
    explanationBox.querySelector('.wrong-explanation-text').textContent = question.wrongExplanation;
}

// --- LOGIC & EVENT HANDLERS ---
function handleOptionSelect(selectedBtn) {
    const index = parseInt(selectedBtn.dataset.questionIndex);
    const letter = selectedBtn.dataset.letter;
    const question = questions[index];
    const parent = selectedBtn.closest('.options-grid');

    if (question.isMultiChoice) {
        const currentSelections = userSelections[index];
        const maxSelections = question.correctAnswers.length;

        if (currentSelections.includes(letter)) {
            userSelections[index] = currentSelections.filter(l => l !== letter);
            selectedBtn.classList.remove('selected', 'font-bold');
        } else {
            if (currentSelections.length >= maxSelections) {
                const oldestSelection = userSelections[index].shift();
                const oldestBtn = parent.querySelector(`.option-btn[data-letter="${oldestSelection}"]`);
                if (oldestBtn) {
                    oldestBtn.classList.remove('selected', 'font-bold');
                }
            }
            userSelections[index].push(letter);
            selectedBtn.classList.add('selected', 'font-bold');
        }
    } else {
        parent.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.remove('selected', 'font-bold');
        });
        userSelections[index] = [letter];
        selectedBtn.classList.add('selected', 'font-bold');
    }
    
    const confirmBtn = document.querySelector(`#question-${index} .confirm-btn`);
    confirmBtn.disabled = userSelections[index].length !== question.correctAnswers.length;
    saveState();
}

function handleConfirm(confirmBtn) {
    const index = parseInt(confirmBtn.dataset.questionIndex);
    const question = questions[index];
    const selections = userSelections[index];
    
    const sortedSelections = [...selections].sort();
    const sortedCorrect = [...question.correctAnswers].sort();
    const isCorrect = JSON.stringify(sortedSelections) === JSON.stringify(sortedCorrect);
    
    if (isCorrect && !answeredCorrectly[index]) {
        score++;
        updateScoreboard();
    }
    
    answeredCorrectly[index] = true;
    applyConfirmedState(index);
    saveState();
}

function handleExplanationClick(btn) {
    const index = parseInt(btn.dataset.questionIndex);
    const explanationBox = document.querySelector(`#question-${index} .explanation-box`);
    explanationBox.classList.toggle('visible');
}

function showQuestion(index, isInitialLoad = false) {
    if (index < 0 || index >= questions.length) return;

    const allQuestions = document.querySelectorAll('.question-container');
    allQuestions.forEach(q => q.classList.add('hidden'));

    const newQuestionEl = document.getElementById(`question-${index}`);
    if (newQuestionEl) newQuestionEl.classList.remove('hidden');

    currentQuestionIndex = index;
    questionJumpEl.value = index;

    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === questions.length - 1;

    if (!isInitialLoad) {
        saveState();
    }
}

function updateScoreboard() {
    scoreboardEl.textContent = `Score: ${score} / ${questions.length}`;
}

function showResetModal() {
    resetConfirmOverlay.classList.remove('hidden');
    resetConfirmModal.classList.remove('hidden');
}

function hideResetModal() {
    resetConfirmOverlay.classList.add('hidden');
    resetConfirmModal.classList.add('hidden');
}

function handleResetConfirmation() {
    hideResetModal();
    deleteCookie('quizState'); 
    location.reload(); 
}

// --- TIMER & INACTIVITY FUNCTIONS ---
function handleUserInteraction() {
    if (!userHasInteracted) {
        userHasInteracted = true;
    }
    clearTimeout(inactivityTimer);
    startTimer();
    inactivityTimer = setTimeout(stopTimer, 180000); 
}

function startTimer() {
    if (timerInterval || !userHasInteracted) return;
    timerInterval = setInterval(() => {
        totalSeconds++;
        timerEl.textContent = formatTime(totalSeconds);
        saveState();
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// --- EVENT DISPATCHER ---
function dispatchInteraction(event) {
    const target = event.target;
    
    const optionBtn = target.closest('.option-btn');
    if (optionBtn) {
        handleOptionSelect(optionBtn);
        return;
    }

    const confirmBtn = target.closest('.confirm-btn');
    if (confirmBtn) {
        handleConfirm(confirmBtn);
        return;
    }

    const explanationBtn = target.closest('.explanation-btn');
    if (explanationBtn) {
        handleExplanationClick(explanationBtn);
        return;
    }

    if (target.id === 'prev-btn') {
         showQuestion(currentQuestionIndex - 1);
    } else if (target.id === 'next-btn') {
         showQuestion(currentQuestionIndex + 1);
    } else if (target.id === 'question-jump') {
        showQuestion(parseInt(target.value));
    }
}
