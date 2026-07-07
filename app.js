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
  { id: "spark_weapon", name: "반짝 무기 상자", type: "weapon", cost: 1000, odds: { A: 6, B: 20, C: 34, D: 40 } },
  { id: "legend_weapon", name: "전설 무기 상자", type: "weapon", cost: 1500, odds: { S: 2, A: 8, B: 20, C: 30, D: 40 } },
  { id: "spark_armor", name: "반짝 갑옷 상자", type: "armor", cost: 1000, odds: { A: 6, B: 20, C: 34, D: 40 } },
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
const VIEW_H = 1280;
const WORLD_W = VIEW_W * 3;
const WORLD_H = VIEW_H * 3;

const STORAGE_KEY = "ddrpg_user_v1";
let user = null;
let lastResult = null;
let enemySeq = 0;

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

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
    gold: 0,
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
  const snapshot = await firestoreSdk.getDoc(userRef);
  return snapshot.exists() ? normalizeUser(snapshot.data(), profile) : blankUser(profile);
}

const storage = {
  async signInGuest() {
    return loadCachedUser() || blankUser();
  },
  async signInGoogle() {
    const services = await getFirebaseServices();
    const result = await services.authSdk.signInWithPopup(services.firebaseAuth, services.googleProvider);
    const data = await loadFirebaseUser(result.user, services);
    await this.save(data);
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

function renderHome() {
  updateUnlocks();
  $("#nickname").textContent = user.nickname;
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
}

function startGame() {
  game.start(user.selectedCharacter);
  showScreen("gameScreen");
}

function rewardFor(result) {
  const dungeonBonus = result.clearedDungeonCount >= 3 ? 220 : result.clearedDungeonCount === 2 ? 120 : result.clearedDungeonCount === 1 ? 50 : 0;
  return 100 + dungeonBonus + (result.bossKilled ? 150 : 0) + (result.newBest ? 200 : 0);
}

function finishRun(result) {
  lastResult = result;
  user.totalPlayCount++;
  user.progress.totalKills += result.kills;
  user.progress.bossKills += result.bossKilled ? 1 : 0;
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
    const passive = user.characters[characterId].passiveLevel;
    const ch = CHARACTERS.find(item => item.id === characterId);
    this.state = {
      characterId,
      ch,
      t: 0,
      score: 0,
      wave: 1,
      kills: 0,
      level: 1,
      xp: 0,
      xpNeed: 5,
      bossKilled: false,
      clearedDungeonCount: 0,
      poisonKills: 0,
      healing: 0,
      lightningPicks: 0,
      world: { w: WORLD_W, h: WORLD_H },
      camera: { x: WORLD_W / 2 - VIEW_W / 2, y: WORLD_H / 2 - VIEW_H / 2 },
      player: { x: WORLD_W / 2, y: WORLD_H / 2, r: 24, hp: 100 + (ch.id === "knight_01" ? passive * 10 : 0), maxHp: 100 + (ch.id === "knight_01" ? passive * 10 : 0), inv: 0 },
      enemies: [],
      shots: [],
      pops: [],
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
      cardLevels: {}
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
    requestAnimationFrame(ts => this.loop(ts));
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
    if (!this.paused) this.update(dt);
    this.draw();
    requestAnimationFrame(next => this.loop(next));
  },
  update(dt) {
    const s = this.state;
    s.t += dt;
    s.wave = 1 + Math.floor(s.t / 35);
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
    this.updateEnemies(dt);
    s.pops = s.pops.filter(pop => (pop.life -= dt) > 0);
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
    const boss = !s.bossKilled && s.t > 95;
    s.enemies.push({
      id: ++enemySeq,
      x: pos.x,
      y: pos.y,
      r: boss ? 42 : 20 + Math.random() * 8,
      hp: boss ? 180 + s.wave * 22 : 22 + s.wave * 5,
      maxHp: boss ? 180 + s.wave * 22 : 22 + s.wave * 5,
      speed: boss ? 45 : 58 + Math.random() * 20,
      boss,
      poison: 0
    });
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
        p.hp -= enemy.boss ? 22 : 11;
        p.inv = s.invDuration;
        s.timeSinceDamage = 0;
      }
    });
    s.enemies = s.enemies.filter(enemy => {
      if (enemy.hp > 0) return true;
      this.killEnemy(enemy);
      return false;
    });
  },
  damageEnemy(enemy, damage, type, dot = false) {
    const s = this.state;
    if (type === "poison" && Math.random() < 0.45 + s.statusChance) enemy.poison = 4;
    const finalDamage = damage * s.damageMultiplier * (enemy.boss ? 1 + s.bossDamage : 1);
    enemy.hp -= finalDamage;
    if (!dot) s.pops.push({ x: enemy.x, y: enemy.y, text: Math.round(finalDamage), life: 0.45 });
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
    s.xp += enemy.boss ? 6 : 1;
    if (s.lifeSteal > 0 && s.player.hp < s.player.maxHp) {
      const healed = Math.min(s.player.maxHp - s.player.hp, s.lifeSteal);
      s.player.hp += healed;
      s.healing += healed;
    }
    if (enemy.boss) s.bossKilled = true;
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
    const available = SKILL_CARDS.filter(card =>
      (this.state.cardLevels[card.id] || 0) < CARD_MAX_LEVEL &&
      canOfferCard(card, this.state.cardLevels)
    );
    if (!available.length) {
      this.paused = false;
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
  },
  updateHud() {
    const s = this.state;
    $("#waveHud").textContent = `Wave ${s.wave}`;
    $("#timeHud").textContent = fmtTime(s.t);
    $("#hpHud").textContent = `HP ${Math.max(0, Math.ceil(s.player.hp))}/${Math.ceil(s.player.maxHp)}`;
    $("#killHud").textContent = `${s.kills} 처치`;
    $("#xpBar").style.width = `${Math.min(100, s.xp / s.xpNeed * 100)}%`;
  },
  draw() {
    const ctx = this.ctx;
    const s = this.state;
    this.updateCamera();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#97dfc9";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#7fcfaf";
    ctx.save();
    ctx.translate(-s.camera.x, -s.camera.y);
    const startY = Math.floor(s.camera.y / 130) * 130;
    const endY = s.camera.y + VIEW_H + 130;
    const startX = Math.floor(s.camera.x / 120) * 120;
    const endX = s.camera.x + VIEW_W + 120;
    for (let y = startY; y < endY; y += 130) {
      for (let x = startX; x < endX; x += 120) {
        ctx.beginPath();
        ctx.ellipse(x + ((y / 130) % 2) * 35, y, 26, 10, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "rgba(36,49,63,0.1)";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, s.world.w - 8, s.world.h - 8);
    s.enemies.forEach(e => this.drawEnemy(ctx, e));
    s.shots.forEach(shot => {
      ctx.fillStyle = shot.color;
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
      ctx.fill();
    });
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
        ctx.fillStyle = "#24313f";
        ctx.font = "bold 22px system-ui";
        ctx.fillText(pop.text, pop.x, pop.y - (0.45 - pop.life) * 45);
      }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    if (this.paused && $("#cardModal").hidden) {
      ctx.fillStyle = "rgba(36,49,63,0.42)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 54px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("PAUSE", VIEW_W / 2, VIEW_H / 2 - 20);
    }
  },
  drawPlayer(ctx, p, ch) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "rgba(36,49,63,0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 26, 28, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ch.color;
    ctx.beginPath();
    ctx.arc(0, -8, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-9, -12, 5, 0, Math.PI * 2);
    ctx.arc(9, -12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#24313f";
    ctx.fillRect(-12, -12, 5, 6);
    ctx.fillRect(7, -12, 5, 6);
    ctx.fillStyle = ch.accent || "#fffdf8";
    ctx.fillRect(-16, 14, 32, 24);
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
    ctx.fillStyle = e.boss ? "#ff7c8a" : "#b9e36c";
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.restore();
  },
  end(cleared) {
    if (!this.running) return;
    this.running = false;
    const s = this.state;
    finishRun({
      characterId: s.characterId,
      cleared,
      score: Math.floor(s.score + s.t * 3),
      wave: s.wave,
      kills: s.kills,
      survivalTime: Math.floor(s.t),
      clearedDungeonCount: s.clearedDungeonCount,
      bossKilled: s.bossKilled,
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

$("#googleLoginBtn").addEventListener("click", async () => {
  try {
    user = await storage.signInGoogle();
    renderHome();
    showScreen("homeScreen");
  } catch (error) {
    console.error("Google sign-in failed:", error);
    alert("Google 로그인에 실패했습니다. Firebase Authentication에서 Google 로그인을 켜고, Firestore Database를 만든 뒤 다시 시도해주세요.");
  }
});

$("#guestLoginBtn").addEventListener("click", async () => {
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
});
$("#speedBtn").addEventListener("click", () => {
  if (!game.running) return;
  game.speed = game.speed === 2 ? 1 : 2;
  $("#speedBtn").textContent = game.speed === 2 ? "x2" : "x1";
  $("#speedBtn").classList.toggle("active", game.speed === 2);
});
$("#claimRewardBtn").addEventListener("click", async () => {
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
