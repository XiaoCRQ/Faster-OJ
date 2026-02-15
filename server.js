const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 10044, host: "127.0.0.1" });

wss.on("connection", (ws, req) => {
  console.log("客户端已连接:", req.socket.remoteAddress);

  ws.on("message", (message) => {
    console.log("收到数据:", message.toString());

    let data;
    try {
      data = JSON.parse(message.toString());
      console.log("解析后的 JSON:", data);
    } catch (err) {
      console.error("不是合法 JSON:", err);
      return;
    }

    // 广播给所有客户端
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on("error", (err) => console.error("WebSocket 错误:", err));
});

console.log("ws://127.0.0.1:10044 已启动");

