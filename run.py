import os
import sys
import time
import subprocess
import threading
from pathlib import Path

# Force UTF-8 and line buffering for real-time console display
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True, encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(line_buffering=True, encoding='utf-8')

BASE_DIR = Path(__file__).resolve().parent

def cleanup_stale_processes():
    """Terminate any stale processes on port 8000 (FastAPI), 8080 (llama-server), or 1234 (LM Studio API)."""
    print("[*] Проверка и освобождение системных портов (8000, 8080, 1234)...")
    try:
        current_pid = os.getpid()
        # Use PowerShell Get-NetTCPConnection for 100% reliable process termination on Windows
        ps_cmd = (
            f"$curr = {current_pid}; "
            "$ports = @(8000, 8080, 1234); "
            "Get-NetTCPConnection -ErrorAction SilentlyContinue | "
            "Where-Object { $ports -contains $_.LocalPort -and $_.OwningProcess -ne $curr -and $_.OwningProcess -gt 0 } | "
            "ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
        )
        subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=6)
        
        # Kill orphan llama-server processes
        subprocess.run('taskkill /F /IM llama-server.exe /T', shell=True, capture_output=True)
        time.sleep(0.5)
    except Exception as e:
        print(f"[!] Предупреждение при очистке портов: {e}")

def find_edge():
    """Find Microsoft Edge or Chrome executable."""
    candidates = [
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None

def ensure_desktop_shortcut():
    """Ensure Windows desktop shortcut with SREDA AI branding icon exists."""
    if os.name != 'nt':
        return
    try:
        ico_path = BASE_DIR / "frontend" / "favicon.ico"
        bat_path = BASE_DIR / "run.bat"
        if not ico_path.exists() or not bat_path.exists():
            return
            
        desktop_candidates = [
            Path(os.path.expanduser("~/Desktop")),
            Path(os.environ.get("OneDrive", "")) / "Desktop",
            BASE_DIR.parent
        ]
        for d in desktop_candidates:
            if d and d.exists() and d.is_dir():
                sc_path = d / "SREDA AI.lnk"
                vbs_code = (
                    f'Set oWS = WScript.CreateObject("WScript.Shell")\n'
                    f'Set oLink = oWS.CreateShortcut("{str(sc_path)}")\n'
                    f'oLink.TargetPath = "{str(bat_path)}"\n'
                    f'oLink.WorkingDirectory = "{str(BASE_DIR)}"\n'
                    f'oLink.IconLocation = "{str(ico_path)},0"\n'
                    f'oLink.Description = "SREDA AI — Multimodal Workstation"\n'
                    f'oLink.Save\n'
                )
                vbs_file = BASE_DIR / f"_sc_{os.getpid()}.vbs"
                vbs_file.write_text(vbs_code, encoding="utf-16")
                subprocess.run(["cscript", "//nologo", str(vbs_file)], capture_output=True, timeout=4)
                if vbs_file.exists():
                    vbs_file.unlink()
    except Exception:
        pass

def apply_window_branding():
    """Inject SREDA AI icon into the window caption and taskbar via Win32 WM_SETICON."""
    if os.name != 'nt':
        return
    try:
        import ctypes
        from ctypes import wintypes
        ico_path = BASE_DIR / "frontend" / "favicon.ico"
        if not ico_path.exists():
            return

        user32 = ctypes.windll.user32
        WM_SETICON = 0x80
        ICON_SMALL = 0
        ICON_BIG = 1
        IMAGE_ICON = 1
        LR_LOADFROMFILE = 0x00000010
        LR_DEFAULTSIZE = 0x00000040

        hicon_big = user32.LoadImageW(None, str(ico_path), IMAGE_ICON, 48, 48, LR_LOADFROMFILE)
        hicon_small = user32.LoadImageW(None, str(ico_path), IMAGE_ICON, 16, 16, LR_LOADFROMFILE)
        if not hicon_big:
            hicon_big = user32.LoadImageW(None, str(ico_path), IMAGE_ICON, 0, 0, LR_LOADFROMFILE | LR_DEFAULTSIZE)
        if not hicon_small:
            hicon_small = hicon_big

        SW_MAXIMIZE = 3
        maximized = False
        for _ in range(50):
            time.sleep(0.3)
            def enum_cb(hwnd, extra):
                nonlocal maximized
                if user32.IsWindowVisible(hwnd):
                    length = user32.GetWindowTextLengthW(hwnd)
                    if length > 0:
                        buff_title = ctypes.create_unicode_buffer(length + 1)
                        user32.GetWindowTextW(hwnd, buff_title, length + 1)
                        title = buff_title.value

                        buff_cls = ctypes.create_unicode_buffer(256)
                        user32.GetClassNameW(hwnd, buff_cls, 256)
                        cls = buff_cls.value

                        if "SREDA AI" in title:
                            if hicon_big:
                                user32.SendMessageW(hwnd, WM_SETICON, ICON_BIG, hicon_big)
                            if hicon_small:
                                user32.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, hicon_small)

                            # ONLY maximize and focus the browser workstation window
                            # Never maximize the backend console/terminal
                            is_console = "[Console]" in title or "Console" in title or cls in [
                                "ConsoleWindowClass", "CASCADIA_HOSTING_WINDOW_CLASS", "PseudoConsoleWindow"
                            ]
                            is_browser = not is_console and (
                                "Chrome_WidgetWin_1" in cls or "Multimodal Workstation" in title or "Workstation" in title
                            )

                            if is_browser and not maximized:
                                user32.ShowWindow(hwnd, SW_MAXIMIZE)
                                user32.SetForegroundWindow(hwnd)
                                maximized = True
                                try:
                                    kernel32 = ctypes.windll.kernel32
                                    con_hwnd = kernel32.GetConsoleWindow()
                                    if con_hwnd:
                                        user32.ShowWindow(con_hwnd, 6)
                                except Exception:
                                    pass
                return True

            WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
            user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
            if maximized:
                break
    except Exception:
        pass

