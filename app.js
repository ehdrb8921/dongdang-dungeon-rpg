"use strict";

const firebaseConfig = {
  apiKey: "AIzaSyA91gqyrlA7DB-euEsrLx9onmTiDG_fmmc",
  authDomain: "dongdang-dungeon-rpg.firebaseapp.com",
  projectId: "dongdang-dungeon-rpg",
  storageBucket: "dongdang-dungeon-rpg.firebasestorage.app",
  messagingSenderId: "273199982049",
  appId: "1:273199982049:web:741894ab32b6d0dea15ea0",
  measurementId: "G-4CNXRMBGHY"
};

let firebaseServicesPromise = null;

function getFirebaseServices() {
  firebaseServicesPromise ||= Promise.all([
    import("https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js"),
    import("https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js")
  ]).then(([appSdk, analyticsSdk, authSdk, firestoreSdk]) => {
    const firebaseApp = appSdk.initializeApp(firebaseConfig);
    const firebaseAuth = authSdk.getAuth(firebaseApp);
    const firebaseDb = firestoreSdk.getFirestore(firebaseApp);
    const googleProvider = new authSdk.GoogleAuthProvider();

    analyticsSdk.isSupported()
      .then(supported => {
        if (supported) analyticsSdk.getAnalytics(firebaseApp);
      })
      .catch(error => console.warn("Firebase analytics skipped:", error));

    return { authSdk, firestoreSdk, firebaseAuth, firebaseDb, googleProvider };
  }).catch(error => {
    console.error("Firebase SDK load failed:", error);
    throw error;
  });

  return firebaseServicesPromise;
}

const CHARACTERS = [
  { id: "warrior_01", name: "초보 검사", icon: "검", color: "#ffd66e", accent: "#f2a13a", prop: "sword", passive: "공격력 증가", unlock: "기본 지급", forceCost: 0 },
  { id: "mage_01", name: "말랑 마법사", icon: "마", color: "#a58bff", accent: "#6e57db", prop: "staff", passive: "스킬 쿨타임 감소", unlock: "1스테이지 클리어", forceCost: 1500 },
  { id: "archer_01", name: "통통 궁수", icon: "궁", color: "#7ed7b5", accent: "#3cb58a", prop: "bow", passive: "투사체 관련 능력 증가", unlock: "누적 몬스터 500마리 처치", forceCost: 2000 },
  { id: "rogue_01", name: "장난꾸러기 도적", icon: "도", color: "#ff9c6e", accent: "#e35e4f", prop: "dagger", passive: "치명타 확률 증가", unlock: "3분 이상 생존", forceCost: 2500 },
  { id: "knight_01", name: "방패 기사", icon: "방", color: "#7ab8ff", accent: "#3f78d8", prop: "shield", passive: "최대 체력 증가", unlock: "보스 1회 처치", forceCost: 3000 },
  { id: "spark_01", name: "번개 수습생", icon: "번", color: "#fff176", accent: "#f2bd24", prop: "bolt", passive: "번개 스킬 피해 증가", unlock: "번개 카드 5회 선택", forceCost: 3500 },
  { id: "alchemist_01", name: "독버섯 연금술사", icon: "독", color: "#b5df72", accent: "#5da840", prop: "flask", passive: "상태이상 지속시간 증가", unlock: "중독으로 적 100마리 처치", forceCost: 4000 },
  { id: "cleric_01", name: "꼬마 성직자", icon: "성", color: "#ffb8cd", accent: "#ee6f9d", prop: "halo", passive: "회복량 증가", unlock: "체력 회복 누적 1000 달성", forceCost: 4500 }
];

const PASSIVE_COST = { 2: 500, 3: 1000, 4: 2000, 5: 4000 };
const CHESTS = [
  { id: "spark_weapon", name: "반짝 무기 상자", type: "weapon", cost: 1000, odds: { A: 12, B: 25, C: 28, D: 35 } },
  { id: "legend_weapon", name: "전설 무기 상자", type: "weapon", cost: 1500, odds: { S: 2, A: 8, B: 20, C: 30, D: 40 } },
  { id: "spark_armor", name: "반짝 갑옷 상자", type: "armor", cost: 1000, odds: { A: 12, B: 25, C: 28, D: 35 } },
  { id: "legend_armor", name: "전설 갑옷 상자", type: "armor", cost: 1500, odds: { S: 2, A: 8, B: 20, C: 30, D: 40 } }
];

const GRADE_POWER = { D: 1, C: 1.35, B: 1.8, A: 2.4, S: 3.2 };
const SKILL_CARDS = [
  { type: "공격", name: "파이어볼", desc: "불덩이가 가까운 적에게 날아갑니다.", apply: s => { s.fireball++; } },
  { type: "공격", name: "회전 베기", desc: "주변 적에게 주기적으로 피해를 줍니다.", apply: s => { s.spin++; } },
  { type: "공격", name: "독 단검", desc: "중독 피해를 남기는 단검을 던집니다.", apply: s => { s.poison++; } },
  { type: "공격", name: "얼음창", desc: "직선 투사체 피해와 둔화를 추가합니다.", apply: s => { s.ice++; } },
  { type: "공격", name: "번개구슬", desc: "번개 피해가 튕깁니다.", apply: s => { s.lightning++; s.lightningPicks++; } },
  { type: "공격", name: "관통 화살", desc: "추가 투사체가 전장을 가릅니다.", apply: s => { s.arrow++; s.projectiles++; } },
  { type: "강화", name: "투사체 +1", desc: "자동 공격 투사체가 늘어납니다.", apply: s => { s.projectiles++; } },
  { type: "강화", name: "공격 속도 증가", desc: "기본 공격 간격이 짧아집니다.", apply: s => { s.attackRate += 0.18; } },
  { type: "강화", name: "치명타 확률 증가", desc: "가끔 더 강하게 때립니다.", apply: s => { s.crit += 0.08; } },
  { type: "강화", name: "범위 증가", desc: "스킬 범위가 커집니다.", apply: s => { s.area += 0.15; } },
  { type: "강화", name: "쿨타임 감소", desc: "자동 스킬 발동이 빨라집니다.", apply: s => { s.cooldown *= 0.88; } },
  { type: "강화", name: "상태이상 확률 증가", desc: "화상, 빙결, 중독 확률이 오릅니다.", apply: s => { s.statusChance += 0.1; } },
  { type: "시너지", name: "화상 폭발", desc: "파이어볼과 합쳐 화상 적 처치 시 작은 폭발이 생깁니다.", apply: s => { s.synergyBurn = true; } },
  { type: "시너지", name: "빙결 추가 피해", desc: "얼음창과 합쳐 빙결 적에게 추가 피해를 줍니다.", apply: s => { s.synergyIce = true; } },
  { type: "시너지", name: "독 폭발", desc: "독 단검과 합쳐 중독 처치 기록 구조를 활성화합니다.", apply: s => { s.synergyPoison = true; } },
  { type: "시너지", name: "번개 연쇄", desc: "번개구슬과 합쳐 치명타 시 추가 연쇄가 생깁니다.", apply: s => { s.synergyLightning = true; } },
  { type: "시너지", name: "초과 회복 보호막", desc: "회복 능력과 합쳐 회복량 기록과 보호막 구조를 강화합니다.", apply: s => { s.synergyShield = true; } }
];

const CARD_MAX_LEVEL = 5;

SKILL_CARDS.forEach((card, index) => {
  card.id ||= `starter_${index}`;
});

SKILL_CARDS.push(
  { id: "max_hp", type: "강화", name: "튼튼한 심장", desc: "최대 체력이 증가합니다.", apply: s => { s.player.maxHp += 18; s.player.hp += 18; } },
  { id: "regen", type: "회복", name: "숨 고르기", desc: "피해를 안 받았을 때 체력 회복량이 증가합니다.", apply: s => { s.regenRate += 0.8; } },
  { id: "move_speed", type: "강화", name: "가벼운 발걸음", desc: "이동 속도가 증가합니다.", apply: s => { s.moveSpeed += 22; } },
  { id: "damage", type: "강화", name: "날카로운 무기", desc: "모든 공격 피해가 증가합니다.", apply: s => { s.damageMultiplier += 0.12; } },
  { id: "pickup", type: "편의", name: "전리품 감각", desc: "경험치 요구량이 조금 줄어듭니다.", apply: s => { s.xpNeed = Math.max(4, Math.floor(s.xpNeed * 0.9)); } },
  { id: "dash_guard", type: "방어", name: "버티는 자세", desc: "피격 후 무적 시간이 길어집니다.", apply: s => { s.invDuration += 0.12; } },
  { id: "vampire", type: "회복", name: "생기 흡수", desc: "적을 처치할 때 체력을 조금 회복합니다.", apply: s => { s.lifeSteal += 1.5; } },
  { id: "boss_hunter", type: "공격", name: "거대 사냥꾼", desc: "보스에게 주는 피해가 증가합니다.", apply: s => { s.bossDamage += 0.18; } },
  { id: "burst_wave", type: "범위", name: "폭발 충격파", desc: "투사체가 맞은 지점 주변 적에게도 피해를 줍니다.", apply: s => { s.burstWave++; } },
  { id: "piercing_shot", type: "관통", name: "관통 사격", desc: "기본 공격과 스킬 투사체가 적을 더 뚫고 지나갑니다.", apply: s => { s.pierce++; } },
  { id: "shatter_round", type: "범위", name: "파열 탄환", desc: "기본 공격이 터지며 작은 범위 피해를 남깁니다.", apply: s => { s.shatterRound++; } },
  { id: "ground_slam", type: "범위", name: "대지 충격파", desc: "스킬 발동 때 주변 적 무리를 원형으로 타격합니다.", apply: s => { s.groundSlam++; } },
  { id: "piercing_beam", type: "관통", name: "관통 광선", desc: "가까운 적 방향으로 직선 광선을 쏴 줄지은 적을 관통합니다.", apply: s => { s.piercingBeam++; } },
  { id: "meteor_drop", type: "범위", name: "운석 낙하", desc: "적이 모인 지점에 운석을 떨어뜨려 넓은 범위를 공격합니다.", apply: s => { s.meteorDrop++; } },
  { id: "twin_barrage", type: "관통", name: "양방향 탄막", desc: "일정 시간마다 좌우 양방향으로 탄환을 동시에 발사합니다.", apply: s => { s.twinBarrage++; } },
  { id: "slow_field", type: "제어", name: "끈적한 바닥", desc: "적 이동 속도가 느려집니다.", apply: s => { s.enemySlow += 0.06; } },
  { id: "gold_luck", type: "보상", name: "행운 주머니", desc: "이번 탐험의 점수가 증가합니다.", apply: s => { s.scoreMultiplier += 0.08; } }
);

