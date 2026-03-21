const STORAGE_KEY = "sustain-reminders-state-v3";
const NOTIFICATION_INTERVAL_MS = 6 * 60 * 60 * 1000;
const HERO_TIP_INTERVAL_MS = 30 * 1000;

const heroTips = [
  "A reminder app that helps people turn good intentions into greener routines.",
  "Bring your reusable bottle before you head out the door.",
  "Take shorter showers and save water every single day.",
  "Try a meat-free day today for a lighter footprint.",
  "Turn off lights before leaving to cut wasted energy.",
  "Small eco habits every day can build real climate impact."
];

const streakViews = [
  { label: "Weekly streak", goal: 7, unit: "day", scale: "Goal: 7-day habit streak" },
  { label: "Monthly streak", goal: 30, unit: "day", scale: "Goal: 30-day habit streak" },
  { label: "Yearly streak", goal: 365, unit: "day", scale: "Goal: 365-day habit streak" }
];

const petStages = [
  {
    name: "Seedling planet",
    threshold: 0,
    mood: "Your tiny planet buddy is waiting for today's eco wins."
  },
  {
    name: "Sprout world",
    threshold: 5,
    mood: "Terra has started sprouting leaves. Your streak is making the planet feel alive."
  },
  {
    name: "Bloom world",
    threshold: 10,
    mood: "Terra is brighter and bolder now. Double-digit streak energy looks good on it."
  },
  {
    name: "Orbit guardian",
    threshold: 20,
    mood: "Terra has entered guardian mode, spinning with confidence around your habit streak."
  },
  {
    name: "Legendary eco world",
    threshold: 35,
    mood: "Terra is thriving. This streak has turned your little world into a full eco legend."
  }
];

const presetHabits = [
  { title: "Bring reusable bottle", frequency: "daily", impact: "both", co2: 0.2, water: 3 },
  { title: "Turn off lights before leaving", frequency: "daily", impact: "co2", co2: 0.4, water: 0 },
  { title: "Meat-free day today", frequency: "weekly", impact: "both", co2: 2.1, water: 120 },
  { title: "Take shorter shower", frequency: "daily", impact: "water", co2: 0.1, water: 35 },
  { title: "Walk for nearby errands", frequency: "weekly", impact: "co2", co2: 1.4, water: 0 },
  { title: "Wash clothes in cold water", frequency: "weekly", impact: "both", co2: 0.8, water: 18 }
];

const defaultState = {
  reminders: presetHabits.slice(0, 3).map((habit, index) => ({
    id: `preset-${index}`,
    ...habit,
    completions: 0,
    lastCompletedDate: null
  })),
  streak: {
    current: 0,
    best: 0,
    lastIncrementDate: null
  }
};

const elements = {
  presetList: document.getElementById("presetList"),
  reminderList: document.getElementById("reminderList"),
  reminderForm: document.getElementById("reminderForm"),
  titleInput: document.getElementById("titleInput"),
  frequencyInput: document.getElementById("frequencyInput"),
  impactInput: document.getElementById("impactInput"),
  heroTip: document.getElementById("heroTip"),
  streakPrevButton: document.getElementById("streakPrevButton"),
  streakNextButton: document.getElementById("streakNextButton"),
  streakBanner: document.querySelector(".streak-banner"),
  streakBannerLabel: document.getElementById("streakBannerLabel"),
  reminderCount: document.getElementById("reminderCount"),
  completedCount: document.getElementById("completedCount"),
  currentStreak: document.getElementById("currentStreak"),
  streakBannerValue: document.getElementById("streakBannerValue"),
  streakBannerMeta: document.getElementById("streakBannerMeta"),
  streakBannerFill: document.getElementById("streakBannerFill"),
  streakScale: document.getElementById("streakScale"),
  co2Value: document.getElementById("co2Value"),
  waterValue: document.getElementById("waterValue"),
  bestStreak: document.getElementById("bestStreak"),
  heroStreak: document.getElementById("heroStreak"),
  notifyButton: document.getElementById("notifyButton"),
  notifyStatus: document.getElementById("notifyStatus"),
  toast: document.getElementById("toast"),
  volumeDock: document.getElementById("volumeDock"),
  volumeDockTitle: document.getElementById("volumeDockTitle"),
  volumeSlider: document.getElementById("volumeSlider"),
  petButton: document.getElementById("petButton"),
  petAvatar: document.getElementById("petAvatar"),
  petStage: document.getElementById("petStage"),
  petMood: document.getElementById("petMood"),
  petGrowthFill: document.getElementById("petGrowthFill"),
  petGrowthText: document.getElementById("petGrowthText"),
  presetTemplate: document.getElementById("presetTemplate"),
  reminderTemplate: document.getElementById("reminderTemplate")
};

