// ============================================================
// MAIN.JS — Cyber Café
//
// INDHOLD:
//   1. Data (scener, valg, resultat-niveauer)
//   2. State (variabler der holder styr på spillets fremdrift)
//   3. DOM-referencer
//   4. Funktioner
//   5. Event listeners
//   6. Opstart
// ============================================================


// ------------------------------------------------------------
// 1. DATA
// ------------------------------------------------------------
// Hver scene er et objekt i et array. Hvert valg (choice) er selv et
// objekt med den feedback og de point, valget udløser.

const scenes = [
  {
    number: 1,
    category: "wifi",
    categoryLabel: "Café Wi-Fi",
    choices: [
      {
        status: "negative",
        points: -20,
        text: "Åbne netværk gør det let for andre at aflæse din trafik med et Man-in-the-Middle-angreb.",
      },
      {
        status: "positive",
        points: 15,
        text: "Godt valg! VPN krypterer din forbindelse, så dine data er beskyttet, selv på åbent wifi.",
      },
      {
        status: "positive",
        points: 20,
        text: "Godt valg! Dit eget mobile hotspot er en forbindelse, du selv kontrollerer og er derfor sikker.",
      },
    ],
  },
  {
    number: 2,
    category: "password",
    categoryLabel: "Adgangskode",
    choices: [
      {
        status: "negative",
        points: -20,
        text: "En kort kode med navn og tal har lav entropi og kan gættes eller knækkes med et dictionary-angreb.",
      },
      {
        status: "neutral",
        points: -10,
        text: "Bedre end navn123, men stadig noget andre kan gætte ud fra offentlige oplysninger om dig.",
      },
      {
        status: "positive",
        points: 20,
        text: "Godt valg! En lang adgangssætning giver høj entropi og er samtidig lettere at huske.",
      },
    ],
  },
  {
    number: 3,
    category: "mail",
    categoryLabel: "Mail",
    choices: [
      {
        status: "negative",
        points: -20,
        text: "Det er præcis, hvad afsenderen håber på. Tidspresset er en klassisk phishing-taktik.",
      },
      {
        status: "positive",
        points: 20,
        text: "Godt valg! At verificere med IT-support beskytter både dig og resten af skolen.",
      },
      {
        status: "neutral",
        points: 5,
        text: "Du undgår selv faren, men uden at advare andre kan phishing-forsøget stadig ramme andre.",
      },
    ],
  },
];

// Resultat-niveauer, sorteret efter mindste point først.
// Bruges til at afgøre hvilken af de (mindst) to slutninger spilleren får.
const outcomes = [
  {
    min: 50,
    title: "Cyber Champion",
    message: "Flotte valg! Du navigerede café-wifi, adgangskoder og en phishing-mail sikkert igennem.",
  },
  {
    min: 25,
    title: "Godt gået",
    message: "Du traf flere gode valg, men der er stadig plads til at skærpe dine digitale vaner.",
  },
  {
    min: -Infinity,
    title: "Prøv igen",
    message: "Flere af dine valg gjorde dig sårbar. Prøv igen, og se om du kan træffe sikrere valg.",
  },
];

// Farver til de dynamiske status-prikker (matcher variablerne i style.scss)
const statusColors = {
  positive: "#3fa34d",
  neutral: "#e0a800",
  negative: "#d9483d",
};


// ------------------------------------------------------------
// 2. STATE
// ------------------------------------------------------------

let playerName = "";
let selectedCharacter = "1";
let currentSceneNumber = 1;
let cyberScore = 0;
let breakdown = []; // { label, points, status } — ét pr. besvaret scene
let introTimeoutId = null;   // reference til den ventende intro-timer, så den kan annulleres
let bootHasStarted = false;  // forhindrer at boot-sekvensen bliver startet mere end én gang


// ------------------------------------------------------------
// 3. DOM-REFERENCER
// ------------------------------------------------------------

const nameInput = document.getElementById("player-name");
const startButton = document.getElementById("start-button");
const characterButtons = document.querySelectorAll(".character-picker__option");

const introSlides = document.querySelectorAll(".intro-slide");
const skipIntroButton = document.getElementById("skip-intro-button");

const bootPlayerName = document.getElementById("boot-player-name");
const bootProgressBar = document.querySelector(".boot__progress-bar");
const bootProgressLabel = document.querySelector(".boot__progress-label");
const bootProgressWrapper = document.querySelector(".boot__progress");

const cyberScoreValue = document.getElementById("cyber-score-value");
const cyberScoreScene = document.getElementById("cyber-score-scene");

