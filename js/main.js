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
const characterButtons = document.querySelectorAll(".gender-picker__option");
const startCharacterImage = document.getElementById("start-character-image");

const introSlides = document.querySelectorAll(".intro-slide");
const introVideoBoy = document.getElementById("intro-video-boy");
const introVideoGirl = document.getElementById("intro-video-girl");
const skipIntroButton = document.getElementById("skip-intro-button");

const bootPlayerName = document.getElementById("boot-player-name");
const bootProgressBar = document.querySelector(".boot__progress-bar");
const bootProgressLabel = document.querySelector(".boot__progress-label");
const bootProgressWrapper = document.querySelector(".boot__progress");

const cyberScoreValue = document.getElementById("cyber-score-value");
const cyberScoreScene = document.getElementById("cyber-score-scene");

const restartButton = document.getElementById("restart-button");
const bgMusic = document.getElementById("bg-music");
const startMusic = document.getElementById("start-music");

const feedbackSounds = {
  positive: document.getElementById("sound-positive"),
  neutral: document.getElementById("sound-neutral"),
  negative: document.getElementById("sound-negative"),
};


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

  // #app skal have et andet højde-forhold på startskærmen (så baggrundsbilledet
  // ikke bliver klemt) end på boot-/computer-skærmene (som har deres egen faste højde)
  document.getElementById("app").classList.toggle("app--start", screenId === "screen-start");

  // Indholdets højde ændrer sig fra skærm til skærm, så vi genberegner skaleringen
  fitToScreen();
}

// Skalerer #app ned (aldrig op), så hele spillet altid er synligt i vinduet,
// uanset skærmstørrelse — uden at der nogensinde skal scrolles.
// Tager højde for body's padding, så der altid er luft omkring "kortet".
function fitToScreen() {
  const app = document.getElementById("app");

  // Nulstil skalering først, så vi kan måle appens naturlige (uskalerede) størrelse
  app.style.transform = "scale(1)";

  const bodyStyles = getComputedStyle(document.body);
  const paddingX = parseFloat(bodyStyles.paddingLeft) + parseFloat(bodyStyles.paddingRight);
  const paddingY = parseFloat(bodyStyles.paddingTop) + parseFloat(bodyStyles.paddingBottom);

  const appRect = app.getBoundingClientRect();
  const availableWidth = window.innerWidth - paddingX;
  const availableHeight = window.innerHeight - paddingY;

  const scaleX = availableWidth / appRect.width;
  const scaleY = availableHeight / appRect.height;

  // Vi skalerer aldrig op over 1 — kun ned, hvis indholdet er for stort til vinduet
  const scale = Math.min(scaleX, scaleY, 1);

  app.style.transform = "scale(" + scale + ")";
}

// Markerer den valgte karakter som "trykket", gemmer valget,
// og skifter den viste GIF i "stage'n" til den valgte karakter
// Prøver at afspille startskærmens musik. Browsere blokerer ofte autoplay
// med lyd, før brugeren har interageret med siden — derfor fanger vi fejlen
// stille og prøver i stedet igen ved brugerens første klik/tastetryk.
function tryPlayStartMusic() {
  startMusic.play().catch(() => {
    // Autoplay blokeret af browseren — handleFirstInteraction() prøver igen
  });
}

// Fallback: hvis autoplay blev blokeret, starter denne musikken ved
// brugerens første interaktion — men kun mens startskærmen rent faktisk vises
function handleFirstInteraction() {
  const startScreen = document.getElementById("screen-start");

  if (startScreen.classList.contains("is-active") && startMusic.paused) {
    tryPlayStartMusic();
  }
}

function selectCharacter(button) {
  characterButtons.forEach((btn) => {
    btn.setAttribute("aria-pressed", "false");
  });

  button.setAttribute("aria-pressed", "true");
  selectedCharacter = button.dataset.character;
  startCharacterImage.src = button.dataset.gif;
}

// Starter spillet: gemmer navn og går videre til introfilmen
function startGame() {
  const typedName = nameInput.value.trim();
  playerName = typedName === "" ? "Spiller" : typedName;

  startMusic.pause();
  startMusic.currentTime = 0;

  showScreen("screen-intro");

  // Begge karakterer har deres egen videoversion af introfilmen.
  // Slideshowet med stillbilleder fungerer nu kun som backup, hvis en
  // ny karakter skulle blive tilføjet senere uden sin egen video.
  if (selectedCharacter === "2") {
    playIntroVideo(introVideoBoy);
  } else if (selectedCharacter === "1") {
    playIntroVideo(introVideoGirl);
  } else {
    playIntro(0);
  }
}

