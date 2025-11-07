from flask import Flask, jsonify, request, send_from_directory
import csv
import os
import random
import threading
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# -------------------- 全局配置常量 --------------------
CSV_FOLDER = 'QB_CSV'                  # 题库 CSV 文件所在的目录
IMAGE_FOLDER = 'QB_image'              # 题目配图所在目录
CSV_COLUMNS = ['J', 'P', 'I', 'Q', 'T', 'A', 'B', 'C', 'D']  # CSV 列名顺序，与题目字段一一对应
FAVORITES_CATEGORY = '收藏夹'           # 收藏夹在接口返回中的分类名称
FAVORITES_FILENAME = '收藏夹.csv'        # 收藏夹 CSV 文件名
CSV_FILES = {                          # 各题库分类对应的文件名，便于统一加载
    'A类题库': 'A类题库_extracted.csv',
    'B类题库': 'B类题库_extracted.csv',
    'C类题库': 'C类题库_extracted.csv',
    '总题库': '总题库_extracted.csv'
}

# -------------------- 运行时全局状态 --------------------
questions_data = {}      # {分类名称: [题目字典, ...]}
favorite_ids = set()     # 当前收藏夹中的题目 ID 集合，加速判断收藏状态
favorites_lock = threading.Lock()  # 读写收藏夹时使用互斥锁，避免并发写入造成数据损坏


# -------------------- 收藏夹文件辅助工具 --------------------
def ensure_favorites_file():
    """确保收藏夹 CSV 文件存在且至少包含表头。
    若文件不存在或为空，则写入列名，避免读写时报错。
    """
    os.makedirs(CSV_FOLDER, exist_ok=True)
    favorites_path = get_favorites_path()
    if not os.path.exists(favorites_path) or os.path.getsize(favorites_path) == 0:
        with open(favorites_path, 'w', newline='', encoding='utf-8-sig') as file:
            writer = csv.DictWriter(file, fieldnames=CSV_COLUMNS)
            writer.writeheader()


def get_favorites_path():
    """获取收藏夹 CSV 文件的绝对路径。"""
    return os.path.join(CSV_FOLDER, FAVORITES_FILENAME)


# -------------------- CSV 数据解析工具 --------------------
def clean_value(value):
    """清洗 CSV 中的单元格内容：去除前后空白并统一 None -> 空串。"""
    return value.strip() if isinstance(value, str) else ''


def prepare_row(row):
    """对 CSV 字典行进行标准化处理，保证键和值都移除空白字符。"""
    return {(key or '').strip(): clean_value(value) for key, value in row.items() if key}


def get_image_path(question_id):
    """检查题目配图是否存在，存在则返回前端可直接访问的 URL。"""
    image_filename = f'{question_id}.png'
    image_full_path = os.path.join(IMAGE_FOLDER, image_filename)
    if os.path.exists(image_full_path):
        return f'/QB_image/{image_filename}'
    return None


def create_question_from_row(row, category, origin_category=None):
    """根据 CSV 行构建题目字典，统一封装题目信息。
    origin_category 用于记录题目来自哪个原始题库（收藏夹里需要保持原题库记录）。
    """
    question_id = row.get('I', '')
    if not question_id:
        raise KeyError('缺少题目编号 I')
    correct_answer = row.get('T', '')
    question_type = 'multiple' if len(correct_answer) > 1 else 'single'
    options = {
        'A': row.get('A', ''),
        'B': row.get('B', ''),
        'C': row.get('C', ''),
        'D': row.get('D', '')
    }
    question = {
        'id': question_id,
        'chapter': row.get('P', ''),
        'code': question_id,
        'question': row.get('Q', ''),
        'correct_answer': correct_answer,
        'options': options,
        'type': question_type,
        'image': get_image_path(question_id),
        'origin_category': origin_category if origin_category else category,
        'csv_row': {column: row.get(column, '') for column in CSV_COLUMNS}  # 保留原始字段，用于写回收藏夹
    }
    return question


