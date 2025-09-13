#!/bin/bash

# HAM操作技术验证系统部署脚本
# 适用于Linux服务器部署

echo "开始部署HAM操作技术验证系统..."

# 检查Python3是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误: Python3未安装，请先安装Python3"
    exit 1
fi

# 检查pip是否安装
if ! command -v pip3 &> /dev/null; then
    echo "错误: pip3未安装，请先安装pip3"
    exit 1
fi

# 创建虚拟环境
echo "创建Python虚拟环境..."
python3 -m venv venv

# 激活虚拟环境
echo "激活虚拟环境..."
source venv/bin/activate

# 升级pip
echo "升级pip..."
pip install --upgrade pip

# 安装依赖
echo "安装Python依赖包..."
pip install -r requirements.txt

# 检查端口5000是否被占用
echo "检查端口5000状态..."
if netstat -tuln | grep :5000 > /dev/null; then
    echo "警告: 端口5000已被占用，请检查或更改端口"
fi

# 创建systemd服务文件
echo "创建系统服务配置..."
sudo tee /etc/systemd/system/ham-quiz.service > /dev/null <<EOF
[Unit]
Description=HAM Operation Technical Verification System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/venv/bin
ExecStart=$(pwd)/venv/bin/gunicorn --bind 0.0.0.0:5000 --workers 4 app:app
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# 重新加载systemd
echo "重新加载systemd配置..."
sudo systemctl daemon-reload

# 启用服务
echo "启用HAM Quiz服务..."
sudo systemctl enable ham-quiz.service

# 启动服务
echo "启动HAM Quiz服务..."
sudo systemctl start ham-quiz.service

# 检查服务状态
echo "检查服务状态..."
sudo systemctl status ham-quiz.service

# 检查防火墙状态
echo "检查防火墙配置..."
if command -v ufw &> /dev/null; then
    echo "检测到UFW防火墙"
    sudo ufw allow 5000/tcp
    echo "已开放端口5000"
elif command -v firewall-cmd &> /dev/null; then
    echo "检测到firewalld防火墙"
    sudo firewall-cmd --permanent --add-port=5000/tcp
    sudo firewall-cmd --reload
    echo "已开放端口5000"
else
    echo "未检测到常见防火墙，请手动开放端口5000"
fi

echo "部署完成！"
echo "服务状态: sudo systemctl status ham-quiz.service"
echo "查看日志: sudo journalctl -u ham-quiz.service -f"
echo "重启服务: sudo systemctl restart ham-quiz.service"
echo "停止服务: sudo systemctl stop ham-quiz.service"
echo ""
echo "应用应该在以下地址可访问:"
echo "本地访问: http://localhost:5000"
echo "网络访问: http://$(hostname -I | awk '{print $1}'):5000"
echo "外网访问: http://您的服务器IP:5000"