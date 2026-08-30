const result = document.querySelector("#result");
const recommendButton = document.querySelector("#recommendButton");
const campusSelect = document.querySelector("#campus");
const canteenSelect = document.querySelector("#canteen");
const typeOptions = document.querySelector("#typeOptions");
const ALL_VALUE = "all";

let foods = [];

function showMessage(emoji, title, description, isEmpty = false, detailHtml = "") {
  result.classList.toggle("empty-state", isEmpty);
  result.innerHTML = `
    <div class="food-emoji">${emoji}</div>
    <p class="result-label">${isEmpty ? "换个条件试试" : "今日推荐"}</p>
    <h2>${title}</h2>
    <p class="result-description">${description}</p>
    ${detailHtml}
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
  const noSpicy = document.querySelector("#noSpicy").checked;
  const type = document.querySelector('input[name="type"]:checked').value;

  // 这里仅处理校区、食堂、预算、不吃辣、类型五类筛选。
  return foods.filter((food) =>
    (campus === ALL_VALUE || food.campus === campus) &&
    (canteen === ALL_VALUE || food.canteen === canteen) &&
    (budget === "" || food.price <= Number(budget)) &&
    (!noSpicy || food.spicyLevel === "不辣") &&
    (type === ALL_VALUE || food.type === type)
  );
}

function recommendFood() {
  const matches = getFilteredFoods();

  if (matches.length === 0) {
    showMessage("🫠", "这次没有匹配的菜", "可以试着提高预算，或放宽一点筛选条件。", true);
    return;
  }

  // Math.random() 会产生 0 到 1 之间的小数，用它随机取得数组中的一个菜品。
  const randomIndex = Math.floor(Math.random() * matches.length);
  const food = matches[randomIndex];
  const detailHtml = `
    <div class="food-details">
      <span>${food.campus}</span><span>${food.type}</span>
      <span>${food.spicyLevel}</span><span>¥ ${food.price}</span>
    </div>`;

  showMessage(food.emoji, food.name, food.description, false, detailHtml);
}

recommendButton.addEventListener("click", recommendFood);
campusSelect.addEventListener("change", renderCanteenOptions);
initializePage();
