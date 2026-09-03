const result = document.querySelector("#result");
const recommendButton = document.querySelector("#recommendButton");
const campusSelect = document.querySelector("#campus");
const canteenSelect = document.querySelector("#canteen");
const typeOptions = document.querySelector("#typeOptions");
const messageForm = document.querySelector("#messageForm");
const messageInput = document.querySelector("#messageInput");
const messageList = document.querySelector("#messageList");
const messageStatus = document.querySelector("#messageStatus");
const ALL_VALUE = "all";
const DEFAULT_CAMPUS = "南校区";
const SELECTED_MEAL_KEY = "campusFoodPickerSelectedMeal";
const LAST_MESSAGE_SENT_AT_KEY = "campusFoodPickerLastMessageSentAt";
const MESSAGE_RATE_LIMIT_MS = 60 * 1000;
// 基础留言词库：覆盖广告引流、诈骗风险、粗俗辱骂和明显违规内容。
// 英文词会在 containsBlockedWord() 中自动按不区分大小写的方式匹配。
const BLOCKED_WORDS = [
  // 广告、推广与引流
  "广告", "推广", "兼职", "刷单", "代理", "加盟", "加微信", "加vx", "加v", "微信号", "加qq", "qq号", "联系方式", "私聊我", "扫码加入", "进群", "引流", "全网最低",
  // 诈骗与高风险交易
  "诈骗", "骗钱", "转账", "刷信誉", "刷信用", "赌博", "博彩", "投注", "六合彩", "高利贷", "非法集资", "洗钱", "裸聊", "色情服务",
  // 不文明辱骂（不包含针对特定群体的攻击性词汇）
  "傻逼", "煞笔", "脑残", "废物", "狗东西", "滚蛋", "去死", "妈的", "他妈的", "操你", "fuck", "shit",
  // 明显违规内容
  "毒品", "卖毒", "枪支", "卖枪", "爆炸物", "制作炸弹", "儿童色情",
];
const SUPABASE_URL = "https://totishqeeuwjepwiupuj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvdGlzaHFlZXV3amVwd2l1cHVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMjcxMzgsImV4cCI6MjEwMzgwMzEzOH0.LchFGqYPuL3pI9BkIFo-PzJn7J8PD4oJeigpKiK4lOw";
// 留言区不再提供前端登录，因此忽略浏览器中可能遗留的管理员 session，始终以 anon 身份请求。
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

let foods = [];
let lastRecommendedFood = null;
let messageChannel = null;

function showMessage(emoji, title, description, isEmpty = false, detailHtml = "", actionHtml = "") {
  result.classList.toggle("empty-state", isEmpty);
  const descriptionHtml = description ? `<p class="result-description">${description}</p>` : "";

  result.innerHTML = `
    <div class="food-emoji">${emoji}</div>
    <p class="result-label">${isEmpty ? "换个条件试试" : "今日推荐"}</p>
    <h2>${title}</h2>
    ${descriptionHtml}
    ${detailHtml}
    ${actionHtml}
  `;
}

function getUniqueValues(fieldName, data = foods) {
  // Set 会自动去重；具体名称始终从 foods.json 中读取。
  return [...new Set(data.map((food) => food[fieldName]).filter(Boolean))];
}

function createQuickOption(name, value, text, isSelected = false) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  const textSpan = document.createElement("span");

  label.className = "quick-option";
  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = isSelected;
  textSpan.textContent = text;

  label.append(input, textSpan);
  return label;
}

function renderCampusOptions() {
  campusSelect.replaceChildren(new Option("全部校区", ALL_VALUE));

  getUniqueValues("campus").forEach((campus) => {
    campusSelect.add(new Option(campus, campus));
  });

  // 当前版本优先展示南校区；以后数据中没有该校区时会自然回退到“全部校区”。
  if ([...campusSelect.options].some((option) => option.value === DEFAULT_CAMPUS)) {
    campusSelect.value = DEFAULT_CAMPUS;
  }
}

function formatMessageDate(createdAt) {
  return new Date(createdAt).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function setMessageStatus(text = "") {
  messageStatus.textContent = text;
}

function getRemainingMessageWaitSeconds() {
  try {
    const lastSentAt = Number(localStorage.getItem(LAST_MESSAGE_SENT_AT_KEY));
    const remainingMs = lastSentAt + MESSAGE_RATE_LIMIT_MS - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  } catch (error) {
    // localStorage 不可用时不阻断正常留言，只跳过本地频率限制。
    console.warn("无法读取留言频率记录：", error);
    return 0;
  }
}

function containsBlockedWord(message) {
  const normalizedMessage = message.toLowerCase();
  return BLOCKED_WORDS.some((word) => word && normalizedMessage.includes(word.toLowerCase()));
}

async function loadMessages() {
  const { data: messages, error } = await supabaseClient
    .from("messages")
    .select("content, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("读取留言失败：", error);
    return;
  }

  messageList.replaceChildren();

  messages.forEach((item) => {
    const card = document.createElement("article");
    const text = document.createElement("p");
    const time = document.createElement("time");
    card.className = "message-item";
    text.textContent = `📌 ${item.content}`;
    time.textContent = formatMessageDate(item.created_at);
    card.append(text, time);
    messageList.append(card);
  });
}

async function saveMessage(event) {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  if (containsBlockedWord(message)) {
    setMessageStatus("留言包含不适宜内容，请修改后再发布。");
    return;
  }

  const remainingSeconds = getRemainingMessageWaitSeconds();
  if (remainingSeconds > 0) {
    setMessageStatus(`请在 ${remainingSeconds} 秒后再发布留言。`);
    return;
  }

  const { error } = await supabaseClient.from("messages").insert({ content: message });
  if (error) {
    console.error("发布留言失败：", error);
    setMessageStatus("发布失败，请稍后再试。");
    return;
  }

  messageForm.reset();
  try {
    // 仅在 Supabase 写入成功后记录时间，失败不会消耗发布次数。
    localStorage.setItem(LAST_MESSAGE_SENT_AT_KEY, String(Date.now()));
  } catch (error) {
    console.warn("无法保存留言频率记录：", error);
  }
  setMessageStatus("留言已发布。");
}

function subscribeToMessages() {
  if (messageChannel) return;

  messageChannel = supabaseClient
    .channel("messages-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, loadMessages)
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, loadMessages)
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") console.error("留言实时连接失败。");
    });
}

