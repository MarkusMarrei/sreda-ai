import os
import json
import re
import requests
from typing import Dict, Any, List, Optional

class MCPManager:
    """
    Model Context Protocol (MCP) Client & Integrator for SREDA AI.
    Specifically supports Blender MCP (default port 9876) and general HTTP/SSE JSON-RPC 2.0 endpoints.
    """
    def __init__(self):
        self.default_blender_port = 9876
        self.default_blender_url = f"http://127.0.0.1:{self.default_blender_port}"

    def test_connection(self, url: str) -> Dict[str, Any]:
        """Test whether an MCP server is reachable at the given URL."""
        if not url.startswith("http://") and not url.startswith("https://"):
            url = f"http://127.0.0.1:{url}" if url.isdigit() else f"http://{url}"

        # 1. Try standard JSON-RPC 2.0 tools/list
        try:
            payload = {
                "jsonrpc": "2.0",
                "id": "sreda-mcp-ping",
                "method": "tools/list",
                "params": {}
            }
            res = requests.post(url, json=payload, timeout=2.5)
            if res.status_code == 200:
                data = res.json()
                tools = data.get("result", {}).get("tools", [])
                return {
                    "connected": True,
                    "url": url,
                    "protocol": "json-rpc-2.0",
                    "tools": tools,
                    "message": f"Соединение успешно установлено! Обнаружено инструментов: {len(tools)}"
                }
        except Exception:
            pass

        # 2. Try HTTP GET endpoint (health / info / SSE handshake)
        try:
            res = requests.get(url, timeout=2)
            if res.status_code in (200, 404, 405):
                return {
                    "connected": True,
                    "url": url,
                    "protocol": "http-handshake",
                    "tools": self.get_known_blender_tools() if "9876" in url or "blender" in url.lower() else [],
                    "message": f"MCP сервер активен на {url} (HTTP {res.status_code})"
                }
        except Exception as e:
            return {
                "connected": False,
                "url": url,
                "error": f"Не удалось подключиться к {url}: {e}"
            }

        return {
            "connected": False,
            "url": url,
            "error": "Сервер не ответил на запросы рукопожатия MCP."
        }

    def call_tool(self, server_url: str, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Invoke an MCP tool on the external server via JSON-RPC 2.0."""
        if not server_url.startswith("http://") and not server_url.startswith("https://"):
            server_url = f"http://127.0.0.1:{server_url}" if server_url.isdigit() else f"http://{server_url}"

        payload = {
            "jsonrpc": "2.0",
            "id": f"sreda-call-{tool_name}",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        try:
            res = requests.post(server_url, json=payload, timeout=40)
            if res.status_code == 200:
                data = res.json()
                result = data.get("result", data)
                return {"success": True, "result": result}
            return {
                "success": False,
                "error": f"HTTP {res.status_code}: {res.text[:300]}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Ошибка соединения с {server_url}: {e}"
            }

    def get_known_blender_tools(self) -> List[Dict[str, Any]]:
        """Standard Blender MCP tool signatures for scene manipulation."""
        return [
            {
                "name": "blender_object_create",
                "description": "Создать 3D примитив (cube, sphere, cylinder, plane, monkey, text)",
                "parameters": {"type": "string", "name": "string", "location": "list[float]", "scale": "list[float]"}
            },
            {
                "name": "blender_material_create",
                "description": "Создать и настроить PBR материал (Principled BSDF: base_color, metallic, roughness)",
                "parameters": {"name": "string", "color": "list[float]", "metallic": "float", "roughness": "float"}
            },
            {
                "name": "blender_execute_script",
                "description": "Выполнить Python-скрипт bpy непосредственно внутри запущенного Blender",
                "parameters": {"code": "string"}
            },
            {
                "name": "blender_scene_info",
                "description": "Получить информацию об объектах, камерах и настройках сцены Blender",
                "parameters": {}
            },
            {
                "name": "blender_render_image",
                "description": "Выполнить рендер активной сцены в файл изображения",
                "parameters": {"output_path": "string"}
            }
        ]

    def parse_mcp_calls_from_text(self, text: str) -> List[Dict[str, Any]]:
        """Extract [MCP_CALL: ...] tags from model generation."""
        calls = []
        # Match [MCP_CALL: server="blender", tool="...", args={...}]
        pattern = r'\[MCP_CALL:\s*server="([^"]+)"(?:,\s*port=(\d+))?,\s*tool="([^"]+)"(?:,\s*args=(\{.*?\}))?\]'
        for match in re.finditer(pattern, text, re.DOTALL):
            server = match.group(1)
            port = int(match.group(2)) if match.group(2) else self.default_blender_port
            tool = match.group(3)
            args_raw = match.group(4) or "{}"
            try:
                args = json.loads(args_raw)
            except Exception:
                args = {"raw": args_raw}

            calls.append({
                "server": server,
                "port": port,
                "url": f"http://127.0.0.1:{port}",
                "tool": tool,
                "args": args
            })
        return calls
