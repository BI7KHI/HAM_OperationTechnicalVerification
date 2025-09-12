import csv
import os
import re
from typing import Dict, List, Optional

from pdfminer.high_level import extract_text

# 解析题目块，返回一个题目的字典
# 预期字段：J(题号)、P(分值/类别?)、I(难度/类型?)、Q(问题)、T(正确选项)、A/B/C/D(选项内容)
# 实际 PDF 的文本格式可能略有差异，此解析器尽量兼容常见样式：
# 1) 每题以如 "[J] 123" 或 "J:123" 或 "J 123" 起始
# 2) [Q] 问题常为多行文字，直到出现下一个标签或选项
# 3) 选项以 A. / A) / [A] / A、 等多种形式出现
# 4) 正确答案以 [T] A 或 T: A 的形式

QUESTION_START_RE = re.compile(r"^\s*\[J\]\s*(\S+)|^\s*J[:：\s]+(\S+)", re.MULTILINE)
FIELD_RE = re.compile(r"^\s*\[(J|P|I|Q|T)\]\s*(.*)$", re.MULTILINE)
OPTION_RE = re.compile(r"^\s*\[([ABCD])\]\s*(.*)$", re.MULTILINE)
# 兼容 A. 文本
OPTION_ALT_RE = re.compile(r"^\s*([ABCD])[\.|、\)]\s*(.*)$", re.MULTILINE)
T_FIELD_RE = re.compile(r"^\s*(?:\[T\]|T[:：])\s*([ABCD])\b", re.MULTILINE)


def split_questions_by_J(lines: List[str]) -> List[List[str]]:
    blocks: List[List[str]] = []
    current: List[str] = []
    for ln in lines:
        # 只要检测到题号起始就切分（支持 [J] 后为任意非空白ID，如 LK1039）
        if QUESTION_START_RE.search(ln):
            if current:
                blocks.append(current)
                current = []
        current.append(ln)
    if current:
        blocks.append(current)
    return blocks


def parse_block(block: List[str]) -> Optional[Dict[str, str]]:
    data: Dict[str, str] = {k: "" for k in ["J", "P", "I", "Q", "T", "A", "B", "C", "D"]}

    # 收集多行字段内容（尤其是Q与选项可能换行）
    current_field: Optional[str] = None

    def append_to(field: str, text: str):
        if text is None:
            return
        text = text.strip()
        if not text:
            return
        if data[field]:
            data[field] += " " + text
        else:
            data[field] = text

    for raw in block:
        line = raw.strip()
        if not line:
            continue

        # [J]/J: 题号优先解析
        m_start = QUESTION_START_RE.search(line)
        if m_start:
            qid = m_start.group(1) or m_start.group(2)
            if qid:
                data["J"] = qid.strip()
            # 题号所在行可能还包含其它字段，继续往下解析

        # 通用字段 [J][P][I][Q][T]
        m_field = FIELD_RE.match(line)
        if m_field:
            tag, content = m_field.group(1), m_field.group(2)
            if tag in ["J", "P", "I", "Q", "T"]:
                current_field = tag
                if tag == "T":
                    # T 可能是单字母
                    m_t = T_FIELD_RE.match(line)
                    if m_t:
                        data["T"] = m_t.group(1)
                        current_field = None
                    else:
                        append_to("T", content)
                        current_field = None
                elif tag == "J":
                    data["J"] = content.strip() or data["J"]
                else:
                    append_to(tag, content)
                continue

        # 选项 [A]-[D]
        m_opt = OPTION_RE.match(line)
        if m_opt:
            opt, content = m_opt.group(1), m_opt.group(2)
            append_to(opt, content)
            current_field = opt
            continue

        # 兼容 A. / A) / A、
        m_opt2 = OPTION_ALT_RE.match(line)
        if m_opt2:
            opt, content = m_opt2.group(1), m_opt2.group(2)
            if opt in "ABCD":
                append_to(opt, content)
                current_field = opt
                continue

        # 若当前在累积某字段（多行续写）
        if current_field in ["Q", "A", "B", "C", "D"]:
            append_to(current_field, line)
        else:
            # 尝试从行中抽取 T（如 "T: A"）
            m_t_inline = T_FIELD_RE.match(line)
            if m_t_inline:
                data["T"] = m_t_inline.group(1)
                current_field = None
                continue
            # 尝试 P/I 的内联样式，例如 "P: 2"、"I: 1"
            if line.startswith("P:") or line.startswith("P："):
                append_to("P", line.split(":", 1)[-1].strip().lstrip("："))
                continue
            if line.startswith("I:") or line.startswith("I："):
                append_to("I", line.split(":", 1)[-1].strip().lstrip("："))
                continue

    # 若没有题号或问题，认为失败
    if not data["J"] and not data["Q"]:
        return None

    return data


def extract_pdf_to_csv(pdf_path: str, csv_path: str) -> int:
    text = extract_text(pdf_path)
    # 正规化换行，避免多余空白
    lines = [ln.strip("\ufeff").rstrip() for ln in text.splitlines()]

    blocks = split_questions_by_J(lines)
    records: List[Dict[str, str]] = []
    for blk in blocks:
        item = parse_block(blk)
        if item:
            records.append(item)

    # 写出 CSV
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["J", "P", "I", "Q", "T", "A", "B", "C", "D"])
        writer.writeheader()
        for r in records:
            writer.writerow(r)

    return len(records)


if __name__ == "__main__":
    # 处理所有PDF文件
    pdf_files = [
        "A类题库.pdf",
        "B类题库.pdf", 
        "C类题库.pdf",
        "总题库.pdf"
    ]
    
    for pdf_file in pdf_files:
        PDF_FILE = os.path.join(os.path.dirname(__file__), "QB_PDF", pdf_file)
        OUT_CSV = os.path.join(os.path.dirname(__file__), "QB_PDF", pdf_file.replace(".pdf", "_extracted.csv"))

        if not os.path.exists(PDF_FILE):
            print(f"跳过不存在的文件: {PDF_FILE}")
            continue

        count = extract_pdf_to_csv(PDF_FILE, OUT_CSV)
        print(f"完成，从 {PDF_FILE} 抽取 {count} 条记录，输出: {OUT_CSV}")