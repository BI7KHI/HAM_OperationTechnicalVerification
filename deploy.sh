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


source venv/bin/activate
python app.py

echo "部署完成！"
echo ""
echo "应用应该在以下地址可访问:"
echo "本地访问: http://localhost:5000"
echo "网络访问: http://$(hostname -I | awk '{print $1}'):5000"
echo "外网访问: http://您的服务器IP:5000"