def main():
    print("=" * 64)
    print("        SREDA AI v9.0-beta — Multimodal Workstation")
    print("     Cross-Platform: AMD / NVIDIA / Intel • Windows 10/11")
    print("=" * 64)
    print()

    cleanup_stale_processes()
    ensure_desktop_shortcut()

    # 1. Start FastAPI Backend
    print("[*] Запуск серверного ядра SREDA AI v9.0-beta (FastAPI + Uvicorn)...")
    server_cmd = [
        sys.executable,
        "-m", "uvicorn",
        "backend.main:app",
        "--host", "127.0.0.1",
        "--port", "8000"
    ]
    server_proc = subprocess.Popen(
        server_cmd,
        cwd=str(BASE_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    )

    # Check if process died immediately
    time.sleep(0.6)
    if server_proc.poll() is not None:
        print(f"[!] Ошибка: Сервер не смог запуститься (код выхода: {server_proc.poll()}).")
        input("\nНажмите Enter для выхода...")
        sys.exit(1)

    # 2. Wait for backend to be ready
    print("[*] Ожидание готовности сервера...")
    import requests
    ready = False
    for _ in range(30):
        try:
            res = requests.get("http://127.0.0.1:8000/api/system", timeout=1)
            if res.status_code == 200:
                ready = True
                break
        except Exception:
            time.sleep(0.3)

    if not ready:
        print("[!] Ошибка: Сервер не отвечает на порту 8000.")
        if server_proc:
            server_proc.terminate()
        input("\nНажмите Enter для выхода...")
        sys.exit(1)

    print("[✓] Ядро SREDA AI v9.0-beta активно на http://127.0.0.1:8000")

    # 3. Launch UI Window
    edge_exe = find_edge()
    launched_in_app = False

    if edge_exe:
        print("[*] Запуск рабочей станции в окне приложения...")
        try:
            edge_cmd = [
                edge_exe,
                "--window-size=1800,1020",
                "--window-position=30,20",
                "--start-maximized",
                "--app=http://127.0.0.1:8000"
            ]
            subprocess.Popen(edge_cmd)
            launched_in_app = True
            threading.Thread(target=apply_window_branding, daemon=True).start()
        except Exception as e:
            print(f"[!] Не удалось запустить через App Mode: {e}")

    if not launched_in_app:
        print("[*] Запуск в браузере по умолчанию...")
        import webbrowser
        webbrowser.open("http://127.0.0.1:8000")

    print()
    print("[✓] SREDA AI v9.0-beta успешно запущена!")
    print("[*] Рабочая станция открыта на http://127.0.0.1:8000")
    print("[*] Не закрывайте это окно консоли во время работы со SREDA AI.")
    print("[*] Для завершения работы нажмите Ctrl+C в этом окне.")
    print()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        print("\n[*] Завершение работы и освобождение ресурсов RAM/VRAM...")
        if server_proc:
            try:
                server_proc.terminate()
                server_proc.wait(timeout=2)
            except Exception:
                try:
                    server_proc.kill()
                except Exception:
                    pass

        # Also ensure llama-server is stopped
        try:
            subprocess.run(
                ["powershell.exe", "-NoProfile", "-Command", "Get-Process llama-server -ErrorAction SilentlyContinue | Stop-Process -Force"],
                capture_output=True,
                timeout=3
            )
        except Exception:
            pass

        print("[✓] Все процессы успешно остановлены.")

if __name__ == "__main__":
    main()