let state = loadState();
let notificationTimer = null;
let midnightResetTimer = null;
let cooldownTicker = null;
let heroTipIndex = 0;
let heroTipTimer = null;
let streakViewIndex = 0;
let toastTimer = null;
let audioContext = null;
let masterGain = null;
let chordTimer = null;
let noiseNodes = [];
let volumeHideTimer = null;
let volumeCountdownTimer = null;
let musicVolume = 0.35;
let streakBannerTriggerTop = 0;
let petExciteTimer = null;

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return structuredClone(defaultState);
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      reminders: Array.isArray(parsed.reminders)
        ? parsed.reminders.map((reminder) => ({
            ...reminder,
            completions: Number.isFinite(reminder.completions) ? reminder.completions : 0,
            lastCompletedDate: typeof reminder.lastCompletedDate === "string" ? reminder.lastCompletedDate : null
          }))
        : structuredClone(defaultState.reminders),
      streak: {
        current: Number.isFinite(parsed.streak?.current) ? parsed.streak.current : 0,
        best: Number.isFinite(parsed.streak?.best) ? parsed.streak.best : 0,
        lastIncrementDate: typeof parsed.streak?.lastIncrementDate === "string" ? parsed.streak.lastIncrementDate : null
      }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getTodayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function getMillisecondsUntilNextMidnight() {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight.getTime() - now.getTime();
}

function formatCooldown(msRemaining) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function updateCooldownLabels() {
  const cooldownText = `Resets in ${formatCooldown(getMillisecondsUntilNextMidnight())}`;
  document.querySelectorAll(".cooldown-note[data-active='true']").forEach((element) => {
    element.textContent = cooldownText;
  });
}

function showNextHeroTip() {
  if (!elements.heroTip) {
    return;
  }

  elements.heroTip.classList.add("hero-tip-changing");
  window.setTimeout(() => {
    heroTipIndex = (heroTipIndex + 1) % heroTips.length;
    elements.heroTip.textContent = heroTips[heroTipIndex];
    elements.heroTip.classList.remove("hero-tip-changing");
  }, 220);
}

function startHeroTipRotation() {
  if (!elements.heroTip) {
    return;
  }

  elements.heroTip.textContent = heroTips[heroTipIndex];

  if (heroTipTimer) {
    clearInterval(heroTipTimer);
  }

  heroTipTimer = window.setInterval(showNextHeroTip, HERO_TIP_INTERVAL_MS);
}

function startCooldownTicker() {
  if (cooldownTicker) {
    clearInterval(cooldownTicker);
  }

  updateCooldownLabels();
  cooldownTicker = window.setInterval(updateCooldownLabels, 1000);
}

function scheduleMidnightRefresh() {
  if (midnightResetTimer) {
    clearTimeout(midnightResetTimer);
  }

  midnightResetTimer = window.setTimeout(() => {
    render();
    scheduleMidnightRefresh();
  }, getMillisecondsUntilNextMidnight());
}

function isCompletedToday(reminder) {
  return reminder.lastCompletedDate === getTodayKey();
}

function getPendingReminders() {
  return state.reminders.filter((reminder) => !isCompletedToday(reminder));
}

function updateDailyStreakIfComplete() {
  const todayKey = getTodayKey();

  if (!state.reminders.length) {
    return;
  }

  if (state.streak.lastIncrementDate === todayKey) {
    return;
  }

  if (getPendingReminders().length > 0) {
    return;
  }

  state.streak.current += 1;
  state.streak.best = Math.max(state.streak.best, state.streak.current);
  state.streak.lastIncrementDate = todayKey;
}