const restartButton = document.getElementById("restart-button");


// ------------------------------------------------------------
// 4. FUNKTIONER
// ------------------------------------------------------------

// Viser én skærm (fx "screen-start") og skjuler resten
function showScreen(screenId) {
  const allScreens = document.querySelectorAll(".screen");

  allScreens.forEach((screen) => {
    const isTarget = screen.id === screenId;
    screen.classList.toggle("is-active", isTarget);
    screen.setAttribute("aria-hidden", String(!isTarget));
  });
}

// Markerer den valgte karakter som "trykket" og gemmer valget
function selectCharacter(button) {
  characterButtons.forEach((btn) => {
    btn.setAttribute("aria-pressed", "false");
  });

  button.setAttribute("aria-pressed", "true");
  selectedCharacter = button.dataset.character;
}

// Starter spillet: gemmer navn og går videre til introfilmen
function startGame() {
  const typedName = nameInput.value.trim();
  playerName = typedName === "" ? "Spiller" : typedName;

  showScreen("screen-intro");
  playIntro(0);
}

// Viser introfilmens slides efter hinanden med en kort pause imellem
function playIntro(slideIndex) {
  introSlides.forEach((slide, index) => {
    slide.classList.toggle("is-active", index === slideIndex);
  });

  const isLastSlide = slideIndex >= introSlides.length - 1;

  if (isLastSlide) {
    introTimeoutId = setTimeout(runBootSequence, 1800);
  } else {
    introTimeoutId = setTimeout(() => playIntro(slideIndex + 1), 1800);
  }
}

// Springer introfilmen over: annullerer den ventende intro-timer først,
// så boot-sekvensen ikke også bliver startet automatisk senere
function skipIntro() {
  if (introTimeoutId !== null) {
    clearTimeout(introTimeoutId);
    introTimeoutId = null;
  }

  runBootSequence();
}

// Kører boot-skærmens loading-animation og går derefter videre til computeren
function runBootSequence() {
  // Ekstra sikkerhed: hvis funktionen på en eller anden måde bliver kaldt
  // to gange, ignoreres det andet kald, så loading-baren ikke kører to gange
  if (bootHasStarted) {
    return;
  }
  bootHasStarted = true;

  showScreen("screen-boot");
  bootPlayerName.textContent = playerName;

  let progress = 0;
  const progressStep = 5;
  const stepDelay = 60;

  const progressInterval = setInterval(() => {
    progress += progressStep;

    if (progress >= 100) {
      progress = 100;
      clearInterval(progressInterval);
      setTimeout(startComputerScenario, 700);
    }

    bootProgressBar.style.width = progress + "%";
    bootProgressLabel.textContent = progress + "%";
    bootProgressWrapper.setAttribute("aria-valuenow", String(progress));
  }, stepDelay);
}

// Nulstiller og starter selve det forgrenede scenarie
function startComputerScenario() {
  currentSceneNumber = 1;
  cyberScore = 0;
  breakdown = [];

  updateCyberScoreDisplay();
  loadScene(currentSceneNumber);
  showScreen("screen-computer");
}

// Finder scene-data ud fra scene-nummeret
function getSceneData(sceneNumber) {
  return scenes.find((scene) => scene.number === sceneNumber);
}

// Gør en given scene synlig, og nulstiller dens feedback/knapper
function loadScene(sceneNumber) {
  const allSceneElements = document.querySelectorAll(".scene");

  allSceneElements.forEach((sceneElement) => {
    const isTarget = sceneElement.dataset.scene === String(sceneNumber);
    sceneElement.classList.toggle("is-active", isTarget);
    sceneElement.setAttribute("aria-hidden", String(!isTarget));
  });

  // Resultat-scenen har hverken valgknapper eller feedback-boks, så den stopper her
  if (sceneNumber === "result") {
    return;
  }

  cyberScoreScene.textContent = "Scene " + sceneNumber;

  const sceneElement = document.querySelector('.scene[data-scene="' + sceneNumber + '"]');
  const feedbackBox = sceneElement.querySelector(".feedback-box");
  const nextButton = sceneElement.querySelector(".btn--next");
  const optionButtons = sceneElement.querySelectorAll(".btn--choice");

  feedbackBox.hidden = true;
  feedbackBox.classList.remove("is-positive", "is-neutral", "is-negative");
  nextButton.hidden = true;

  optionButtons.forEach((button) => {
    button.disabled = false;
  });
}