const CARD_REQUIREMENTS = {
  starter_12: ["starter_0"],
  starter_13: ["starter_3"],
  starter_14: ["starter_2"],
  starter_15: ["starter_4"],
  starter_16: ["regen", "vampire"]
};

const VIEW_W = 720;
let VIEW_H = 1280;
let WORLD_W = VIEW_W * 3;
let WORLD_H = VIEW_H * 3;

const BOSS_TYPES = [
  { id: "ember", name: "Ember King", color: "#ff6b55", accent: "#ffd66e", shotColor: "#ffcf5a", warningColor: "#ff6b55", warningShape: "circle", projectileCount: 3, projectileSpread: 0.24, projectileSpeed: 245, projectileRadius: 11, projectileDamage: 13, projectileCooldown: 1.55, slamCooldown: 6.2, slamRadius: 96, slamDamage: 25 },
  { id: "star", name: "Star Witch", color: "#a58bff", accent: "#fff176", shotColor: "#d9ccff", warningColor: "#a58bff", warningShape: "star", projectileCount: 5, projectileSpread: 0.18, projectileSpeed: 285, projectileRadius: 9, projectileDamage: 11, projectileCooldown: 1.25, slamCooldown: 5.4, slamRadius: 86, slamDamage: 22 },
  { id: "square", name: "Cube Warden", color: "#5aa9ff", accent: "#7ed7b5", shotColor: "#7ab8ff", warningColor: "#5aa9ff", warningShape: "square", projectileCount: 2, projectileSpread: 0.34, projectileSpeed: 220, projectileRadius: 14, projectileDamage: 15, projectileCooldown: 1.75, slamCooldown: 6.8, slamRadius: 106, slamDamage: 28 }
];

const AUDIO_STORAGE_KEY = "ddrpg_audio_v1";

const STORAGE_KEY = "ddrpg_user_v1";
let user = null;
let lastResult = null;
let enemySeq = 0;

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

const audio = {
  ctx: null,
  master: null,
  musicGain: null,
  musicTimer: null,
  musicMode: "",
  menuStep: 0,
  gameStep: 0,
  musicVolume: Number(localStorage.getItem(AUDIO_STORAGE_KEY) || 65) / 100,
  init() {
    try {
      if (this.ctx) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.master);
    } catch (error) {
      console.warn("Audio init skipped:", error);
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
    }
  },
  setMusicVolume(value) {
    const next = Math.max(0, Math.min(1, Number(value) / 100));
    this.musicVolume = Number.isFinite(next) ? next : 0.65;
    localStorage.setItem(AUDIO_STORAGE_KEY, Math.round(this.musicVolume * 100));
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
    syncVolumeControls();
  },
  resume() {
    try {
      this.init();
      if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
    } catch (error) {
      console.warn("Audio resume skipped:", error);
    }
  },
  tone(freq, duration = 0.08, type = "sine", volume = 0.2, slide = 1) {
    try {
      if (!this.ctx || !this.master) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (error) {
      console.warn("Audio tone skipped:", error);
    }
  },
  noise(duration = 0.08, volume = 0.18, tone = 900) {
    try {
      if (!this.ctx || !this.master) return;
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const src = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      src.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = tone;
      gain.gain.value = volume;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();
    } catch (error) {
      console.warn("Audio noise skipped:", error);
    }
  },
  play(name) {
    try {
      this.resume();
      if (name === "playerAttack") this.tone(760, 0.055, "triangle", 0.045, 1.35);
      if (name === "hit") this.noise(0.055, 0.07, 1200);
      if (name === "bossAttack") {
        this.tone(180, 0.18, "sawtooth", 0.12, 0.62);
        this.noise(0.12, 0.08, 360);
      }
      if (name === "bossWave") {
        this.tone(130, 0.18, "sawtooth", 0.12, 1.7);
        setTimeout(() => this.tone(196, 0.2, "sawtooth", 0.1, 1.45), 110);
      }
      if (name === "slam") {
        this.tone(90, 0.24, "square", 0.14, 0.45);
        this.noise(0.16, 0.12, 180);
      }
      if (name === "hurt") this.tone(120, 0.12, "square", 0.08, 0.7);
    } catch (error) {
      console.warn("Audio play skipped:", error);
    }
  },
  setMusic(mode) {
    try {
      this.resume();
      if (!this.ctx || this.musicMode === mode) return;
      this.stopMusic();
      this.musicMode = mode;
      const playStep = () => {
        if (!this.ctx || this.musicMode !== mode) return;
        const menu = [392, 494, 587, 494, 440, 523, 659, 523];
        const game = [196, 247, 294, 330, 294, 247, 220, 262];
        const seq = mode === "game" ? game : menu;
        const stepKey = mode === "game" ? "gameStep" : "menuStep";
        const freq = seq[this[stepKey] % seq.length];
        this[stepKey]++;
        this.musicTone(freq, mode === "game" ? 0.16 : 0.22, mode === "game" ? "square" : "triangle", mode === "game" ? 0.06 : 0.045);
        this.musicTimer = setTimeout(playStep, mode === "game" ? 260 : 390);
      };
      playStep();
    } catch (error) {
      console.warn("Music skipped:", error);
    }
  },
  musicTone(freq, duration, type, volume) {
    try {
      if (!this.ctx || !this.musicGain) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (error) {
      console.warn("Music tone skipped:", error);
    }
  },
  stopMusic() {
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
    this.musicMode = "";
  }
};

function syncVolumeControls() {
  const value = Math.round(audio.musicVolume * 100);
  ["#homeMusicVolume", "#gameMusicVolume"].forEach(selector => {
    const input = $(selector);
    if (input && Number(input.value) !== value) input.value = value;
  });
}

function configureGameViewport(canvas) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || window.visualViewport?.width || window.innerWidth || 360;
  const height = rect.height || window.visualViewport?.height || window.innerHeight || 640;
  const aspect = Math.max(0.42, Math.min(0.9, width / Math.max(1, height)));
  VIEW_H = Math.round(Math.max(960, Math.min(1780, VIEW_W / aspect)));
  WORLD_W = VIEW_W * 3;
  WORLD_H = VIEW_H * 3;
  if (canvas.width !== VIEW_W) canvas.width = VIEW_W;
  if (canvas.height !== VIEW_H) canvas.height = VIEW_H;
}

function blankUser(profile = {}) {
  const characters = {};
  CHARACTERS.forEach((ch, index) => {
    characters[ch.id] = { characterId: ch.id, unlocked: index === 0, passiveLevel: 1, forcedUnlocked: false };
  });
  const now = new Date().toISOString();
  return {
    uid: profile.uid || `guest_${crypto.randomUUID()}`,
    nickname: profile.nickname || "동당탕탕용사",
    email: profile.email || "",
    photoURL: profile.photoURL || "",
    provider: profile.provider || "guest",
    gold: 4000,
    gems: 0,
    selectedCharacter: "warrior_01",
    characters,
    equipments: [],
    equipped: {},
    records: {
      bestScore: 0,
      bestWave: 0,
      bestKills: 0,
      bestSurvivalTime: 0,
      bestClearedDungeonCount: 0,
      bestCharacter: "warrior_01",
      updatedAt: now
    },
    progress: {
      totalKills: 0,
      bossKills: 0,
      lightningPicks: 0,
      poisonKills: 0,
      totalHealing: 0,
      stageClears: 0,
      longestSurvival: 0
    },
    totalPlayCount: 0,
    createdAt: now,
    lastLoginAt: now
  };
}

function mergeUserData(base, saved = {}) {
  const merged = {
    ...base,
    ...saved,
    characters: { ...base.characters, ...(saved.characters || {}) },
    records: { ...base.records, ...(saved.records || {}) },
    progress: { ...base.progress, ...(saved.progress || {}) },
    equipped: { ...base.equipped, ...(saved.equipped || {}) },
    equipments: Array.isArray(saved.equipments) ? saved.equipments : base.equipments
  };

  delete merged.updatedAt;
  return merged;
}

function normalizeUser(saved = {}, profile = {}) {
  const normalized = mergeUserData(blankUser(profile), saved);
  normalized.uid = profile.uid || normalized.uid;
  normalized.nickname = profile.nickname || normalized.nickname;
  normalized.email = profile.email || normalized.email;
  normalized.photoURL = profile.photoURL || normalized.photoURL;
  normalized.provider = profile.provider || normalized.provider;
  return normalized;
}

function firebaseProfile(firebaseUser) {
  return {
    uid: firebaseUser.uid,
    nickname: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "동당탕탕용사",
    email: firebaseUser.email || "",
    photoURL: firebaseUser.photoURL || "",
    provider: "google"
  };
}

function loadCachedUser() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (!existing) return null;
  try {
    return normalizeUser(JSON.parse(existing));
  } catch (error) {
    console.warn("Saved user data was reset:", error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

async function loadFirebaseUser(firebaseUser, services) {
  const profile = firebaseProfile(firebaseUser);
  const { firebaseDb, firestoreSdk } = services;
  const userRef = firestoreSdk.doc(firebaseDb, "users", profile.uid);
  try {
    const snapshot = await firestoreSdk.getDoc(userRef);
    return snapshot.exists() ? normalizeUser(snapshot.data(), profile) : blankUser(profile);
  } catch (error) {
    console.warn("Firestore user load failed, using a local profile:", error);
    return blankUser(profile);
  }
}

const storage = {
  async signInGuest() {
    return loadCachedUser() || blankUser();
  },
  async signInGoogle() {
    const services = await getFirebaseServices();
    const result = await services.authSdk.signInWithPopup(services.firebaseAuth, services.googleProvider);
    const data = await loadFirebaseUser(result.user, services);
    try {
      await this.save(data);
    } catch (error) {
      console.warn("Firestore user save failed; progress is cached locally for now:", error);
    }
    return data;
  },
  async save(data) {
    data.lastLoginAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    if (data.provider === "google") {
      const services = await getFirebaseServices();
      const userRef = services.firestoreSdk.doc(services.firebaseDb, "users", data.uid);
      await services.firestoreSdk.setDoc(
        userRef,
        { ...data, updatedAt: services.firestoreSdk.serverTimestamp() },
        { merge: true }
      );
    }
  },
  async rankings() {
    if (user?.provider !== "google") return localRankings();
    try {
      const services = await getFirebaseServices();
      const rankingQuery = services.firestoreSdk.query(
        services.firestoreSdk.collection(services.firebaseDb, "users"),
        services.firestoreSdk.orderBy("records.bestWave", "desc"),
        services.firestoreSdk.limit(10)
      );
      const snapshot = await services.firestoreSdk.getDocs(rankingQuery);
      const rows = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          nickname: data.nickname || "이름 없는 용사",
          bestWave: data.records?.bestWave || 0,
          bestScore: data.records?.bestScore || 0
        };
      }).filter(row => row.bestWave > 0 || row.uid === user.uid);
      return rows.length ? rows : localRankings();
    } catch (error) {
      console.warn("Ranking load failed, using local ranking:", error);
      return localRankings();
    }
  }
};