def load_category(category, filename):
    """读取单个题库 CSV，将所有题目载入到内存结构中。"""
    filepath = os.path.join(CSV_FOLDER, filename)
    questions_data[category] = []
    if not os.path.exists(filepath):
        print(f'文件不存在: {filepath}')
        return
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as file:
            reader = csv.DictReader(file)
            print(f"正在加载 {category}，列名: {reader.fieldnames}")
            for row_num, row in enumerate(reader, 1):
                try:
                    clean_row = prepare_row(row)
                    if not clean_row.get('I'):  # 忽略缺少题号的行
                        continue
                    question = create_question_from_row(clean_row, category)
                    questions_data[category].append(question)
                except KeyError as error:
                    print(f"第{row_num}行数据错误: 缺少列 {error}")
                except Exception as error:
                    print(f"第{row_num}行处理错误: {error}")
    except Exception as error:
        print(f"读取文件 {filepath} 失败: {error}")


def find_question_by_id(question_id, preferred_category=None):
    """在所有题库中查找指定题号的题目。
    preferred_category 可指定优先搜索的题库，减少遍历范围。
    """
    categories_to_probe = []
    if preferred_category and preferred_category in questions_data:
        categories_to_probe.append(preferred_category)
    # 补充其他题库，保证最终一定遍历所有分类
    for category in questions_data:
        if category not in categories_to_probe:
            categories_to_probe.append(category)
    for category in categories_to_probe:
        for question in questions_data.get(category, []):
            if question['id'] == question_id:
                return question
    return None


# -------------------- 收藏夹读写逻辑 --------------------
def load_favorites():
    """从收藏夹 CSV 中重建收藏题目列表和缓存集合。
    在应用启动时或重新加载题库时调用。
    """
    favorites_path = get_favorites_path()
    favorite_questions = []
    if not os.path.exists(favorites_path):
        questions_data[FAVORITES_CATEGORY] = favorite_questions
        favorite_ids.clear()
        return
    try:
        with open(favorites_path, 'r', encoding='utf-8-sig') as file:
            reader = csv.DictReader(file)
            for row_num, row in enumerate(reader, 1):
                try:
                    clean_row = prepare_row(row)
                    question_id = clean_row.get('I')
                    if not question_id:
                        continue
                    original_question = find_question_by_id(question_id)
                    origin_category = original_question['origin_category'] if original_question else FAVORITES_CATEGORY
                    question = create_question_from_row(clean_row, FAVORITES_CATEGORY, origin_category=origin_category)
                    favorite_questions.append(question)
                except Exception as error:
                    print(f"收藏夹第{row_num}行处理错误: {error}")
    except Exception as error:
        print(f"读取收藏夹失败: {error}")
    questions_data[FAVORITES_CATEGORY] = favorite_questions
    favorite_ids.clear()
    favorite_ids.update(question['id'] for question in favorite_questions)


def add_to_favorites_locked(question):
    """将题目写入收藏夹 CSV，并更新内存状态（调用者必须已加锁）。"""
    question_id = question['id']
    if question_id in favorite_ids:
        return True  # 已收藏则视为成功
    favorites_path = get_favorites_path()
    row_data = question['csv_row']
    try:
        with open(favorites_path, 'a', newline='', encoding='utf-8-sig') as file:
            writer = csv.DictWriter(file, fieldnames=CSV_COLUMNS)
            writer.writerow({column: row_data.get(column, '') for column in CSV_COLUMNS})
    except Exception as error:
        print(f"写入收藏夹失败: {error}")
        return False
    favorite_question = create_question_from_row(row_data, FAVORITES_CATEGORY, origin_category=question['origin_category'])
    questions_data[FAVORITES_CATEGORY].append(favorite_question)
    favorite_ids.add(question_id)
    return True