function getNotificationMessage() {
  const titles = getPendingReminders()
    .slice(0, 3)
    .map((reminder) => reminder.title);

  if (!titles.length) {
    return "";
  }

  return `Eco reminder: ${titles.join(" | ")}`;
}

function sendSustainNotification() {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const message = getNotificationMessage();
  if (!message) {
    return;
  }

  new Notification("Sustain reminder", {
    body: message,
    tag: "sustain-6-hour-nudge"
  });
}

function startNotificationLoop() {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  if (notificationTimer) {
    clearInterval(notificationTimer);
  }

  sendSustainNotification();
  notificationTimer = window.setInterval(sendSustainNotification, NOTIFICATION_INTERVAL_MS);
}

function updateNotificationUI() {
  if (!("Notification" in window)) {
    elements.notifyButton.disabled = true;
    elements.notifyStatus.textContent = "This browser does not support notifications for this demo.";
    return;
  }

  if (Notification.permission === "granted") {
    elements.notifyButton.textContent = "Enabled";
    elements.notifyStatus.textContent = getPendingReminders().length
      ? "Browser notifications are on. You will get a nudge every 6 hours only for reminders that are not done yet today."
      : "Browser notifications are on, and every reminder has already been completed today.";
    return;
  }

  if (Notification.permission === "denied") {
    elements.notifyButton.textContent = "Notifications blocked";
    elements.notifyStatus.textContent = "Notifications are blocked in this browser. Allow them in site settings if you want 6-hour reminder nudges.";
    return;
  }

  elements.notifyButton.textContent = "Enable 6-hour reminders";
  elements.notifyStatus.textContent = "Notifications are off. Turn them on to get a sustainable habit nudge every 6 hours while this page is open.";
}

function showToast(message, tone = "success") {
  if (!elements.toast) {
    return;
  }

  elements.toast.textContent = message;
  elements.toast.dataset.tone = tone;
  elements.toast.classList.add("is-visible");

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2600);
}

function stopLofiLoop() {
  if (chordTimer) {
    clearInterval(chordTimer);
    chordTimer = null;
  }

  noiseNodes.forEach((node) => {
    try {
      node.stop();
    } catch {
      // noop
    }
  });
  noiseNodes = [];

  if (masterGain) {
    masterGain.gain.cancelScheduledValues(audioContext.currentTime);
    masterGain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.2);
  }
}

function updateMasterVolume() {
  if (!audioContext || !masterGain) {
    return;
  }

  masterGain.gain.cancelScheduledValues(audioContext.currentTime);
  if (musicVolume <= 0) {
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioContext.currentTime);
    masterGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.16);
    return;
  }

  masterGain.gain.setTargetAtTime(musicVolume * 0.38, audioContext.currentTime, 0.2);
}

function showVolumeDock() {
  if (!elements.volumeDock) {
    return;
  }

  elements.volumeDock.classList.add("is-visible");

  if (elements.volumeDockTitle) {
    elements.volumeDockTitle.textContent = "Lo-fi Music (15s)";
  }

  if (volumeHideTimer) {
    clearTimeout(volumeHideTimer);
  }

  if (volumeCountdownTimer) {
    clearInterval(volumeCountdownTimer);
  }

  let secondsRemaining = 15;
  volumeCountdownTimer = window.setInterval(() => {
    secondsRemaining -= 1;

    if (secondsRemaining <= 0) {
      clearInterval(volumeCountdownTimer);
      volumeCountdownTimer = null;
      return;
    }

    if (elements.volumeDockTitle) {
      elements.volumeDockTitle.textContent = `Lo-fi Music (${secondsRemaining}s)`;
    }
  }, 1000);

  volumeHideTimer = window.setTimeout(() => {
    elements.volumeDock.classList.remove("is-visible");
    if (volumeCountdownTimer) {
      clearInterval(volumeCountdownTimer);
      volumeCountdownTimer = null;
    }
  }, 15000);
}

