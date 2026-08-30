const result = document.querySelector("#result");
const recommendButton = document.querySelector("#recommendButton");

// foods.json 中的数据会在页面打开时读取一次，之后每次推荐都直接使用它。
let foods = [];

async function loadFoods() {
  try {
    const response = await fetch("foods.json");
    if (!response.ok) throw new Error("菜品数据读取失败");
    foods = await response.json();
  } catch (error) {
    showMessage("😵", "菜品数据没有加载成功", "请使用本地服务器打开页面后再试。", true);
    console.error(error);
  }
}

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

function getFilteredFoods() {
  const campus = document.querySelector("#campus").value;
  const budget = Number(document.querySelector("#budget").value);
  const spicyLevel = document.querySelector("#spicyLevel").value;
  const type = document.querySelector("#type").value;

  // every 条件都满足的菜品才会被保留下来。
  return foods.filter((food) =>
    (campus === "all" || food.campus === campus) &&
    food.price <= budget &&
    (spicyLevel === "all" || food.spicyLevel === spicyLevel) &&
    (type === "all" || food.type === type)
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
loadFoods();
