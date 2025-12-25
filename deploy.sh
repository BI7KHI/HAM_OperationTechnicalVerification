# HAM操作技术验证系统部署脚本
# 适用于Linux服务器部署

echo "开始部署HAM操作技术验证系统..."
source venv/bin/activate
python app.py
echo ""
echo "应用应该在以下地址可访问:"
echo "本地访问: http://localhost:5000"
echo "网络访问: http://$(hostname -I | awk '{print $1}'):5000"
echo "外网访问: http://您的服务器IP:5000"