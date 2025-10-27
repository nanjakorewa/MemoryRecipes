(() => {
  document.addEventListener("DOMContentLoaded", () => {
    initRecipeChecklists();
    const alarm = new RecipeAlarmWidget();
    alarm.init();
  });
})();

function initRecipeChecklists() {
  const boxes = Array.from(document.querySelectorAll('[data-check-type]'));
  if (!boxes.length) return;
  const storageKey = `recipe-check:${location.pathname}`;
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch (err) {
    stored = {};
  }

  boxes.forEach((box, index) => {
    let id = box.dataset.checkId;
    if (!id) {
      id = `${box.dataset.checkType || "item"}-${index}`;
      box.dataset.checkId = id;
    }
    if (stored[id]) box.checked = true;
    toggleChecklistState(box);
    box.addEventListener('change', () => {
      stored[id] = box.checked;
      try {
        localStorage.setItem(storageKey, JSON.stringify(stored));
      } catch (err) {
        console.warn('Unable to persist checklist state', err);
      }
      toggleChecklistState(box);
    });
  });
}

function toggleChecklistState(box) {
  const container = box.closest('li');
  if (container) {
    container.classList.toggle('is-checked', box.checked);
  }
}

class RecipeAlarmWidget {
  constructor() {
    this.widget = null;
    this.panel = null;
    this.fab = null;
    this.closeBtn = null;
    this.labelEl = null;
    this.subtitleEl = null;
    this.displayEl = null;
    this.startBtn = null;
    this.pauseBtn = null;
    this.resetBtn = null;
    this.countdownId = null;
    this.remainingMs = 0;
    this.totalMs = 0;
    this.currentLabel = '';
    this.sourceButtons = [];
    this.audio = null;
    this.lastTick = 0;
  }

  init() {
    this.audio = document.getElementById('recipe-alarm-audio');
    this.buildWidget();
    this.bindStepButtons();
  }

  buildWidget() {
    this.widget = document.createElement('div');
    this.widget.className = 'recipe-timer-widget';
    this.widget.innerHTML = `
      <button class="recipe-timer-fab" type="button" aria-label="Open cooking alarm">
        ⏰
      </button>
      <section class="recipe-timer-panel" aria-live="polite">
        <header class="recipe-timer-panel__header">
          <div>
            <p class="recipe-timer-panel__eyebrow">Cooking Alarm</p>
            <p class="recipe-timer-panel__label" data-timer-label>Timer not set</p>
            <p class="recipe-timer-panel__subtitle" data-timer-subtitle>
              Tap a step's ⏱ chip to preload the countdown. / 「目安」をタップすると自動入力されます。
            </p>
          </div>
          <button class="recipe-timer-panel__close" type="button" aria-label="Close cooking alarm">✕</button>
        </header>
        <div class="recipe-timer-panel__body">
          <div class="recipe-timer-panel__display" data-timer-display>00:00</div>
          <div class="recipe-timer-panel__actions">
            <button type="button" class="timer-btn timer-btn--primary" data-action="start" disabled>Start</button>
            <button type="button" class="timer-btn" data-action="pause" disabled>Pause</button>
            <button type="button" class="timer-btn" data-action="reset" disabled>Reset</button>
          </div>
        </div>
      </section>
    `;
    document.body.appendChild(this.widget);

    this.panel = this.widget.querySelector('.recipe-timer-panel');
    this.fab = this.widget.querySelector('.recipe-timer-fab');
    this.closeBtn = this.widget.querySelector('.recipe-timer-panel__close');
    this.labelEl = this.widget.querySelector('[data-timer-label]');
    this.subtitleEl = this.widget.querySelector('[data-timer-subtitle]');
    this.displayEl = this.widget.querySelector('[data-timer-display]');
    this.startBtn = this.widget.querySelector('[data-action="start"]');
    this.pauseBtn = this.widget.querySelector('[data-action="pause"]');
    this.resetBtn = this.widget.querySelector('[data-action="reset"]');

    this.fab.addEventListener('click', () => this.togglePanel());
    this.closeBtn.addEventListener('click', () => this.closePanel());
    this.startBtn.addEventListener('click', () => this.start());
    this.pauseBtn.addEventListener('click', () => this.pause());
    this.resetBtn.addEventListener('click', () => this.reset());
  }