async function removeMessagesSubscription() {
  if (!messageChannel) return;
  const channel = messageChannel;
  messageChannel = null;
  await supabaseClient.removeChannel(channel);
}

function renderCanteenOptions() {
  const selectedCampus = campusSelect.value;
  const campusFoods = selectedCampus === ALL_VALUE
    ? foods
    : foods.filter((food) => food.campus === selectedCampus);

  // 每次校区变化都重建食堂下拉框，因此会自动回到“全部食堂”。
  canteenSelect.replaceChildren(new Option("全部食堂", ALL_VALUE));
  getUniqueValues("canteen", campusFoods).forEach((canteen) => {
    canteenSelect.add(new Option(canteen, canteen));
  });
}

function renderTypeOptions() {
  typeOptions.replaceChildren(createQuickOption("type", ALL_VALUE, "随便", true));

  getUniqueValues("type").forEach((type) => {
    typeOptions.append(createQuickOption("type", type, type));
  });
}

function createFilterControls() {
  renderCampusOptions();
  renderCanteenOptions();
  renderTypeOptions();
}

async function initializePage() {
  try {
    // 初始化顺序：读取 JSON → 保存菜品 → 校区 → 食堂 → 类型 → 启用推荐。
    const response = await fetch("foods.json");
    if (!response.ok) throw new Error("菜品数据读取失败");

    foods = await response.json();
    createFilterControls();
    recommendButton.disabled = false;
  } catch (error) {
    showMessage("😵", "菜品数据没有加载成功", "请使用本地服务器打开页面后再试。", true);
    console.error(error);
  }
}

function getFilteredFoods() {
  const campus = campusSelect.value;
  const canteen = canteenSelect.value;
  const budget = document.querySelector('input[name="budget"]:checked').value;
  const type = document.querySelector('input[name="type"]:checked').value;

  // 这里仅处理校区、食堂、预算、类型四类筛选。
  return foods.filter((food) =>
    (campus === ALL_VALUE || food.campus === campus) &&
    (canteen === ALL_VALUE || food.canteen === canteen) &&
    (budget === "" || food.price <= Number(budget)) &&
    (type === ALL_VALUE || food.type === type)
  );
}

function showFoodRecommendation(food) {
  const emoji = typeof food.emoji === "string" && food.emoji.trim() ? food.emoji : "🍽️";
  const description = typeof food.description === "string" ? food.description.trim() : "";
  const floorTag = typeof food.floor === "string" && food.floor.trim()
    ? `<span>${food.floor.trim()}</span>`
    : "";
  const detailHtml = `
    <div class="food-details">
      <span>${food.campus}</span><span>${food.canteen}</span>
      ${floorTag}<span>${food.type}</span>
      <span>¥ ${food.price}</span>
    </div>`;
  const actionHtml = `
    <div class="result-actions">
      <button class="result-button result-button--secondary" type="button" data-result-action="another">换一个</button>
      <button class="result-button" type="button" data-result-action="choose">就吃这个</button>
    </div>`;

  showMessage(emoji, food.name, description, false, detailHtml, actionHtml);
}

function recommendFood() {
  const matches = getFilteredFoods();

  if (matches.length === 0) {
    showMessage("🫠", "这次没有匹配的菜", "可以试着提高预算，或放宽一点筛选条件。", true);
    return;
  }

  // 匹配结果超过一道时，先排除上一次推荐，避免连续出现同一道菜。
  const candidates = matches.length > 1
    ? matches.filter((food) => food !== lastRecommendedFood)
    : matches;
  const randomIndex = Math.floor(Math.random() * candidates.length);
  const food = candidates[randomIndex];

  lastRecommendedFood = food;
  showFoodRecommendation(food);
}

function saveSelectedFood() {
  if (!lastRecommendedFood) return;

  const selectedMeal = {
    name: lastRecommendedFood.name,
    school: lastRecommendedFood.school,
    campus: lastRecommendedFood.campus,
    canteen: lastRecommendedFood.canteen,
    price: lastRecommendedFood.price,
    selectedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(SELECTED_MEAL_KEY, JSON.stringify(selectedMeal));
    showMessage("✅", "已记下，今天就吃这个！", `${selectedMeal.name}，祝你吃得开心。`);
  } catch (error) {
    showMessage("😵", "暂时没能记下选择", "请检查浏览器是否允许使用本地存储后再试。", true);
    console.error(error);
  }
}

recommendButton.addEventListener("click", recommendFood);
campusSelect.addEventListener("change", renderCanteenOptions);
messageForm.addEventListener("submit", saveMessage);
result.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-result-action]");
  if (!actionButton) return;

  if (actionButton.dataset.resultAction === "another") recommendFood();
  if (actionButton.dataset.resultAction === "choose") saveSelectedFood();
});

window.addEventListener("pagehide", () => {
  removeMessagesSubscription();
});

initializePage();
loadMessages();
subscribeToMessages();
