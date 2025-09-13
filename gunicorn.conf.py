# Gunicorn配置文件
# 用于生产环境部署HAM操作技术验证系统

import multiprocessing

# 服务器绑定地址和端口
bind = "0.0.0.0:5000"

# 工作进程数量（建议为CPU核心数的2倍）
workers = multiprocessing.cpu_count() * 2 + 1

# 工作进程类型
worker_class = "sync"

# 每个工作进程的最大请求数
max_requests = 1000
max_requests_jitter = 100

# 超时设置
timeout = 30
keepalive = 2

# 预加载应用
preload_app = True

# 日志配置
accesslog = "/var/log/ham-quiz/access.log"
errorlog = "/var/log/ham-quiz/error.log"
loglevel = "info"

# 进程名称
proc_name = "ham-quiz"

# 用户和组（可选，建议使用非root用户）
# user = "www-data"
# group = "www-data"

# PID文件
pidfile = "/var/run/ham-quiz.pid"

# 守护进程模式（设为False以便systemd管理）
daemon = False

# 临时目录
tmp_upload_dir = None

# SSL配置（如果需要HTTPS）
# keyfile = "/path/to/keyfile"
# certfile = "/path/to/certfile"