const result = document.querySelector("#result");
const recommendButton = document.querySelector("#recommendButton");
const campusSelect = document.querySelector("#campus");
const canteenSelect = document.querySelector("#canteen");
const typeOptions = document.querySelector("#typeOptions");
const messageForm = document.querySelector("#messageForm");
const messageInput = document.querySelector("#messageInput");
const messageList = document.querySelector("#messageList");
const ALL_VALUE = "all";
const DEFAULT_CAMPUS = "南校区";
const SELECTED_MEAL_KEY = "campusFoodPickerSelectedMeal";
const MESSAGES_KEY = "campusFoodPickerMessages";

let foods = [];
let lastRecommendedFood = null;

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

function getLocalDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function getMessages() {
  try {
    return JSON.parse(localStorage.getItem(MESSAGES_KEY)) || [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

function renderMessages() {
  const messages = getMessages();
  messageList.replaceChildren();

  messages.forEach((item) => {
    const card = document.createElement("article");
    const text = document.createElement("p");
    const time = document.createElement("time");
    card.className = "message-item";
    text.textContent = `📌 ${item.message}`;
    time.textContent = item.time;
    card.append(text, time);
    messageList.append(card);
  });
}

function saveMessage(event) {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  const messages = getMessages();
  messages.unshift({ message, time: getLocalDate() });
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  messageForm.reset();
  renderMessages();
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
initializePage();
renderMessages();