// Håndterer at spilleren har klikket på et af de tre valg i en scene
function handleChoice(sceneElement, choiceNumber) {
  const sceneNumber = Number(sceneElement.dataset.scene);
  const sceneData = getSceneData(sceneNumber);
  const choice = sceneData.choices[choiceNumber - 1];

  cyberScore += choice.points;
  breakdown.push({
    label: sceneData.categoryLabel,
    points: choice.points,
    status: choice.status,
  });

  updateCyberScoreDisplay();
  showFeedback(sceneElement, choice);
  disableChoices(sceneElement);
}

// Viser feedback-boksen med tekst, point og farvet indikator
function showFeedback(sceneElement, choice) {
  const feedbackBox = sceneElement.querySelector(".feedback-box");
  const feedbackText = feedbackBox.querySelector(".feedback-box__text");
  const feedbackPoints = feedbackBox.querySelector(".feedback-box__points");
  const nextButton = sceneElement.querySelector(".btn--next");

  feedbackBox.hidden = false;
  feedbackBox.classList.add("is-" + choice.status);

  feedbackText.textContent = choice.text;
  feedbackPoints.textContent = (choice.points > 0 ? "+" : "") + choice.points + " point";

  nextButton.hidden = false;
}

// Forhindrer at spilleren vælger flere gange i samme scene
function disableChoices(sceneElement) {
  const optionButtons = sceneElement.querySelectorAll(".btn--choice");

  optionButtons.forEach((button) => {
    button.disabled = true;
  });
}

// Går videre til næste scene, eller til resultatet hvis sidste scene er nået
function goToNextScene() {
  const isLastScene = currentSceneNumber >= scenes.length;

  if (isLastScene) {
    showResult();
  } else {
    currentSceneNumber += 1;
    loadScene(currentSceneNumber);
  }
}

// Bygger resultatskærmen ud fra den samlede Cyber Score og breakdown-arrayet
function showResult() {
  const resultScore = document.getElementById("result-score");
  const resultBreakdown = document.getElementById("result-breakdown");
  const resultMessage = document.getElementById("result-message");

  resultScore.textContent = String(cyberScore);

  // Ryd tidligere indhold og byg listen op igen ud fra breakdown-arrayet
  resultBreakdown.innerHTML = "";

  breakdown.forEach((entry) => {
    const listItem = document.createElement("li");
    const pointsText = (entry.points > 0 ? "+" : "") + entry.points + " point";

    listItem.textContent = entry.label + ": " + pointsText;
    listItem.style.setProperty("--dot-color", statusColors[entry.status]);

    resultBreakdown.appendChild(listItem);
  });

  const outcome = outcomes.find((level) => cyberScore >= level.min);
  resultMessage.textContent = outcome.title + " — " + outcome.message;

  loadScene("result");
  cyberScoreScene.textContent = "Resultat";
}

// Nulstiller alt og starter forfra på startskærmen
function restartGame() {
  playerName = "";
  cyberScore = 0;
  breakdown = [];
  currentSceneNumber = 1;
  bootHasStarted = false;

  if (introTimeoutId !== null) {
    clearTimeout(introTimeoutId);
    introTimeoutId = null;
  }

  nameInput.value = "";
  bootProgressBar.style.width = "0%";
  bootProgressLabel.textContent = "0%";

  showScreen("screen-start");
}

// Opdaterer Cyber Score i toppen af computer-skærmen
function updateCyberScoreDisplay() {
  cyberScoreValue.textContent = String(cyberScore);
}


// ------------------------------------------------------------
// 5. EVENT LISTENERS
// ------------------------------------------------------------

characterButtons.forEach((button) => {
  button.addEventListener("click", () => selectCharacter(button));
});

startButton.addEventListener("click", startGame);
skipIntroButton.addEventListener("click", skipIntro);

// Én event listener pr. scene, der lytter efter klik på både valg-knapper og "Næste"
document.querySelectorAll('.scene[data-scene]').forEach((sceneElement) => {
  if (sceneElement.dataset.scene === "result") {
    return; // resultat-scenen har ingen valgknapper
  }

  sceneElement.querySelectorAll(".btn--choice").forEach((button, index) => {
    button.addEventListener("click", () => {
      if (button.disabled) {
        return;
      }
      handleChoice(sceneElement, index + 1);
    });
  });

  sceneElement.querySelector(".btn--next").addEventListener("click", goToNextScene);
});

restartButton.addEventListener("click", restartGame);


// ------------------------------------------------------------
// 6. OPSTART
// ------------------------------------------------------------

showScreen("screen-start");