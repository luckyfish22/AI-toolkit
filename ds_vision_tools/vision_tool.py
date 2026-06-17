"""
多模态视觉工具 — 为纯文本 Agent 提供"眼睛"
=============================================
你的主模型（DeepSeek）没有视觉能力，但它可以调用这个工具来看图。
支持豆包(Doubao/Volcano Ark)和 Kimi(Moonshot)作为视觉后端。

两种用法：
  1. CLI（agent 通过 subprocess 调用）：
     python vision_tool.py -i screenshot.png -q "这张图里有什么？"
     python vision_tool.py -i diagram.png -q "描述架构" --backend kimi

  2. import（agent 在代码里直接调）：
     from vision_tool import describe_image
     text = describe_image("screenshot.png", "这张图里有什么？")

环境变量（二选一，优先用哪个后端就设哪个）：
  DOUBAO_API_KEY=xxx      # 豆包 API Key（火山引擎 ARK）
  KIMI_API_KEY=xxx        # Kimi API Key（月之暗面 Moonshot）
"""

import os
import sys
import json
import base64
import argparse
from pathlib import Path
from typing import Optional

import requests

# ── .env 文件加载（优先级最低，不会覆盖已有的环境变量）──────────────

def _load_dotenv() -> None:
    """加载脚本同目录下的 .env 文件，解析 KEY=VALUE 行"""
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip()
            # 去掉引号
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            # 环境变量优先，.env 只是兜底
            if key not in os.environ:
                os.environ[key] = value

_load_dotenv()

# ── 配置 ──────────────────────────────────────────────────────────────

# 代理设置（可选，在 .env 里写 VISION_PROXY=http://127.0.0.1:7897 或设环境变量）
PROXY_URL = os.environ.get("VISION_PROXY", os.environ.get("HTTPS_PROXY", ""))

# 后端配置表
BACKENDS = {
    "doubao": {
        # 豆包原生 REST API（/api/v3/responses），直接传模型名，不需要端点 ID
        "url": "https://ark.cn-beijing.volces.com/api/v3/responses",
        "model": "doubao-seed-1-6-vision-250815",  # 最新视觉模型
        "key_env": "DOUBAO_API_KEY",
        "model_env": "DOUBAO_MODEL",
        "format": "doubao_native",  # 标记用豆包原生格式
    },
    "kimi": {
        "url": "https://api.moonshot.cn/v1/chat/completions",
        "model": "moonshot-v1-8k-vision-preview",  # Kimi 视觉模型
        "key_env": "KIMI_API_KEY",
    },
}


# ── 核心函数 ──────────────────────────────────────────────────────────

def _encode_image(image_path: str) -> str:
    """读取图片文件，返回 base64 data URL 字符串"""
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"图片不存在: {image_path}")

    ext = path.suffix.lower()
    mime_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
    }
    mime = mime_map.get(ext, "image/png")

    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    return f"data:{mime};base64,{b64}"


