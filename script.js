class QuizApp {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.correctCount = 0;
        this.apiBase = 'http://localhost:5000/api';
        
        this.initializeElements();
        this.bindEvents();
        this.loadCategories();
    }

    initializeElements() {
        // 控制元素
        this.categorySelect = document.getElementById('category');
        this.questionCountInput = document.getElementById('questionCount');
        this.startBtn = document.getElementById('startBtn');
        
        // 统计元素
        this.statsContainer = document.getElementById('stats');
        this.totalQuestionsSpan = document.getElementById('totalQuestions');
        this.currentQuestionSpan = document.getElementById('currentQuestion');
        this.correctCountSpan = document.getElementById('correctCount');
        this.accuracySpan = document.getElementById('accuracy');
        
        // 题目容器元素
        this.questionContainer = document.getElementById('questionContainer');
        this.progressFill = document.getElementById('progressFill');
        this.questionTypeBadge = document.getElementById('questionTypeBadge');
        this.questionCode = document.getElementById('questionCode');
        this.questionChapter = document.getElementById('questionChapter');
        this.questionNumber = document.getElementById('questionNumber');
        this.questionText = document.getElementById('questionText');
        this.optionsContainer = document.getElementById('optionsContainer');
        this.resultContainer = document.getElementById('resultContainer');
        
        // 操作按钮
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.submitBtn = document.getElementById('submitBtn');
        
        // 加载提示
        this.loading = document.getElementById('loading');
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startQuiz());
        this.prevBtn.addEventListener('click', () => this.previousQuestion());
        this.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.submitBtn.addEventListener('click', () => this.submitAnswer());
    }

    async loadCategories() {
        try {
            const response = await fetch(`${this.apiBase}/categories`);
            const data = await response.json();
            
            this.categorySelect.innerHTML = '<option value="">请选择题库...</option>';
            data.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = `${category} (${data.counts[category]}题)`;
                this.categorySelect.appendChild(option);
            });
        } catch (error) {
            console.error('加载题库分类失败:', error);
            alert('无法连接到服务器，请确保后端服务正在运行');
        }
    }

    async startQuiz() {
        const category = this.categorySelect.value;
        const count = parseInt(this.questionCountInput.value);
        
        if (!category) {
            alert('请选择题库');
            return;
        }
        
        if (count < 1 || count > 100) {
            alert('题目数量必须在1-100之间');
            return;
        }
        
        this.showLoading(true);
        
        try {
            let url = `${this.apiBase}/random_questions?category=${encodeURIComponent(category)}&count=${count}`;
            // 不再过滤题型，包含所有单选题和多选题
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.questions = data.questions;
            this.currentQuestionIndex = 0;
            this.userAnswers = new Array(this.questions.length).fill('');
            this.correctCount = 0;
            
            this.showQuizInterface();
            this.displayQuestion();
            
        } catch (error) {
            console.error('加载题目失败:', error);
            alert('加载题目失败: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        this.loading.style.display = show ? 'block' : 'none';
    }

    showQuizInterface() {
        this.questionContainer.style.display = 'block';
        this.statsContainer.style.display = 'flex';
        this.updateStats();
    }

    displayQuestion() {
        const question = this.questions[this.currentQuestionIndex];
        
        // 更新进度条
        const progress = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
        this.progressFill.style.width = `${progress}%`;
        
        // 更新题目信息
        this.questionTypeBadge.textContent = question.type === 'single' ? '单选题' : '多选题';
        this.questionTypeBadge.className = `question-badge ${question.type === 'single' ? 'single-choice' : 'multiple-choice'}`;
        this.questionCode.textContent = question.code;
        this.questionChapter.textContent = `章节: ${question.chapter}`;
        this.questionNumber.textContent = `${this.currentQuestionIndex + 1}/${this.questions.length}`;
        this.questionText.textContent = question.question;
        
        // 显示选项
        this.displayOptions(question);
        
        // 更新按钮状态
        this.updateButtonStates();
        
        // 隐藏结果
        this.resultContainer.style.display = 'none';
        
        // 更新统计
        this.updateStats();
    }

    displayOptions(question) {
        this.optionsContainer.innerHTML = '';
        
        ['A', 'B', 'C', 'D'].forEach(optionKey => {
            if (question.options[optionKey]) {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'option';
                optionDiv.dataset.value = optionKey;
                
                // 检查是否已选择
                const userAnswer = this.userAnswers[this.currentQuestionIndex];
                if (userAnswer.includes(optionKey)) {
                    optionDiv.classList.add('selected');
                }
                
                optionDiv.innerHTML = `
                    <span class="option-label">${optionKey}</span>
                    <span class="option-text">${question.options[optionKey]}</span>
                `;
                
                optionDiv.addEventListener('click', () => this.selectOption(optionKey));
                this.optionsContainer.appendChild(optionDiv);
            }
        });
    }

    selectOption(optionKey) {
        const question = this.questions[this.currentQuestionIndex];
        let userAnswer = this.userAnswers[this.currentQuestionIndex];
        
        if (question.type === 'single') {
            // 单选题：替换答案
            userAnswer = optionKey;
            
            // 更新UI
            this.optionsContainer.querySelectorAll('.option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.optionsContainer.querySelector(`[data-value="${optionKey}"]`).classList.add('selected');
            
        } else {
            // 多选题：切换答案
            if (userAnswer.includes(optionKey)) {
                userAnswer = userAnswer.replace(optionKey, '');
                this.optionsContainer.querySelector(`[data-value="${optionKey}"]`).classList.remove('selected');
            } else {
                userAnswer += optionKey;
                this.optionsContainer.querySelector(`[data-value="${optionKey}"]`).classList.add('selected');
            }
            
            // 按字母顺序排序
            userAnswer = userAnswer.split('').sort().join('');
        }
        
        this.userAnswers[this.currentQuestionIndex] = userAnswer;
        this.updateButtonStates();
    }

    async submitAnswer() {
        const question = this.questions[this.currentQuestionIndex];
        const userAnswer = this.userAnswers[this.currentQuestionIndex];
        
        if (!userAnswer) {
            alert('请选择答案');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/check_answer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    category: this.categorySelect.value,
                    question_id: question.id,
                    answer: userAnswer
                })
            });
            
            const result = await response.json();
            
            // 显示结果
            this.showResult(result);
            
            // 更新选项样式
            this.highlightCorrectAnswers(question, result);
            
            // 更新统计
            if (result.correct && !question.answered) {
                this.correctCount++;
                question.answered = true;
            }
            
            this.updateStats();
            
        } catch (error) {
            console.error('提交答案失败:', error);
            alert('提交答案失败');
        }
    }

    showResult(result) {
        this.resultContainer.style.display = 'block';
        this.resultContainer.className = `result ${result.correct ? 'correct' : 'incorrect'}`;
        
        const icon = result.correct ? '✅' : '❌';
        const status = result.correct ? '回答正确！' : '回答错误！';
        
        this.resultContainer.innerHTML = `
            <h3>${icon} ${status}</h3>
            <p><strong>您的答案:</strong> ${result.user_answer || '未选择'}</p>
            <p><strong>正确答案:</strong> ${result.correct_answer}</p>
            <p>${result.explanation}</p>
        `;
    }

    highlightCorrectAnswers(question, result) {
        const correctAnswers = result.correct_answer.split('');
        const userAnswers = result.user_answer.split('');
        
        this.optionsContainer.querySelectorAll('.option').forEach(optionDiv => {
            const optionKey = optionDiv.dataset.value;
            
            optionDiv.classList.remove('correct', 'incorrect');
            
            if (correctAnswers.includes(optionKey)) {
                optionDiv.classList.add('correct');
            } else if (userAnswers.includes(optionKey)) {
                optionDiv.classList.add('incorrect');
            }
        });
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayQuestion();
        }
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.displayQuestion();
        }
    }

    updateButtonStates() {
        const hasAnswer = this.userAnswers[this.currentQuestionIndex] !== '';
        
        this.prevBtn.disabled = this.currentQuestionIndex === 0;
        this.nextBtn.disabled = this.currentQuestionIndex === this.questions.length - 1;
        this.submitBtn.disabled = !hasAnswer;
    }

    updateStats() {
        this.totalQuestionsSpan.textContent = this.questions.length;
        this.currentQuestionSpan.textContent = this.currentQuestionIndex + 1;
        this.correctCountSpan.textContent = this.correctCount;
        
        const answeredCount = this.userAnswers.filter(answer => answer !== '').length;
        const accuracy = answeredCount > 0 ? Math.round((this.correctCount / answeredCount) * 100) : 0;
        this.accuracySpan.textContent = `${accuracy}%`;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});