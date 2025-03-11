import unicodedata





# 半角文字入力チェック関数
def has_non_halfwidth_characters(input_string):
  for char in input_string:
    # Unicodeの文字幅カテゴリ 'Na' は「ナロー（半角）」を意味します。
    if unicodedata.east_asian_width(char) != 'Na':
      # 全角文字かそれ以外（例: 全角スペース、絵文字など）が検出されたらTrueを返す
      return True

    return False