def remove_from_favorites_locked(question_id):
    """从收藏夹中删除题目：重写 CSV 并更新内存结构（调用者必须已加锁）。"""
    if question_id not in favorite_ids:
        return True
    current_favorites = questions_data.get(FAVORITES_CATEGORY, [])
    remaining = [question for question in current_favorites if question['id'] != question_id]
    favorites_path = get_favorites_path()
    try:
        with open(favorites_path, 'w', newline='', encoding='utf-8-sig') as file:
            writer = csv.DictWriter(file, fieldnames=CSV_COLUMNS)
            writer.writeheader()
            for question in remaining:
                writer.writerow({column: question['csv_row'].get(column, '') for column in CSV_COLUMNS})
    except Exception as error:
        print(f"更新收藏夹失败: {error}")
        return False
    questions_data[FAVORITES_CATEGORY] = remaining
    favorite_ids.discard(question_id)
    return True


# -------------------- 数据加载入口 --------------------
def load_csv_data():
    """统一加载所有题库以及收藏夹。
    注意：需要在应用启动时调用，保证 questions_data 与 favorite_ids 已建好。
    """
    with favorites_lock:
        questions_data.clear()
        for category in CSV_FILES:
            questions_data[category] = []
        questions_data[FAVORITES_CATEGORY] = []
        ensure_favorites_file()
        for category, filename in CSV_FILES.items():
            load_category(category, filename)
        load_favorites()


# -------------------- 序列化工具（用于 API 输出） --------------------
def serialize_question(question):
    """将题目对象转换成 JSON 可返回的字典，同时标注收藏状态。"""
    return {
        'id': question['id'],
        'chapter': question['chapter'],
        'code': question['code'],
        'question': question['question'],
        'correct_answer': question['correct_answer'],
        'options': question['options'],
        'type': question['type'],
        'image': question['image'],
        'favorite': question['id'] in favorite_ids,
        'origin_category': question['origin_category'],
        'classification': question['csv_row'].get('J', '')
    }


def serialize_questions_list(questions):
    """批量序列化题目列表。"""
    return [serialize_question(question) for question in questions]


