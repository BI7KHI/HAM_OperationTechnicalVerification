# HAM操作技术验证系统部署故障排除指南

## 常见问题及解决方案

### 1. 无法连接到服务器

#### 问题症状
- 浏览器显示"无法连接到服务器"
- 连接超时或拒绝连接

#### 排查步骤

**步骤1: 检查应用是否正在运行**
```bash
# 检查进程
ps aux | grep python
ps aux | grep gunicorn

# 检查systemd服务状态
sudo systemctl status ham-quiz.service

# 查看服务日志
sudo journalctl -u ham-quiz.service -f
```

**步骤2: 检查端口监听状态**
```bash
# 检查端口5000是否被监听
sudo netstat -tlnp | grep :5000
# 或者使用ss命令
sudo ss -tlnp | grep :5000
```

**步骤3: 检查防火墙设置**
```bash
# Ubuntu/Debian (UFW)
sudo ufw status
sudo ufw allow 5000/tcp

# CentOS/RHEL (firewalld)
sudo firewall-cmd --list-ports
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --reload

# 检查iptables
sudo iptables -L -n | grep 5000
```

**步骤4: 测试本地连接**
```bash
# 在服务器上测试本地连接
curl http://localhost:5000
curl http://127.0.0.1:5000

# 测试网络接口
curl http://0.0.0.0:5000
```

### 2. Flask应用启动失败

#### 问题症状
- 服务启动时报错
- ImportError或ModuleNotFoundError

#### 解决方案

**检查Python环境**
```bash
# 激活虚拟环境
source venv/bin/activate

# 检查Python版本
python --version

# 检查已安装的包
pip list

# 重新安装依赖
pip install -r requirements.txt
```

**常见依赖问题修复**
```bash
# 如果遇到Werkzeug版本问题
pip uninstall flask flask-cors werkzeug -y
pip install flask==2.3.3 flask-cors==4.0.0 werkzeug==2.3.7

# 如果遇到其他依赖问题
pip install --upgrade pip
pip install --force-reinstall -r requirements.txt
```

### 3. 权限问题

#### 问题症状
- Permission denied错误
- 无法创建日志文件
- 无法绑定端口

#### 解决方案

**创建必要的目录和设置权限**
```bash
# 创建日志目录
sudo mkdir -p /var/log/ham-quiz
sudo chown $USER:$USER /var/log/ham-quiz

# 如果使用1024以下端口，需要特殊权限
# 建议使用8000等高端口，或配置Nginx反向代理
```

### 4. 网络访问问题

#### 问题症状
- 本地可以访问，外网无法访问
- 特定IP无法访问

#### 解决方案

**检查服务器网络配置**
```bash
# 检查网络接口
ip addr show

# 检查路由
ip route show

# 检查DNS解析
nslookup your-domain.com
```

**检查云服务器安全组**
- 阿里云: 在ECS控制台检查安全组规则
- 腾讯云: 在CVM控制台检查安全组规则
- AWS: 检查Security Groups设置
- 确保入站规则允许端口5000的TCP连接

### 5. 性能问题

#### 问题症状
- 响应缓慢
- 连接超时
- 高负载

#### 解决方案

**优化Gunicorn配置**
```python
# 在gunicorn.conf.py中调整
workers = 4  # 根据CPU核心数调整
worker_connections = 1000
timeout = 30
keepalive = 2
```

**监控系统资源**
```bash
# 检查CPU和内存使用
top
htop

# 检查磁盘使用
df -h

# 检查网络连接
ss -tuln
```

## 部署检查清单

### 服务器环境
- [ ] Python 3.7+ 已安装
- [ ] pip 已安装
- [ ] 虚拟环境已创建并激活
- [ ] 所有依赖包已安装

### 应用配置
- [ ] Flask应用配置正确 (host='0.0.0.0')
- [ ] 端口配置正确 (默认5000)
- [ ] 题库文件存在且可读
- [ ] 静态文件路径正确

### 网络配置
- [ ] 防火墙已开放相应端口
- [ ] 云服务器安全组已配置
- [ ] Nginx配置正确（如果使用）
- [ ] 域名解析正确（如果使用）

### 服务配置
- [ ] systemd服务文件已创建
- [ ] 服务已启用并启动
- [ ] 日志目录已创建且有写权限
- [ ] 服务可以正常重启

## 常用命令

```bash
# 重启服务
sudo systemctl restart ham-quiz.service

# 查看实时日志
sudo journalctl -u ham-quiz.service -f

# 检查服务状态
sudo systemctl status ham-quiz.service

# 重新加载配置
sudo systemctl daemon-reload

# 测试连接
curl -I http://localhost:5000

# 查看端口占用
sudo lsof -i :5000
```

## 联系支持

如果以上步骤都无法解决问题，请提供以下信息：
1. 操作系统版本
2. Python版本
3. 错误日志内容
4. 网络环境描述
5. 已尝试的解决步骤