def describe_image(
    image_path: str,
    question: str = "请详细描述这张图片的内容。",
    backend: str = "doubao",
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    use_proxy: Optional[bool] = None,
    max_tokens: int = 1024,
    timeout: int = 60,
) -> str:
    """
    让多模态 AI 看一张图，返回文字描述。

    参数:
        image_path: 本地图片路径
        question:   你想问的问题（"图里有什么？""描述架构""翻译文字"等）
        backend:    "doubao" 或 "kimi"
        api_key:    API Key（不传则读环境变量）
        model:      模型名（不传则用默认值）
        use_proxy:  True=强制走代理, False=强制直连, None=跟随 .env 配置（默认）
        max_tokens: 最大输出 token 数
        timeout:    请求超时秒数

    返回:
        AI 的文字描述
    """
    cfg = BACKENDS.get(backend)
    if cfg is None:
        raise ValueError(f"不支持的后端: {backend}，可选: {list(BACKENDS.keys())}")

    # 获取 API Key
    api_key = api_key or os.environ.get(cfg["key_env"], "")
    if not api_key:
        raise ValueError(
            f"未找到 {cfg['key_env']}。请任选一种方式配置：\n"
            f"  1. 在 {Path(__file__).parent / '.env'} 文件中写入 {cfg['key_env']}=你的key\n"
            f"  2. 或设置系统环境变量 set {cfg['key_env']}=你的key\n"
            f"  3. 或传入 api_key 参数"
        )

    model = model or os.environ.get(cfg.get("model_env", ""), "") or cfg["model"]
    image_data_url = _encode_image(image_path)
    fmt = cfg.get("format", "openai")  # doubao_native 或 openai

    if fmt == "doubao_native":
        # 豆包原生格式: /api/v3/responses
        body = {
            "model": model,
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_image", "image_url": image_data_url},
                        {"type": "input_text", "text": question},
                    ],
                }
            ],
        }
    else:
        # OpenAI 兼容格式: /v1/chat/completions（Kimi 等）
        body = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                        {"type": "text", "text": question},
                    ],
                }
            ],
            "max_tokens": max_tokens,
        }

    # 代理控制：use_proxy=True 走代理，False 直连，None 跟随 .env
    if use_proxy is True:
        proxies = {"https": PROXY_URL} if PROXY_URL else None
    elif use_proxy is False:
        proxies = None  # 强制直连
    else:
        proxies = {"https": PROXY_URL} if PROXY_URL else None  # 默认行为：有代理就用
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    resp = requests.post(
        cfg["url"],
        headers=headers,
        json=body,
        proxies=proxies,
        timeout=timeout,
    )
    resp.raise_for_status()

    data = resp.json()

    if fmt == "doubao_native":
        # 豆包 /api/v3/responses 返回格式
        # 可能有两种：openai 兼容的 choices，或 output 数组
        if "output" in data:
            for item in data["output"]:
                for c in item.get("content", []):
                    if c.get("type") == "output_text":
                        return c["text"]
        if "choices" in data:
            return data["choices"][0]["message"]["content"]
        # 兜底：打印原始响应
        return json.dumps(data, ensure_ascii=False)
    else:
        # OpenAI 兼容格式
        return data["choices"][0]["message"]["content"]


# ── CLI 入口 ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="多模态视觉工具 — 让纯文本 Agent 拥有看图能力",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python vision_tool.py -i screenshot.png
  python vision_tool.py -i diagram.png -q "描述这张架构图，列出所有组件"
  python vision_tool.py -i photo.jpg -q "图里有什么？" --backend kimi
  python vision_tool.py -i chart.png --model doubao-vision-pro-32k
  python vision_tool.py -i test.png --no-proxy       # 强制直连
  python vision_tool.py -i test.png --proxy           # 强制走代理
        """,
    )
    parser.add_argument("-i", "--image", required=True, help="本地图片路径")
    parser.add_argument("-q", "--question", default="请详细描述这张图片的内容。", help="对图片的提问（默认: 描述内容）")
    parser.add_argument("--backend", default="doubao", choices=["doubao", "kimi"], help="视觉后端（默认: doubao）")
    parser.add_argument("--api-key", default=None, help="API Key（不传则读环境变量）")
    parser.add_argument("--model", default=None, help="模型名（不传则用默认值）")
    parser.add_argument("--max-tokens", type=int, default=1024, help="最大输出 token 数（默认: 1024）")
    parser.add_argument("--timeout", type=int, default=60, help="请求超时秒数（默认: 60）")
    proxy_group = parser.add_mutually_exclusive_group()
    proxy_group.add_argument("--proxy", action="store_true", dest="use_proxy", default=None, help="强制走代理")
    proxy_group.add_argument("--no-proxy", action="store_false", dest="use_proxy", default=None, help="强制直连")
    parser.add_argument("--json", action="store_true", help="以 JSON 格式输出（方便 agent 解析）")

    args = parser.parse_args()

    try:
        result = describe_image(
            image_path=args.image,
            question=args.question,
            backend=args.backend,
            api_key=args.api_key,
            model=args.model,
            use_proxy=args.use_proxy,
            max_tokens=args.max_tokens,
            timeout=args.timeout,
        )

        if args.json:
            print(json.dumps({"ok": True, "result": result}, ensure_ascii=False))
        else:
            print(result)

    except Exception as e:
        if args.json:
            print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))
        else:
            print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
