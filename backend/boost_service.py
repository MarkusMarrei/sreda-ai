import ctypes
from ctypes import wintypes
import json
import logging
import os
import platform
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger("sreda.boost")

# Win32 Process Access Rights & Priority Constants
PROCESS_QUERY_INFORMATION = 0x0400
PROCESS_SET_INFORMATION = 0x0200
PROCESS_SET_QUOTA = 0x0100

HIGH_PRIORITY_CLASS = 0x00000080
ABOVE_NORMAL_PRIORITY_CLASS = 0x00008000
NORMAL_PRIORITY_CLASS = 0x00000020
BELOW_NORMAL_PRIORITY_CLASS = 0x00004000
IDLE_PRIORITY_CLASS = 0x00000040

class MEMORYSTATUSEX(ctypes.Structure):
    _fields_ = [
        ("dwLength", wintypes.DWORD),
        ("dwMemoryLoad", wintypes.DWORD),
        ("ullTotalPhys", ctypes.c_uint64),
        ("ullAvailPhys", ctypes.c_uint64),
        ("ullTotalPageFile", ctypes.c_uint64),
        ("ullAvailPageFile", ctypes.c_uint64),
        ("ullTotalVirtual", ctypes.c_uint64),
        ("ullAvailVirtual", ctypes.c_uint64),
        ("ullAvailExtendedVirtual", ctypes.c_uint64),
    ]

# Whitelist: System core, audio, display, AMD, NVIDIA, Intel GPU drivers, critical services
SYSTEM_WHITELIST: Set[str] = {
    "system", "registry", "smss.exe", "csrss.exe", "wininit.exe", "services.exe",
    "lsass.exe", "svchost.exe", "fontdrvhost.exe", "dwm.exe", "winlogon.exe",
    "spoolsv.exe", "explorer.exe", "sihost.exe", "taskhostw.exe", "ctfmon.exe",
    "audiodg.exe", "securityhealthservice.exe", "mpengine.dll", "msmpeng.exe",
    # AMD GPU & Chipset
    "amdfendrs.exe", "amdow.exe", "radeonsoftware.exe", "amdrsserv.exe", "amdfendrs64.exe",
    "atieclxx.exe", "atiesrxx.exe", "amdinstall.exe",
    # NVIDIA GPU & Display Driver
    "nvcontainer.exe", "nvdisplay.container.exe", "nvcplui.exe", "nvsphelper64.exe",
    "nvagent.exe", "nvidia-share.exe", "geforceexperience.exe",
    # Intel Graphics & Arc Control
    "igfxcuiservice.exe", "igfxem.exe", "igfxhk.exe", "igfxtray.exe",
    "intelcphs.exe", "oneapp.igc.winresourcestream.exe", "graphics-cpanel.exe", "arccontrol.exe"
}

DEFAULT_BOOST_CONFIG = {
    "auto_boost_on_launch": True,
    "throttle_background": True,
    "compact_ram_on_inference": True
}

