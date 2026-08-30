# 校园食堂随机推荐

这是一个适合初学者阅读的小网页练习：用 `foods.json` 保存菜品数据，用 JavaScript 根据筛选条件随机推荐菜品。

## 如何运行

`fetch()` 读取 JSON 文件时，浏览器通常不允许直接双击打开 `index.html`。请在本文件夹打开终端后运行：

```bash
python -m http.server 8000
```

接着在浏览器访问 `http://localhost:8000`。

## 文件说明

- `index.html`：页面结构和筛选下拉框。
- `style.css`：页面样式和手机端适配。
- `script.js`：读取数据、筛选菜品、随机推荐。
- `foods.json`：菜品数据；可以自行添加更多对象，字段格式保持一致即可。
