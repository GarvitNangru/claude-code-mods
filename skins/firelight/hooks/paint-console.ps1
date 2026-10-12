$ErrorActionPreference = 'Stop'
$sequence = [Console]::In.ReadToEnd()

Add-Type -Namespace Firelight -Name Console -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern bool FreeConsole();
[DllImport("kernel32.dll")] public static extern bool AttachConsole(int pid);
[DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr CreateFile(string name, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
[DllImport("kernel32.dll")] public static extern bool GetConsoleMode(IntPtr handle, out uint mode);
[DllImport("kernel32.dll")] public static extern bool SetConsoleMode(IntPtr handle, uint mode);
[DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern bool WriteConsole(IntPtr handle, string text, int length, out int written, IntPtr reserved);
[DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
'@

[void][Firelight.Console]::FreeConsole()
if (-not [Firelight.Console]::AttachConsole(-1)) { exit 2 }
$out = [Firelight.Console]::CreateFile('CONOUT$', [uint32]3221225472, 3, [IntPtr]::Zero, 3, 0, [IntPtr]::Zero)
if ($out -eq [IntPtr]-1) { exit 3 }
$mode = 0
[void][Firelight.Console]::GetConsoleMode($out, [ref]$mode)
[void][Firelight.Console]::SetConsoleMode($out, $mode -bor 4)
$written = 0
[void][Firelight.Console]::WriteConsole($out, $sequence, $sequence.Length, [ref]$written, [IntPtr]::Zero)
[void][Firelight.Console]::SetConsoleMode($out, $mode)
[void][Firelight.Console]::CloseHandle($out)
