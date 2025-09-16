class QuizApp {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.correctCount = 0;
        this.shuffleOptions = true;
        this.originalOptions = [];
        // 动态获取API基础URL，支持外网访问
        this.apiBase = `${window.location.protocol}//${window.location.host}/api`;
        
        this.initializeElements();
        this.bindEvents();
        this.loadCategories();
        this.onPracticeModeChange();
    }

    initializeElements() {
        // 控制元素
        this.categorySelect = document.getElementById('category');
        this.practiceModeSelect = document.getElementById('practiceMode');
        this.questionCountInput = document.getElementById('questionCount');
        this.questionCountContainer = document.getElementById('questionCountContainer');
        this.shuffleOptionsSelect = document.getElementById('shuffleOptions');
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
        
        // 导航元素
        this.questionNavigation = document.getElementById('questionNavigation');
        this.navGrid = document.getElementById('navGrid');
        this.showNavBtn = document.getElementById('showNavBtn');
        this.toggleNavBtn = document.getElementById('toggleNavBtn');
        this.prevPageBtn = document.getElementById('prevPageBtn');
        this.nextPageBtn = document.getElementById('nextPageBtn');
        this.pageInfo = document.getElementById('pageInfo');
        
        // 分页相关属性
        this.itemsPerPage = 50; // 每页显示50个题目
        this.currentPage = 1;
        this.totalPages = 1;
        
        // 操作按钮
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.submitBtn = document.getElementById('submitBtn');
        
        // 加载提示
        this.loading = document.getElementById('loading');
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startQuiz());
        this.practiceModeSelect.addEventListener('change', () => this.onPracticeModeChange());
        this.prevBtn.addEventListener('click', () => this.previousQuestion());
        this.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.submitBtn.addEventListener('click', () => this.submitAnswer());
        this.showNavBtn.addEventListener('click', () => this.toggleQuestionNavigation());
        this.toggleNavBtn.addEventListener('click', () => this.toggleQuestionNavigation());
        this.prevPageBtn.addEventListener('click', () => this.goToPreviousPage());
        this.nextPageBtn.addEventListener('click', () => this.goToNextPage());
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

    onPracticeModeChange() {
        const mode = this.practiceModeSelect.value;
        if (mode === 'sequential') {
            this.questionCountContainer.classList.add('hidden');
        } else {
            this.questionCountContainer.classList.remove('hidden');
        }
    }
    
    async startQuiz() {
        const category = this.categorySelect.value;
        const practiceMode = this.practiceModeSelect.value;
        const questionCount = parseInt(this.questionCountInput.value);
        this.shuffleOptions = this.shuffleOptionsSelect.value === 'true';
        
        if (!category) {
            alert('请选择题库');
            return;
        }
        
        if (practiceMode === 'random' && (questionCount < 1 || questionCount > 100)) {
            alert('题目数量必须在1-100之间');
            return;
        }
        
        this.showLoading(true);
        
        try {
            let url;
            if (practiceMode === 'sequential') {
                url = `${this.apiBase}/sequential_questions?category=${encodeURIComponent(category)}`;
            } else {
                url = `${this.apiBase}/random_questions?category=${encodeURIComponent(category)}&count=${questionCount}`;
            }
            // 包含所有单选题和多选题
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.questions = data.questions;
            this.currentQuestionIndex = 0;
            this.userAnswers = new Array(this.questions.length).fill('');
            this.correctCount = 0;
            
            // 保存原始选项顺序
            this.originalOptions = this.questions.map(q => ({ ...q.options }));
            
            this.showQuizInterface();
            this.initializeQuestionNavigation();
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
        
        // 显示配图（如果存在）
        this.displayQuestionImage(question);
        
        // 显示选项
        this.displayOptions(question);
        
        // 更新按钮状态
        this.updateButtonStates();
        
        // 隐藏结果
        this.resultContainer.style.display = 'none';
        
        // 更新统计
        this.updateStats();
    }

    displayQuestionImage(question) {
        // 查找或创建图片容器
        let imageContainer = document.getElementById('question-image-container');
        if (!imageContainer) {
            imageContainer = document.createElement('div');
            imageContainer.id = 'question-image-container';
            imageContainer.className = 'question-image-container';
            
            // 将图片容器插入到题目文本之后，选项之前
            const questionTextElement = document.querySelector('.question-text');
            questionTextElement.parentNode.insertBefore(imageContainer, questionTextElement.nextSibling);
        }
        
        // 清空容器
        imageContainer.innerHTML = '';
        
        // 如果题目有配图，显示图片
        if (question.image) {
            const img = document.createElement('img');
            img.src = question.image;
            img.alt = `题目 ${question.code} 配图`;
            img.className = 'question-image';
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.marginTop = '15px';
            img.style.marginBottom = '15px';
            img.style.border = '1px solid #ddd';
            img.style.borderRadius = '8px';
            img.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            
            // 添加加载错误处理
            img.onerror = function() {
                imageContainer.innerHTML = '<p style="color: #666; font-style: italic; margin: 15px 0;">配图加载失败</p>';
            };
            
            imageContainer.appendChild(img);
        }
    }

    displayOptions(question) {
        this.optionsContainer.innerHTML = '';
        
        // 获取有效选项
        let optionKeys = ['A', 'B', 'C', 'D'].filter(key => question.options[key]);
        let optionTexts = optionKeys.map(key => question.options[key]);
        
        // 如果开启选项混乱，则打乱选项内容，但保持字母标签固定
        if (this.shuffleOptions) {
            optionTexts = this.shuffleArray([...optionTexts]);
        }
        
        // 创建选项映射，用于记录打乱后的对应关系
        const shuffledMapping = {};
        if (this.shuffleOptions) {
            // 创建原始文本到原始字母的映射
            const originalTextToKey = {};
            optionKeys.forEach(key => {
                originalTextToKey[question.options[key]] = key;
            });
            
            // 为每个显示位置记录对应的原始字母
            optionKeys.forEach((displayKey, index) => {
                const displayText = optionTexts[index];
                const originalKey = originalTextToKey[displayText];
                shuffledMapping[displayKey] = {
                    originalKey: originalKey,
                    text: displayText
                };
            });
        } else {
            // 如果没有混乱，直接映射
            optionKeys.forEach((key, index) => {
                shuffledMapping[key] = {
                    originalKey: key,
                    text: optionTexts[index]
                };
            });
        }
        
        // 保存当前题目的选项映射
        if (!this.optionMappings) this.optionMappings = [];
        this.optionMappings[this.currentQuestionIndex] = shuffledMapping;
        
        optionKeys.forEach((displayKey, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            optionDiv.dataset.value = displayKey;
            
            // 检查是否已选择（需要根据映射关系判断）
            const userAnswer = this.userAnswers[this.currentQuestionIndex];
            if (userAnswer.includes(displayKey)) {
                optionDiv.classList.add('selected');
            }
            
            optionDiv.innerHTML = `
                <span class="option-label">${displayKey}</span>
                <span class="option-text">${optionTexts[index]}</span>
            `;
            
            optionDiv.addEventListener('click', () => this.selectOption(displayKey));
            this.optionsContainer.appendChild(optionDiv);
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
        
        // 如果开启了选项混乱，需要将显示的字母转换为原始字母
        let actualAnswer = userAnswer;
        if (this.shuffleOptions && this.optionMappings && this.optionMappings[this.currentQuestionIndex]) {
            const mapping = this.optionMappings[this.currentQuestionIndex];
            actualAnswer = userAnswer.split('').map(letter => {
                // 找到显示字母对应的原始字母
                for (const [displayKey, info] of Object.entries(mapping)) {
                    if (displayKey === letter) {
                        return info.originalKey;
                    }
                }
                return letter;
            }).sort().join('');
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
                    answer: actualAnswer
                })
            });
            
            const result = await response.json();
            
            // 确保显示用户实际选择的字母，而不是转换后的答案
            result.user_answer = userAnswer;
            
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
        
        // 获取用户实际选择的答案（显示字母）
        let displayUserAnswer = this.userAnswers[this.currentQuestionIndex] || '未选择';
        let displayCorrectAnswer = result.correct_answer;
        
        if (this.shuffleOptions && this.optionMappings && this.optionMappings[this.currentQuestionIndex]) {
            const mapping = this.optionMappings[this.currentQuestionIndex];
            
            // 转换正确答案为显示字母
            displayCorrectAnswer = result.correct_answer.split('').map(originalKey => {
                for (const [displayKey, info] of Object.entries(mapping)) {
                    if (info.originalKey === originalKey) {
                        return displayKey;
                    }
                }
                return originalKey;
            }).sort().join('');
        } else {
            // 非混乱模式下对多选答案排序
            if (result.correct_answer.length > 1) {
                displayCorrectAnswer = result.correct_answer.split('').sort().join('');
            }
        }
        
        // 对用户答案排序（如果是多选）
        if (displayUserAnswer !== '未选择' && displayUserAnswer.length > 1) {
            displayUserAnswer = displayUserAnswer.split('').sort().join('');
        }
        
        this.resultContainer.innerHTML = `
            <h3>${icon} ${status}</h3>
            <p><strong>您的答案:</strong> ${displayUserAnswer}</p>
            <p><strong>正确答案:</strong> ${displayCorrectAnswer}</p>
        `;
    }

    highlightCorrectAnswers(question, result) {
        const correctAnswers = result.correct_answer.split('');
        const userAnswers = result.user_answer.split('');
        
        this.optionsContainer.querySelectorAll('.option').forEach(optionDiv => {
            const displayKey = optionDiv.dataset.value;
            
            optionDiv.classList.remove('correct', 'incorrect');
            
            // 如果开启了选项混乱，需要将正确答案转换为显示字母
            let displayCorrectAnswers = correctAnswers;
            if (this.shuffleOptions && this.optionMappings && this.optionMappings[this.currentQuestionIndex]) {
                const mapping = this.optionMappings[this.currentQuestionIndex];
                displayCorrectAnswers = correctAnswers.map(originalKey => {
                    // 找到原始字母对应的显示字母
                    for (const [displayKey, info] of Object.entries(mapping)) {
                        if (info.originalKey === originalKey) {
                            return displayKey;
                        }
                    }
                    return originalKey;
                });
            }
            
            if (displayCorrectAnswers.includes(displayKey)) {
                optionDiv.classList.add('correct');
            } else if (userAnswers.includes(displayKey)) {
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
        
        // 更新题目导航
        this.updateQuestionNavigation();
    }
    
    // 数组打乱方法
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    // 初始化题目导航
    initializeQuestionNavigation() {
        // 计算总页数
        this.totalPages = Math.ceil(this.questions.length / this.itemsPerPage);
        this.currentPage = Math.ceil((this.currentQuestionIndex + 1) / this.itemsPerPage);
        
        this.renderCurrentPage();
        this.updatePaginationControls();
        this.updateQuestionNavigation();
    }
    
    // 切换题目导航显示
    toggleQuestionNavigation() {
        const isVisible = this.questionNavigation.style.display !== 'none';
        this.questionNavigation.style.display = isVisible ? 'none' : 'block';
        this.showNavBtn.textContent = isVisible ? '题目导航' : '隐藏导航';
        this.toggleNavBtn.textContent = isVisible ? '展开' : '收起';
    }
    
    // 更新题目导航状态
    updateQuestionNavigation() {
        const navItems = this.navGrid.querySelectorAll('.nav-item');
        
        navItems.forEach((item, index) => {
            item.classList.remove('current', 'answered', 'incorrect');
            
            if (index === this.currentQuestionIndex) {
                item.classList.add('current');
            } else if (this.userAnswers[index] !== '') {
                const question = this.questions[index];
                if (question.answered) {
                    item.classList.add('answered');
                } else {
                    item.classList.add('incorrect');
                }
            }
        });
    }
    
    // 渲染当前页的题目导航
    renderCurrentPage() {
        this.navGrid.innerHTML = '';
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.questions.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const navItem = document.createElement('div');
            navItem.className = 'nav-item';
            navItem.textContent = i + 1;
            navItem.dataset.index = i;
            
            navItem.addEventListener('click', () => this.jumpToQuestion(i));
            this.navGrid.appendChild(navItem);
        }
    }
    
    // 更新分页控件状态
    updatePaginationControls() {
        this.pageInfo.textContent = `第 ${this.currentPage} 页，共 ${this.totalPages} 页`;
        this.prevPageBtn.disabled = this.currentPage <= 1;
        this.nextPageBtn.disabled = this.currentPage >= this.totalPages;
    }
    
    // 上一页
    goToPreviousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderCurrentPage();
            this.updatePaginationControls();
            this.updateQuestionNavigation();
        }
    }
    
    // 下一页
    goToNextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.renderCurrentPage();
            this.updatePaginationControls();
            this.updateQuestionNavigation();
        }
    }
    
    // 跳转到指定题目
    jumpToQuestion(index) {
        if (index >= 0 && index < this.questions.length) {
            this.currentQuestionIndex = index;
            
            // 如果跳转的题目不在当前页，需要切换到对应页面
            const targetPage = Math.ceil((index + 1) / this.itemsPerPage);
            if (targetPage !== this.currentPage) {
                this.currentPage = targetPage;
                this.renderCurrentPage();
                this.updatePaginationControls();
            }
            
            this.displayQuestion();
            this.updateQuestionNavigation();
        }
    }

}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});