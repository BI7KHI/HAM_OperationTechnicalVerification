# HAM系统外网访问问题解决方案

## 问题现状

✅ **Flask应用运行正常**
- 应用已成功启动并运行在 `10.0.12.4:5000`
- 数据加载完成，共4483道题目
- 内网访问正常，有外部访问日志记录

❌ **外网访问失败**
- 浏览器显示："无法连接到服务器，请确保后端服务正在运行"
- 外网IP `81.68.144.16:5000` 无法访问

## 问题分析

根据日志分析，Flask应用本身运行正常，问题出现在网络层面：

1. **防火墙阻止**：服务器防火墙可能阻止5000端口的外网访问
2. **安全组限制**：云服务器安全组未开放5000端口
3. **网络配置**：网络接口或路由配置问题

## 立即解决方案

### 方案一：使用自动修复脚本（推荐）

```bash
# 在服务器上运行
cd /crac_test

# 上传并运行修复脚本
chmod +x fix_network.sh
bash fix_network.sh
```

### 方案二：手动修复步骤

#### 1. 检查并配置防火墙

```bash
# 检查UFW状态
sudo ufw status

# 允许5000端口
sudo ufw allow 5000
sudo ufw reload

# 或者临时禁用防火墙测试
sudo ufw disable
```

#### 2. 检查云服务器安全组

**重要：这是最常见的问题原因**

1. 登录云服务器管理控制台
2. 找到当前服务器的安全组设置
3. 添加入站规则：
   - **协议**：TCP
   - **端口**：5000
   - **源地址**：0.0.0.0/0（允许所有IP访问）
   - **描述**：HAM Quiz System

#### 3. 验证端口监听

```bash
# 检查端口监听状态
netstat -tlnp | grep :5000

# 应该看到类似输出：
# tcp 0 0 0.0.0.0:5000 0.0.0.0:* LISTEN 12345/python
```

#### 4. 测试连接

```bash
# 测试本地连接
curl http://localhost:5000
curl http://10.0.12.4:5000

# 测试外网连接（从其他机器）
curl http://81.68.144.16:5000
```

## 诊断工具

### 运行网络诊断

```bash
# 上传并运行诊断脚本
chmod +x network_diagnosis.sh
bash network_diagnosis.sh
```

诊断脚本会检查：
- Flask应用进程状态
- 端口监听情况
- 防火墙配置
- 网络接口状态
- 本地连接测试

## 常见错误和解决方法

### 错误1：端口被占用
```bash
# 查找占用5000端口的进程
sudo lsof -i :5000

# 杀死占用进程
sudo kill -9 <PID>
```

### 错误2：权限问题
```bash
# 使用sudo运行Flask应用
sudo python app.py

# 或者更改端口到8000
python app.py --port 8000
```

### 错误3：网络接口绑定问题
确保Flask应用绑定到 `0.0.0.0:5000` 而不是 `127.0.0.1:5000`

## 生产环境部署（推荐）

为了更稳定的外网访问，建议使用Nginx反向代理：

```bash
# 安装Nginx
sudo apt update
sudo apt install nginx

# 使用提供的nginx.conf配置
sudo cp nginx.conf /etc/nginx/sites-available/ham-quiz
sudo ln -s /etc/nginx/sites-available/ham-quiz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 使用Gunicorn运行Flask
gunicorn --bind 127.0.0.1:5000 --workers 2 app:app
```

这样可以通过80端口访问：`http://81.68.144.16`

## 验证步骤

修复完成后，按以下步骤验证：

1. **检查服务状态**
   ```bash
   ps aux | grep python
   netstat -tlnp | grep :5000
   ```

2. **测试本地访问**
   ```bash
   curl -I http://localhost:5000
   ```

3. **测试外网访问**
   - 浏览器访问：`http://81.68.144.16:5000`
   - 应该看到HAM题库系统界面

## 联系支持

如果按照以上步骤仍无法解决问题，请提供以下信息：

1. 网络诊断脚本的完整输出
2. 云服务器安全组配置截图
3. Flask应用的完整日志
4. 服务器系统版本和网络配置

---

**最后更新**：2025年9月13日
**适用版本**：HAM Operation Technical Verification System v1.0