function showScreen(id) {
  $$(".screen").forEach(screen => screen.classList.toggle("active", screen.id === id));
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateUnlocks() {
  const p = user.progress;
  const c = user.characters;
  if (p.stageClears >= 1) c.mage_01.unlocked = true;
  if (p.totalKills >= 500) c.archer_01.unlocked = true;
  if (p.longestSurvival >= 180) c.rogue_01.unlocked = true;
  if (p.bossKills >= 1) c.knight_01.unlocked = true;
  if (p.lightningPicks >= 5) c.spark_01.unlocked = true;
  if (p.poisonKills >= 100) c.alchemist_01.unlocked = true;
  if (p.totalHealing >= 1000) c.cleric_01.unlocked = true;
}

function passiveMultiplier(characterId) {
  return 1 + (user.characters[characterId].passiveLevel - 1) * 0.08;
}

function canOfferCard(card, cardLevels) {
  const requirements = CARD_REQUIREMENTS[card.id];
  return !requirements || requirements.some(id => (cardLevels[id] || 0) > 0);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function localRankings() {
  if (!user) return [];
  return [{
    uid: user.uid,
    nickname: user.nickname || "동당탕탕용사",
    bestWave: user.records?.bestWave || 0,
    bestScore: user.records?.bestScore || 0,
    local: true
  }];
}

let rankingRenderSeq = 0;

function renderHome() {
  updateUnlocks();
  $("#nickname").textContent = user.nickname;
  const nicknameInput = $("#nicknameInput");
  if (nicknameInput) nicknameInput.value = user.nickname;
  $("#accountType").textContent = user.provider === "guest" ? "게스트" : "Google";
  $("#goldText").textContent = `${user.gold.toLocaleString()}G`;
  $("#gemText").textContent = `${user.gems.toLocaleString()}◆`;
  renderCharacters();
  renderEquipment();
  renderRecords();
  storage.save(user);
}

function characterAvatar(ch) {
  return `
    <div class="avatar character-avatar ${ch.prop}" style="--hero:${ch.color}; --accent:${ch.accent}">
      <span class="char-prop"></span>
      <span class="char-head"><i></i></span>
      <span class="char-body"></span>
    </div>
  `;
}

function renderCharacters() {
  $("#characterList").innerHTML = CHARACTERS.map(ch => {
    const state = user.characters[ch.id];
    const selected = user.selectedCharacter === ch.id;
    const nextLevel = state.passiveLevel + 1;
    const upgradeCost = PASSIVE_COST[nextLevel];
    const canUpgrade = state.unlocked && upgradeCost;
    const lockAction = state.unlocked
      ? `<button class="mini-btn good" data-select="${ch.id}">${selected ? "선택 중" : "선택"}</button>`
      : `<button class="mini-btn danger" data-unlock="${ch.id}">${ch.forceCost.toLocaleString()}G 해금</button><span class="pill unlock-condition">조건: ${ch.unlock}</span>`;
    return `
      <article class="character-card">
        ${characterAvatar(ch)}
        <div>
          <h3>${ch.name}</h3>
          <small>${ch.passive} · Lv.${state.passiveLevel} · 효과 x${passiveMultiplier(ch.id).toFixed(2)}</small>
          <small>${state.unlocked ? "해금됨" : `조건: ${ch.unlock}`}</small>
          <div class="meta-row">
            ${lockAction}
            ${canUpgrade ? `<button class="mini-btn" data-upgrade="${ch.id}">패시브 Lv.${nextLevel} ${upgradeCost.toLocaleString()}G</button>` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function rollGrade(odds) {
  const pick = Math.random() * 100;
  let acc = 0;
  for (const [grade, chance] of Object.entries(odds)) {
    acc += chance;
    if (pick <= acc) return grade;
  }
  return "D";
}

function makeEquipment(type, grade) {
  const ch = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  const id = `eq_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const weaponNames = ["통통 검", "말랑 지팡이", "쫑긋 활", "반짝 단검", "쿵쾅 망치"];
  const armorNames = ["폭신 갑옷", "방울 망토", "튼튼 조끼", "구름 방패복", "반짝 로브"];
  const statPool = type === "weapon"
    ? ["attackPercent", "skillDamagePercent", "critRatePercent", "attackSpeedPercent"]
    : ["maxHpPercent", "defensePercent", "damageReductionPercent", "healingPercent"];
  const optionCount = grade === "S" ? 3 : grade === "A" ? 2 : grade === "B" ? 1 + Math.floor(Math.random() * 2) : grade === "C" ? 1 : 0;
  const stats = {};
  stats[type === "weapon" ? "attackPercent" : "maxHpPercent"] = Math.round(7 * GRADE_POWER[grade]);
  [...statPool].sort(() => Math.random() - 0.5).slice(0, optionCount).forEach(stat => {
    stats[stat] = Math.round((4 + Math.random() * 5) * GRADE_POWER[grade]);
  });
  return {
    equipmentId: id,
    characterId: ch.id,
    type,
    grade,
    name: `${ch.name} 전용 ${type === "weapon" ? weaponNames[Math.floor(Math.random() * weaponNames.length)] : armorNames[Math.floor(Math.random() * armorNames.length)]}`,
    stats,
    specialEffectLocked: grade === "S",
    specialEffectUnlocked: false,
    specialEffectImplemented: false,
    equipped: false,
    createdAt: new Date().toISOString()
  };
}

function renderEquipment() {
  const selected = user.selectedCharacter;
  const weaponId = user.equipped[`${selected}_weapon`];
  const armorId = user.equipped[`${selected}_armor`];
  const weapon = user.equipments.find(eq => eq.equipmentId === weaponId);
  const armor = user.equipments.find(eq => eq.equipmentId === armorId);
  $("#equippedWeapon").textContent = weapon ? `${weapon.grade} ${weapon.name}` : "없음";
  $("#equippedArmor").textContent = armor ? `${armor.grade} ${armor.name}` : "없음";
  $("#chestList").innerHTML = CHESTS.map(chest => `
    <article class="chest-card">
      <h3>${chest.name}</h3>
      <small>${chest.type === "weapon" ? "무기" : "갑옷"} · ${chest.cost.toLocaleString()}G · 확률 ${Object.entries(chest.odds).map(([g, n]) => `${g} ${n}%`).join(" / ")}</small>
      <div class="meta-row"><button class="mini-btn" data-chest="${chest.id}">열기</button></div>
    </article>
  `).join("");
  const owned = user.equipments.slice().reverse();
  $("#equipmentList").innerHTML = owned.length ? owned.map(eq => {
    const owner = CHARACTERS.find(ch => ch.id === eq.characterId);
    const canEquip = eq.characterId === selected;
    const special = eq.grade === "S"
      ? `<small>특수효과: ${eq.specialEffectUnlocked ? "해금됨" : "잠금 상태"} · 보석을 사용해 해금할 수 있습니다. 기능은 추후 업데이트 예정입니다.</small>`
      : "";
    return `
      <article class="equipment-card">
        <h3>${eq.grade} ${eq.name}</h3>
        <small>${owner.name} 전용 ${eq.type === "weapon" ? "무기" : "갑옷"} · ${Object.entries(eq.stats).map(([k, v]) => `${k} +${v}%`).join(", ")}</small>
        ${special}
        <div class="meta-row">
          <span class="pill">${canEquip ? "장착 가능" : "다른 캐릭터 전용"}</span>
          ${canEquip ? `<button class="mini-btn good" data-equip="${eq.equipmentId}">장착</button>` : ""}
          ${eq.grade === "S" && !eq.specialEffectUnlocked ? `<button class="mini-btn" data-special="${eq.equipmentId}">보석 10◆ 해금</button>` : ""}
        </div>
      </article>
    `;
  }).join("") : `<article class="equipment-card"><h3>장비 없음</h3><small>상자를 열면 해금하지 않은 캐릭터의 장비도 등장합니다.</small></article>`;
}

function renderRecords() {
  const r = user.records;
  const data = [
    ["최고 점수", r.bestScore],
    ["최고 웨이브", r.bestWave],
    ["최고 킬 수", r.bestKills],
    ["최장 생존", fmtTime(r.bestSurvivalTime)],
    ["클리어 던전", r.bestClearedDungeonCount],
    ["플레이 횟수", user.totalPlayCount]
  ];
  $("#recordGrid").innerHTML = data.map(([label, value]) => `<div class="record-item"><small>${label}</small><strong>${value}</strong></div>`).join("");
  renderRankings();
}

function renderRankingRows(rows, status = "") {
  const list = $("#rankingList");
  if (!list) return;
  if (!rows.length) {
    list.innerHTML = `<div class="ranking-empty">${status || "아직 랭킹 기록이 없습니다."}</div>`;
    return;
  }
  list.innerHTML = rows.slice(0, 10).map((row, index) => {
    const rank = index + 1;
    const topClass = rank <= 3 ? ` top-${rank}` : "";
    const mineClass = row.uid === user.uid ? " mine" : "";
    return `
      <article class="ranking-row${topClass}${mineClass}">
        <span class="rank-badge">${rank}</span>
        <strong>${escapeHTML(row.nickname || "이름 없는 용사")}</strong>
        <span>Wave ${Number(row.bestWave || 0).toLocaleString()}</span>
      </article>
    `;
  }).join("");
  if (status) list.insertAdjacentHTML("beforeend", `<div class="ranking-empty">${escapeHTML(status)}</div>`);
}

async function renderRankings() {
  const seq = ++rankingRenderSeq;
  renderRankingRows([], "랭킹을 불러오는 중...");
  const rows = await storage.rankings();
  if (seq !== rankingRenderSeq) return;
  renderRankingRows(rows, user?.provider === "guest" ? "게스트는 내 기록만 표시됩니다." : "");
}

function startGame() {
  showScreen("gameScreen");
  requestAnimationFrame(() => game.start(user.selectedCharacter));
}

function restoreCachedSession() {
  const cached = loadCachedUser();
  if (!cached) return;
  user = cached;
  renderHome();
  showScreen("homeScreen");
}

function rewardFor(result) {
  const dungeonBonus = result.clearedDungeonCount >= 3 ? 220 : result.clearedDungeonCount === 2 ? 120 : result.clearedDungeonCount === 1 ? 50 : 0;
  return 100 + dungeonBonus + (result.goldEarned || 0) + ((result.bossKillCount || 0) * 150) + (result.newBest ? 200 : 0);
}

function finishRun(result) {
  lastResult = result;
  user.totalPlayCount++;
  user.progress.totalKills += result.kills;
  user.progress.bossKills += result.bossKillCount || (result.bossKilled ? 1 : 0);
  user.progress.stageClears += result.clearedDungeonCount;
  user.progress.longestSurvival = Math.max(user.progress.longestSurvival, result.survivalTime);
  user.progress.lightningPicks += result.lightningPicks;
  user.progress.poisonKills += result.poisonKills;
  user.progress.totalHealing += result.healing;
  result.newBest = result.score > user.records.bestScore;
  user.records.bestScore = Math.max(user.records.bestScore, result.score);
  user.records.bestWave = Math.max(user.records.bestWave, result.wave);
  user.records.bestKills = Math.max(user.records.bestKills, result.kills);
  user.records.bestSurvivalTime = Math.max(user.records.bestSurvivalTime, result.survivalTime);
  user.records.bestClearedDungeonCount = Math.max(user.records.bestClearedDungeonCount, result.clearedDungeonCount);
  user.records.bestCharacter = result.characterId;
  user.records.updatedAt = new Date().toISOString();
  result.gold = rewardFor(result);
  $("#resultTitle").textContent = result.cleared ? "던전 클리어!" : "탐험 종료";
  $("#resultStats").innerHTML = [
    ["점수", result.score.toLocaleString()],
    ["웨이브", result.wave],
    ["처치", result.kills],
    ["획득 골드", `${(result.goldEarned || 0).toLocaleString()}G`],
    ["생존 시간", fmtTime(result.survivalTime)],
    ["보상", `${result.gold.toLocaleString()}G`],
    ["최고 기록", result.newBest ? "갱신 +200G" : "유지"]
  ].map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join("");
  showScreen("resultScreen");
}

const game = {
  canvas: null,
  ctx: null,
  running: false,
  paused: false,
  last: 0,
  pointer: { active: false, x: 0, y: 0 },
  joy: { x: 0, y: 0 },
  keys: {},
  start(characterId) {
    this.canvas = $("#gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    $("#gameScreen").classList.remove("volume-open");
    configureGameViewport(this.canvas);
    const passive = user.characters[characterId].passiveLevel;
    const ch = CHARACTERS.find(item => item.id === characterId);
    this.state = {
      characterId,
      ch,
      t: 0,
      score: 0,
      goldEarned: 0,
      wave: 1,
      kills: 0,
      level: 1,
      xp: 0,
      xpNeed: 5,
      bossKilled: false,
      bossKillCount: 0,
      xpBuffTime: 0,
      clearedDungeonCount: 0,
      poisonKills: 0,
      healing: 0,
      lightningPicks: 0,
      world: { w: WORLD_W, h: WORLD_H },
      camera: { x: WORLD_W / 2 - VIEW_W / 2, y: WORLD_H / 2 - VIEW_H / 2 },
      player: { x: WORLD_W / 2, y: WORLD_H / 2, r: 24, hp: 100 + (ch.id === "knight_01" ? passive * 10 : 0), maxHp: 100 + (ch.id === "knight_01" ? passive * 10 : 0), inv: 0 },
      enemies: [],
      shots: [],
      enemyShots: [],
      warnings: [],
      pops: [],
      alerts: [],
      nextSpawn: 0,
      nextAttack: 0,
      nextSkill: 0,
      nextTwinBarrage: 1.2,
      projectiles: 1,
      attackRate: 1 + (ch.id === "warrior_01" ? passive * 0.08 : 0),
      crit: ch.id === "rogue_01" ? passive * 0.04 : 0.04,
      area: 1,
      cooldown: ch.id === "mage_01" ? 0.85 : 1,
      statusChance: 0.08,
      moveSpeed: 230,
      damageMultiplier: 1,
      scoreMultiplier: 1,
      regenDelay: 4,
      regenRate: ch.id === "cleric_01" ? 2.2 : 1.2,
      timeSinceDamage: 0,
      invDuration: 0.45,
      lifeSteal: 0,
      bossDamage: 0,
      enemySlow: 0,
      burstWave: 0,
      pierce: 0,
      shatterRound: 0,
      groundSlam: 0,
      piercingBeam: 0,
      meteorDrop: 0,
      twinBarrage: 0,
      fireball: 0,
      spin: 0,
      poison: 0,
      ice: 0,
      lightning: ch.id === "spark_01" ? 1 : 0,
      arrow: ch.id === "archer_01" ? 1 : 0,
      selectedCards: [],
      cardLevels: {},
      bossWavesSpawned: {},
      bossWaveActive: false
    };
    this.running = true;
    this.paused = false;
    this.speed = 1;
    this.last = performance.now();
    $("#pauseBtn").textContent = "Ⅱ";
    $("#pauseBtn").classList.remove("active");
    $("#speedBtn").textContent = "x1";
    $("#speedBtn").classList.remove("active");
    $("#buildList").innerHTML = "";
    $("#cardModal").hidden = true;
    this.pointer.active = false;
    this.joy.x = 0;
    this.joy.y = 0;
    this.keys = {};
    this.bindJoystick();
    this.draw();
    requestAnimationFrame(ts => this.loop(ts));
    audio.setMusic("game");
  },
  resizeViewport() {
    if (!this.canvas || !this.state) return;
    configureGameViewport(this.canvas);
    const s = this.state;
    s.world.w = WORLD_W;
    s.world.h = WORLD_H;
    s.player.x = Math.max(28, Math.min(s.world.w - 28, s.player.x));
    s.player.y = Math.max(28, Math.min(s.world.h - 28, s.player.y));
    this.updateCamera();
    this.draw();
  },
  bindJoystick() {
    const joy = $("#joystick");
    const knob = joy.querySelector("span");
    const screen = $("#gameScreen");
    const radius = 56;
    const max = 36;
    const reset = () => {
      this.pointer.active = false;
      this.pointer.x = 0;
      this.pointer.y = 0;
      this.joy.x = 0;
      this.joy.y = 0;
      joy.classList.remove("active");
      knob.style.transform = "translate(0, 0)";
    };
    const begin = e => {
      if (!this.running || !$("#cardModal").hidden || e.target.closest(".hud, .game-controls, .card-modal")) return;
      screen.setPointerCapture(e.pointerId);
      this.pointer.active = true;
      const rect = screen.getBoundingClientRect();
      const x = Math.max(radius, Math.min(rect.width - radius, e.clientX - rect.left));
      const y = Math.max(radius, Math.min(rect.height - radius, e.clientY - rect.top));
      this.pointer.x = rect.left + x;
      this.pointer.y = rect.top + y;
      joy.style.left = `${x - radius}px`;
      joy.style.top = `${y - radius}px`;
      joy.style.bottom = "auto";
      joy.classList.add("active");
      knob.style.transform = "translate(0, 0)";
      move(e);
    };
    const move = e => {
      if (!this.pointer.active) return;
      const dx = e.clientX - this.pointer.x;
      const dy = e.clientY - this.pointer.y;
      const len = Math.hypot(dx, dy) || 1;
      const mag = Math.min(max, len);
      this.joy.x = dx / len * (mag / max);
      this.joy.y = dy / len * (mag / max);
      knob.style.transform = `translate(${this.joy.x * max}px, ${this.joy.y * max}px)`;
    };
    reset();
    screen.onpointerdown = begin;
    screen.onpointermove = move;
    screen.onpointerup = screen.onpointercancel = reset;
  },
  loop(ts) {
    if (!this.running) return;
    const dt = Math.min(0.033, (ts - this.last) / 1000) * (this.speed || 1);
    this.last = ts;
    try {
      if (!this.paused) this.update(dt);
      this.draw();
    } catch (error) {
      console.error("Game loop error:", error);
      this.drawEmergencyFrame();
    }
    requestAnimationFrame(next => this.loop(next));
  },
  drawEmergencyFrame() {
    const ctx = this.ctx;
    const s = this.state;
    if (!ctx || !s) return;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#97dfc9";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#24313f";
    ctx.font = "bold 30px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Loading...", VIEW_W / 2, VIEW_H / 2);
    if (s.player) {
      ctx.save();
      ctx.translate(VIEW_W / 2, VIEW_H / 2 + 56);
      ctx.fillStyle = s.ch?.color || "#ffd66e";
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
  update(dt) {
    const s = this.state;
    s.t += dt;
    const nextWave = 1 + Math.floor(s.t / 35);
    if (nextWave !== s.wave) s.bossWaveActive = false;
    s.wave = nextWave;
    if (s.wave >= 5 && s.wave % 5 === 0 && !s.bossWavesSpawned[s.wave]) this.spawnBossWave();
    if (s.t > 120) s.clearedDungeonCount = Math.max(s.clearedDungeonCount, 1);
    if (s.t > 210) s.clearedDungeonCount = Math.max(s.clearedDungeonCount, 2);
    if (s.t > 300) {
      s.clearedDungeonCount = 3;
      return this.end(true);
    }
    const p = s.player;
    const keyboardX = (this.keys.ArrowRight || this.keys.KeyD ? 1 : 0) - (this.keys.ArrowLeft || this.keys.KeyA ? 1 : 0);
    const keyboardY = (this.keys.ArrowDown || this.keys.KeyS ? 1 : 0) - (this.keys.ArrowUp || this.keys.KeyW ? 1 : 0);
    const rawX = this.joy.x + keyboardX;
    const rawY = this.joy.y + keyboardY;
    const inputLength = Math.hypot(rawX, rawY);
    const moveX = inputLength > 1 ? rawX / inputLength : rawX;
    const moveY = inputLength > 1 ? rawY / inputLength : rawY;
    p.x = Math.max(28, Math.min(s.world.w - 28, p.x + moveX * s.moveSpeed * dt));
    p.y = Math.max(28, Math.min(s.world.h - 28, p.y + moveY * s.moveSpeed * dt));
    this.updateCamera();
    p.inv = Math.max(0, p.inv - dt);
    s.xpBuffTime = Math.max(0, s.xpBuffTime - dt);
    s.timeSinceDamage += dt;
    if (s.timeSinceDamage >= s.regenDelay && p.hp < p.maxHp) {
      const healed = Math.min(p.maxHp - p.hp, s.regenRate * dt);
      p.hp += healed;
      s.healing += healed;
    }
    s.nextSpawn -= dt;
    if (s.nextSpawn <= 0) {
      this.spawnEnemy();
      s.nextSpawn = Math.max(0.18, 0.8 - s.wave * 0.05);
    }
    s.nextAttack -= dt;
    if (s.nextAttack <= 0) {
      this.fireBasic();
      s.nextAttack = Math.max(0.16, 0.62 / s.attackRate);
    }
    s.nextSkill -= dt;
    if (s.nextSkill <= 0) {
      this.fireSkill();
      s.nextSkill = Math.max(0.6, 2.1 * s.cooldown);
    }
    if (s.twinBarrage > 0) {
      s.nextTwinBarrage -= dt;
      if (s.nextTwinBarrage <= 0) {
        this.fireTwinBarrage();
        s.nextTwinBarrage = Math.max(0.42, (2.4 - s.twinBarrage * 0.24) * s.cooldown);
      }
    }
    this.updateShots(dt);
    this.updateEnemyShots(dt);
    this.updateWarnings(dt);
    this.updateEnemies(dt);
    s.pops = s.pops.filter(pop => (pop.life -= dt) > 0);
    s.alerts = s.alerts.filter(alert => (alert.life -= dt) > 0);
    if (p.hp <= 0) this.end(false);
    this.updateHud();
  },
  updateCamera() {
    const s = this.state;
    s.camera.x = Math.max(0, Math.min(s.world.w - VIEW_W, s.player.x - VIEW_W / 2));
    s.camera.y = Math.max(0, Math.min(s.world.h - VIEW_H, s.player.y - VIEW_H / 2));
  },
  spawnEnemy() {
    const s = this.state;
    const edge = Math.floor(Math.random() * 4);
    const margin = 44;
    const left = s.camera.x;
    const top = s.camera.y;
    const right = s.camera.x + VIEW_W;
    const bottom = s.camera.y + VIEW_H;
    const pos = [
      { x: left + Math.random() * VIEW_W, y: top - margin },
      { x: left + Math.random() * VIEW_W, y: bottom + margin },
      { x: left - margin, y: top + Math.random() * VIEW_H },
      { x: right + margin, y: top + Math.random() * VIEW_H }
    ][edge];
    pos.x = Math.max(20, Math.min(s.world.w - 20, pos.x));
    pos.y = Math.max(20, Math.min(s.world.h - 20, pos.y));
    s.enemies.push({
      id: ++enemySeq,
      x: pos.x,
      y: pos.y,
      r: 20 + Math.random() * 8,
      hp: 22 + s.wave * 5,
      maxHp: 22 + s.wave * 5,
      speed: 58 + Math.random() * 20,
      boss: false,
      poison: 0
    });
  },
  spawnBossWave() {
    const s = this.state;
    s.bossWavesSpawned[s.wave] = true;
    s.bossWaveActive = true;
    const bossIndex = Math.max(0, Math.floor(s.wave / 5) - 1) % BOSS_TYPES.length;
    const type = BOSS_TYPES[bossIndex] || BOSS_TYPES[0];
    const angle = Math.random() * Math.PI * 2;
    const distance = 430;
    const x = Math.max(64, Math.min(s.world.w - 64, s.player.x + Math.cos(angle) * distance));
    const y = Math.max(64, Math.min(s.world.h - 64, s.player.y + Math.sin(angle) * distance));
    const hp = 620 + s.wave * 86;
    s.enemies.push({
      id: ++enemySeq,
      x,
      y,
      r: 50,
      hp,
      maxHp: hp,
      speed: Math.max(34, 54 - s.wave * 0.6),
      boss: true,
      bossType: type,
      nextProjectile: 0.7,
      nextSlam: 2.6,
      poison: 0
    });
    s.alerts.push({ text: `BOSS WAVE! ${type.name}`, life: 3.2, total: 3.2 });
    audio.play("bossWave");
  },
  nearestEnemy() {
    const p = this.state.player;
    return this.state.enemies.slice().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  },
  densestEnemy() {
    const enemies = this.state.enemies;
    let best = null;
    let bestScore = -1;
    enemies.forEach(enemy => {
      const score = enemies.reduce((sum, other) => sum + (Math.hypot(enemy.x - other.x, enemy.y - other.y) < 130 ? 1 : 0), 0);
      if (score > bestScore) {
        best = enemy;
        bestScore = score;
      }
    });
    return best;
  },
  fireBasic() {
    const s = this.state;
    const target = this.nearestEnemy();
    if (!target) return;
    audio.play("playerAttack");
    const count = Math.min(5, s.projectiles + s.arrow);
    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(target.y - s.player.y, target.x - s.player.x) + (i - (count - 1) / 2) * 0.18;
      s.shots.push({
        x: s.player.x,
        y: s.player.y,
        vx: Math.cos(angle) * 470,
        vy: Math.sin(angle) * 470,
        r: 7,
        dmg: 18,
        life: 1.4,
        color: "#24313f",
        type: "basic",
        pierce: s.pierce,
        hits: []
      });
    }
  },
  fireTwinBarrage() {
    const s = this.state;
    const pairs = s.twinBarrage >= 4 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 0], [-1, 0]];
    const damage = 12 + s.twinBarrage * 5;
    const speed = 500 + s.twinBarrage * 18;
    pairs.forEach(([dx, dy]) => {
      s.shots.push({
        x: s.player.x,
        y: s.player.y,
        vx: dx * speed,
        vy: dy * speed,
        r: (8 + s.twinBarrage) * s.area,
        dmg: damage,
        life: 1.55,
        color: "#ffcf5a",
        type: "twin",
        pierce: s.pierce + Math.ceil(s.twinBarrage / 2),
        hits: []
      });
    });
  },
  fireSkill() {
    const s = this.state;
    const target = this.nearestEnemy();
    if (!target) return;
    const addShot = (type, color, dmg, speed = 360) => {
      const angle = Math.atan2(target.y - s.player.y, target.x - s.player.x);
      s.shots.push({ x: s.player.x, y: s.player.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 12 * s.area, dmg, life: 1.8, color, type, pierce: s.pierce, hits: [] });
    };
    if (s.fireball) addShot("fire", "#ff7c4c", 28 + s.fireball * 8);
    if (s.poison) addShot("poison", "#6fbe44", 22 + s.poison * 7);
    if (s.ice) addShot("ice", "#7ab8ff", 24 + s.ice * 7);
    if (s.lightning) addShot("lightning", "#fff176", 26 + s.lightning * 8, 520);
    if (!s.fireball && !s.poison && !s.ice && !s.lightning) addShot("spark", "#ffd66e", 25);
    if (s.spin) {
      s.enemies.forEach(e => {
        if (Math.hypot(e.x - s.player.x, e.y - s.player.y) < 88 * s.area) this.damageEnemy(e, 14 + s.spin * 8, "spin");
      });
    }
    if (s.groundSlam) {
      this.damageArea(s.player.x, s.player.y, (105 + s.groundSlam * 22) * s.area, 16 + s.groundSlam * 9, "slam");
    }
    if (s.piercingBeam) {
      this.damageLine(s.player.x, s.player.y, target.x, target.y, 680, 18 + s.piercingBeam * 6, 34 + s.piercingBeam * 5, "beam");
    }
    if (s.meteorDrop) {
      const center = this.densestEnemy();
      if (center) this.damageArea(center.x, center.y, (78 + s.meteorDrop * 18) * s.area, 26 + s.meteorDrop * 10, "meteor");
    }
  },
  updateShots(dt) {
    const s = this.state;
    s.shots.forEach(shot => {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      s.enemies.forEach(enemy => {
        if (shot.life > 0 && !shot.hits.includes(enemy.id) && Math.hypot(enemy.x - shot.x, enemy.y - shot.y) < enemy.r + shot.r) {
          const hitDamage = shot.dmg * (Math.random() < s.crit ? 1.8 : 1);
          shot.hits.push(enemy.id);
          this.damageEnemy(enemy, hitDamage, shot.type);
          if (shot.type === "basic" && s.shatterRound > 0) {
            const radius = (34 + s.shatterRound * 9) * s.area;
            const splashDamage = hitDamage * (0.18 + s.shatterRound * 0.05);
            this.damageArea(enemy.x, enemy.y, radius, splashDamage, "shatter", enemy);
          }
          if (s.burstWave > 0) {
            const radius = (54 + s.burstWave * 13) * s.area;
            const splashDamage = hitDamage * (0.28 + s.burstWave * 0.07);
            this.damageArea(enemy.x, enemy.y, radius, splashDamage, "burst", enemy);
          }
          if (shot.pierce > 0) {
            shot.pierce--;
          } else {
            shot.life = 0;
          }
        }
      });
    });
    s.shots = s.shots.filter(shot =>
      shot.life > 0 &&
      shot.x > -80 &&
      shot.y > -80 &&
      shot.x < s.world.w + 80 &&
      shot.y < s.world.h + 80
    );
  },
  updateEnemyShots(dt) {
    const s = this.state;
    const p = s.player;
    s.enemyShots.forEach(shot => {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (shot.life > 0 && Math.hypot(shot.x - p.x, shot.y - p.y) < shot.r + p.r && p.inv <= 0) {
        this.damagePlayer(shot.damage);
        shot.life = 0;
      }
    });
    s.enemyShots = s.enemyShots.filter(shot =>
      shot.life > 0 &&
      shot.x > -120 &&
      shot.y > -120 &&
      shot.x < s.world.w + 120 &&
      shot.y < s.world.h + 120
    );
  },
  updateWarnings(dt) {
    const s = this.state;
    const p = s.player;
    s.warnings.forEach(warning => {
      warning.life -= dt;
      if (warning.life <= 0 && !warning.done) {
        warning.done = true;
        if (warning.boss?.hp > 0) {
          warning.boss.x = warning.x;
          warning.boss.y = warning.y - warning.boss.r * 0.2;
        }
        audio.play("slam");
        s.pops.push({ x: warning.x, y: warning.y, radius: warning.r, ring: true, life: 0.42, color: warning.color });
        s.pops.push({ x: warning.x, y: warning.y, text: "SLAM", life: 0.55 });
        if (Math.hypot(p.x - warning.x, p.y - warning.y) <= warning.r + p.r && p.inv <= 0) this.damagePlayer(warning.damage);
      }
    });
    s.warnings = s.warnings.filter(warning => warning.life > -0.18);
  },
  updateEnemies(dt) {
    const s = this.state;
    const p = s.player;
    s.enemies.forEach(enemy => {
      const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
      const speed = enemy.speed * Math.max(0.45, 1 - s.enemySlow);
      enemy.x += Math.cos(angle) * speed * dt;
      enemy.y += Math.sin(angle) * speed * dt;
      if (enemy.poison > 0) {
        enemy.poison -= dt;
        this.damageEnemy(enemy, 6 * dt, "poisonDot", true);
      }
      if (Math.hypot(enemy.x - p.x, enemy.y - p.y) < enemy.r + p.r && p.inv <= 0) {
        this.damagePlayer(enemy.boss ? 22 : 11);
      }
      if (enemy.boss) this.updateBossAttack(enemy, dt);
    });
    s.enemies = s.enemies.filter(enemy => {
      if (enemy.hp > 0) return true;
      this.killEnemy(enemy);
      return false;
    });
  },
  updateBossAttack(enemy, dt) {
    const s = this.state;
    const type = enemy.bossType || BOSS_TYPES[0];
    enemy.nextProjectile -= dt;
    enemy.nextSlam -= dt;
    if (enemy.nextProjectile <= 0) {
      this.fireBossProjectile(enemy, type);
      enemy.nextProjectile = Math.max(0.65, type.projectileCooldown - s.wave * 0.025);
    }
    if (enemy.nextSlam <= 0) {
      this.queueBossSlam(enemy, type);
      enemy.nextSlam = Math.max(3.4, type.slamCooldown - s.wave * 0.05);
    }
  },
  fireBossProjectile(enemy, type) {
    const s = this.state;
    const base = Math.atan2(s.player.y - enemy.y, s.player.x - enemy.x);
    const count = type.projectileCount;
    for (let i = 0; i < count; i++) {
      const angle = base + (i - (count - 1) / 2) * type.projectileSpread;
      s.enemyShots.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * type.projectileSpeed,
        vy: Math.sin(angle) * type.projectileSpeed,
        r: type.projectileRadius,
        damage: type.projectileDamage,
        life: 3.2,
        color: type.shotColor,
        shape: type.warningShape
      });
    }
    audio.play("bossAttack");
  },
  queueBossSlam(enemy, type) {
    const s = this.state;
    const lead = 0.25;
    const x = Math.max(70, Math.min(s.world.w - 70, s.player.x + this.joy.x * s.moveSpeed * lead));
    const y = Math.max(70, Math.min(s.world.h - 70, s.player.y + this.joy.y * s.moveSpeed * lead));
    s.warnings.push({
      x,
      y,
      r: type.slamRadius,
      damage: type.slamDamage,
      life: 1.75,
      total: 1.75,
      color: type.warningColor,
      shape: type.warningShape,
      boss: enemy
    });
    audio.play("bossAttack");
  },
  damagePlayer(damage) {
    const s = this.state;
    s.player.hp -= damage;
    s.player.inv = s.invDuration;
    s.timeSinceDamage = 0;
    s.pops.push({ x: s.player.x, y: s.player.y, text: `-${Math.round(damage)}`, life: 0.42, color: "#ff5a68" });
    audio.play("hurt");
  },
  damageEnemy(enemy, damage, type, dot = false) {
    const s = this.state;
    if (type === "poison" && Math.random() < 0.45 + s.statusChance) enemy.poison = 4;
    const finalDamage = damage * s.damageMultiplier * (enemy.boss ? 1 + s.bossDamage : 1);
    enemy.hp -= finalDamage;
    if (!dot) {
      s.pops.push({ x: enemy.x, y: enemy.y, text: Math.round(finalDamage), life: 0.45 });
      audio.play("hit");
    }
  },
  damageArea(x, y, radius, damage, type, exclude = null) {
    const s = this.state;
    const colors = { burst: "#ffcf5a", shatter: "#f8fbff", slam: "#9d7042", meteor: "#ff7c4c" };
    s.pops.push({ x, y, radius, ring: true, life: 0.34, color: colors[type] || "#ffffff" });
    s.enemies.forEach(enemy => {
      if (enemy === exclude || enemy.hp <= 0) return;
      if (Math.hypot(enemy.x - x, enemy.y - y) <= radius + enemy.r) {
        this.damageEnemy(enemy, damage, type);
      }
    });
  },
  damageLine(x1, y1, x2, y2, length, damage, width, type) {
    const s = this.state;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const endX = x1 + Math.cos(angle) * length;
    const endY = y1 + Math.sin(angle) * length;
    s.pops.push({ x: x1, y: y1, x2: endX, y2: endY, line: true, life: 0.28, color: "#aef5ff", width });
    s.enemies.forEach(enemy => {
      const vx = endX - x1;
      const vy = endY - y1;
      const wx = enemy.x - x1;
      const wy = enemy.y - y1;
      const projection = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
      const closestX = x1 + vx * projection;
      const closestY = y1 + vy * projection;
      if (Math.hypot(enemy.x - closestX, enemy.y - closestY) <= width + enemy.r) {
        this.damageEnemy(enemy, damage, type);
      }
    });
  },
  killEnemy(enemy) {
    const s = this.state;
    s.kills++;
    s.score += Math.floor((enemy.boss ? 600 : 40 + s.wave * 6) * s.scoreMultiplier);
    const baseXp = enemy.boss ? 18 + Math.floor(s.wave / 5) * 5 : 1;
    const xpGain = Math.ceil(baseXp * (s.xpBuffTime > 0 ? 2 : 1));
    const goldGain = enemy.boss ? 220 + s.wave * 25 : 2 + Math.floor(s.wave / 3);
    s.xp += xpGain;
    s.goldEarned += Math.floor(goldGain * s.scoreMultiplier);
    s.pops.push({ x: enemy.x, y: enemy.y - enemy.r - 24, text: `+${xpGain}XP`, life: 0.6, color: "#ffd35a" });
    if (goldGain > 0) s.pops.push({ x: enemy.x, y: enemy.y - enemy.r - 2, text: `+${Math.floor(goldGain * s.scoreMultiplier)}G`, life: 0.6, color: "#fff4a8" });
    if (s.lifeSteal > 0 && s.player.hp < s.player.maxHp) {
      const healed = Math.min(s.player.maxHp - s.player.hp, s.lifeSteal);
      s.player.hp += healed;
      s.healing += healed;
    }
    if (enemy.boss) {
      s.bossKilled = true;
      s.bossKillCount++;
      s.xpBuffTime = 10;
      s.alerts.push({ text: "EXP BUFF x2 - 10s", life: 2.2, total: 2.2 });
    }
    if (enemy.poison > 0 || s.synergyPoison) s.poisonKills++;
    while (s.xp >= s.xpNeed) {
      s.xp -= s.xpNeed;
      s.level++;
      s.xpNeed = Math.ceil(s.xpNeed * 1.35 + 2);
      this.offerCards();
    }
  },
  offerCards() {
    this.paused = true;
    $("#gameScreen").classList.remove("volume-open");
    const available = SKILL_CARDS.filter(card =>
      (this.state.cardLevels[card.id] || 0) < CARD_MAX_LEVEL &&
      canOfferCard(card, this.state.cardLevels)
    );
    if (!available.length) {
      this.paused = false;
      $("#gameScreen").classList.remove("volume-open");
      return;
    }
    const picks = [...available].sort(() => Math.random() - 0.5).slice(0, 3);
    this.cardPicks = picks;
    $("#cardChoices").innerHTML = picks.map((card, index) => `
      <button class="skill-card" data-card="${index}">
        <strong>${index + 1}</strong>
        <b>${card.name}</b>
        <small>${card.type}</small>
        <em>LV.${this.state.cardLevels[card.id] || 0} → LV.${(this.state.cardLevels[card.id] || 0) + 1}</em>
        <span>${card.desc}</span>
      </button>
    `).join("");
    $("#cardModal").hidden = false;
    $$(".skill-card").forEach(btn => {
      btn.onclick = () => {
        this.chooseCard(Number(btn.dataset.card));
      };
    });
  },
  chooseCard(index) {
    if (!this.running || $("#cardModal").hidden || !this.cardPicks?.[index]) return;
    const card = this.cardPicks[index];
    const nextLevel = (this.state.cardLevels[card.id] || 0) + 1;
    this.state.cardLevels[card.id] = nextLevel;
    card.apply(this.state);
    this.state.selectedCards = Object.entries(this.state.cardLevels)
      .map(([id, level]) => {
        const picked = SKILL_CARDS.find(item => item.id === id);
        return picked ? `${picked.name} LV.${level}` : "";
      })
      .filter(Boolean);
    $("#buildList").innerHTML = this.state.selectedCards.slice(-8).map(name => `<span>${name}</span>`).join("");
    $("#cardModal").hidden = true;
    this.cardPicks = [];
    this.paused = false;
    $("#gameScreen").classList.remove("volume-open");
  },
  updateHud() {
    const s = this.state;
    $("#waveHud").textContent = `Wave ${s.wave}`;
    $("#timeHud").textContent = fmtTime(s.t);
    $("#hpHud").textContent = `HP ${Math.max(0, Math.ceil(s.player.hp))}/${Math.ceil(s.player.maxHp)}`;
    $("#killHud").textContent = `${s.kills} 처치 · ${s.goldEarned.toLocaleString()}G`;
    $("#xpBar").style.width = `${Math.min(100, s.xp / s.xpNeed * 100)}%`;
    const buffHud = $("#buffHud");
    if (buffHud) {
      buffHud.hidden = s.xpBuffTime <= 0;
      buffHud.textContent = s.xpBuffTime > 0 ? `EXP x2 ${Math.ceil(s.xpBuffTime)}s` : "";
    }
  },
  draw() {
    const ctx = this.ctx;
    const s = this.state;
    this.updateCamera();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    this.drawWorldBackground(ctx);
    ctx.save();
    ctx.translate(-s.camera.x, -s.camera.y);
    this.drawWorldDetails(ctx);
    ctx.strokeStyle = "rgba(31,43,56,0.12)";
    ctx.lineWidth = 10;
    ctx.strokeRect(4, 4, s.world.w - 8, s.world.h - 8);
    s.warnings.forEach(warning => this.drawWarning(ctx, warning));
    s.enemies.forEach(e => this.drawEnemy(ctx, e));
    s.shots.forEach(shot => {
      ctx.fillStyle = shot.color;
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
      ctx.fill();
    });
    s.enemyShots.forEach(shot => this.drawProjectileShape(ctx, shot.x, shot.y, shot.r, shot.shape, shot.color));
    this.drawPlayer(ctx, s.player, s.ch);
    s.pops.forEach(pop => {
      ctx.globalAlpha = Math.max(0, pop.life * 2);
      if (pop.ring) {
        ctx.strokeStyle = pop.color || "#fff";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(pop.x, pop.y, pop.radius * (1.15 - pop.life), 0, Math.PI * 2);
        ctx.stroke();
      } else if (pop.line) {
        ctx.strokeStyle = pop.color || "#fff";
        ctx.lineWidth = pop.width;
        ctx.beginPath();
        ctx.moveTo(pop.x, pop.y);
        ctx.lineTo(pop.x2, pop.y2);
        ctx.stroke();
      } else {
        ctx.fillStyle = pop.color || "#24313f";
        ctx.font = "bold 22px system-ui";
        ctx.textAlign = "left";
        ctx.fillText(pop.text, pop.x, pop.y - (0.45 - pop.life) * 45);
      }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    s.alerts.forEach(alert => {
      const alpha = Math.min(1, alert.life) * 0.92;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(36,49,63,0.78)";
      ctx.fillRect(78, 116, VIEW_W - 156, 82);
      ctx.strokeStyle = "#ffd66e";
      ctx.lineWidth = 4;
      ctx.strokeRect(78, 116, VIEW_W - 156, 82);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 34px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(alert.text, VIEW_W / 2, 168);
      ctx.restore();
    });
    if (this.paused && $("#cardModal").hidden) {
      ctx.fillStyle = "rgba(36,49,63,0.42)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 54px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("PAUSE", VIEW_W / 2, VIEW_H / 2 - 20);
    }
  },
  drawWorldBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    gradient.addColorStop(0, "#aee7c6");
    gradient.addColorStop(0.42, "#93d8ad");
    gradient.addColorStop(1, "#77c797");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let y = 0; y < VIEW_H; y += 120) {
      ctx.fillRect(0, y, VIEW_W, 1);
    }
    ctx.fillStyle = "rgba(255,244,184,0.16)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H * 0.3);
  },
  drawWorldDetails(ctx) {
    const s = this.state;
    const left = s.camera.x;
    const right = s.camera.x + VIEW_W;
    const top = s.camera.y;
    const bottom = s.camera.y + VIEW_H;
    const startY = top - 90;
    const endY = bottom + 120;
    const centerX = left + VIEW_W / 2;
    const pathW = 330;
    const pathLeft = centerX - pathW / 2;
    const pathRight = centerX + pathW / 2;

    this.drawGrassAndMoss(ctx, left, right, top, bottom);
    this.drawStonePath(ctx, pathLeft, pathRight, startY, endY);
    this.drawRuinsEntrance(ctx, centerX, top + 36);
    this.drawRuinsProps(ctx, left, right, top, bottom, centerX, pathW);

    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    const gridX = left;
    const gridY = top;
    for (let x = gridX; x < right + 120; x += 240) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    for (let y = gridY; y < bottom + 120; y += 240) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
  },
  drawGrassAndMoss(ctx, left, right, top, bottom) {
    const startY = top - 30;
    const startX = left - 30;
    for (let y = startY; y < bottom + 120; y += 150) {
      for (let x = startX; x < right + 140; x += 150) {
        const wobble = Math.sin((x - left) * 0.017 + (y - top) * 0.013);
        if (wobble > -0.15) this.drawGrassClump(ctx, x + 36 + wobble * 12, y + 48);
        ctx.fillStyle = "rgba(255,245,178,0.24)";
        ctx.beginPath();
        ctx.arc(x + 86, y + 92, 2.2, 0, Math.PI * 2);
        ctx.arc(x + 96, y + 88, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  drawStonePath(ctx, pathLeft, pathRight, startY, endY) {
    ctx.fillStyle = "rgba(96,116,94,0.18)";
    ctx.beginPath();
    ctx.moveTo(pathLeft - 44, startY);
    ctx.lineTo(pathRight + 44, startY);
    ctx.lineTo(pathRight + 76, endY);
    ctx.lineTo(pathLeft - 76, endY);
    ctx.closePath();
    ctx.fill();

    let row = 0;
    for (let y = startY; y < endY; y += 72) {
      const rowOffset = row % 2 ? 42 : 0;
      for (let x = pathLeft - 20 + rowOffset; x < pathRight; x += 84) {
        const localX = x - pathLeft;
        const localY = y - startY;
        const w = 76 + Math.sin(localX * 0.04) * 8;
        const h = 62 + Math.cos(localY * 0.05) * 5;
        ctx.fillStyle = "#b7b89f";
        ctx.strokeStyle = "rgba(70,79,70,0.42)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(x + 8, y + 8, w - 18, 6);
        ctx.fillStyle = "rgba(53,111,66,0.26)";
        if ((Math.floor(x + y) % 3) === 0) {
          ctx.beginPath();
          ctx.ellipse(x + w * 0.55, y + h - 6, 22, 5, -0.12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      row++;
    }
  },
  drawRuinsEntrance(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(43,56,54,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 154, 210, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    this.drawStoneBlock(ctx, -170, 34, 56, 150);
    this.drawStoneBlock(ctx, 114, 34, 56, 150);
    this.drawStoneBlock(ctx, -122, 0, 244, 52);
    ctx.fillStyle = "#607164";
    ctx.fillRect(-72, 68, 144, 116);
    ctx.fillStyle = "#34443e";
    ctx.beginPath();
    ctx.moveTo(-54, 184);
    ctx.lineTo(-54, 106);
    ctx.quadraticCurveTo(0, 54, 54, 106);
    ctx.lineTo(54, 184);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(26,36,34,0.36)";
    ctx.lineWidth = 6;
    ctx.stroke();
    for (let i = 0; i < 5; i++) this.drawStoneBlock(ctx, -120 + i * 48, 190 + i * 14, 48, 18);
    this.drawVines(ctx, -164, 20, 92);
    this.drawVines(ctx, 142, 20, 100);
    ctx.restore();
  },
  drawRuinsProps(ctx, left, right, top, bottom, centerX, pathW) {
    const startY = top + 100;
    let row = 0;
    for (let y = startY; y < bottom + 300; y += 360) {
      const side = row % 2 ? -1 : 1;
      const pillarX = centerX + side * (pathW / 2 + 100);
      const brokenX = centerX - side * (pathW / 2 + 150);
      if (pillarX > left - 120 && pillarX < right + 120) {
        this.drawBrokenPillar(ctx, pillarX, y + 90, 54, 150, side);
      }
      if (brokenX > left - 160 && brokenX < right + 160) {
        this.drawRubble(ctx, brokenX, y + 230);
      }
      this.drawGrassClump(ctx, centerX + side * (pathW / 2 + 32), y + 288);
      row++;
    }
  },
  drawStoneBlock(ctx, x, y, w, h) {
    ctx.fillStyle = "#9a9d90";
    ctx.strokeStyle = "rgba(51,59,55,0.42)";
    ctx.lineWidth = 3;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(x + 7, y + 7, Math.max(8, w - 14), 6);
    ctx.strokeStyle = "rgba(57,70,62,0.22)";
    for (let yy = y + 34; yy < y + h; yy += 34) {
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy + Math.sin(yy) * 2);
      ctx.stroke();
    }
  },
  drawBrokenPillar(ctx, x, y, w, h, lean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean * 0.04);
    ctx.fillStyle = "rgba(43,56,54,0.2)";
    ctx.beginPath();
    ctx.ellipse(0, h + 12, w * 0.78, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    this.drawStoneBlock(ctx, -w / 2, 0, w, h);
    ctx.fillStyle = "#85897e";
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(w / 2 - 12, -22);
    ctx.lineTo(4, -10);
    ctx.lineTo(-12, -28);
    ctx.closePath();
    ctx.fill();
    this.drawVines(ctx, -w * 0.25, 6, h * 0.72);
    ctx.restore();
  },
  drawRubble(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    for (let i = 0; i < 7; i++) {
      const px = Math.cos(i * 1.7) * (18 + i * 4);
      const py = Math.sin(i * 1.1) * 18;
      ctx.fillStyle = i % 2 ? "#a9aa9a" : "#8f9388";
      ctx.strokeStyle = "rgba(51,59,55,0.32)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(px - 14, py - 10, 28 + (i % 3) * 8, 20 + (i % 2) * 8);
      ctx.fill();
      ctx.stroke();
    }
    this.drawGrassClump(ctx, 18, 18);
    ctx.restore();
  },
  drawVines(ctx, x, y, h) {
    ctx.strokeStyle = "#3f8a4d";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < 5; i++) ctx.lineTo(x + Math.sin(i * 1.2) * 12, y + h * (i + 1) / 5);
    ctx.stroke();
    ctx.fillStyle = "#57ad54";
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(i * 1.7) * 14, y + i * h / 6 + 8, 8, 4, i, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  drawGrassClump(ctx, x, y) {
    ctx.strokeStyle = "#4ea05a";
    ctx.lineWidth = 3;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 6, y);
      ctx.quadraticCurveTo(x + i * 7, y - 16 - Math.abs(i) * 2, x + i * 12, y - 26 + Math.abs(i) * 3);
      ctx.stroke();
    }
  },
  drawWarning(ctx, warning) {
    const progress = Math.max(0, Math.min(1, warning.life / warning.total));
    ctx.save();
    ctx.globalAlpha = 0.22 + (1 - progress) * 0.2;
    ctx.fillStyle = warning.color;
    ctx.strokeStyle = warning.color;
    ctx.lineWidth = 6 + (1 - progress) * 6;
    this.traceShape(ctx, warning.x, warning.y, warning.r, warning.shape);
    ctx.fill();
    ctx.globalAlpha = 0.88;
    this.traceShape(ctx, warning.x, warning.y, warning.r * (0.72 + progress * 0.28), warning.shape);
    ctx.stroke();
    ctx.restore();
  },
  drawProjectileShape(ctx, x, y, r, shape, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(36,49,63,0.18)";
    ctx.lineWidth = 3;
    this.traceShape(ctx, x, y, r, shape);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },
  traceShape(ctx, x, y, r, shape) {
    ctx.beginPath();
    if (shape === "square") {
      ctx.rect(x - r, y - r, r * 2, r * 2);
      return;
    }
    if (shape === "star") {
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r : r * 0.46;
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      return;
    }
    ctx.arc(x, y, r, 0, Math.PI * 2);
  },
  drawPlayer(ctx, p, ch) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "rgba(31,43,56,0.2)";
    ctx.beginPath();
    ctx.ellipse(0, 31, 32, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ch.accent || "#fffdf8";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-20, 4, 40, 34, 10);
    else ctx.rect(-20, 4, 40, 34);
    ctx.fill();
    ctx.strokeStyle = "rgba(31,43,56,0.22)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = ch.color;
    ctx.beginPath();
    ctx.arc(0, -11, 29, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.beginPath();
    ctx.arc(-10, -22, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-10, -14, 5, 0, Math.PI * 2);
    ctx.arc(10, -14, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#24313f";
    ctx.fillRect(-12, -14, 4, 7);
    ctx.fillRect(8, -14, 4, 7);
    ctx.strokeStyle = "#24313f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -5, 8, 0.15, Math.PI - 0.15);
    ctx.stroke();
    this.drawPlayerProp(ctx, ch);
    ctx.restore();
  },
  drawPlayerProp(ctx, ch) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (ch.prop === "sword") {
      ctx.save();
      ctx.rotate(0.55);
      ctx.fillStyle = "#f8fbff";
      ctx.strokeStyle = "#8392a3";
      ctx.lineWidth = 3;
      ctx.fillRect(17, -36, 8, 48);
      ctx.strokeRect(17, -36, 8, 48);
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(10, 6, 22, 7);
      ctx.restore();
    }
    if (ch.prop === "staff") {
      ctx.strokeStyle = "#7a5b3a";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(28, -38);
      ctx.lineTo(18, 34);
      ctx.stroke();
      ctx.fillStyle = "#fff2a6";
      ctx.beginPath();
      ctx.arc(29, -42, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ch.accent;
      ctx.beginPath();
      ctx.moveTo(-17, -24);
      ctx.lineTo(0, -56);
      ctx.lineTo(17, -24);
      ctx.fill();
    }
    if (ch.prop === "bow") {
      ctx.strokeStyle = "#7a4d2c";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(-27, -3, 31, -1.2, 1.2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(36,49,63,0.62)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-18, -31);
      ctx.lineTo(-18, 24);
      ctx.stroke();
    }
    if (ch.prop === "dagger") {
      ctx.fillStyle = "rgba(36,49,63,0.82)";
      ctx.fillRect(-15, -20, 30, 10);
      ctx.save();
      ctx.rotate(0.78);
      ctx.fillStyle = "#e8eef4";
      ctx.strokeStyle = "#6b7787";
      ctx.lineWidth = 3;
      ctx.fillRect(16, -6, 8, 33);
      ctx.strokeRect(16, -6, 8, 33);
      ctx.restore();
    }
    if (ch.prop === "shield") {
      ctx.fillStyle = "#f8fbff";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(31, 1);
      ctx.quadraticCurveTo(50, 5, 45, 33);
      ctx.quadraticCurveTo(31, 45, 17, 33);
      ctx.quadraticCurveTo(12, 5, 31, 1);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ch.accent;
      ctx.fillRect(30, 7, 12, 25);
    }
    if (ch.prop === "bolt") {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(23, -48);
      ctx.lineTo(42, -48);
      ctx.lineTo(31, -18);
      ctx.lineTo(45, -18);
      ctx.lineTo(15, 26);
      ctx.lineTo(23, -8);
      ctx.lineTo(10, -8);
      ctx.closePath();
      ctx.fill();
    }
    if (ch.prop === "flask") {
      ctx.fillStyle = "#da5d4d";
      ctx.beginPath();
      ctx.arc(-8, -31, 8, 0, Math.PI * 2);
      ctx.arc(7, -33, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.rotate(-0.22);
      ctx.fillStyle = "#e9fff1";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 4;
      ctx.fillRect(22, 0, 19, 28);
      ctx.strokeRect(22, 0, 19, 28);
      ctx.fillStyle = "#62c45c";
      ctx.fillRect(24, 13, 15, 13);
      ctx.restore();
    }
    if (ch.prop === "halo") {
      ctx.strokeStyle = "#fff7a8";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, -46, 18, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("+", 0, 33);
    }
  },
  drawEnemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = "rgba(36,49,63,0.14)";
    ctx.beginPath();
    ctx.ellipse(0, e.r * 0.85, e.r, e.r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    const bossType = e.bossType || BOSS_TYPES[0];
    ctx.fillStyle = e.boss ? bossType.color : "#b9e36c";
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
    if (e.boss) {
      ctx.fillStyle = bossType.accent;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.45, -e.r * 0.58);
      ctx.lineTo(-e.r * 0.18, -e.r * 1.04);
      ctx.lineTo(e.r * 0.08, -e.r * 0.58);
      ctx.lineTo(e.r * 0.34, -e.r * 1.04);
      ctx.lineTo(e.r * 0.58, -e.r * 0.58);
      ctx.fill();
    }
    ctx.fillStyle = "#24313f";
    ctx.beginPath();
    ctx.arc(-e.r * 0.32, -e.r * 0.1, e.r * 0.11, 0, Math.PI * 2);
    ctx.arc(e.r * 0.32, -e.r * 0.1, e.r * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#24313f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, e.r * 0.06, e.r * 0.3, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-e.r, -e.r - 10, e.r * 2, 5);
    ctx.fillStyle = "#ff5a68";
    ctx.fillRect(-e.r, -e.r - 10, e.r * 2 * Math.max(0, e.hp / e.maxHp), 5);
    if (e.boss) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(bossType.name, 0, -e.r - 20);
    }
    ctx.restore();
  },
  end(cleared) {
    if (!this.running) return;
    this.running = false;
    $("#gameScreen").classList.remove("volume-open");
    audio.setMusic("menu");
    const s = this.state;
    finishRun({
      characterId: s.characterId,
      cleared,
      score: Math.floor(s.score + s.t * 3),
      wave: s.wave,
      kills: s.kills,
      goldEarned: s.goldEarned,
      survivalTime: Math.floor(s.t),
      clearedDungeonCount: s.clearedDungeonCount,
      bossKilled: s.bossKilled,
      bossKillCount: s.bossKillCount,
      lightningPicks: s.lightningPicks,
      poisonKills: s.poisonKills,
      healing: s.healing
    });
  }
};

document.addEventListener("click", async event => {
  const target = event.target.closest("button");
  if (!target || !user) return;
  if (target.dataset.select) {
    if (user.characters[target.dataset.select].unlocked) user.selectedCharacter = target.dataset.select;
    renderHome();
  }
  if (target.dataset.unlock) {
    const ch = CHARACTERS.find(item => item.id === target.dataset.unlock);
    if (user.gold >= ch.forceCost) {
      user.gold -= ch.forceCost;
      user.characters[ch.id].unlocked = true;
      user.characters[ch.id].forcedUnlocked = true;
      renderHome();
    }
  }
  if (target.dataset.upgrade) {
    const state = user.characters[target.dataset.upgrade];
    const next = state.passiveLevel + 1;
    const cost = PASSIVE_COST[next];
    if (cost && user.gold >= cost) {
      user.gold -= cost;
      state.passiveLevel = next;
      renderHome();
    }
  }
  if (target.dataset.chest) {
    const chest = CHESTS.find(item => item.id === target.dataset.chest);
    if (user.gold >= chest.cost) {
      user.gold -= chest.cost;
      user.equipments.push(makeEquipment(chest.type, rollGrade(chest.odds)));
      renderHome();
    }
  }
  if (target.dataset.equip) {
    const eq = user.equipments.find(item => item.equipmentId === target.dataset.equip);
    if (eq && eq.characterId === user.selectedCharacter) {
      user.equipped[`${eq.characterId}_${eq.type}`] = eq.equipmentId;
      renderHome();
    }
  }
  if (target.dataset.special) {
    const eq = user.equipments.find(item => item.equipmentId === target.dataset.special);
    if (eq && eq.grade === "S" && user.gems >= 10) {
      user.gems -= 10;
      eq.specialEffectLocked = false;
      eq.specialEffectUnlocked = true;
      eq.specialEffectImplemented = false;
      renderHome();
    }
  }
});

document.addEventListener("keydown", event => {
  const movementKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"];
  if (movementKeys.includes(event.code)) {
    game.keys[event.code] = true;
    event.preventDefault();
  }
  if (!$("#cardModal").hidden && ["Digit1", "Digit2", "Digit3", "Numpad1", "Numpad2", "Numpad3"].includes(event.code)) {
    const index = Number(event.code.replace("Digit", "").replace("Numpad", "")) - 1;
    game.chooseCard(index);
    event.preventDefault();
  }
});

document.addEventListener("keyup", event => {
  const movementKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"];
  if (movementKeys.includes(event.code)) {
    game.keys[event.code] = false;
    event.preventDefault();
  }
});

window.addEventListener("resize", () => {
  if (game.running) requestAnimationFrame(() => game.resizeViewport());
});

window.addEventListener("orientationchange", () => {
  if (game.running) setTimeout(() => game.resizeViewport(), 180);
});

$("#googleLoginBtn").addEventListener("click", async () => {
  try {
    audio.setMusic("menu");
    user = await storage.signInGoogle();
    renderHome();
    showScreen("homeScreen");
  } catch (error) {
    console.error("Google sign-in failed:", error);
    const code = error?.code ? `\n\n오류 코드: ${error.code}` : "";
    const message = error?.message ? `\n${error.message}` : "";
    alert(`Google 로그인에 실패했습니다.${code}${message}\n\nFirebase Authentication에서 Google 로그인이 켜져 있는지, 승인된 도메인에 Netlify 주소가 추가되어 있는지 확인해주세요.`);
  }
});

$("#guestLoginBtn").addEventListener("click", async () => {
  audio.setMusic("menu");
  user = await storage.signInGuest();
  renderHome();
  showScreen("homeScreen");
});

$("#startRunBtn").addEventListener("click", startGame);
$("#pauseBtn").addEventListener("click", () => {
  if (!game.running || !$("#cardModal").hidden) return;
  game.paused = !game.paused;
  $("#pauseBtn").textContent = game.paused ? "▶" : "Ⅱ";
  $("#pauseBtn").classList.toggle("active", game.paused);
  $("#gameScreen").classList.toggle("volume-open", game.paused);
});
$("#speedBtn").addEventListener("click", () => {
  if (!game.running) return;
  game.speed = game.speed === 2 ? 1 : 2;
  $("#speedBtn").textContent = game.speed === 2 ? "x2" : "x1";
  $("#speedBtn").classList.toggle("active", game.speed === 2);
});
["#homeMusicVolume", "#gameMusicVolume"].forEach(selector => {
  const input = $(selector);
  if (input) {
    input.value = Math.round(audio.musicVolume * 100);
    input.addEventListener("input", event => audio.setMusicVolume(event.target.value));
  }
});
$("#nicknameForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!user) return;
  const input = $("#nicknameInput");
  const nextName = (input?.value || "").trim().slice(0, 12) || "동당탕탕용사";
  user.nickname = nextName;
  $("#nickname").textContent = nextName;
  if (input) input.value = nextName;
  await storage.save(user);
  renderRecords();
});
$("#refreshRankingBtn")?.addEventListener("click", () => {
  if (user) renderRankings();
});
$("#claimRewardBtn").addEventListener("click", async () => {
  audio.setMusic("menu");
  user.gold += lastResult.gold;
  updateUnlocks();
  await storage.save(user);
  renderHome();
  showScreen("homeScreen");
});

$$(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach(item => item.classList.toggle("active", item === tab));
    $$(".panel").forEach(panel => panel.classList.toggle("active", panel.id === tab.dataset.panel));
  });
});

restoreCachedSession();
