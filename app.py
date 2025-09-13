from flask import Flask, jsonify, request, send_from_directory
import csv
import os
import random
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 全局变量存储题目数据
questions_data = {}

def load_csv_data():
    """加载所有CSV文件中的题目数据"""
    csv_folder = 'QB_CSV'
    csv_files = {
        'A类题库': 'A类题库_extracted.csv',
        'B类题库': 'B类题库_extracted.csv', 
        'C类题库': 'C类题库_extracted.csv',
        '总题库': '总题库_extracted.csv'
    }
    
    for category, filename in csv_files.items():
        filepath = os.path.join(csv_folder, filename)
        if os.path.exists(filepath):
            questions_data[category] = []
            try:
                with open(filepath, 'r', encoding='utf-8-sig') as file:
                    reader = csv.DictReader(file)
                    print(f"正在加载 {category}，列名: {reader.fieldnames}")
                    
                    for row_num, row in enumerate(reader, 1):
                        try:
                            # 清理列名中的BOM和空白字符
                            clean_row = {k.strip(): v for k, v in row.items()}
                            
                            # 判断题目类型（单选题/多选题）
                            correct_answer = clean_row['T'].strip()
                            question_type = 'multiple' if len(correct_answer) > 1 else 'single'
                            
                            question = {
                                'id': clean_row['J'],
                                'chapter': clean_row['P'],
                                'code': clean_row['I'],
                                'question': clean_row['Q'],
                                'correct_answer': correct_answer,
                                'options': {
                                    'A': clean_row['A'],
                                    'B': clean_row['B'],
                                    'C': clean_row['C'],
                                    'D': clean_row['D']
                                },
                                'type': question_type
                            }
                            questions_data[category].append(question)
                        except KeyError as e:
                            print(f"第{row_num}行数据错误: 缺少列 {e}")
                            print(f"可用列: {list(row.keys())}")
                            continue
                        except Exception as e:
                            print(f"第{row_num}行处理错误: {e}")
                            continue
            except Exception as e:
                print(f"读取文件 {filepath} 失败: {e}")
        else:
            print(f"文件不存在: {filepath}")

@app.route('/')
def index():
    """返回主页面"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    """返回静态文件"""
    return send_from_directory('.', filename)

@app.route('/api/categories')
def get_categories():
    """获取所有题库分类"""
    return jsonify({
        'categories': list(questions_data.keys()),
        'counts': {cat: len(questions) for cat, questions in questions_data.items()}
    })

@app.route('/api/questions/<category>')
def get_questions(category):
    """获取指定分类的所有题目"""
    if category not in questions_data:
        return jsonify({'error': '分类不存在'}), 404
    
    # 获取查询参数
    limit = request.args.get('limit', type=int)
    shuffle = request.args.get('shuffle', 'false').lower() == 'true'
    question_type = request.args.get('type')  # 'single' 或 'multiple'
    
    questions = questions_data[category].copy()
    
    # 按题目类型过滤
    if question_type:
        questions = [q for q in questions if q['type'] == question_type]
    
    # 随机打乱
    if shuffle:
        random.shuffle(questions)
    
    # 限制数量
    if limit:
        questions = questions[:limit]
    
    return jsonify({
        'category': category,
        'total': len(questions),
        'questions': questions
    })

@app.route('/api/question/<category>/<question_id>')
def get_single_question(category, question_id):
    """获取单个题目"""
    if category not in questions_data:
        return jsonify({'error': '分类不存在'}), 404
    
    question = next((q for q in questions_data[category] if q['id'] == question_id), None)
    if not question:
        return jsonify({'error': '题目不存在'}), 404
    
    return jsonify(question)

@app.route('/api/check_answer', methods=['POST'])
def check_answer():
    """检查答案是否正确"""
    data = request.json
    category = data.get('category')
    question_id = data.get('question_id')
    user_answer = data.get('answer', '').upper().strip()
    
    if category not in questions_data:
        return jsonify({'error': '分类不存在'}), 404
    
    question = next((q for q in questions_data[category] if q['id'] == question_id), None)
    if not question:
        return jsonify({'error': '题目不存在'}), 404
    
    correct_answer = question['correct_answer']
    is_correct = user_answer == correct_answer
    
    return jsonify({
        'correct': is_correct,
        'correct_answer': correct_answer,
        'user_answer': user_answer,
        'explanation': f"正确答案是: {correct_answer}"
    })

@app.route('/api/random_questions')
def get_random_questions():
    """获取随机题目"""
    count = request.args.get('count', 10, type=int)
    category = request.args.get('category', '总题库')
    question_type = request.args.get('type')  # 'single' 或 'multiple'
    
    if category not in questions_data:
        return jsonify({'error': '分类不存在'}), 404
    
    questions = questions_data[category].copy()
    
    # 按题目类型过滤
    if question_type:
        questions = [q for q in questions if q['type'] == question_type]
    
    # 随机选择题目
    if len(questions) > count:
        questions = random.sample(questions, count)
    
    return jsonify({
        'category': category,
        'total': len(questions),
        'questions': questions
    })

if __name__ == '__main__':
    print("正在加载题目数据...")
    load_csv_data()
    print(f"数据加载完成，共加载 {sum(len(q) for q in questions_data.values())} 道题目")
    
    for category, questions in questions_data.items():
        single_count = len([q for q in questions if q['type'] == 'single'])
        multiple_count = len([q for q in questions if q['type'] == 'multiple'])
        print(f"{category}: {len(questions)} 道题目 (单选: {single_count}, 多选: {multiple_count})")
    
    app.run(debug=True, host='0.0.0.0', port=5000)