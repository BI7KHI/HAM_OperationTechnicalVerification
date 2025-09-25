# 业余无线电台操作技术能力验证题库及其练习程序(2025)

这个项目包含业余无线电台操作技术能力验证的题库，包括 A、B、C 类 PDF 和 CSV 文件，以及相关图像。程序提供在线练习功能，用于模拟考试。

CRAC题库(PDF)链接🔗[资料下载详细-中国无线电协会业余无线电分会](http://www.crac.org.cn/News/Detail?ID=d11def30d20d4d8fb12e08e7160e607d)

练习程序已构建，后端使用 Python (app.py)，前端使用 HTML/JS (index.html, script.js)。

发现或者遇到bug请提交issue谢谢喵

在线答题: [2025新版业余无线电题库在线练习](http://81.68.144.16:5000)

## 项目结构

- **QB_PDF/**: PDF 题库文件和提取的 CSV

- **QB_CSV/**: 提取的 CSV 题库文件

- **QB_image/**: 题库相关图像文件 (PNG)

- **app.py**: Flask 后端服务器

- **index.html**, **script.js**: 前端网页和脚本

- **requirements.txt**: Python 依赖列表

- **deploy.sh**, **gunicorn.conf.py**: 部署脚本和配置

- **extract_qb_to_csv.py**: PDF 到 CSV 提取脚本

# 本地部署方式 How To Use

1. 安装 Python 3.12 或更高版本

2.安装requirements.txt

`pip install -r requirements.txt`

3.运行app.py

`python app.py`

4.打开浏览器输入localhost:5000或127.0.0.1:5000即可访问

# 生产部署 (可选)

- 使用 deploy.sh 脚本进行部署。

- 或手动运行 Gunicorn: gunicorn -c gunicorn.conf.py app:app

注意: 确保服务器环境配置正确，并处理端口和安全设置。