# -------------------- 页面与静态资源 --------------------
@app.route('/')
def index():
    """返回主页 HTML。"""
    return send_from_directory('.', 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
    """返回静态资源（前端脚本、样式等）。"""
    return send_from_directory('.', filename)


@app.route('/QB_image/<filename>')
def serve_image(filename):
    """提供题目配图。"""
    return send_from_directory(IMAGE_FOLDER, filename)


# -------------------- 题库查询相关接口 --------------------
@app.route('/api/categories')
def get_categories():
    """获取所有题库分类与题目数量。"""
    with favorites_lock:
        return jsonify({
            'categories': list(questions_data.keys()),
            'counts': {category: len(questions) for category, questions in questions_data.items()}
        })


@app.route('/api/questions/<category>')
def get_questions(category):
    """按分类返回题目，可选过滤题型、乱序和数量限制。"""
    with favorites_lock:
        if category not in questions_data:
            return jsonify({'error': '分类不存在'}), 404
        limit = request.args.get('limit', type=int)
        shuffle = request.args.get('shuffle', 'false').lower() == 'true'
        question_type = request.args.get('type')
        selected = questions_data[category].copy()
        if question_type:
            selected = [question for question in selected if question['type'] == question_type]
        if shuffle:
            random.shuffle(selected)
        if limit:
            selected = selected[:limit]
        return jsonify({
            'category': category,
            'total': len(selected),
            'questions': serialize_questions_list(selected)
        })


@app.route('/api/question/<category>/<question_id>')
def get_single_question(category, question_id):
    """获取单个题目详情。"""
    with favorites_lock:
        if category not in questions_data:
            return jsonify({'error': '分类不存在'}), 404
        question = next((q for q in questions_data[category] if q['id'] == question_id), None)
        if not question:
            return jsonify({'error': '题目不存在'}), 404
        return jsonify(serialize_question(question))


@app.route('/api/check_answer', methods=['POST'])
def check_answer():
    """校验用户提交的答案是否正确，并返回结果。"""
    data = request.json or {}
    category = data.get('category')
    question_id = data.get('question_id')
    user_answer = data.get('answer', '').upper().strip()
    with favorites_lock:
        if category not in questions_data:
            return jsonify({'error': '分类不存在'}), 404
        question = next((q for q in questions_data[category] if q['id'] == question_id), None)
        if not question:
            return jsonify({'error': '题目不存在'}), 404
        correct_answer = question['correct_answer']
        # 多选题进行排序比对，防止顺序不同导致误判
        if len(correct_answer) > 1 or len(user_answer) > 1:
            sorted_user_answer = ''.join(sorted(user_answer))
            sorted_correct_answer = ''.join(sorted(correct_answer))
            is_correct = sorted_user_answer == sorted_correct_answer
        else:
            is_correct = user_answer == correct_answer
        display_correct = ''.join(sorted(correct_answer)) if len(correct_answer) > 1 else correct_answer
        return jsonify({
            'correct': is_correct,
            'correct_answer': correct_answer,
            'user_answer': user_answer,
            'explanation': f"正确答案是: {display_correct}"
        })


@app.route('/api/random_questions')
def get_random_questions():
    """随机抽取一定数量的题目（可按题型过滤）。"""
    count = request.args.get('count', 10, type=int)
    category = request.args.get('category', '总题库')
    question_type = request.args.get('type')
    with favorites_lock:
        if category not in questions_data:
            return jsonify({'error': '分类不存在'}), 404
        candidates = questions_data[category].copy()
        if question_type:
            candidates = [question for question in candidates if question['type'] == question_type]
        if len(candidates) > count:
            candidates = random.sample(candidates, count)
        return jsonify({
            'category': category,
            'total': len(candidates),
            'questions': serialize_questions_list(candidates)
        })


@app.route('/api/sequential_questions')
def get_sequential_questions():
    """顺序返回整个题库，适用于全量练习模式。"""
    category = request.args.get('category')
    if not category:
        return jsonify({'error': '无效的题库分类'}), 400
    with favorites_lock:
        if category not in questions_data:
            return jsonify({'error': '无效的题库分类'}), 400
        questions = questions_data[category]
        return jsonify({
            'questions': serialize_questions_list(questions),
            'total': len(questions)
        })


@app.route('/api/favorites/toggle', methods=['POST'])
def toggle_favorite():
    """收藏/取消收藏接口。
    根据 question_id 判断当前状态，若已收藏则删除，否则添加。
    """
    data = request.json or {}
    question_id = data.get('question_id')
    if not question_id:
        return jsonify({'error': '缺少题目编号'}), 400
    preferred_order = []
    origin_category = data.get('origin_category')
    current_category = data.get('category')
    if origin_category:
        preferred_order.append(origin_category)
    if current_category and current_category not in preferred_order:
        preferred_order.append(current_category)
    with favorites_lock:
        if question_id in favorite_ids:
            if remove_from_favorites_locked(question_id):
                return jsonify({
                    'favorite': False,
                    'question_id': question_id,
                    'total_favorites': len(favorite_ids)
                })
            return jsonify({'error': '取消收藏失败'}), 500
        question = None
        for category in preferred_order:
            question = find_question_by_id(question_id, category)
            if question:
                break
        if not question:
            question = find_question_by_id(question_id)
        if not question:
            return jsonify({'error': '题目不存在'}), 404
        if add_to_favorites_locked(question):
            return jsonify({
                'favorite': True,
                'question_id': question_id,
                'total_favorites': len(favorite_ids)
            })
        return jsonify({'error': '收藏失败'}), 500


# -------------------- Flask 启动入口 --------------------
if __name__ == '__main__':
    print("正在加载题目数据...")
    load_csv_data()
    total_questions = sum(len(questions) for questions in questions_data.values())
    print(f"数据加载完成，共加载 {total_questions} 道题目")
    for category, questions in questions_data.items():
        single_count = sum(1 for question in questions if question['type'] == 'single')
        multiple_count = sum(1 for question in questions if question['type'] == 'multiple')
        print(f"{category}: {len(questions)} 道题目 (单选: {single_count}, 多选: {multiple_count})")
    app.run(debug=True, host='0.0.0.0', port=5000)