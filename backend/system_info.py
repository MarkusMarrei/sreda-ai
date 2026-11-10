import ctypes
from ctypes import wintypes
import os
import platform
import subprocess

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

def get_memory_info():
    """Queries Windows 10/11 memory metrics via ctypes kernel32 with zero dependencies."""
    total_gb = 16.0
    avail_gb = 10.0
    load_percent = 50

    try:
        stat = MEMORYSTATUSEX()
        stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
            total_gb = round(stat.ullTotalPhys / (1024 ** 3), 2)
            avail_gb = round(stat.ullAvailPhys / (1024 ** 3), 2)
            load_percent = int(stat.dwMemoryLoad)
    except Exception:
        pass

    cores = os.cpu_count() or 8
    
    # Universal GPU info check across AMD, NVIDIA, and Intel
    gpu_name = "Auto-detected GPU (Vulkan / DirectML)"
    try:
        # PowerShell CIM query compatible with Windows 10 & 11
        cmd = 'powershell.exe -NoProfile -Command "$gpus = Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch \'Virtual|Remote|Basic|VNC\' } | Select-Object -ExpandProperty Name; if ($gpus) { $gpus -join \'; \' } else { (Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name) -join \'; \' }"'
        out = subprocess.check_output(cmd, shell=True, timeout=3).decode('cp1251', errors='ignore').strip()
        if out:
            gpu_name = out
    except Exception:
        pass

    return {
        "total_ram_gb": total_gb,
        "available_ram_gb": avail_gb,
        "memory_load_percent": load_percent,
        "logical_cores": cores,
        "gpu_name": gpu_name,
        "platform": f"{platform.system()} {platform.release()}"
    }

if __name__ == "__main__":
    print(get_memory_info())
