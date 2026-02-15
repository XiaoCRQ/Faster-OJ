import asyncio
import json
import websockets

url = "https://www.luogu.com.cn/problem/P1001"
code = r"""
#include <bits/stdc++.h>
#define EACH(a) for (auto &it : a)
#define REP(i, n) for (ll i = 0, _ = (n); i < _; i++)
#define REPD(i, n) for (ll i = (ll)(n) - 1, _ = 0; i >= _; i--)

using namespace std;
using ll = long long;
using pl = pair<ll, ll>;
using vl = vector<ll>;
using vpl = vector<pl>;
const ll MOD = 998244353;

void solve() {}

int main() {
  cin.tie(0)->ios::sync_with_stdio(0);
  ll a, b;
  cin >> a >> b;
  cout << a + b << '\n';
}
"""

# url = "https://codeforces.com/problemset/problem/4/A"
# code = r"""
# #include <bits/stdc++.h>
# using namespace std;
#
# static inline void fast_io() {
#   ios::sync_with_stdio(false);
#   cin.tie(nullptr);
# }
#
# int main() {
#   fast_io();
#
#   int w;
#   cin >> w;
#
#   if (w % 2 == 0 && w > 2)
#     cout << "YES";
#   else
#     cout << "NO";
#   return 0;
# }"""

async def send_json():
    uri = "ws://127.0.0.1:10044"  # 非加密 WS，不需要 ssl

    print("正在连接到服务器...")
    async with websockets.connect(uri) as websocket:
        print("连接成功，发送数据...")
        data = {"url": url, "code": code}
        await websocket.send(json.dumps(data))
        print("已发送:", data)

# 运行
asyncio.run(send_json())