function updateStreakBannerScrollState() {
  if (!elements.streakBanner) {
    return;
  }

  elements.streakBanner.classList.toggle("is-condensed", window.scrollY > streakBannerTriggerTop);
}

function createNoiseBuffer(context) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * 0.16;
  }
  return buffer;
}

function scheduleChord(context, startTime, frequencies) {
  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const noteGain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = index === 0 ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1100, startTime);
    filter.Q.setValueAtTime(0.9, startTime);

    noteGain.gain.setValueAtTime(0.0001, startTime);
    noteGain.gain.linearRampToValueAtTime(index === 0 ? 0.07 : 0.045, startTime + 0.8);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 5.2);

    oscillator.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(masterGain);

    oscillator.start(startTime);
    oscillator.stop(startTime + 5.4);
  });
}

function startLofiLoop() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    showToast("This browser does not support audio for lo-fi mode.", "error");
    return;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.0001;
    masterGain.connect(audioContext.destination);
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  stopLofiLoop();

  const now = audioContext.currentTime;
  updateMasterVolume();

  const noiseSource = audioContext.createBufferSource();
  const noiseFilter = audioContext.createBiquadFilter();
  const noiseGain = audioContext.createGain();
  noiseSource.buffer = createNoiseBuffer(audioContext);
  noiseSource.loop = true;
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 900;
  noiseGain.gain.value = 0.018;
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noiseSource.start();
  noiseNodes = [noiseSource];

  const chords = [
    [261.63, 329.63, 392.0],
    [220.0, 277.18, 329.63],
    [174.61, 220.0, 261.63],
    [196.0, 246.94, 293.66]
  ];

  let step = 0;
  scheduleChord(audioContext, now, chords[step]);
  chordTimer = window.setInterval(() => {
    step = (step + 1) % chords.length;
    scheduleChord(audioContext, audioContext.currentTime, chords[step]);
  }, 4200);
}

function createReminder(reminder) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    completions: 0,
    lastCompletedDate: null,
    co2: reminder.impact === "water" ? 0.1 : reminder.impact === "co2" ? 0.5 : 0.3,
    water: reminder.impact === "co2" ? 0 : reminder.impact === "water" ? 25 : 10,
    ...reminder
  };
}

function formatFrequency(value) {
  return value === "weekly" ? "Weekly rhythm" : "Daily nudge";
}

function formatImpact(value) {
  if (value === "co2") {
    return "CO2 saver";
  }
  if (value === "water") {
    return "Water saver";
  }
  return "Mixed impact";
}

function getImpactTotals() {
  return state.reminders.reduce(
    (totals, reminder) => {
      totals.completions += reminder.completions;
      totals.co2 += reminder.completions * reminder.co2;
      totals.water += reminder.completions * reminder.water;
      return totals;
    },
    { completions: 0, co2: 0, water: 0 }
  );
}

function getPetProfile(streakCount) {
  let stageIndex = 0;

  petStages.forEach((stage, index) => {
    if (streakCount >= stage.threshold) {
      stageIndex = index;
    }
  });

  const currentStage = petStages[stageIndex];
  const nextStage = petStages[stageIndex + 1] || null;
  const previousThreshold = currentStage.threshold;
  const nextThreshold = nextStage ? nextStage.threshold : currentStage.threshold;
  const span = Math.max(nextThreshold - previousThreshold, 1);
  const progress = nextStage ? (streakCount - previousThreshold) / span : 1;

  return {
    stageIndex,
    currentStage,
    nextStage,
    progress: Math.max(0, Math.min(progress, 1))
  };
}

function animatePetExcitement() {
  if (!elements.petButton) {
    return;
  }

  elements.petButton.classList.add("is-excited");

  if (petExciteTimer) {
    clearTimeout(petExciteTimer);
  }

  petExciteTimer = window.setTimeout(() => {
    elements.petButton.classList.remove("is-excited");
  }, 700);
}

