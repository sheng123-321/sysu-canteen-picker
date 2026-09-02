"""校验校园食堂菜品数据的基础质量。

运行方式：python validate_foods.py
"""

import json
import sys
from pathlib import Path


REQUIRED_FIELDS = ("school", "campus", "canteen", "name", "price", "type")
DATA_FILE = Path(__file__).resolve().with_name("foods.json")


def is_empty(value):
    """None 和空白字符串都视为缺失。"""
    return value is None or (isinstance(value, str) and not value.strip())


def food_label(index, food):
    """为输出准备统一的菜品定位信息，便于回到 JSON 修改。"""
    name = food.get("name") or "未命名菜品"
    return f"[下标 {index}｜{name}]"


def load_foods():
    """读取并确认 foods.json 的最外层是一个数组。"""
    try:
        with DATA_FILE.open("r", encoding="utf-8") as file:
            foods = json.load(file)
    except FileNotFoundError:
        print(f"❌ 找不到数据文件：{DATA_FILE}")
        return None
    except json.JSONDecodeError as error:
        print(f"❌ JSON 格式错误：第 {error.lineno} 行，第 {error.colno} 列：{error.msg}")
        return None

    if not isinstance(foods, list):
        print("❌ foods.json 最外层必须是数组，例如：[{...}, {...}]")
        return None
    return foods


def validate_foods(foods):
    """检查所有菜品，并返回各类问题的菜品下标集合。"""
    missing_required = set()
    invalid_price = set()
    duplicate_items = set()
    unusual_price = set()
    all_issue_items = set()
    seen_foods = {}

    for index, food in enumerate(foods):
        if not isinstance(food, dict):
            print(f"❌ [下标 {index}] 菜品必须是对象，当前是 {type(food).__name__}")
            missing_required.add(index)
            all_issue_items.add(index)
            continue

        label = food_label(index, food)
        # floor 是可选字段：缺失、None 或空字符串都不产生错误。
        floor = food.get("floor", "")
        if floor is None:
            floor = ""

        missing_fields = [field for field in REQUIRED_FIELDS if is_empty(food.get(field))]
        if missing_fields:
            print(f"❌ {label} 缺少必填字段：{', '.join(missing_fields)}")
            missing_required.add(index)
            all_issue_items.add(index)

        price = food.get("price")
        # bool 在 Python 中属于 int 的子类，所以需要单独排除。
        if not is_empty(price) and (isinstance(price, bool) or not isinstance(price, (int, float)) or price <= 0):
            print(f"❌ {label} price 必须是大于 0 的数字，当前值：{price!r}")
            invalid_price.add(index)
            all_issue_items.add(index)
        elif isinstance(price, (int, float)) and not isinstance(price, bool) and price > 100:
            print(f"⚠️ {label} 价格可能异常：{price}")
            unusual_price.add(index)
            all_issue_items.add(index)

        duplicate_fields = ("school", "campus", "canteen", "name")
        if not any(is_empty(food.get(field)) for field in duplicate_fields):
            duplicate_key = tuple(food[field] for field in duplicate_fields)
            if duplicate_key in seen_foods:
                first_index = seen_foods[duplicate_key]
                print(f"⚠️ {label} 疑似重复：与下标 {first_index} 的 school + campus + canteen + name 相同")
                duplicate_items.add(index)
                all_issue_items.add(index)
            else:
                seen_foods[duplicate_key] = index

    normal_count = len(foods) - len(all_issue_items)
    print("\n--- 校验汇总 ---")
    print(f"共检查 {len(foods)} 道菜")
    print(f"✅ 正常：{normal_count}")
    print(f"❌ 缺少必填字段：{len(missing_required)}")
    print(f"❌ 价格格式/数值错误：{len(invalid_price)}")
    print(f"⚠️ 疑似重复：{len(duplicate_items)}")
    print(f"⚠️ 价格异常：{len(unusual_price)}")

    # 只有错误（不是警告）时返回非 0 状态码，方便未来接入自动化流程。
    return 1 if missing_required or invalid_price else 0


def main():
    foods = load_foods()
    if foods is None:
        return 1
    return validate_foods(foods)


if __name__ == "__main__":
    sys.exit(main())