class BoostService:
    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)
        self.config_dir = self.base_dir / "backend" / "config"
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.config_file = self.config_dir / "boost.json"
        self.config = self._load_config()

        self.is_boost_active = False
        self.boosted_engine_pid: Optional[int] = None
        self.throttled_pids: List[int] = []
        self.last_freed_ram_mb: float = 0.0
        self.last_boost_time: float = 0.0

        self.kernel32 = ctypes.windll.kernel32 if os.name == 'nt' else None
        self.psapi = ctypes.windll.psapi if os.name == 'nt' else None

    def _load_config(self) -> Dict[str, Any]:
        if self.config_file.exists():
            try:
                with open(self.config_file, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    for k, v in DEFAULT_BOOST_CONFIG.items():
                        if k not in cfg:
                            cfg[k] = v
                    return cfg
            except Exception as e:
                logger.warning(f"Could not load boost.json: {e}")
        return DEFAULT_BOOST_CONFIG.copy()

    def save_config(self, cfg: Dict[str, Any]) -> bool:
        try:
            self.config = cfg
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(cfg, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logger.error(f"Could not save boost.json: {e}")
            return False

    def get_memory_metrics(self) -> Dict[str, Any]:
        """Fetch real-time memory metrics via GlobalMemoryStatusEx."""
        total_mb = 16384.0
        avail_mb = 8192.0
        load_pct = 50

        if self.kernel32:
            try:
                stat = MEMORYSTATUSEX()
                stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
                if self.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                    total_mb = round(stat.ullTotalPhys / (1024 * 1024), 1)
                    avail_mb = round(stat.ullAvailPhys / (1024 * 1024), 1)
                    load_pct = int(stat.dwMemoryLoad)
            except Exception:
                pass

        return {
            "total_mb": total_mb,
            "total_gb": round(total_mb / 1024, 2),
            "avail_mb": avail_mb,
            "avail_gb": round(avail_mb / 1024, 2),
            "load_pct": load_pct
        }

    def _get_process_name(self, hProc) -> str:
        if not self.psapi:
            return ""
        name_buf = (ctypes.c_char * 260)()
        if self.psapi.GetProcessImageFileNameA(hProc, name_buf, 260):
            proc_path = name_buf.value.decode("utf-8", errors="ignore").lower()
            return proc_path.split("\\")[-1] if proc_path else ""
        return ""

    def compact_ram(self) -> Dict[str, Any]:
        """Safely flush inactive working set memory of background user processes."""
        if os.name != 'nt' or not self.kernel32 or not self.psapi:
            return {"success": False, "error": "Not supported on non-Windows OS"}

        t0 = time.time()
        mem_before = self.get_memory_metrics()

        max_pids = 4096
        pids_buffer = (wintypes.DWORD * max_pids)()
        bytes_returned = wintypes.DWORD()

        compacted_count = 0
        my_pid = os.getpid()

        # Build dynamic self whitelist
        self_whitelist = set(SYSTEM_WHITELIST)
        self_whitelist.add("msedge.exe")
        self_whitelist.add("llama-server.exe")

        if self.psapi.EnumProcesses(ctypes.byref(pids_buffer), ctypes.sizeof(pids_buffer), ctypes.byref(bytes_returned)):
            count = bytes_returned.value // ctypes.sizeof(wintypes.DWORD)
            for i in range(count):
                pid = pids_buffer[i]
                if pid <= 4 or pid == my_pid or pid == self.boosted_engine_pid:
                    continue

                hProc = self.kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_SET_QUOTA, False, pid)
                if not hProc:
                    continue

                try:
                    pname = self._get_process_name(hProc)
                    if pname and pname in self_whitelist:
                        continue

                    # Soft memory compaction (flushes cold cache, leaves process alive and intact)
                    if self.psapi.EmptyWorkingSet(hProc):
                        compacted_count += 1
                finally:
                    self.kernel32.CloseHandle(hProc)

        mem_after = self.get_memory_metrics()
        freed_mb = max(0.0, round(mem_after["avail_mb"] - mem_before["avail_mb"], 1))
        self.last_freed_ram_mb = freed_mb

        return {
            "success": True,
            "freed_ram_mb": freed_mb,
            "freed_mb": freed_mb,
            "freed_ram_gb": round(freed_mb / 1024, 2),
            "before_avail_gb": mem_before["avail_gb"],
            "after_avail_gb": mem_after["avail_gb"],
            "before_load_pct": mem_before["load_pct"],
            "after_load_pct": mem_after["load_pct"],
            "processes_compacted": compacted_count,
            "count": compacted_count,
            "duration_ms": round((time.time() - t0) * 1000, 1)
        }

    def elevate_engine_priority(self, pid: int) -> bool:
        """Assign HIGH_PRIORITY_CLASS to llama-server.exe for dedicated Zen 4 core allocation."""
        if os.name != 'nt' or not self.kernel32:
            return False

        hProc = self.kernel32.OpenProcess(PROCESS_SET_INFORMATION | PROCESS_QUERY_INFORMATION, False, pid)
        if not hProc:
            return False

        try:
            ok = self.kernel32.SetPriorityClass(hProc, HIGH_PRIORITY_CLASS)
            if ok:
                self.boosted_engine_pid = pid
                logger.info(f"Elevated engine process PID {pid} to HIGH_PRIORITY_CLASS")
                return True
        finally:
            self.kernel32.CloseHandle(hProc)
        return False

    def throttle_background_tasks(self) -> int:
        """Lower priority of heavy background user apps to BELOW_NORMAL_PRIORITY_CLASS."""
        if os.name != 'nt' or not self.kernel32 or not self.psapi:
            return 0

        max_pids = 4096
        pids_buffer = (wintypes.DWORD * max_pids)()
        bytes_returned = wintypes.DWORD()

        throttled = 0
        my_pid = os.getpid()
        self.throttled_pids.clear()

        # Known typical background applications that benefit from polite throttling during inference
        target_apps = {
            "telegram.exe", "discord.exe", "steam.exe", "epicgameslauncher.exe",
            "spotify.exe", "slack.exe", "utorrent.exe", "qbittorrent.exe", "viber.exe"
        }

        if self.psapi.EnumProcesses(ctypes.byref(pids_buffer), ctypes.sizeof(pids_buffer), ctypes.byref(bytes_returned)):
            count = bytes_returned.value // ctypes.sizeof(wintypes.DWORD)
            for i in range(count):
                pid = pids_buffer[i]
                if pid <= 4 or pid == my_pid or pid == self.boosted_engine_pid:
                    continue

                hProc = self.kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_SET_INFORMATION, False, pid)
                if not hProc:
                    continue

                try:
                    pname = self._get_process_name(hProc)
                    if pname and pname in target_apps:
                        if self.kernel32.SetPriorityClass(hProc, BELOW_NORMAL_PRIORITY_CLASS):
                            self.throttled_pids.append(pid)
                            throttled += 1
                finally:
                    self.kernel32.CloseHandle(hProc)

        return throttled

    def restore_background_tasks(self) -> int:
        """Restore all throttled processes back to NORMAL_PRIORITY_CLASS."""
        if os.name != 'nt' or not self.kernel32:
            return 0

        restored = 0
        for pid in self.throttled_pids:
            hProc = self.kernel32.OpenProcess(PROCESS_SET_INFORMATION, False, pid)
            if hProc:
                try:
                    if self.kernel32.SetPriorityClass(hProc, NORMAL_PRIORITY_CLASS):
                        restored += 1
                finally:
                    self.kernel32.CloseHandle(hProc)
        self.throttled_pids.clear()
        return restored

    def activate_boost(self, engine_pid: Optional[int] = None) -> Dict[str, Any]:
        """Full SREDA Boost activation sequence."""
        t0 = time.time()
        engine_boosted = False
        if engine_pid:
            engine_boosted = self.elevate_engine_priority(engine_pid)

        # Elevate current backend process to ABOVE_NORMAL
        my_pid = os.getpid()
        if self.kernel32:
            hMy = self.kernel32.OpenProcess(PROCESS_SET_INFORMATION, False, my_pid)
            if hMy:
                self.kernel32.SetPriorityClass(hMy, ABOVE_NORMAL_PRIORITY_CLASS)
                self.kernel32.CloseHandle(hMy)

        # Throttle background apps if enabled
        throttled_count = 0
        if self.config.get("throttle_background", True):
            throttled_count = self.throttle_background_tasks()

        # Compact RAM
        compact_res = {}
        if self.config.get("compact_ram_on_inference", True):
            compact_res = self.compact_ram()

        self.is_boost_active = True
        self.last_boost_time = time.time()

        return {
            "success": True,
            "status": "boost_active",
            "is_boost_active": True,
            "is_boosted": True,
            "engine_boosted": engine_boosted,
            "engine_pid": self.boosted_engine_pid,
            "throttled_count": throttled_count,
            "freed_ram_mb": compact_res.get("freed_ram_mb", 0.0),
            "freed_mb": compact_res.get("freed_ram_mb", 0.0),
            "freed_ram_gb": compact_res.get("freed_ram_gb", 0.0),
            "processes_compacted": compact_res.get("processes_compacted", 0),
            "count": compact_res.get("count", 0),
            "current_avail_gb": compact_res.get("after_avail_gb", self.get_memory_metrics()["avail_gb"]),
            "current_load_pct": compact_res.get("after_load_pct", self.get_memory_metrics()["load_pct"]),
            "duration_ms": round((time.time() - t0) * 1000, 1)
        }

    def deactivate_boost(self) -> Dict[str, Any]:
        """Deactivate SREDA Boost and restore normal OS scheduling."""
        restored_count = self.restore_background_tasks()

        # Reset engine process priority to NORMAL if it was boosted
        if self.boosted_engine_pid and self.kernel32:
            try:
                hEngine = self.kernel32.OpenProcess(PROCESS_SET_INFORMATION, False, self.boosted_engine_pid)
                if hEngine:
                    self.kernel32.SetPriorityClass(hEngine, NORMAL_PRIORITY_CLASS)
                    self.kernel32.CloseHandle(hEngine)
            except Exception:
                pass

        # Reset backend priority to NORMAL
        my_pid = os.getpid()
        if self.kernel32:
            try:
                hMy = self.kernel32.OpenProcess(PROCESS_SET_INFORMATION, False, my_pid)
                if hMy:
                    self.kernel32.SetPriorityClass(hMy, NORMAL_PRIORITY_CLASS)
                    self.kernel32.CloseHandle(hMy)
            except Exception:
                pass

        self.is_boost_active = False
        self.boosted_engine_pid = None

        return {
            "success": True,
            "status": "boost_idle",
            "is_boost_active": False,
            "is_boosted": False,
            "restored_count": restored_count,
            "current_memory": self.get_memory_metrics()
        }

    def get_status(self) -> Dict[str, Any]:
        mem = self.get_memory_metrics()
        return {
            "is_boost_active": self.is_boost_active,
            "is_boosted": self.is_boost_active,
            "auto_boost_on_launch": self.config.get("auto_boost_on_launch", True),
            "engine_pid": self.boosted_engine_pid,
            "last_freed_ram_mb": self.last_freed_ram_mb,
            "last_boost_time": self.last_boost_time,
            "throttled_processes": len(self.throttled_pids),
            "config": self.config,
            "memory": mem
        }
