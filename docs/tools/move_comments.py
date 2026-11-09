# -*- coding: utf-8 -*-
"""
docs/*.md のコードフェンス内で、コードの「行末（横）」に書かれたコメントを
そのコードの「すぐ上の行」へ移動して統一するスクリプト。

- 対象は実コード言語のフェンスのみ: python/bash/powershell/javascript/typescript/tsx/jsx/ts/css
- 文字列・テンプレートリテラル・三連クォート・ブロックコメントの状態を追跡し、
  文字列内の # // /* や URL の // 、CSSのhex色などを誤ってコメント扱いしない
- 行頭（コードが無い）コメントは移動しない（すでに上に書かれている）
- ディレクトリツリー等（罫線文字を含む行）は触らない
使い方:  python docs/tools/move_comments.py [--apply]
省略時はドライラン（統計のみ表示）。
"""
import sys, os, glob, io

HASH_LANGS = {"python", "bash", "powershell", "sh", "shell"}
SLASH_LANGS = {"javascript", "typescript", "tsx", "jsx", "ts", "js"}
CSS_LANGS = {"css", "scss"}
TARGET = HASH_LANGS | SLASH_LANGS | CSS_LANGS

BOX = set("├└│─┌┐┘┬┴┼")


def find_trailing_comment_hash(line):
    """# 系言語: 文字列外で、前が空白(または行頭)の # を探す。戻り値=コメント開始index or -1"""
    in_s = None  # ' or "
    i = 0
    n = len(line)
    while i < n:
        c = line[i]
        if in_s:
            if c == "\\":
                i += 2
                continue
            if c == in_s:
                in_s = None
            i += 1
            continue
        if c in ("'", '"'):
            in_s = c
            i += 1
            continue
        if c == "#":
            # 行頭、または直前が空白のときのみコメントとみなす
            if i == 0 or line[i - 1] in (" ", "\t"):
                return i
        i += 1
    return -1


def find_trailing_comment_slash(line):
    """// 系言語: 文字列/テンプレート外の // または /* を探す。"""
    in_s = None
    i = 0
    n = len(line)
    while i < n:
        c = line[i]
        if in_s:
            if in_s != "`" and c == "\\":
                i += 2
                continue
            if c == in_s:
                in_s = None
            i += 1
            continue
        if c in ("'", '"', "`"):
            in_s = c
            i += 1
            continue
        if c == "/" and i + 1 < n:
            nxt = line[i + 1]
            if nxt == "/":
                # URL の :// は除外
                if i > 0 and line[i - 1] == ":":
                    i += 1
                    continue
                return i
            if nxt == "*":
                # JSXコメント {/* ... */} は { から1つの塊として移動する
                if i > 0 and line[i - 1] == "{":
                    return i - 1
                return i
        i += 1
    return -1


def find_trailing_comment_css(line):
    """css: 文字列外の /* を探す。"""
    in_s = None
    i = 0
    n = len(line)
    while i < n:
        c = line[i]
        if in_s:
            if c == "\\":
                i += 2
                continue
            if c == in_s:
                in_s = None
            i += 1
            continue
        if c in ("'", '"'):
            in_s = c
            i += 1
            continue
        if c == "/" and i + 1 < n and line[i + 1] == "*":
            if i > 0 and line[i - 1] == "{":
                return i - 1
            return i
        i += 1
    return -1


def process_file(path, apply):
    with io.open(path, "r", encoding="utf-8", newline="") as f:
        text = f.read()
    # 改行コードを保持
    nl = "\r\n" if "\r\n" in text else "\n"
    lines = text.split(nl)

    out = []
    in_fence = False
    lang = None
    # 複数行状態
    py_triple = None      # """ or '''
    js_template = False   # 未閉じのバッククォート
    block_comment = False # 未閉じの /* */
    moved = 0

    i = 0
    for raw in lines:
        stripped = raw.lstrip()
        # フェンス境界
        if stripped.startswith("```") or stripped.startswith("~~~"):
            if not in_fence:
                in_fence = True
                info = stripped[3:].strip().lower()
                lang = info.split()[0] if info else ""
                py_triple = None
                js_template = False
                block_comment = False
            else:
                in_fence = False
                lang = None
            out.append(raw)
            continue

        if not in_fence or lang not in TARGET:
            out.append(raw)
            continue

        line = raw
        # 罫線（ツリー）行は触らない
        if any(ch in BOX for ch in line):
            out.append(raw)
            continue

        # ---- 複数行ブロックの途中なら、その行ではコメント分割しない ----
        if block_comment:
            if "*/" in line:
                block_comment = False
            out.append(raw)
            continue
        if py_triple is not None:
            if py_triple in line:
                py_triple = None
            out.append(raw)
            continue
        if js_template:
            # バッククォートが奇数個あれば閉じる
            if line.count("`") % 2 == 1:
                js_template = False
            out.append(raw)
            continue

        # ---- コメント位置検出 ----
        if lang in HASH_LANGS:
            idx = find_trailing_comment_hash(line)
        elif lang in CSS_LANGS:
            idx = find_trailing_comment_css(line)
        else:
            idx = find_trailing_comment_slash(line)

        code_part = line[:idx] if idx >= 0 else line
        # コメント前にコードがある＝行末コメント。先頭が空白のみ＝全行コメント(移動しない)
        if idx >= 0 and code_part.strip() != "":
            comment = line[idx:].rstrip()
            # /* が含まれ */ で閉じていないブロックは移動対象外（複数行）
            if "/*" in comment and "*/" not in comment:
                # 上には移さず、状態だけ更新
                block_comment = True
                out.append(raw)
            else:
                indent = line[: len(line) - len(line.lstrip())]
                out.append(indent + comment)
                out.append(code_part.rstrip())
                moved += 1
        else:
            out.append(raw)

        # ---- この行の末尾で複数行状態に入るか判定（コメント除去後のコード部分で） ----
        scan = code_part if idx >= 0 else line
        # Python 三連クォート
        if lang in HASH_LANGS:
            pass  # bash/powershellは無視、pythonの三連は下で
        if lang == "python" or "python" in (lang,):
            for tq in ('"""', "'''"):
                # 単純判定：行内に奇数回出現で開く（同一行で閉じればチャラ）
                cnt = scan.count(tq)
                if cnt % 2 == 1:
                    py_triple = tq
                    break
        if lang in SLASH_LANGS:
            if scan.count("`") % 2 == 1:
                js_template = True
            if "/*" in scan and "*/" not in scan.split("/*", 1)[1]:
                block_comment = True
        if lang in CSS_LANGS:
            if "/*" in scan and "*/" not in scan.split("/*", 1)[1]:
                block_comment = True

    new_text = nl.join(out)
    if apply and new_text != text:
        with io.open(path, "w", encoding="utf-8", newline="") as f:
            f.write(new_text)
    return moved


def main():
    apply = "--apply" in sys.argv
    docs = os.path.join(os.path.dirname(__file__), "..")
    files = sorted(glob.glob(os.path.join(docs, "*.md")))
    total = 0
    for p in files:
        m = process_file(p, apply)
        total += m
        print("%4d  %s" % (m, os.path.basename(p)))
    print("---")
    print("合計移動コメント数: %d  (%s)" % (total, "適用済み" if apply else "ドライラン"))


if __name__ == "__main__":
    main()