  bindStepButtons() {
    this.sourceButtons = Array.from(document.querySelectorAll('[data-timer-duration]'));
    this.sourceButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const durationText = btn.dataset.timerDuration || btn.textContent;
        const parsed = this.parseDuration(durationText);
        if (!parsed) {
          console.warn('Unable to parse timer duration from', durationText);
          btn.classList.add('is-error');
          setTimeout(() => btn.classList.remove('is-error'), 2000);
          return;
        }
        const label = btn.dataset.timerLabel || btn.textContent.trim();
        this.setTimer(parsed, label, durationText);
        this.highlightSource(btn);
      });
    });
  }

  parseDuration(value) {
    if (!value) return 0;
    const normalized = value.toString().replace(/\s+/g, '');
    let totalSeconds = 0;

    // Hours
    const hourMatch = normalized.match(/(\d+(?:\.\d+)?)(?=時間|h)/i);
    if (hourMatch) {
      totalSeconds += parseFloat(hourMatch[1]) * 3600;
    }

    let minuteHandled = false;
    const minuteRange = normalized.match(/(\d+(?:\.\d+)?)[~〜–-](\d+(?:\.\d+)?)(?=分|m|min|$)/i);
    if (minuteRange) {
      totalSeconds += parseFloat(minuteRange[2]) * 60;
      minuteHandled = true;
    }
    if (!minuteHandled) {
      const minuteMatch = normalized.match(/(\d+(?:\.\d+)?)(?=分|m|min)/i);
      if (minuteMatch) {
        totalSeconds += parseFloat(minuteMatch[1]) * 60;
        minuteHandled = true;
      }
    }

    let secondHandled = false;
    const secondRange = normalized.match(/(\d+(?:\.\d+)?)[~〜–-](\d+(?:\.\d+)?)(?=秒|s|sec)/i);
    if (secondRange) {
      totalSeconds += parseFloat(secondRange[2]);
      secondHandled = true;
    }
    if (!secondHandled) {
      const secondMatch = normalized.match(/(\d+(?:\.\d+)?)(?=秒|s|sec)/i);
      if (secondMatch) {
        totalSeconds += parseFloat(secondMatch[1]);
        secondHandled = true;
      }
    }

    if (!minuteHandled && !secondHandled && totalSeconds === 0) {
      const genericRange = normalized.match(/(\d+(?:\.\d+)?)[~〜–-](\d+(?:\.\d+)?)/);
      if (genericRange) {
        totalSeconds += parseFloat(genericRange[2]) * 60;
      } else {
        const fallback = normalized.match(/\d+(?:\.\d+)?/);
        if (fallback) {
          totalSeconds += parseFloat(fallback[0]) * 60;
        }
      }
    }

    return Math.round(totalSeconds * 1000);
  }

  setTimer(durationMs, label, subtitle) {
    this.stopAlarm();
    this.totalMs = durationMs;
    this.remainingMs = durationMs;
    this.currentLabel = label;
    this.labelEl.textContent = label;
    this.subtitleEl.textContent = subtitle || '';
    this.widget.classList.add('is-open');
    this.panel.classList.remove('is-alert');
    this.widget.classList.remove('is-alert');
    this.updateDisplay();
    this.updateButtons();
    if (this.startBtn) {
      this.startBtn.focus();
    } else if (this.panel && typeof this.panel.focus === "function") {
      this.panel.focus();
    }
  }

  highlightSource(activeBtn) {
    this.sourceButtons.forEach((btn) => btn.classList.remove('is-active'));
    activeBtn.classList.add('is-active');
  }

  togglePanel() {
    this.widget.classList.toggle('is-open');
  }

  closePanel() {
    this.widget.classList.remove('is-open');
  }

  openPanel() {
    this.widget.classList.add('is-open');
  }

  start() {
    if (this.remainingMs <= 0) return;
    if (this.countdownId) return;
    this.lastTick = Date.now();
    this.countdownId = window.setInterval(() => this.tick(), 200);
    this.widget.classList.add('is-running');
    this.updateButtons();
  }

  pause() {
    if (!this.countdownId) return;
    clearInterval(this.countdownId);
    this.countdownId = null;
    this.widget.classList.remove('is-running');
    this.updateButtons();
  }

  reset() {
    this.pause();
    this.stopAlarm();
    this.remainingMs = this.totalMs;
    this.updateDisplay();
    this.panel.classList.remove('is-alert');
    this.widget.classList.remove('is-alert');
    this.updateButtons();
  }

  tick() {
    const now = Date.now();
    const delta = now - this.lastTick;
    this.lastTick = now;
    this.remainingMs = Math.max(0, this.remainingMs - delta);
    this.updateDisplay();
    if (this.remainingMs <= 0) {
      this.pause();
      this.triggerAlarm();
    }
  }

  updateDisplay() {
    if (!this.displayEl) return;
    const seconds = Math.ceil(this.remainingMs / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    this.displayEl.textContent = `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }

  updateButtons() {
    const hasTimer = this.totalMs > 0;
    this.startBtn.disabled = !hasTimer || this.remainingMs <= 0 || Boolean(this.countdownId);
    this.pauseBtn.disabled = !this.countdownId;
    this.resetBtn.disabled = !hasTimer;
  }

  triggerAlarm() {
    this.panel.classList.add('is-alert');
    this.widget.classList.add('is-alert');
    this.openPanel();
    if (this.audio) {
      try {
        this.audio.currentTime = 0;
        this.audio.play();
      } catch (err) {
        console.warn('Unable to play alarm sound', err);
      }
    }
  }

  stopAlarm() {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch (err) {
        // noop
      }
    }
    if (this.panel) { this.panel.classList.remove('is-alert'); }
    if (this.widget) { this.widget.classList.remove('is-alert'); }
  }
}



