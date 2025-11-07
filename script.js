class QuizApp {
    constructor() {
        // -------------------- 状态字段初始化 --------------------
        this.questions = [];                 // 当前练习题目列表
        this.currentQuestionIndex = 0;       // 当前题目索引
        this.userAnswers = [];               // 用户作答记录（与题目索引对应）
        this.correctCount = 0;               // 答对题目数量
        this.shuffleOptions = true;          // 是否对选项进行乱序显示
        this.originalOptions = [];           // 保存原始选项，用于还原
        this.optionMappings = [];            // 乱序情况下记录显示选项和原始选项的映射关系
        this.apiBase = `${window.location.protocol}//${window.location.host}/api`;  // 后端 API 基础地址

        // 绑定 UI 元素、事件，并初始化题库列表
        this.initializeElements();
        this.bindEvents();
        this.loadCategories();
        this.onPracticeModeChange();
    }

    initializeElements() {
        // -------------------- 控制区域元素 --------------------
        this.categorySelect = document.getElementById('category');
        this.practiceModeSelect = document.getElementById('practiceMode');
        this.questionCountInput = document.getElementById('questionCount');
        this.questionCountContainer = document.getElementById('questionCountContainer');
        this.shuffleOptionsSelect = document.getElementById('shuffleOptions');
        this.startBtn = document.getElementById('startBtn');

        // -------------------- 统计信息元素 --------------------
        this.statsContainer = document.getElementById('stats');
        this.totalQuestionsSpan = document.getElementById('totalQuestions');
        this.currentQuestionSpan = document.getElementById('currentQuestion');
        this.correctCountSpan = document.getElementById('correctCount');
        this.accuracySpan = document.getElementById('accuracy');

        // -------------------- 题目展示区域元素 --------------------
        this.questionContainer = document.getElementById('questionContainer');
        this.progressFill = document.getElementById('progressFill');
        this.questionTypeBadge = document.getElementById('questionTypeBadge');
        this.questionCode = document.getElementById('questionCode');
        this.questionChapter = document.getElementById('questionChapter');
        this.questionNumber = document.getElementById('questionNumber');
        this.questionText = document.getElementById('questionText');
        this.optionsContainer = document.getElementById('optionsContainer');
        this.resultContainer = document.getElementById('resultContainer');

        // -------------------- 题目导航与分页元素 --------------------
        this.questionNavigation = document.getElementById('questionNavigation');
        this.navGrid = document.getElementById('navGrid');
        this.showNavBtn = document.getElementById('showNavBtn');
        this.toggleNavBtn = document.getElementById('toggleNavBtn');
        this.prevPageBtn = document.getElementById('prevPageBtn');
        this.nextPageBtn = document.getElementById('nextPageBtn');
        this.pageInfo = document.getElementById('pageInfo');

        this.itemsPerPage = 50;  // 题目导航每页显示数量
        this.currentPage = 1;    // 当前导航页码
        this.totalPages = 1;     // 导航总页数

        // -------------------- 操作按钮 --------------------
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.submitBtn = document.getElementById('submitBtn');
        this.favoriteBtn = document.getElementById('favoriteBtn');

        // -------------------- 加载提示 --------------------
        this.loading = document.getElementById('loading');
    }

    bindEvents() {
        // 将常用操作与对应按钮绑定事件
        this.startBtn.addEventListener('click', () => this.startQuiz());
        this.practiceModeSelect.addEventListener('change', () => this.onPracticeModeChange());
        this.prevBtn.addEventListener('click', () => this.previousQuestion());
        this.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.submitBtn.addEventListener('click', () => this.submitAnswer());
        this.favoriteBtn.addEventListener('click', () => this.toggleFavorite());
        this.showNavBtn.addEventListener('click', () => this.toggleQuestionNavigation());
        this.toggleNavBtn.addEventListener('click', () => this.toggleQuestionNavigation());
        this.prevPageBtn.addEventListener('click', () => this.goToPreviousPage());
        this.nextPageBtn.addEventListener('click', () => this.goToNextPage());
    }

    async loadCategories() {
        // 向后端请求题库分类列表，并填充到下拉选项中
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
        // 根据练习模式隐藏/显示题目数量输入框
        const mode = this.practiceModeSelect.value;
        if (mode === 'sequential') {
            this.questionCountContainer.classList.add('hidden');
        } else {
            this.questionCountContainer.classList.remove('hidden');
        }
    }

    async startQuiz() {
        // -------------------- 基础参数校验 --------------------
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
            // -------------------- 根据练习模式调用不同接口 --------------------
            let url;
            if (practiceMode === 'sequential') {
                url = `${this.apiBase}/sequential_questions?category=${encodeURIComponent(category)}`;
            } else {
                url = `${this.apiBase}/random_questions?category=${encodeURIComponent(category)}&count=${questionCount}`;
            }

            const response = await fetch(url);
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            this.questions = data.questions || [];
            if (this.questions.length === 0) {
                alert('当前题库暂无题目，请稍后再试');
                this.resetInterface();
                return;
            }

            // 初始化作答状态
            this.currentQuestionIndex = 0;
            this.userAnswers = new Array(this.questions.length).fill('');
            this.optionMappings = new Array(this.questions.length).fill(null);
            this.correctCount = 0;
            this.originalOptions = this.questions.map(question => ({ ...question.options }));

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

    resetInterface() {
        // 当题库为空或发生错误时，隐藏题目区域
        this.questionContainer.style.display = 'none';
        this.statsContainer.style.display = 'none';
        this.resultContainer.style.display = 'none';
    }

    showLoading(show) {
        // 控制加载中动画的显示
        this.loading.style.display = show ? 'block' : 'none';
    }

    showQuizInterface() {
        // 显示题目区域与统计信息
        this.questionContainer.style.display = 'block';
        this.statsContainer.style.display = 'flex';
        this.updateStats();
    }

    displayQuestion() {
        // -------------------- 刷新当前题目的内容 --------------------
        const question = this.questions[this.currentQuestionIndex];

        // 更新进度条
        const progress = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
        this.progressFill.style.width = `${progress}%`;

        // 基本信息
        this.questionTypeBadge.textContent = question.type === 'single' ? '单选题' : '多选题';
        this.questionTypeBadge.className = `question-badge ${question.type === 'single' ? 'single-choice' : 'multiple-choice'}`;
        this.questionCode.textContent = question.code;
        this.questionChapter.textContent = `章节: ${question.chapter}`;
        this.questionNumber.textContent = `${this.currentQuestionIndex + 1}/${this.questions.length}`;
        this.questionText.textContent = question.question;

        // 展示配图与选项
        this.displayQuestionImage(question);
        this.displayOptions(question);

        // 刷新收藏按钮状态
        this.updateFavoriteButton();
        this.favoriteBtn.disabled = false;

        this.updateButtonStates();
        this.resultContainer.style.display = 'none';
        this.updateStats();
    }

    displayQuestionImage(question) {
        // 动态创建或复用配图容器，并根据题目信息展示图片
        let imageContainer = document.getElementById('question-image-container');
        if (!imageContainer) {
            imageContainer = document.createElement('div');
            imageContainer.id = 'question-image-container';
            imageContainer.className = 'question-image-container';
            const questionTextElement = document.querySelector('.question-text');
            questionTextElement.parentNode.insertBefore(imageContainer, questionTextElement.nextSibling);
        }
        imageContainer.innerHTML = '';
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
            img.onerror = function() {
                imageContainer.innerHTML = '<p style="color: #666; font-style: italic; margin: 15px 0;">配图加载失败</p>';
            };
            imageContainer.appendChild(img);
        }
    }

    displayOptions(question) {
        // -------------------- 显示题目选项，并处理乱序和选中状态 --------------------
        this.optionsContainer.innerHTML = '';
        let optionKeys = ['A', 'B', 'C', 'D'].filter(key => question.options[key]);
        let optionTexts = optionKeys.map(key => question.options[key]);

        // 乱序显示选项内容，但保留显示字母 A-D
        if (this.shuffleOptions) {
            optionTexts = this.shuffleArray([...optionTexts]);
        }

        const shuffledMapping = {};
        if (this.shuffleOptions) {
            const originalTextToKey = {};
            optionKeys.forEach(key => {
                originalTextToKey[question.options[key]] = key;
            });
            optionKeys.forEach((displayKey, index) => {
                const displayText = optionTexts[index];
                const originalKey = originalTextToKey[displayText];
                shuffledMapping[displayKey] = {
                    originalKey: originalKey,
                    text: displayText
                };
            });
        } else {
            optionKeys.forEach((key, index) => {
                shuffledMapping[key] = {
                    originalKey: key,
                    text: optionTexts[index]
                };
            });
        }

        // 记录当前题目的选项映射，提交答案时需要用到
        this.optionMappings[this.currentQuestionIndex] = shuffledMapping;

        optionKeys.forEach((displayKey, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            optionDiv.dataset.value = displayKey;

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
        // 用户点击某个选项后的处理逻辑：单选直接覆盖，多选则开关状态
        const question = this.questions[this.currentQuestionIndex];
        let userAnswer = this.userAnswers[this.currentQuestionIndex];

        if (question.type === 'single') {
            userAnswer = optionKey;
            this.optionsContainer.querySelectorAll('.option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.optionsContainer.querySelector(`[data-value="${optionKey}"]`).classList.add('selected');
        } else {
            if (userAnswer.includes(optionKey)) {
                userAnswer = userAnswer.replace(optionKey, '');
                this.optionsContainer.querySelector(`[data-value="${optionKey}"]`).classList.remove('selected');
            } else {
                userAnswer += optionKey;
                this.optionsContainer.querySelector(`[data-value="${optionKey}"]`).classList.add('selected');
            }
            userAnswer = userAnswer.split('').sort().join('');
        }

        this.userAnswers[this.currentQuestionIndex] = userAnswer;
        this.updateButtonStates();
    }

    async submitAnswer() {
        // -------------------- 调用接口校验答案 --------------------
        const question = this.questions[this.currentQuestionIndex];
        const userAnswer = this.userAnswers[this.currentQuestionIndex];

        if (!userAnswer) {
            alert('请选择答案');
            return;
        }

        let actualAnswer = userAnswer;
        const mapping = this.optionMappings[this.currentQuestionIndex];
        if (this.shuffleOptions && mapping) {
            // 将显示字母还原为原始选项字母，防止乱序导致判错
            actualAnswer = userAnswer.split('').map(letter => {
                const info = mapping[letter];
                return info ? info.originalKey : letter;
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
            result.user_answer = userAnswer;  // 保留用户在界面上看到的字母

            this.showResult(result);
            this.highlightCorrectAnswers(question, result);

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

    async toggleFavorite() {
        // -------------------- 收藏/取消收藏按钮逻辑 --------------------
        const question = this.questions[this.currentQuestionIndex];
        if (!question) {
            return;
        }
        this.favoriteBtn.disabled = true;

        try {
            const response = await fetch(`${this.apiBase}/favorites/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question_id: question.id,
                    category: this.categorySelect.value,
                    origin_category: question.origin_category
                })
            });

            const result = await response.json();
            if (result.error) {
                throw new Error(result.error);
            }

            // 同步当前题目列表中的收藏状态
            this.questions.forEach(q => {
                if (q.id === question.id) {
                    q.favorite = result.favorite;
                }
            });

            this.updateFavoriteButton();

            if (!result.favorite && this.categorySelect.value === '收藏夹') {
                console.log(`题目 ${question.code} 已从收藏夹移除`);
            }
        } catch (error) {
            console.error('更新收藏状态失败:', error);
            alert('更新收藏状态失败: ' + error.message);
        } finally {
            this.favoriteBtn.disabled = false;
        }
    }

    updateFavoriteButton() {
        // 根据题目收藏状态更新按钮文案与样式
        const question = this.questions[this.currentQuestionIndex];
        if (!question) {
            return;
        }
        const isFavorite = !!question.favorite;
        this.favoriteBtn.textContent = isFavorite ? '取消收藏' : '收藏';
        this.favoriteBtn.classList.toggle('btn-secondary', !isFavorite);
    }

    showResult(result) {
        // 展示答题结果，并将正确答案转换为当前显示字母
        this.resultContainer.style.display = 'block';
        this.resultContainer.className = `result ${result.correct ? 'correct' : 'incorrect'}`;

        const icon = result.correct ? '✅' : '❌';
        const status = result.correct ? '回答正确！' : '回答错误！';

        let displayUserAnswer = this.userAnswers[this.currentQuestionIndex] || '未选择';
        let displayCorrectAnswer = result.correct_answer;

        const mapping = this.optionMappings[this.currentQuestionIndex];
        if (this.shuffleOptions && mapping) {
            displayCorrectAnswer = result.correct_answer.split('').map(originalKey => {
                for (const [displayKey, info] of Object.entries(mapping)) {
                    if (info.originalKey === originalKey) {
                        return displayKey;
                    }
                }
                return originalKey;
            }).sort().join('');
        } else if (result.correct_answer.length > 1) {
            displayCorrectAnswer = result.correct_answer.split('').sort().join('');
        }

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
        // 题目提交后将正确选项标绿、错误选项标红
        const correctAnswers = result.correct_answer.split('');
        const userAnswers = result.user_answer.split('');
        const mapping = this.optionMappings[this.currentQuestionIndex];

        this.optionsContainer.querySelectorAll('.option').forEach(optionDiv => {
            const displayKey = optionDiv.dataset.value;
            optionDiv.classList.remove('correct', 'incorrect');

            let displayCorrectAnswers = correctAnswers;
            if (this.shuffleOptions && mapping) {
                displayCorrectAnswers = correctAnswers.map(originalKey => {
                    for (const [mappedKey, info] of Object.entries(mapping)) {
                        if (info.originalKey === originalKey) {
                            return mappedKey;
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
        // 根据当前题目位置与作答情况控制按钮可用状态
        const hasAnswer = this.userAnswers[this.currentQuestionIndex] !== '';
        this.prevBtn.disabled = this.currentQuestionIndex === 0;
        this.nextBtn.disabled = this.currentQuestionIndex === this.questions.length - 1;
        this.submitBtn.disabled = !hasAnswer;
    }

    updateStats() {
        // 刷新统计信息及导航
        this.totalQuestionsSpan.textContent = this.questions.length;
        this.currentQuestionSpan.textContent = this.currentQuestionIndex + 1;
        this.correctCountSpan.textContent = this.correctCount;

        const answeredCount = this.userAnswers.filter(answer => answer !== '').length;
        const accuracy = answeredCount > 0 ? Math.round((this.correctCount / answeredCount) * 100) : 0;
        this.accuracySpan.textContent = `${accuracy}%`;

        this.updateQuestionNavigation();
    }

    shuffleArray(array) {
        // Fisher-Yates 洗牌算法
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    initializeQuestionNavigation() {
        // 初始化题目导航网格与分页
        this.totalPages = Math.ceil(this.questions.length / this.itemsPerPage);
        this.currentPage = Math.ceil((this.currentQuestionIndex + 1) / this.itemsPerPage);
        this.renderCurrentPage();
        this.updatePaginationControls();
        this.updateQuestionNavigation();
    }

    toggleQuestionNavigation() {
        // 展开/收起题目导航面板
        const isVisible = this.questionNavigation.style.display !== 'none';
        this.questionNavigation.style.display = isVisible ? 'none' : 'block';
        this.showNavBtn.textContent = isVisible ? '题目导航' : '隐藏导航';
        this.toggleNavBtn.textContent = isVisible ? '展开' : '收起';
    }

    updateQuestionNavigation() {
        // 更新导航中每一题的颜色状态（当前题、已答对、答错/未确认）
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

    renderCurrentPage() {
        // 生成当前页的题号按钮
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

    updatePaginationControls() {
        // 按照当前页刷新上一页/下一页按钮与页码文字
        this.pageInfo.textContent = `第 ${this.currentPage} 页，共 ${this.totalPages} 页`;
        this.prevPageBtn.disabled = this.currentPage <= 1;
        this.nextPageBtn.disabled = this.currentPage >= this.totalPages;
    }

    goToPreviousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderCurrentPage();
            this.updatePaginationControls();
            this.updateQuestionNavigation();
        }
    }

    goToNextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.renderCurrentPage();
            this.updatePaginationControls();
            this.updateQuestionNavigation();
        }
    }

    jumpToQuestion(index) {
        // 点击导航跳转到指定题目
        if (index >= 0 && index < this.questions.length) {
            this.currentQuestionIndex = index;
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

// DOM 加载完成后启动应用
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});