function getPetCheerLine(profile) {
  const remaining = profile.nextStage ? profile.nextStage.threshold - state.streak.current : 0;

  if (!state.streak.current) {
    return "Terra says: finish today's habits and I'll start growing leaves.";
  }

  if (!profile.nextStage) {
    return "Terra says: we're at max form now, so let's keep this world glowing.";
  }

  if (remaining === 1) {
    return "Terra says: one more streak day and I evolve again.";
  }

  return `Terra says: ${remaining} more streak days until my ${profile.nextStage.name.toLowerCase()} form.`;
}

function renderPresets() {
  elements.presetList.innerHTML = "";

  presetHabits.forEach((habit) => {
    const node = elements.presetTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".preset-frequency").textContent = formatFrequency(habit.frequency);
    node.querySelector("h4").textContent = habit.title;
    node.querySelector(".add-preset").addEventListener("click", () => {
      const duplicate = state.reminders.some((reminder) => reminder.title === habit.title);
      if (duplicate) {
        return;
      }
      state.reminders.unshift(createReminder(habit));
      saveState();
      render();
    });
    elements.presetList.appendChild(node);
  });
}

function renderReminders() {
  elements.reminderList.innerHTML = "";
  elements.reminderCount.textContent = `${state.reminders.length} reminder${state.reminders.length === 1 ? "" : "s"}`;

  if (!state.reminders.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No reminders yet. Add one from the form or starter pack.";
    elements.reminderList.appendChild(empty);
    return;
  }

  state.reminders.forEach((reminder) => {
    const node = elements.reminderTemplate.content.firstElementChild.cloneNode(true);
    const completedToday = isCompletedToday(reminder);
    const completeButton = node.querySelector(".complete-button");
    const cooldownNote = node.querySelector(".cooldown-note");

    node.querySelector(".reminder-frequency").textContent = formatFrequency(reminder.frequency);
    node.querySelector("h4").textContent = reminder.title;
    node.querySelector(".impact-badge").textContent = formatImpact(reminder.impact);
    node.querySelector(".completion-count").textContent = completedToday
      ? `${reminder.completions} completion${reminder.completions === 1 ? "" : "s"} logged | done today`
      : `${reminder.completions} completion${reminder.completions === 1 ? "" : "s"} logged`;
    node.querySelector(".progress-fill").style.width = `${(Math.min(reminder.completions, 7) / 7) * 100}%`;

    completeButton.disabled = completedToday;
    completeButton.textContent = completedToday ? "Done today" : "Mark done";
    cooldownNote.dataset.active = completedToday ? "true" : "false";
    cooldownNote.textContent = completedToday ? `Resets in ${formatCooldown(getMillisecondsUntilNextMidnight())}` : "";
    completeButton.addEventListener("click", () => {
      try {
        if (isCompletedToday(reminder)) {
          throw new Error("already-completed");
        }

        reminder.completions += 1;
        reminder.lastCompletedDate = getTodayKey();
        updateDailyStreakIfComplete();
        saveState();
        render();
        showToast(`Marked "${reminder.title}" as done.`);
      } catch {
        showToast("Failed to complete reminder.", "error");
      }
    });

    node.querySelector(".delete-button").addEventListener("click", () => {
      try {
        const nextReminders = state.reminders.filter((item) => item.id !== reminder.id);
        if (nextReminders.length === state.reminders.length) {
          throw new Error("missing-reminder");
        }

        state.reminders = nextReminders;
        saveState();
        render();
        showToast(`Deleted "${reminder.title}".`);
      } catch {
        showToast("Failed to delete reminder.", "error");
      }
    });

    elements.reminderList.appendChild(node);
  });
}