// Viser introfilmens slides efter hinanden med en kort pause imellem
function playIntro(slideIndex) {
  introVideoBoy.classList.add("is-hidden");
  introVideoGirl.classList.add("is-hidden");
  document.querySelector(".intro__slides").classList.remove("is-hidden");

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

// Afspiller videoversionen af introfilmen for den valgte karakter (dreng eller
// pige) og går videre til boot-skærmen, når videoen er færdig
function playIntroVideo(video) {
  document.querySelector(".intro__slides").classList.add("is-hidden");
  introVideoBoy.classList.add("is-hidden");
  introVideoGirl.classList.add("is-hidden");

  video.classList.remove("is-hidden");
  video.currentTime = 0;
  video.play();

  video.addEventListener("ended", runBootSequence, { once: true });
}

// Springer introfilmen over: annullerer den ventende intro-timer og stopper
// videoen (hvis den kører), så boot-sekvensen ikke bliver startet dobbelt
function skipIntro() {
  if (introTimeoutId !== null) {
    clearTimeout(introTimeoutId);
    introTimeoutId = null;
  }

  [introVideoBoy, introVideoGirl].forEach((video) => {
    if (!video.paused) {
      video.pause();
    }
    video.removeEventListener("ended", runBootSequence);
  });

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

  // Baggrundsmusikken starter her — lige efter introfilmen (uanset slideshow,
  // video eller "Spring over") — og looper resten af spillet
  bgMusic.currentTime = 0;
  bgMusic.play();

  showScreen("screen-boot");
  bootPlayerName.textContent = playerName;

  let progress = 0;
  const progressStep = 5;
  const stepDelay = 200; // højere tal = langsommere loading-bar, mere tid til at læse

  const progressInterval = setInterval(() => {
    progress += progressStep;

    if (progress >= 100) {
      progress = 100;
      clearInterval(progressInterval);
      setTimeout(startComputerScenario, 1500); // ekstra pause efter 100%, før man går videre
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

  feedbackBox.classList.add("is-hidden");
  feedbackBox.classList.remove("is-positive", "is-neutral", "is-negative");
  nextButton.classList.add("is-hidden");

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

  feedbackBox.classList.remove("is-hidden");
  feedbackBox.classList.add("is-" + choice.status);

  feedbackText.textContent = choice.text;
  feedbackPoints.textContent = (choice.points > 0 ? "+" : "") + choice.points + " point";

  nextButton.classList.remove("is-hidden");

  // Afspil den lydeffekt, der matcher valgets farve (grøn/gul/rød)
  const sound = feedbackSounds[choice.status];
  sound.currentTime = 0;
  sound.play().catch(() => {
    // Ingen handling nødvendig, hvis lyden af en eller anden grund ikke kan afspilles
  });
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

  bgMusic.pause();
  bgMusic.currentTime = 0;

  if (introTimeoutId !== null) {
    clearTimeout(introTimeoutId);
    introTimeoutId = null;
  }

  [introVideoBoy, introVideoGirl].forEach((video) => {
    video.pause();
    video.currentTime = 0;
    video.removeEventListener("ended", runBootSequence);
  });

  nameInput.value = "";
  bootProgressBar.style.width = "0%";
  bootProgressLabel.textContent = "0%";

  showScreen("screen-start");
  tryPlayStartMusic();
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

// Fallback for startskærmens musik: hvis autoplay bliver blokeret ved opstart,
// starter musikken i stedet ved brugerens allerførste klik eller tastetryk
document.addEventListener("click", handleFirstInteraction);
document.addEventListener("keydown", handleFirstInteraction);

// Genberegn skaleringen, hver gang vinduet ændrer størrelse (fx ved rotation af mobil,
// eller når man ændrer bredden af browservinduet på computer)
window.addEventListener("resize", fitToScreen);


// ------------------------------------------------------------
// 6. OPSTART
// ------------------------------------------------------------

showScreen("screen-start");
tryPlayStartMusic();

// Skrifttyperne (Google Fonts) indlæses asynkront og kan ændre tekstens højde,
// når de er klar — genberegn derfor skaleringen én gang til, når siden er helt loadet
window.addEventListener("load", fitToScreen);