# 日语道场 · Nihongo Dojo

免费的日语学习网站，从五十音一直到 JLPT N1。打开即用，不需要注册。

**在线使用：** https://koshokai.github.io/nihonggo-dojo/

## 功能

- **假名**：平假名 / 片假名五十音图（清音、浊音、拗音），点击发音；假名识读测验
- **单词**：N5–N1 分级单词卡，间隔重复（SRS）自动安排复习；每个单词 3 个不同场景的例句（带中文翻译和朗读）；单词测验；可搜索的词表
- **汉字**：分级汉字的音读、训读、意思和相关单词；汉字测验
- **语法**：N5–N1 共 176 个句型，每个句型 4 句例句（带译文和朗读）；语法填空练习
- **词典**：查日语、假名、罗马字、中文或英文；JLPT 词有中文释义和例句，其余约 22,000 个常用词来自 JMdict（英文释义）；整句可跳转 Google / DeepL 翻译，并列出句中的词
- **闯关**：每关 10 个词、3 颗心、星级评价，每 10 关一个头目关；还有 60 秒冲刺和配对消除小游戏
- **模拟考**：每级 20 题、限时 15 分钟，交卷后批改并按题型给出正确率
- **错题本**：答错的题自动收集，订正后移出
- **坚持下去**：每日经验目标、连续打卡、学习热力图、段位、成就印章、每日一句日语谚语

学习进度保存在浏览器本地（localStorage），可以在「我的」页面下载备份、到新设备导入。

## 内容说明

- **单词**：JLPT N5–N1 共约 8,000 词。词表来自 [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks)（MIT），基于 [Jonathan Waller 的 JLPT 资料](http://www.tanos.co.uk/jlpt/)（CC BY）；中文释义由本项目编写（`tools/vocab/zh_n*.txt`），运行 `python3 tools/build_vocab.py` 生成 `vocab.js`。
- **词典**：`dict.json` 由 JMdict（[EDRDG](https://www.edrdg.org/)，CC BY-SA 4.0）生成，该文件按 CC BY-SA 4.0 发布；生成方法见 `tools/build_dict.py`。
- **汉字**：`kanji.js` 由 [kanji-data](https://github.com/davidluzgouveia/kanji-data)（MIT）生成，汉字信息来自 KANJIDIC（EDRDG，CC BY-SA 4.0）。
- **语法**：写在 `tools/grammar/N*.txt`，运行 `python3 tools/build_grammar.py` 生成 `grammar.js`。
- 中文释义和例句没有经过专业审核，发现错误欢迎提 issue。

## 例句和朗读

例句写在 `tools/examples_N5.txt` … `examples_N1.txt`，每行一句：`单词 | 日语例句 | 中文翻译`。
改完后运行下面的命令重新生成 `examples.js`，朗读用的假名会自动生成（助词按实际读音，避免浏览器把汉字读错）：

```bash
pip install fugashi unidic-lite
python3 tools/build_examples.py
```

## 本地运行

纯静态网页，直接用浏览器打开 `index.html` 即可，没有构建步骤。