function renderImpact() {
  const totals = getImpactTotals();
  const activeView = streakViews[streakViewIndex];
  const streakGoal = activeView.goal;
  const displayedProgress = Math.min(state.streak.current, streakGoal);
  const remainingDays = Math.max(streakGoal - displayedProgress, 0);

  elements.completedCount.textContent = totals.completions;
  elements.currentStreak.textContent = state.streak.current;
  elements.streakBannerLabel.textContent = activeView.label;
  elements.streakBannerValue.textContent = state.streak.current;
  elements.streakBannerFill.style.width = `${(displayedProgress / streakGoal) * 100}%`;
  elements.streakBannerMeta.textContent = remainingDays
    ? `${remainingDays} more ${activeView.unit}${remainingDays === 1 ? "" : "s"} to hit your ${activeView.label.toLowerCase()}.`
    : `${activeView.label} reached. Keep the streak glowing.`;
  elements.streakScale.textContent = activeView.scale;
  elements.co2Value.textContent = totals.co2.toFixed(1);
  elements.waterValue.textContent = Math.round(totals.water);
  elements.bestStreak.textContent = state.streak.best;
  elements.heroStreak.textContent = state.streak.current;
}

function renderPet() {
  if (!elements.petAvatar) {
    return;
  }

  const profile = getPetProfile(state.streak.current);
  elements.petAvatar.className = `pet-avatar pet-stage-${profile.stageIndex}`;
  elements.petStage.textContent = profile.currentStage.name;
  elements.petMood.textContent = profile.currentStage.mood;
  elements.petGrowthFill.style.width = `${profile.progress * 100}%`;

  if (!profile.nextStage) {
    elements.petGrowthText.textContent = "Terra has reached the final growth stage. Keep your streak alive to protect the planet.";
    return;
  }

  const remaining = profile.nextStage.threshold - state.streak.current;
  elements.petGrowthText.textContent = `${remaining} streak day${remaining === 1 ? "" : "s"} to reach ${profile.nextStage.name.toLowerCase()}.`;
}

function render() {
  renderPresets();
  renderReminders();
  renderImpact();
  renderPet();
  updateNotificationUI();
  updateCooldownLabels();
}

elements.reminderForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = elements.titleInput.value.trim();
  if (!title) {
    return;
  }

  try {
    const reminder = createReminder({
      title,
      frequency: elements.frequencyInput.value,
      impact: elements.impactInput.value
    });

    state.reminders.unshift(reminder);
    elements.reminderForm.reset();
    saveState();
    render();
    showToast(`Added "${title}" to your reminders.`);
  } catch {
    showToast("Failed to add reminder.", "error");
  }
});

elements.notifyButton.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    updateNotificationUI();
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    startNotificationLoop();
  }
  updateNotificationUI();
});

elements.volumeSlider.addEventListener("input", () => {
  musicVolume = Number(elements.volumeSlider.value) / 100;
  if (musicVolume > 0) {
    startLofiLoop();
  } else {
    updateMasterVolume();
  }
  updateMasterVolume();
  showVolumeDock();
});

elements.volumeDock.addEventListener("pointerdown", () => {
  showVolumeDock();
});

elements.petButton?.addEventListener("click", () => {
  const profile = getPetProfile(state.streak.current);
  animatePetExcitement();
  showToast(getPetCheerLine(profile));
});

window.addEventListener("mousemove", (event) => {
  if (event.clientX <= 240 && event.clientY >= window.innerHeight - 180) {
    showVolumeDock();
  }
});

window.addEventListener("scroll", updateStreakBannerScrollState, { passive: true });

window.addEventListener("resize", () => {
  if (!elements.streakBanner) {
    return;
  }

  streakBannerTriggerTop = Math.max(elements.streakBanner.offsetTop - 10, 0);
  updateStreakBannerScrollState();
});

elements.streakPrevButton.addEventListener("click", () => {
  streakViewIndex = (streakViewIndex - 1 + streakViews.length) % streakViews.length;
  renderImpact();
});

elements.streakNextButton.addEventListener("click", () => {
  streakViewIndex = (streakViewIndex + 1) % streakViews.length;
  renderImpact();
});

render();
if (elements.streakBanner) {
  streakBannerTriggerTop = Math.max(elements.streakBanner.offsetTop - 10, 0);
  updateStreakBannerScrollState();
}
showVolumeDock();
startHeroTipRotation();
startCooldownTicker();
if ("Notification" in window && Notification.permission === "granted") {
  startNotificationLoop();
}
scheduleMidnightRefresh();

window.resetSustainState = function resetSustainState() {
  state = structuredClone(defaultState);
  saveState();
  render();
};
