"""将 foods.csv 转换为供网页使用的 foods.json。

运行方式：python csv_to_json.py
"""

import csv
import json
import math
import sys
from pathlib import Path


REQUIRED_FIELDS = ("school", "campus", "canteen", "name", "price", "type")
CSV_FIELDS = REQUIRED_FIELDS + ("floor",)
TEXT_FIELDS = ("school", "campus", "canteen", "name", "type")
BASE_DIR = Path(__file__).resolve().parent
CSV_FILE = BASE_DIR / "foods.csv"
JSON_FILE = BASE_DIR / "foods.json"


def is_blank_row(row):
    """CSV 中所有单元格都是空白时，忽略这一行。"""
    return not any(str(value or "").strip() for value in row.values())


def convert_price(raw_price):
    """把价格转换为正数；整数价格使用 int，小数价格使用 float。"""
    try:
        price = float(raw_price)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(price) or price <= 0:
        return None

    return int(price) if price.is_integer() else price


def read_and_validate_csv():
    """读取 CSV 并收集错误；只有没有错误时才返回菜品列表。"""
    if not CSV_FILE.exists():
        print(f"❌ 找不到文件：{CSV_FILE.name}")
        return None

    errors = []
    foods = []

    with CSV_FILE.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        headers = reader.fieldnames or []
        missing_headers = [field for field in CSV_FIELDS if field not in headers]

        if missing_headers:
            print(f"❌ CSV 缺少必填表头：{', '.join(missing_headers)}")
            return None

        # DictReader 的第一行数据在 CSV 的第 2 行，因此行号从 2 开始。
        for line_number, row in enumerate(reader, start=2):
            if is_blank_row(row):
                continue

            food = {}
            missing_fields = []

            # 先处理必填文本字段，并去除用户容易误输入的首尾空格。
            for field in TEXT_FIELDS:
                value = (row.get(field) or "").strip()
                if not value:
                    missing_fields.append(field)
                else:
                    food[field] = value

            raw_price = (row.get("price") or "").strip()
            price = convert_price(raw_price)
            if not raw_price:
                missing_fields.append("price")
            elif price is None:
                errors.append(f"❌ 第 {line_number} 行（{row.get('name') or '未命名菜品'}）：price 必须是大于 0 的数字，当前值：{raw_price!r}")
            else:
                food["price"] = price

            if missing_fields:
                errors.append(f"❌ 第 {line_number} 行（{row.get('name') or '未命名菜品'}）：必填字段为空：{', '.join(missing_fields)}")

            # floor 的表头必须存在，但楼层本身允许为空，并保留为空字符串。
            food["floor"] = (row.get("floor") or "").strip()

            # 保留 CSV 的其他列，例如 description、emoji，供网页继续使用。
            for field, value in row.items():
                if field and field not in REQUIRED_FIELDS and field != "floor":
                    food[field] = value

            if not missing_fields and price is not None:
                foods.append(food)

    if errors:
        print("转换失败，foods.json 未生成：")
        print("\n".join(errors))
        return None

    return foods


def main():
    foods = read_and_validate_csv()
    if foods is None:
        return 1

    # 所有数据通过校验后，才一次性写入 JSON，避免错误数据覆盖原文件。
    with JSON_FILE.open("w", encoding="utf-8", newline="") as file:
        json.dump(foods, file, ensure_ascii=False, indent=2)
        file.write("\n")

    print(f"成功转换 {len(foods)} 道菜：foods.csv -> foods.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
